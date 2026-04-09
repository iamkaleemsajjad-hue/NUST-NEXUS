/**
 * Generate SHA-256 hash of a file using Web Crypto API
 */
export async function hashFile(file) {
  // Read only the first 1MB of the file for lightning-fast verification
  const sliceSize = Math.min(file.size, 1024 * 1024);
  const buffer = await file.slice(0, sliceSize).arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Check if file hash already exists in database
 */
export async function isFileUnique(supabase, fileHash) {
  const { data, error } = await supabase
    .from('uploads')
    .select('id')
    .eq('file_hash', fileHash)
    .limit(1);
  
  // Fail closed: if we cannot verify uniqueness, do not allow upload (avoids duplicate storage)
  if (error) {
    console.error('Hash check error:', error);
    return false;
  }

  return !data || data.length === 0;
}
