/**
 * NUST NEXUS — Configuration
 *
 * SECURITY NOTES (OWASP):
 * - SUPABASE_ANON_KEY is a PUBLIC key (safe for client-side) — it only grants
 *   access permitted by Row Level Security (RLS) policies. This is by Supabase design.
 * - The SERVICE_ROLE key must NEVER appear in client code — it bypasses all RLS.
 * - Fallback values below are used for GitHub Pages static deploys where env vars
 *   are baked at build time via Vite. For local dev, use .env (gitignored).
 * - All data security relies on RLS policies, not key secrecy.
 */
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ebzfjxmdkrggwmpyhzna.supabase.co';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImViemZqeG1ka3JnZ3dtcHloem5hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NTI3OTMsImV4cCI6MjA5MDAyODc5M30.5nnP2yfmT83ARJFbAE8rkvfVEs6asKqLny2K2chWiuU';

// Points Configuration
export const POINTS = {
  UPLOAD_GENERAL: 5,
  UPLOAD_PROJECT: 50,
  DOWNLOAD_COST: 5,
  DOWNLOAD_PROJECT_COST: 50,
  UNIQUE_IDEA: 5,
  // Q&A System
  ANSWER_ACCEPTED: 5,          // points for having answer accepted
  ANSWER_UPVOTE_BONUS: 20,     // free 20 pts when answer gets first upvote (green tag)
  ASSESSMENT_FULFILL_BONUS: 5, // extra points on top of upload for fulfilling a request
};

// NUST Email Domains
export const VALID_DOMAINS = [
  'seecs.edu.pk',
  'smme.edu.pk',
  'scme.edu.pk',
  'scee.nust.edu.pk',
  'sada.nust.edu.pk',
  's3h.nust.edu.pk',
  'nbs.nust.edu.pk',
  'nbs.edu.pk',
  'asab.nust.edu.pk',
  'sns.nust.edu.pk',
  'nls.nust.edu.pk',
  'ceme.nust.edu.pk',
  'mcs.edu.pk',
  'mce.nust.edu.pk',
  'cae.nust.edu.pk',
  'pnec.nust.edu.pk',
  'igis.nust.edu.pk',
  'iese.nust.edu.pk',
  'nice.nust.edu.pk',
  'uspcase.nust.edu.pk',
  'nbc.nust.edu.pk',
  'nust.edu.pk',
  'student.nust.edu.pk',
];

// Admin notification email (set in .env — defaults to correct email for GitHub pages)
export const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || 'iamkaleemsajjad@gmail.com';

// Upload types
export const UPLOAD_TYPES = [
  { value: 'assignment', label: 'Assignment', icon: 'fa-file-lines' },
  { value: 'lab_report', label: 'Lab Report', icon: 'fa-flask' },
  { value: 'quiz', label: 'Quiz', icon: 'fa-question-circle' },
  { value: 'lecture_ppt', label: 'Lecture PPT', icon: 'fa-person-chalkboard' },
  { value: 'project', label: 'Semester Project', icon: 'fa-diagram-project' },
  { value: 'other', label: 'Other', icon: 'fa-file' },
];
