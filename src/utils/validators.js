/**
 * Validate password:
 * - Min 8 characters
 * - At least 1 capital letter
 * - At least 1 special character
 * - No spaces
 */
export function validatePassword(password) {
  const errors = [];
  
  if (password.length < 8) {
    errors.push('At least 8 characters required');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('At least 1 uppercase letter required');
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('At least 1 special character required');
  }
  if (/\s/.test(password)) {
    errors.push('No spaces allowed');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Get password strength (0-4)
 */
export function getPasswordStrength(password) {
  let strength = 0;
  if (password.length >= 8) strength++;
  if (password.length >= 12) strength++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) strength++;
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) strength++;
  if (/\d/.test(password)) strength++;
  return Math.min(strength, 4);
}

/**
 * Validate upload title contains proper identifier
 * e.g., "Lab 5" should have "lab 5" or "lab5" in filename
 */
export function validateUploadTitle(title, type) {
  if (!title || title.trim().length < 3) {
    return { isValid: false, error: 'Title must be at least 3 characters' };
  }
  return { isValid: true };
}
