/**
 * NEVIN NEXUS — Storj S3-Compatible Storage Client
 * Uploads files via Supabase Edge Function proxy to keep credentials server-side
 */

import { supabase } from './supabase.js';

const STORJ_ENDPOINT = import.meta.env.VITE_STORJ_ENDPOINT || 'https://gateway.storjshare.io';
const STORJ_BUCKET = import.meta.env.VITE_STORJ_BUCKET || 'nust-nexus-uploads';

/**
 * Upload a file to Storj via Supabase Edge Function
 * @param {string} path - Object key/path in the bucket (e.g., 'uploads/uuid/filename.pdf')
 * @param {File} file - The File object to upload
 * @returns {Promise<{ url: string, error: Error|null }>}
 */
export async function uploadToStorj(path, file) {
  try {
    // Get current session for auth
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { url: null, error: new Error('Not authenticated') };
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('path', path);

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/storj-upload`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { url: null, error: new Error(errorData.error || `Upload failed (${response.status})`) };
    }

    const result = await response.json();
    return { url: result.url, error: null };
  } catch (err) {
    return { url: null, error: err };
  }
}

/**
 * Get the public URL for a file stored on Storj
 * @param {string} path - Object key/path
 * @returns {string}
 */
export function getStorjPublicUrl(path) {
  return `${STORJ_ENDPOINT}/${STORJ_BUCKET}/${path}`;
}

/**
 * Delete a file from Storj via Edge Function
 * @param {string} path - Object key to delete
 * @returns {Promise<{ success: boolean, error: Error|null }>}
 */
export async function deleteFromStorj(path) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { success: false, error: new Error('Not authenticated') };
    }

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/storj-delete`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { success: false, error: new Error(errorData.error || `Delete failed (${response.status})`) };
    }

    return { success: true, error: null };
  } catch (err) {
    return { success: false, error: err };
  }
}
