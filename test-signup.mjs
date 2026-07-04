/**
 * Local smoke test only. Run: node --env-file=.env test-signup.mjs
 * Requires: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, TEST_PASSWORD
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const TEST_PASSWORD = process.env.TEST_PASSWORD;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY || !TEST_PASSWORD) {
  console.error('Missing env: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, TEST_PASSWORD');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function run() {
  const email = `testuser_${Date.now()}@test.com`;
  console.log(`Signing up ${email}...`);
  const { data, error } = await supabase.auth.signUp({
    email,
    password: TEST_PASSWORD,
  });
  if (error) console.error(error.message);
  else console.log(data.user.id);
}
run();
