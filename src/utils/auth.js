import { supabase } from './supabase.js';
import { ADMIN_EMAIL } from '../config.js';
import { parseNustEmail } from './email-parser.js';

/**
 * Get current authenticated user
 */
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/**
 * Get user profile from our profiles table
 */
export async function getUserProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  
  if (error) {
    console.error('Profile fetch error:', error);
    return null;
  }
  return data;
}

/**
 * Sign up with email (sends OTP)
 */
export async function signUpWithEmail(email) {
  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
    }
  });
  return { data, error };
}

/**
 * Verify OTP
 */
export async function verifyOTP(email, token) {
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  });
  return { data, error };
}

/**
 * Sign in with email and password
 */
export async function signInWithPassword(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
}

/**
 * Update user password
 */
export async function updatePassword(password) {
  const { data, error } = await supabase.auth.updateUser({
    password,
  });
  return { data, error };
}

/**
 * Sign out
 */
export async function signOut() {
  await supabase.auth.signOut();
}

/**
 * Update user profile
 */
export async function updateProfile(userId, updates) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();
  return { data, error };
}

/**
 * Record login history
 */
export async function recordLogin(userId) {
  await supabase.from('login_history').insert({
    user_id: userId,
    user_agent: navigator.userAgent,
    ip_address: 'client',
  });
}

/**
 * Get login history
 */
export async function getLoginHistory(userId, limit = 10) {
  const { data } = await supabase
    .from('login_history')
    .select('*')
    .eq('user_id', userId)
    .order('login_at', { ascending: false })
    .limit(limit);
  return data || [];
}

/**
 * Check if user is admin
 */
export async function isAdmin(userId) {
  const profile = await getUserProfile(userId);
  return profile?.role === 'admin';
}

/**
 * Complete onboarding - set name, password, parse email data
 */
export async function completeOnboarding(userId, email, displayName, password) {
  // Parse email to get school, degree, year
  const parsed = parseNustEmail(email);
  
  // Update password
  const { error: pwError } = await updatePassword(password);
  if (pwError) return { error: pwError };
  
  // Update profile
  const { data, error } = await updateProfile(userId, {
    display_name: displayName,
    school: parsed.school,
    degree: parsed.degree,
    admission_year: parsed.year,
    onboarding_complete: true,
    terms_accepted: true,
  });
  
  return { data, error };
}
