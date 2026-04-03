// Supabase Configuration
export const SUPABASE_URL = 'https://ebzfjxmdkrggwmpyhzna.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImViemZqeG1ka3JnZ3dtcHloem5hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NTI3OTMsImV4cCI6MjA5MDAyODc5M30.5nnP2yfmT83ARJFbAE8rkvfVEs6asKqLny2K2chWiuU';

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

// Admin credentials
export const ADMIN_EMAIL = 'iamkaleemsajjad@gmail.com';

// Upload types
export const UPLOAD_TYPES = [
  { value: 'assignment', label: 'Assignment', icon: 'fa-file-lines' },
  { value: 'lab_report', label: 'Lab Report', icon: 'fa-flask' },
  { value: 'quiz', label: 'Quiz', icon: 'fa-question-circle' },
  { value: 'lecture_ppt', label: 'Lecture PPT', icon: 'fa-presentation-screen' },
  { value: 'project', label: 'Semester Project', icon: 'fa-diagram-project' },
  { value: 'other', label: 'Other', icon: 'fa-file' },
];
