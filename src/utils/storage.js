/**
 * NUST NEXUS — Supabase Storage Client
 * Uploads, downloads, and deletes files using native Supabase Storage.
 * Uses the supabase-js client which handles auth and CORS automatically.
 */

import { supabase } from './supabase.js';

const BUCKET = 'uploads';

/**
 * Upload a file to Supabase Storage with progress simulation.
 * Uses the native supabase-js client for reliable CORS handling.
 * Progress is simulated based on file size since fetch doesn't support upload progress.
 * @param {string} path - Object key/path in the bucket
 * @param {File} file - The File object to upload
 * @param {function} [onProgress] - Callback: (percent: number) => void
 * @returns {Promise<{ url: string|null, error: Error|null }>}
 */
export async function uploadFile(path, file, onProgress) {
  try {
    // Start simulated progress
    let progressInterval = null;
    let currentProgress = 0;

    if (onProgress) {
      // Simulate progress based on estimated upload time
      // Small files (<1MB): fast progress, Large files: slower
      const fileSizeMB = file.size / (1024 * 1024);
      const intervalMs = fileSizeMB < 1 ? 100 : fileSizeMB < 5 ? 200 : 300;
      const increment = fileSizeMB < 1 ? 8 : fileSizeMB < 5 ? 4 : 2;

      progressInterval = setInterval(() => {
        if (currentProgress < 85) {
          currentProgress += increment + Math.random() * 3;
          if (currentProgress > 85) currentProgress = 85;
          onProgress(Math.round(currentProgress));
        }
      }, intervalMs);
    }

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || 'application/octet-stream',
      });

    // Stop simulated progress
    if (progressInterval) clearInterval(progressInterval);

    if (error) {
      if (onProgress) onProgress(0);
      return { url: null, error };
    }

    // Jump to 95% while we get the public URL
    if (onProgress) onProgress(95);

    // Get the public URL for the uploaded file
    const { data: urlData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(data.path);

    // Complete
    if (onProgress) onProgress(100);

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
