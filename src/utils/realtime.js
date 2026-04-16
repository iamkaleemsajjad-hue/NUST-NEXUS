/**
 * NEVIN NEXUS — Supabase Realtime Subscription Manager
 * Centralized real-time subscription handling with auto-cleanup.
 */

import { supabase } from './supabase.js';

/** @type {Map<string, import('@supabase/supabase-js').RealtimeChannel>} */
const activeChannels = new Map();

/**
 * Subscribe to INSERT/UPDATE/DELETE on a Postgres table via Realtime.
 *
 * @param {string} channelName  – Unique key for this subscription
 * @param {string} table        – Table name in `public` schema
 * @param {string|null} filter  – Optional Postgres filter, e.g. "status=eq.pending"
 * @param {(payload: object) => void} callback – Called on any change
 * @returns {import('@supabase/supabase-js').RealtimeChannel}
 */
export function subscribeToTable(channelName, table, filter, callback) {
  // Avoid duplicate subscriptions
  if (activeChannels.has(channelName)) {
    return activeChannels.get(channelName);
  }

  const opts = { event: '*', schema: 'public', table };
  if (filter) opts.filter = filter;

  const channel = supabase
    .channel(channelName)
    .on('postgres_changes', opts, (payload) => {
      try { callback(payload); } catch (e) { console.error('[realtime] callback error:', e); }
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`[realtime] ✓ ${channelName}`);
      }
    });

  activeChannels.set(channelName, channel);
  return channel;
}

/**
 * Unsubscribe from a specific channel.
 * @param {string} channelName
 */
export function unsubscribe(channelName) {
  const channel = activeChannels.get(channelName);
  if (channel) {
    supabase.removeChannel(channel);
    activeChannels.delete(channelName);
  }
}

/**
 * Unsubscribe from ALL active channels.
 * Call this on route change to prevent subscription leaks.
 */
export function unsubscribeAll() {
  for (const [name, channel] of activeChannels) {
    supabase.removeChannel(channel);
  }
  activeChannels.clear();
}
