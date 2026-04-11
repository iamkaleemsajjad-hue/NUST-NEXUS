/**
 * NUST NEXUS — File Hashing Utility
 * SHA-256 hashing via Web Crypto API for duplicate detection.
 */

/**
 * Generate a SHA-256 hex hash of a File object.
 * @param {File} file
 * @returns {Promise<string>}
 */
export async function hashFile(file) {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Check whether a file with the given hash already exists in the uploads table.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} fileHash
 * @returns {Promise<boolean>} true if no duplicate exists
 */
export async function isFileUnique(supabase, fileHash) {
  const { data, error } = await supabase
    .from('uploads')
    .select('id')
    .eq('file_hash', fileHash)
    .limit(1);

  if (error) {
    console.error('Hash check error:', error);
    return true; // Allow on error
  }

  return !data || data.length === 0;
}
