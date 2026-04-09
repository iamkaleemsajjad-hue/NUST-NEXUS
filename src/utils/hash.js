/**
 * Generate SHA-256 hash of a file using Web Crypto API
 * Hashes the FULL file for accurate duplicate detection
 */
export async function hashFile(file) {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Check if file hash already exists in database
 * @returns {{ isUnique: boolean, existingTitle: string|null }}
 */
export async function isFileUnique(supabase, fileHash) {
  const { data, error } = await supabase
    .from('uploads')
    .select('id, title, status')
    .eq('file_hash', fileHash)
    .limit(1);
  
  // Fail closed: if we cannot verify uniqueness, block the upload
  if (error) {
    console.error('Hash check error:', error);
    return { isUnique: false, existingTitle: null, status: null };
  }

  if (data && data.length > 0) {
    return {
      isUnique: false,
      existingTitle: data[0].title,
      status: data[0].status,
    };
  }

  return { isUnique: true, existingTitle: null, status: null };
}
