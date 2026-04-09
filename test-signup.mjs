import { createClient } from '@supabase/supabase-js';

import fs from 'fs';
const configContent = fs.readFileSync('./src/config.js', 'utf8');
const anonKeyMatch = configContent.match(/export const SUPABASE_ANON_KEY = '(.+?)';/);
if (!anonKeyMatch) throw new Error('Key not found');

const supabase = createClient('https://ebzfjxmdkrggwmpyhzna.supabase.co', anonKeyMatch[1]);

async function run() {
  const email = `testuser_${Date.now()}@test.com`;
  console.log(`Signing up ${email}...`);
  const { data, error } = await supabase.auth.signUp({
    email,
    password: 'Password123!',
  });
  if (error) console.error(error.message);
  else console.log(data.user.id);
}
run();
