/**
 * NUST NEXUS — Supabase Storage Client
 * Uploads, downloads, and deletes files using native Supabase Storage.
 * Includes XMLHttpRequest-based upload with progress tracking.
 */

import { supabase } from './supabase.js';
import { SUPABASE_URL } from '../config.js';

const BUCKET = 'uploads';

/**
 * Upload a file to Supabase Storage with progress callback.
 * Uses XMLHttpRequest for real-time progress tracking.
 * @param {string} path - Object key/path in the bucket
 * @param {File} file - The File object to upload
 * @param {function} [onProgress] - Callback: (percent: number) => void
 * @returns {Promise<{ url: string|null, error: Error|null }>}
 */
export async function uploadFile(path, file, onProgress) {
  try {
    // Get current session token
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { url: null, error: new Error('Not authenticated. Please log in again.') };
    }

    const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`;

    return await new Promise((resolve) => {
      const xhr = new XMLHttpRequest();

      // Track upload progress
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          const percent = Math.round((e.loaded / e.total) * 100);
          onProgress(percent);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          // Build the public URL
          const { data: urlData } = supabase.storage
            .from(BUCKET)
            .getPublicUrl(path);
          resolve({ url: urlData.publicUrl, error: null });
        } else {
          let errMsg = `Upload failed (${xhr.status})`;
          try {
            const resp = JSON.parse(xhr.responseText);
            errMsg = resp.error || resp.message || errMsg;
          } catch (_) {}
          resolve({ url: null, error: new Error(errMsg) });
        }
      });

      xhr.addEventListener('error', () => {
        resolve({ url: null, error: new Error('Network error during upload') });
      });

      xhr.addEventListener('abort', () => {
        resolve({ url: null, error: new Error('Upload cancelled') });
      });

      xhr.open('POST', url);
      xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`);
      xhr.setRequestHeader('x-upsert', 'false');
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      xhr.send(file);
    });
  } catch (err) {
    return { url: null, error: err };
  }
}

/**
 * Get the public URL for a file stored in Supabase Storage
 * @param {string} path - Object key/path
 * @returns {string}
 */
export function getPublicUrl(path) {
  const { data } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Delete a file from Supabase Storage
 * @param {string} path - Object key to delete
 * @returns {Promise<{ success: boolean, error: Error|null }>}
 */
export async function deleteFile(path) {
  try {
    const { error } = await supabase.storage
      .from(BUCKET)
      .remove([path]);

    if (error) {
      return { success: false, error };
    }

    return { success: true, error: null };
  } catch (err) {
    return { success: false, error: err };
  }
}
