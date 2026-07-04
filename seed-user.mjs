/**
 * Admin seeder — run locally ONLY.
 * Usage: node --env-file=.env seed-user.mjs
 * Required in .env: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, SEED_EMAIL, SEED_PASSWORD
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const SEED_EMAIL = process.env.SEED_EMAIL;
const SEED_PASSWORD = process.env.SEED_PASSWORD;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY || !SEED_EMAIL || !SEED_PASSWORD) {
  console.error('Missing env vars. Required: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, SEED_EMAIL, SEED_PASSWORD');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function seed() {
  console.log('Signing up admin...');
  const { data, error } = await supabase.auth.signUp({
    email: SEED_EMAIL,
    password: SEED_PASSWORD,
  });

  if (error) {
    console.error('Error:', error.message);
  } else {
    console.log('Success:', data.user.id);
  }
}

seed();
