// Supabase Configuration (from environment variables — set in .env file)
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    '[NUST NEXUS] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.',
    'Ensure your .env file exists and contains these variables.',
    'For production builds, set them as GitHub Secrets.'
  );
}

// Storj S3 Configuration
// Note: Secret keys (STORJ_ACCESS_KEY, STORJ_SECRET_KEY) are managed
// server-side via Supabase Edge Function secrets — never exposed to the browser.
export const STORJ_CONFIG = {
  endpoint: import.meta.env.VITE_STORJ_ENDPOINT || 'https://gateway.storjshare.io',
  bucket: import.meta.env.VITE_STORJ_BUCKET || 'nust-nexus-uploads',
};

// Points Configuration
export const POINTS = {
  UPLOAD_GENERAL: 5,
  UPLOAD_PROJECT: 50,
  DOWNLOAD_COST: 5,
  DOWNLOAD_PROJECT_COST: 30,
  UNIQUE_IDEA: 5,
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
  'nust.edu.pk',
  'student.nust.edu.pk',
];

// Admin notification email (set in .env)
export const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL;

// Upload types
export const UPLOAD_TYPES = [
  { value: 'assignment', label: 'Assignment', icon: 'fa-file-lines' },
  { value: 'lab_report', label: 'Lab Report', icon: 'fa-flask' },
  { value: 'quiz', label: 'Quiz', icon: 'fa-question-circle' },
  { value: 'lecture_ppt', label: 'Lecture PPT', icon: 'fa-presentation-screen' },
  { value: 'project', label: 'Semester Project', icon: 'fa-diagram-project' },
  { value: 'other', label: 'Other', icon: 'fa-file' },
];
