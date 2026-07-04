/**
 * SCHOLAR NEXUS — Configuration
 *
 * SECURITY NOTES (OWASP):
 * - SUPABASE_PUBLISHABLE_KEY is safe for client-side use — it only grants
 *   access permitted by Row Level Security (RLS) policies. This is by Supabase design.
 * - The secret key must NEVER appear in client code — it bypasses all RLS.
 * - All values are loaded from environment variables. For local dev, use .env (gitignored).
 *   For GitHub Pages deploys, set secrets in GitHub Actions (Settings → Secrets).
 * - All data security relies on RLS policies, not key secrecy.
 */
const _url = import.meta.env.VITE_SUPABASE_URL;
const _key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!_url) throw new Error('Missing env var: VITE_SUPABASE_URL — set it in .env or GitHub Actions secrets.');
if (!_key) throw new Error('Missing env var: VITE_SUPABASE_PUBLISHABLE_KEY — set it in .env or GitHub Actions secrets.');
export const SUPABASE_URL = _url;
export const SUPABASE_PUBLISHABLE_KEY = _key;

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

// University Email Domains
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

// Admin notification email — must be set via VITE_ADMIN_EMAIL in .env or GitHub Actions secrets
const _adminEmail = import.meta.env.VITE_ADMIN_EMAIL;
if (!_adminEmail) throw new Error('Missing env var: VITE_ADMIN_EMAIL — set it in .env or GitHub Actions secrets.');
export const ADMIN_EMAIL = _adminEmail;

// Upload types
export const UPLOAD_TYPES = [
  { value: 'assignment', label: 'Assignment', icon: 'fa-file-lines' },
  { value: 'lab_report', label: 'Lab Report', icon: 'fa-flask' },
  { value: 'quiz', label: 'Quiz', icon: 'fa-question-circle' },
  { value: 'lecture_ppt', label: 'Lecture PPT', icon: 'fa-person-chalkboard' },
  { value: 'project', label: 'Semester Project', icon: 'fa-diagram-project' },
  { value: 'other', label: 'Other', icon: 'fa-file' },
];
