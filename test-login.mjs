import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ebzfjxmdkrggwmpyhzna.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImViemZqeG1ka3JnZ3dtcHloem5hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NTI3OTMsImV4cCI6MjA5MDAyODc5M30.5nnP2yfmT83ARJFbAE8rkvfVEs6asKqLny2K2chWiuU';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testLogin() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'msajjad.bscs25seecs@seecs.edu.pk',
    password: 'Student123.',
  });

  if (error) {
    console.error("Login Failed:", error.message);
  } else {
    console.log("Login Success! User ID:", data.user.id);
  }
}

testLogin();
