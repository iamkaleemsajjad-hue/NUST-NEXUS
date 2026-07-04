/**
 * Local smoke test only. Run: node --env-file=.env test-login.mjs
 * Requires: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, TEST_EMAIL, TEST_PASSWORD
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const email = process.env.TEST_EMAIL;
const password = process.env.TEST_PASSWORD;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY || !email || !password) {
  console.error('Missing env: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, TEST_EMAIL, TEST_PASSWORD');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const { data, error } = await supabase.auth.signInWithPassword({ email, password });

if (error) {
  console.error('Login failed:', error.message);
  process.exit(1);
}
console.log('Login OK, user:', data.user?.id);
