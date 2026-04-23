/**
 * SCHOLAR NEXUS — Input Sanitization & Validation Module
 * OWASP-aligned: prevents XSS, enforces length limits, strips HTML
 */

/**
 * Strip HTML tags from text
 */
export function stripHtml(text) {
  if (typeof text !== 'string') return '';
  return text.replace(/<[^>]*>/g, '');
}

/**
 * Escape HTML entities to prevent XSS when rendering user content
 */
export function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return str.replace(/[&<>"']/g, (c) => map[c]);
}

/**
 * Sanitize a text field — strips HTML, trims, enforces max length
 * @param {string} text - Raw input
 * @param {number} maxLength - Max allowed length (default 500)
 * @returns {string} Sanitized text
 */
export function sanitizeText(text, maxLength = 500) {
  if (typeof text !== 'string') return '';
  return stripHtml(text).trim().substring(0, maxLength);
}

/**
 * Sanitize and validate an email address
 * @param {string} email
 * @returns {{ valid: boolean, email: string }}
 */
export function sanitizeEmail(email) {
  if (typeof email !== 'string') return { valid: false, email: '' };
  const cleaned = email.trim().toLowerCase();
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return {
    valid: emailRegex.test(cleaned) && cleaned.length <= 254,
    email: cleaned,
  };
}

/**
 * Schema-based validation for objects
 * 
 * Schema format:
 * {
 *   fieldName: {
 *     type: 'string' | 'number' | 'boolean',
 *     required: true/false,
 *     maxLength: number (for strings),
 *     min: number (for numbers),
 *     max: number (for numbers),
 *     enum: ['val1', 'val2'] (allowed values),
 *   }
 * }
 * 
 * @param {object} obj - Object to validate
 * @param {object} schema - Schema definition
 * @returns {{ isValid: boolean, errors: string[] }}
 */
/**
 * Build a plain object with only allowed keys (drops unexpected fields — OWASP input hardening)
 * @param {object} obj
 * @param {string[]} allowedKeys
 */
export function pickAllowedFields(obj, allowedKeys) {
  const out = {};
  if (!obj || typeof obj !== 'object') return out;
  for (const k of allowedKeys) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) out[k] = obj[k];
  }
  return out;
}

/**
 * @param {object} obj
 * @param {string[]} allowedKeys
 * @returns {{ ok: boolean, extra: string[] }}
 */
export function rejectExtraFields(obj, allowedKeys) {
  if (!obj || typeof obj !== 'object') return { ok: true, extra: [] };
  const allow = new Set(allowedKeys);
  const extra = Object.keys(obj).filter((k) => !allow.has(k));
  return { ok: extra.length === 0, extra };
}

export function validateFields(obj, schema) {
  const errors = [];

  for (const [field, rules] of Object.entries(schema)) {
    const value = obj[field];

    // Required check
    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push(`${field} is required`);
      continue;
    }

    // Skip optional empty fields
    if (value === undefined || value === null || value === '') continue;

    // Type check
    if (rules.type === 'string' && typeof value !== 'string') {
      errors.push(`${field} must be a string`);
      continue;
    }
    if (rules.type === 'number' && typeof value !== 'number') {
      errors.push(`${field} must be a number`);
      continue;
    }
    if (rules.type === 'boolean' && typeof value !== 'boolean') {
      errors.push(`${field} must be a boolean`);
      continue;
    }

    // String length check
    if (rules.type === 'string' && rules.maxLength && value.length > rules.maxLength) {
      errors.push(`${field} must be ${rules.maxLength} characters or less`);
    }

    // Number range checks
    if (rules.type === 'number') {
      if (rules.min !== undefined && value < rules.min) {
        errors.push(`${field} must be at least ${rules.min}`);
      }
      if (rules.max !== undefined && value > rules.max) {
        errors.push(`${field} must be at most ${rules.max}`);
      }
    }

    // Enum check
    if (rules.enum && !rules.enum.includes(value)) {
      errors.push(`${field} must be one of: ${rules.enum.join(', ')}`);
    }
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Rate limit check using localStorage
 * @param {string} action - Action identifier (e.g., 'login', 'upload', 'feedback')
 * @param {number} maxAttempts - Max attempts allowed in the window
 * @param {number} windowMs - Time window in milliseconds (default: 60000 = 1 minute)
 * @returns {{ allowed: boolean, remainingMs: number, attempts: number }}
 */
export function checkRateLimit(action, maxAttempts = 5, windowMs = 60000) {
  const key = `rl_${action}`;
  const now = Date.now();

  try {
    const stored = JSON.parse(localStorage.getItem(key) || '[]');
    // Filter out expired entries
    const recent = stored.filter((ts) => now - ts < windowMs);

    if (recent.length >= maxAttempts) {
      const oldestInWindow = Math.min(...recent);
      const remainingMs = windowMs - (now - oldestInWindow);
      return { allowed: false, remainingMs, attempts: recent.length };
    }

    // Add current attempt
    recent.push(now);
    localStorage.setItem(key, JSON.stringify(recent));
    return { allowed: true, remainingMs: 0, attempts: recent.length };
  } catch {
    // If localStorage fails, allow the action
    return { allowed: true, remainingMs: 0, attempts: 0 };
  }
}
