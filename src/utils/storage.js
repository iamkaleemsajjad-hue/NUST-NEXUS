/**
 * NUST NEXUS — Supabase Storage Client
 * Clean, reliable file upload/download/delete via native Supabase Storage.
 */

import { supabase } from './supabase.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';

const BUCKET = 'uploads';

/**
 * Upload a file directly to Supabase Storage.
 * Uses XMLHttpRequest under the hood to bypass fetch streaming bugs and provide real upload progress tracking.
 *
 * @param {string} path  – Storage key, e.g. "userId/1712345678-report.pdf"
 * @param {File}   file  – The browser File object
 * @param {Function} onProgress – Optional callback(number % 0-100)
 */
export async function uploadFile(path, file, onProgress) {
  try {
    console.log('[uploadFile] Starting XHR upload for', path, 'Type:', file.type, 'Size:', file.size);
    if (onProgress) onProgress(0);

    let token = SUPABASE_ANON_KEY; // Fallback
    try {
      // Bypass supabase.auth.getSession() lock bugs by synchronously grabbing from storage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes('-auth-token')) {
          const stored = JSON.parse(localStorage.getItem(key));
          if (stored?.access_token) {
            token = stored.access_token;
            break;
          }
        }
      }
    } catch(e) {
      console.warn('[uploadFile] Could not get session token:', e);
    }

    const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`;

    return await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          const percentComplete = (event.loaded / event.total) * 100;
          onProgress(percentComplete);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          console.log('[uploadFile] XHR Upload successful', xhr.status);
          const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
          resolve({ url: urlData.publicUrl, error: null });
        } else {
          console.error('[uploadFile] XHR Upload failed', xhr.status, xhr.responseText);
          resolve({ url: null, error: new Error(`Upload failed (${xhr.status}): ${xhr.responseText}`) });
        }
      };

      xhr.onerror = () => {
        console.error('[uploadFile] XHR Network error');
        resolve({ url: null, error: new Error('Network error occurred during upload. Check your connection or firewall.') });
      };

      xhr.onabort = () => {
        console.warn('[uploadFile] XHR Upload aborted');
        resolve({ url: null, error: new Error('Upload was aborted.') });
      };
      
      xhr.ontimeout = () => {
        console.warn('[uploadFile] XHR Upload timed out');
        resolve({ url: null, error: new Error('Upload timed out after 30 seconds.') });
      }

      xhr.open('POST', uploadUrl, true);
      xhr.timeout = 30000; // 30 seconds timeout
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.setRequestHeader('apikey', SUPABASE_ANON_KEY);
      xhr.setRequestHeader('Cache-Control', '3600');
      // x-upsert header tells supabase storage whether to overwrite existing object
      xhr.setRequestHeader('x-upsert', 'false');
      
      if (file.type) {
        xhr.setRequestHeader('Content-Type', file.type);
      } else {
        xhr.setRequestHeader('Content-Type', 'application/octet-stream');
      }

      xhr.send(file);
    });

  } catch (err) {
    console.error('[uploadFile] Catch error:', err);
    return { url: null, error: err };
  }
}

/**
 * Get the public URL for a stored object.
 * @param {string} path
 * @returns {string}
 */
export function getPublicUrl(path) {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Delete a file from Supabase Storage.
 * @param {string} path
 * @returns {Promise<{ success: boolean, error: Error|null }>}
 */
export async function deleteFile(path) {
  try {
    const { error } = await supabase.storage.from(BUCKET).remove([path]);
    return error ? { success: false, error } : { success: true, error: null };
  } catch (err) {
    return { success: false, error: err };
  }
}
