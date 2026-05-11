/**
 * SCHOLAR NEXUS — Browser-Side Cache Utility
 *
 * Provides TTL-based in-memory caching to prevent redundant Supabase API calls.
 * Data is cached in memory for the lifetime of the page and optionally backed
 * by sessionStorage so it survives SPA navigations within the same tab.
 *
 * Usage:
 *   import { getCached, setCache, bustCache } from '../utils/cache.js';
 *
 *   const cached = getCached('teachers_list');
 *   if (cached) { render(cached); return; }
 *   const fresh = await supabase.from('teachers')...;
 *   setCache('teachers_list', fresh, 300000); // 5 min TTL
 */

// In-memory store (fastest, survives SPA navigations)
const _memoryCache = new Map();

// Default TTL: 5 minutes
const DEFAULT_TTL_MS = 5 * 60 * 1000;

/**
 * Get a cached value. Returns null if expired or missing.
 * @param {string} key
 * @returns {any|null}
 */
export function getCached(key) {
  // Try memory first
  const mem = _memoryCache.get(key);
  if (mem && Date.now() < mem.expiresAt) {
    return mem.data;
  }

  // Memory miss — try sessionStorage
  try {
    const raw = sessionStorage.getItem(`sn_cache_${key}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Date.now() < parsed.expiresAt) {
        // Promote back to memory for speed
        _memoryCache.set(key, parsed);
        return parsed.data;
      }
      // Expired — clean up
      sessionStorage.removeItem(`sn_cache_${key}`);
    }
  } catch (e) {
    // sessionStorage may be unavailable (private browsing edge cases)
  }

  // Miss or expired
  _memoryCache.delete(key);
  return null;
}

/**
 * Store a value in cache with a TTL.
 * @param {string} key
 * @param {any} data
 * @param {number} ttlMs - Time-to-live in milliseconds (default 5 min)
 */
export function setCache(key, data, ttlMs = DEFAULT_TTL_MS) {
  const entry = {
    data,
    expiresAt: Date.now() + ttlMs,
    cachedAt: Date.now(),
  };

  _memoryCache.set(key, entry);

  // Also persist to sessionStorage for SPA navigation survival
  try {
    sessionStorage.setItem(`sn_cache_${key}`, JSON.stringify(entry));
  } catch (e) {
    // Quota exceeded or unavailable — memory cache still works
  }
}

/**
 * Check if a cache entry exists and is still valid.
 * @param {string} key
 * @returns {boolean}
 */
export function isCacheValid(key) {
  return getCached(key) !== null;
}

/**
 * Bust (invalidate) cache entries.
 * @param {string} keyOrPrefix - Exact key, or 'all' to clear everything.
 *   If the key doesn't match exactly, it's treated as a prefix and all
 *   keys starting with it are removed.
 */
export function bustCache(keyOrPrefix) {
  if (keyOrPrefix === 'all') {
    _memoryCache.clear();
    try {
      const keysToRemove = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith('sn_cache_')) keysToRemove.push(k);
      }
      keysToRemove.forEach(k => sessionStorage.removeItem(k));
    } catch (e) { /* ignore */ }
    return;
  }

  // Exact match
  if (_memoryCache.has(keyOrPrefix)) {
    _memoryCache.delete(keyOrPrefix);
    try { sessionStorage.removeItem(`sn_cache_${keyOrPrefix}`); } catch (e) { /* ignore */ }
    return;
  }

  // Prefix match — bust all keys starting with this prefix
  const toDelete = [];
  for (const k of _memoryCache.keys()) {
    if (k.startsWith(keyOrPrefix)) toDelete.push(k);
  }
  toDelete.forEach(k => {
    _memoryCache.delete(k);
    try { sessionStorage.removeItem(`sn_cache_${k}`); } catch (e) { /* ignore */ }
  });
}

/**
 * Get cache age in milliseconds (how long ago the data was cached).
 * Returns Infinity if not cached.
 * @param {string} key
 * @returns {number}
 */
export function getCacheAge(key) {
  const mem = _memoryCache.get(key);
  if (mem && Date.now() < mem.expiresAt) {
    return Date.now() - mem.cachedAt;
  }
  return Infinity;
}
