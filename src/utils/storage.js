/**
 * NUST NEXUS — Supabase Storage Client
 * Uploads, downloads, and deletes files using native Supabase Storage.
 * No Edge Functions needed — the Supabase JS client handles auth automatically.
 */

import { supabase } from './supabase.js';

const BUCKET = 'uploads';

/**
 * Upload a file to Supabase Storage
 * @param {string} path - Object key/path in the bucket (e.g., 'uploads/uuid/filename.pdf')
 * @param {File} file - The File object to upload
 * @returns {Promise<{ url: string|null, error: Error|null }>}
 */
export async function uploadFile(path, file) {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || 'application/octet-stream',
      });

    if (error) {
      return { url: null, error };
    }

    // Get the public URL for the uploaded file
    const { data: urlData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(data.path);

    return { url: urlData.publicUrl, error: null };
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
