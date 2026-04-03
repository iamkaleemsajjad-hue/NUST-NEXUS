import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ebzfjxmdkrggwmpyhzna.supabase.co';
// Need the anon key from config.js
import fs from 'fs';
const configContent = fs.readFileSync('./src/config.js', 'utf8');
const anonKeyMatch = configContent.match(/export const SUPABASE_ANON_KEY = '(.+?)';/);
if (!anonKeyMatch) throw new Error('Key not found');
const SUPABASE_ANON_KEY = anonKeyMatch[1];

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function seed() {
  console.log('Signing up admin...');
  const { data, error } = await supabase.auth.signUp({
    email: 'iamkaleemsajjad@gmail.com',
    password: 'Kalim20052008.133173',
  });
  
  if (error) {
    console.error('Error:', error.message);
  } else {
    console.log('Success:', data.user.id);
  }
}

seed();
