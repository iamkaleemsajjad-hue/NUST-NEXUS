/**
 * NEVIN NEXUS — Upload Page
 * Completely rebuilt upload system with direct Supabase Storage integration.
 * Features: step wizard, drag & drop, real-time progress, duplicate detection.
 */

import { getCurrentUser, getUserProfile } from '../utils/auth.js';
import { calculateSemester } from '../utils/semester.js';
import { hashFile, isFileUnique } from '../utils/hash.js';
import { uploadFile } from '../utils/storage.js';
import { renderSidebar, initSidebar } from '../components/sidebar.js';
import { renderHeader, initHeader, setBreadcrumb } from '../components/header.js';
import { showToast } from '../components/toast.js';
import { supabase } from '../utils/supabase.js';
import { router } from '../router.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, POINTS, UPLOAD_TYPES } from '../config.js';
import { sanitizeText, validateFields, pickAllowedFields, checkRateLimit } from '../utils/sanitize.js';
import gsap from 'gsap';

/* ── State ─────────────────────────────────────────────── */
let currentStep = 1;
let uploadData = {};
let isUploading = false;

/* ── Page Renderer ─────────────────────────────────────── */
export async function renderUploadPage() {
  const app = document.getElementById('app');
  const user = await getCurrentUser();
  if (!user) { router.navigate('/login'); return; }
  const profile = await getUserProfile(user.id);
  if (!profile) { router.navigate('/login'); return; }
  const semester = calculateSemester(profile.admission_year);

  // Reset state
  currentStep = 1;
  isUploading = false;
  uploadData = { userSemester: semester, school: profile.school, degree: profile.degree };

  app.innerHTML = `
    <div class="app-layout">
      ${renderSidebar(profile)}
      <div class="main-content">
        ${renderHeader(profile)}
        <div class="page-container">

          <!-- Page Title -->
          <div class="upload-page-header">
            <div class="upload-page-title">
              <div class="upload-title-icon">
                <i class="fa-solid fa-cloud-arrow-up"></i>
                <div class="upload-title-icon-ring"></div>
              </div>
              <div>
                <h2>Upload Resources</h2>
                <p class="upload-subtitle">Share study materials and earn points for the community</p>
              </div>
            </div>
            <div class="upload-points-hint">
              <i class="fa-solid fa-coins"></i>
              <span>Earn <strong>+5</strong> to <strong>+50</strong> pts per upload</span>
            </div>
          </div>

          <!-- Wizard Steps -->
          <div class="wizard-steps" id="wizard-steps">
            <div class="wizard-step active" data-step="1">
              <div class="step-number">1</div>
              <span class="step-label">Semester</span>
            </div>
            <div class="wizard-step" data-step="2">
              <div class="step-number">2</div>
              <span class="step-label">Course</span>
            </div>
            <div class="wizard-step" data-step="3">
              <div class="step-number">3</div>
              <span class="step-label">Professor</span>
            </div>
            <div class="wizard-step" data-step="4">
              <div class="step-number">4</div>
              <span class="step-label">Type</span>
            </div>
            <div class="wizard-step" data-step="5">
              <div class="step-number">5</div>
              <span class="step-label">Upload</span>
            </div>
          </div>

          <!-- Wizard Card -->
          <div class="card upload-wizard-card" id="upload-wizard">

            <!-- Step 1: Semester -->
            <div class="wizard-content" id="step-1">
              <div class="step-header">
                <div class="step-header-icon"><i class="fa-solid fa-calendar-alt"></i></div>
                <div>
                  <h3>Select Semester</h3>
                  <p class="form-helper">Choose which semester's content you want to upload</p>
                </div>
              </div>
              <div class="semester-grid" id="semester-grid"></div>
            </div>

            <!-- Step 2: Course -->
            <div class="wizard-content" id="step-2" style="display:none;">
              <div class="step-header">
                <div class="step-header-icon"><i class="fa-solid fa-book"></i></div>
                <div>
                  <h3>Select Course</h3>
                  <p class="form-helper">Pick the course this resource belongs to</p>
                </div>
              </div>
              <button class="btn btn-ghost btn-sm step-back-btn" id="back-to-1"><i class="fa-solid fa-arrow-left"></i> Back</button>
              <div id="course-list" class="selection-grid"></div>
            </div>

            <!-- Step 3: Professor -->
            <div class="wizard-content" id="step-3" style="display:none;">
              <div class="step-header">
                <div class="step-header-icon"><i class="fa-solid fa-chalkboard-user"></i></div>
                <div>
                  <h3>Select Professor</h3>
                  <p class="form-helper">Choose the professor for this course (optional)</p>
                </div>
              </div>
              <button class="btn btn-ghost btn-sm step-back-btn" id="back-to-2"><i class="fa-solid fa-arrow-left"></i> Back</button>
              <div style="margin:var(--space-md) 0;">
                <div style="position:relative;">
                  <i class="fa-solid fa-search" style="position:absolute;left:14px;top:50%;transform:translateY(-50%);color:var(--text-muted);"></i>
                  <input type="text" class="form-input" id="professor-search" placeholder="Search professors by name..." style="padding-left:40px;" />
                </div>
              </div>
              <div id="professor-list" class="selection-grid"></div>
            </div>

            <!-- Step 4: Type -->
            <div class="wizard-content" id="step-4" style="display:none;">
              <div class="step-header">
                <div class="step-header-icon"><i class="fa-solid fa-tags"></i></div>
                <div>
                  <h3>What are you uploading?</h3>
                  <p class="form-helper">Select the type of resource</p>
                </div>
              </div>
              <button class="btn btn-ghost btn-sm step-back-btn" id="back-to-3"><i class="fa-solid fa-arrow-left"></i> Back</button>
              <div class="type-grid" id="type-grid"></div>
            </div>

            <!-- Step 5: File Upload -->
            <div class="wizard-content" id="step-5" style="display:none;">
              <div class="step-header">
                <div class="step-header-icon"><i class="fa-solid fa-file-arrow-up"></i></div>
                <div>
                  <h3>Upload Your File</h3>
                  <p class="form-helper">Give it a title, pick your file, and submit</p>
                </div>
              </div>
              <button class="btn btn-ghost btn-sm step-back-btn" id="back-to-4"><i class="fa-solid fa-arrow-left"></i> Back</button>

              <!-- Title Input -->
              <div class="form-group" style="margin-top: var(--space-lg);">
                <label class="form-label" for="upload-title">Title / Name</label>
                <div class="input-with-icon">
                  <i class="fa-solid fa-heading"></i>
                  <input type="text" class="form-input" id="upload-title"
                    placeholder="e.g. Lab 5 — Data Structures" required />
                </div>
                <div class="form-helper">Include the specific identifier (e.g., Lab 5, Assignment 3)</div>
              </div>

              <!-- Drop Zone -->
              <div class="upload-dropzone" id="file-drop-zone">
                <div class="dropzone-illustration">
                  <div class="dropzone-circle">
                    <i class="fa-solid fa-cloud-arrow-up"></i>
                  </div>
                  <div class="dropzone-particles">
                    <span></span><span></span><span></span><span></span><span></span>
                  </div>
                </div>
                <p class="dropzone-title">Drag & drop your file here</p>
                <p class="dropzone-sub">or <span class="dropzone-browse">click to browse</span></p>
                <input type="file" id="file-input" style="display:none;" />
                <div class="dropzone-constraints">
                  <span><i class="fa-solid fa-check-circle"></i> PDF, DOCX, PPTX, images</span>
                  <span><i class="fa-solid fa-ban"></i> No ZIP/RAR files</span>
                  <span><i class="fa-solid fa-weight-hanging"></i> Max 50 MB</span>
                </div>
              </div>

              <!-- File Preview (hidden until file selected) -->
              <div id="file-preview" class="upload-file-preview" style="display:none;">
                <div class="file-preview-info">
                  <div class="file-preview-icon" id="file-type-icon">
                    <i class="fa-solid fa-file"></i>
                  </div>
                  <div class="file-preview-details">
                    <span class="file-preview-name" id="file-name"></span>
                    <span class="file-preview-size" id="file-size"></span>
                  </div>
                </div>
                <button class="btn btn-ghost btn-sm" id="remove-file" title="Remove file">
                  <i class="fa-solid fa-xmark"></i>
                </button>
              </div>

              <!-- Progress Bar (hidden until upload starts) -->
              <div id="upload-progress" class="upload-progress" style="display:none;">
                <div class="upload-progress-info">
                  <span id="upload-progress-label">Uploading...</span>
                  <span id="upload-progress-percent">0%</span>
                </div>
                <div class="upload-progress-track">
                  <div class="upload-progress-bar" id="upload-progress-bar"></div>
                </div>
                <p class="upload-progress-status" id="upload-status-text">Preparing upload...</p>
              </div>

              <!-- Submit Button -->
              <button class="btn btn-primary btn-block btn-lg" id="submit-upload" style="margin-top:var(--space-xl);" disabled>
                <i class="fa-solid fa-rocket"></i> Upload & Submit
              </button>
            </div>
          </div>

          <!-- Recent Uploads -->
          <div id="upload-status-section" style="margin-top:var(--space-2xl);"></div>
        </div>
      </div>
    </div>
  `;

  initSidebar();
  initHeader(profile);
  setBreadcrumb('Upload Resources');
  initUploadWizard(profile);
  loadUserUploads(user.id);

  // Entrance animations
  gsap.fromTo('.upload-page-header', { y: -20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out' });
  gsap.fromTo('.wizard-steps', { y: -10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, delay: 0.15, ease: 'power2.out' });
  gsap.fromTo('.upload-wizard-card', { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, delay: 0.25, ease: 'power3.out' });
  gsap.fromTo('.selection-btn', { y: 15, opacity: 0, scale: 0.9 }, { y: 0, opacity: 1, scale: 1, duration: 0.3, stagger: 0.04, delay: 0.35, ease: 'back.out(1.4)' });
}

/* ── Wizard Initialization ─────────────────────────────── */
function initUploadWizard(profile) {

  // Step 1: Semester Grid
  const semGrid = document.getElementById('semester-grid');
  for (let i = 1; i <= 8; i++) {
    const btn = document.createElement('button');
    btn.className = 'selection-btn';
    btn.innerHTML = `<span class="selection-number">${i}</span><span>Semester ${i}</span>`;
    btn.addEventListener('click', () => {
      uploadData.semester = i;
      goToStep(2);
      loadCourses(profile);
    });
    semGrid.appendChild(btn);
  }

  // Step 4: Type Grid
  const typeGrid = document.getElementById('type-grid');
  UPLOAD_TYPES.forEach(t => {
    const btn = document.createElement('button');
    btn.className = 'selection-btn type-btn';
    const pts = t.value === 'project' ? POINTS.UPLOAD_PROJECT : POINTS.UPLOAD_GENERAL;
    const badgeClass = t.value === 'project' ? 'badge-warning' : 'badge-primary';
    btn.innerHTML = `
      <i class="fa-solid ${t.icon}"></i>
      <span>${t.label}</span>
      <span class="badge ${badgeClass}" style="margin-top:4px;">+${pts} pts</span>
    `;
    btn.addEventListener('click', () => {
      uploadData.type = t.value;
      goToStep(5);
    });
    typeGrid.appendChild(btn);
  });

  // File handling
  setupFileHandling();

  // Back buttons
  document.getElementById('back-to-1')?.addEventListener('click', () => goToStep(1));
  document.getElementById('back-to-2')?.addEventListener('click', () => goToStep(2));
  document.getElementById('back-to-3')?.addEventListener('click', () => goToStep(3));
  document.getElementById('back-to-4')?.addEventListener('click', () => goToStep(4));

  // Submit
  document.getElementById('submit-upload')?.addEventListener('click', () => submitUpload(profile));
}

/* ── File Handling ─────────────────────────────────────── */
function setupFileHandling() {
  const dropZone = document.getElementById('file-drop-zone');
  const fileInput = document.getElementById('file-input');

  dropZone.addEventListener('click', () => fileInput.click());

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  });

  document.getElementById('remove-file')?.addEventListener('click', clearFile);
}

function handleFile(file) {
  if (!file) return;

  // Block archives
  const blockedExts = ['.zip', '.rar', '.7z', '.tar', '.gz'];
  if (blockedExts.some(ext => file.name.toLowerCase().endsWith(ext))) {
    showToast('Archive files are not allowed. Please upload files individually.', 'error');
    return;
  }

  // 50 MB limit
  if (file.size > 50 * 1024 * 1024) {
    showToast('File is too large. Maximum size is 50 MB.', 'error');
    return;
  }

  uploadData.file = file;

  // Show preview, hide dropzone
  document.getElementById('file-drop-zone').style.display = 'none';
  const preview = document.getElementById('file-preview');
  preview.style.display = 'flex';

  // Set icon based on type
  const iconEl = document.getElementById('file-type-icon');
  iconEl.innerHTML = `<i class="fa-solid ${getFileIcon(file.name)}"></i>`;

  document.getElementById('file-name').textContent = file.name;
  document.getElementById('file-size').textContent = formatFileSize(file.size);
  document.getElementById('submit-upload').disabled = false;

  // Animate in
  gsap.fromTo(preview, { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: 'power2.out' });
}

function clearFile() {
  uploadData.file = null;
  document.getElementById('file-preview').style.display = 'none';
  document.getElementById('file-drop-zone').style.display = 'flex';
  document.getElementById('submit-upload').disabled = true;
  document.getElementById('file-input').value = '';

  // also hide progress
  document.getElementById('upload-progress').style.display = 'none';
}

/* ── Courses & Professors ──────────────────────────────── */
async function loadCourses(profile) {
  const container = document.getElementById('course-list');
  // Skeleton loading grid
  container.innerHTML = Array(6).fill('').map(() => `
    <div class="selection-btn" style="pointer-events:none;">
      <div class="skeleton skeleton-text" style="width:60%;margin:0 auto;"></div>
      <div class="skeleton skeleton-text" style="width:80%;margin:6px auto 0;"></div>
    </div>
  `).join('');

  const { data: school } = await supabase
    .from('schools').select('id').eq('name', profile.school).single();
  if (!school) {
    container.innerHTML = '<p>No courses found for your school.</p>';
    return;
  }

  const { data: courses } = await supabase
    .from('courses')
    .select('*')
    .eq('school_id', school.id)
    .eq('semester', uploadData.semester)
    .order('code');

  if (!courses || courses.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-book"></i>
        <h4>No courses found</h4>
        <p>No courses for this semester in your department</p>
      </div>`;
    return;
  }

  container.innerHTML = courses.map(c => `
    <button class="selection-btn course-btn" data-id="${c.id}">
      <span class="selection-code">${c.code}</span>
      <span>${c.name}</span>
    </button>
  `).join('');

  // Animate course cards in
  gsap.fromTo('.course-btn', { y: 12, opacity: 0, scale: 0.95 }, { y: 0, opacity: 1, scale: 1, duration: 0.3, stagger: 0.04, ease: 'back.out(1.3)' });

  container.querySelectorAll('.course-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      uploadData.courseId = btn.dataset.id;
      goToStep(3);
      loadProfessors();
    });
  });
}

async function loadProfessors(searchQuery) {
  const container = document.getElementById('professor-list');
  // Skeleton loading
  container.innerHTML = Array(8).fill('').map(() => `
    <div class="selection-btn" style="pointer-events:none;">
      <div class="skeleton skeleton-avatar" style="width:48px;height:48px;margin:0 auto 8px;"></div>
      <div class="skeleton skeleton-text" style="width:70%;margin:0 auto;"></div>
      <div class="skeleton skeleton-text" style="width:50%;margin:4px auto 0;"></div>
    </div>
  `).join('');

  // Get user's school
  const { data: profileRow } = await supabase
    .from('profiles').select('school').eq('id', (await getCurrentUser()).id).single();
  const { data: school } = await supabase
    .from('schools').select('id').eq('name', profileRow.school).single();
  
  let query = supabase.from('teachers').select('*').eq('school_id', school?.id).order('name');
  if (searchQuery) query = query.ilike('name', `%${searchQuery}%`);
  const { data: allTeachers } = await query;

  const teacherList = allTeachers || [];

  if (teacherList.length === 0 && !searchQuery) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-chalkboard-user"></i>
        <h4>No professors found</h4>
        <p>Professors will be added by admin</p>
      </div>
      <button class="btn btn-secondary btn-block" id="skip-professor">Skip & Continue</button>
    `;
    document.getElementById('skip-professor')?.addEventListener('click', () => {
      uploadData.teacherId = null;
      goToStep(4);
    });
    return;
  }

  if (teacherList.length === 0 && searchQuery) {
    container.innerHTML = `
      <div class="empty-state" style="padding:var(--space-xl);">
        <i class="fa-solid fa-user-slash"></i>
        <p style="color:var(--text-muted);">No professors matching "${searchQuery}"</p>
      </div>
      <button class="btn btn-ghost btn-block" id="skip-professor" style="margin-top:12px;">Skip Professor</button>
    `;
    document.getElementById('skip-professor')?.addEventListener('click', () => {
      uploadData.teacherId = null;
      goToStep(4);
    });
    return;
  }

  container.innerHTML = teacherList.map(t => {
    const initials = t.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    const avatarHtml = t.avatar_url
      ? `<img src="${t.avatar_url}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;border:2px solid var(--border);" alt="${t.name}" />`
      : `<div class="avatar avatar-placeholder" style="width:48px;height:48px;font-size:0.85rem;margin:0 auto;">${initials}</div>`;
    return `
      <button class="selection-btn professor-btn" data-id="${t.id}" style="flex-direction:column;align-items:center;text-align:center;gap:6px;">
        ${avatarHtml}
        <span style="font-weight:600;">${t.name}</span>
        <span class="selection-sub" style="font-size:0.75rem;color:var(--text-muted);">${t.designation}</span>
      </button>
    `;
  }).join('') + `
    <button class="btn btn-ghost btn-block" id="skip-professor" style="margin-top:12px;">
      Skip Professor
    </button>
  `;

  // Animate cards in
  gsap.fromTo('.professor-btn', { y: 15, opacity: 0, scale: 0.95 }, { y: 0, opacity: 1, scale: 1, duration: 0.35, stagger: 0.04, ease: 'back.out(1.4)' });

  container.querySelectorAll('.professor-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      uploadData.teacherId = btn.dataset.id;
      goToStep(4);
    });
  });

  document.getElementById('skip-professor')?.addEventListener('click', () => {
    uploadData.teacherId = null;
    goToStep(4);
  });

  // Wire up search with debounce
  const searchInput = document.getElementById('professor-search');
  if (searchInput && !searchInput._hasListener) {
    searchInput._hasListener = true;
    let timer;
    searchInput.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => loadProfessors(searchInput.value.trim()), 300);
    });
  }
}

/* ── Upload Submission ─────────────────────────────────── */
async function submitUpload(profile) {
  if (isUploading) return;

  // ── OWASP: Rate limiting — max 3 uploads per 10 minutes ──
  const rl = checkRateLimit('upload_submit', 3, 600000);
  if (!rl.allowed) {
    showToast(`Too many uploads. Please wait ${Math.ceil(rl.remainingMs / 1000)}s`, 'error');
    return;
  }

  const btn = document.getElementById('submit-upload');
  const rawTitle = document.getElementById('upload-title').value;
  // ── OWASP: Sanitize + length-limit title ──
  const title = sanitizeText(rawTitle, 200);

  if (!title) { showToast('Please enter a title', 'warning'); return; }
  if (!uploadData.file) { showToast('Please select a file', 'warning'); return; }

  // ── OWASP: Schema-based validation of upload data ──
  const { isValid, errors } = validateFields(
    { title, type: uploadData.type, courseId: uploadData.courseId, semester: uploadData.semester },
    {
      title:    { type: 'string', required: true, maxLength: 200 },
      type:     { type: 'string', required: true, enum: UPLOAD_TYPES.map(t => t.value) },
      courseId: { type: 'string', required: true },
      semester: { type: 'number', required: true, min: 1, max: 12 },
    }
  );
  if (!isValid) { showToast(errors[0], 'error'); return; }

  isUploading = true;
  btn.disabled = true;

  // Show progress UI
  const progressEl = document.getElementById('upload-progress');
  progressEl.style.display = 'block';
  gsap.fromTo(progressEl, { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3 });

  updateProgress(5, 'Checking for duplicates...');

  try {
    // ─── Step A: Duplicate check ────────────────────────
    const fileHash = await hashFile(uploadData.file);
    updateProgress(15, 'Verifying file uniqueness...');

    const unique = await isFileUnique(supabase, fileHash);
    if (!unique) {
      showToast('This exact file has already been uploaded by another user.', 'error');
      resetUploadUI(btn);
      return;
    }

    updateProgress(25, 'Uploading to cloud storage...');

    // ─── Step B: Upload file to Supabase Storage ────────
    const filePath = `${profile.id}/${Date.now()}-${sanitizeFileName(uploadData.file.name)}`;

    // Start a simulated progress animation while upload is in progress
    // Use real XHR progress tracking from uploadFile instead of fake interval
    const { url, error: uploadError } = await uploadFile(filePath, uploadData.file, (percent) => {
      // Progress from 0 to 80% for the upload phase
      const scaledProgress = Math.round(percent * 0.8);
      updateProgress(scaledProgress, `Uploading to cloud storage... ${Math.round(percent)}%`);
    });

    if (uploadError) {
      showToast('Upload failed: ' + uploadError.message, 'error');
      resetUploadUI(btn);
      return;
    }

    updateProgress(85, 'Saving upload record...');

    // Extract auth token synchronously to bypass supabase-js library locks
    const sToken = localStorage.getItem('sb-ebzfjxmdkrggwmpyhzna-auth-token') || localStorage.getItem('supabase.auth.token');
    const tokenData = sToken ? JSON.parse(sToken) : null;
    const accessToken = tokenData?.currentSession?.access_token || tokenData?.access_token;
    
    if (!accessToken) {
      throw new Error('Authentication token missing. Please log in again.');
    }

    const headers = {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };

    // ─── Step C: Save to database (auto-approved, no admin review) ──
    const isProject = uploadData.type === 'project';
    const pointsAwarded = isProject ? POINTS.UPLOAD_PROJECT : POINTS.UPLOAD_GENERAL;

    // ── OWASP: Build payload with only allowed fields (reject extras) ──
    const rawPayload = {
      user_id: profile.id,
      course_id: uploadData.courseId,
      teacher_id: uploadData.teacherId || null,
      semester: uploadData.semester,
      type: uploadData.type,
      title,
      file_url: url,
      file_hash: fileHash,
      file_size: uploadData.file.size,
      status: 'approved',
      points_awarded: pointsAwarded,
      reviewed_at: new Date().toISOString(),
    };
    const payload = pickAllowedFields(rawPayload, [
      'user_id', 'course_id', 'teacher_id', 'semester', 'type',
      'title', 'file_url', 'file_hash', 'file_size', 'status',
      'points_awarded', 'reviewed_at'
    ]);

    const uploadRes = await fetch(`${SUPABASE_URL}/rest/v1/uploads`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      showToast('Upload record failed: ' + errText, 'error');
      resetUploadUI(btn);
      return;
    }

    const uploadRecords = await uploadRes.json();
    const upload = uploadRecords[0];

    updateProgress(92, 'Logging activity...');

    // ─── Step D: Audit log ──────────────────────────────
    await fetch(`${SUPABASE_URL}/rest/v1/audit_logs`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        user_id: profile.id,
        upload_id: upload.id,
        action: 'uploaded',
      })
    });

    // ─── Step E: Award points for all uploads ───────────
    await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${profile.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ points: (profile.points || 0) + pointsAwarded })
    });

    // ─── Done! ──────────────────────────────────────────
    updateProgress(100, 'Upload complete!');

    // Make progress bar green
    const bar = document.getElementById('upload-progress-bar');
    bar.classList.add('upload-progress-bar-success');

    showToast(`Upload approved! +${pointsAwarded} points awarded!`, 'success');

    // Reset after a short delay
    setTimeout(() => {
      currentStep = 1;
      isUploading = false;
      renderUploadPage();
    }, 1800);

  } catch (err) {
    if (typeof simInterval !== 'undefined') clearInterval(simInterval);
    console.error('Upload error:', err);
    showToast('Failed: ' + (err.message || 'Unknown error'), 'error');
    resetUploadUI(btn);
  }
}

/* ── UI Helpers ────────────────────────────────────────── */
function updateProgress(percent, label) {
  const bar = document.getElementById('upload-progress-bar');
  const percentEl = document.getElementById('upload-progress-percent');
  const labelEl = document.getElementById('upload-progress-label');
  const statusEl = document.getElementById('upload-status-text');

  if (bar) bar.style.width = percent + '%';
  if (percentEl) percentEl.textContent = percent + '%';
  if (labelEl) labelEl.textContent = label;
  if (statusEl) statusEl.textContent = label;
}

function resetUploadUI(btn) {
  isUploading = false;
  btn.disabled = false;
  btn.innerHTML = '<i class="fa-solid fa-rocket"></i> Upload & Submit';
  document.getElementById('upload-progress').style.display = 'none';

  const bar = document.getElementById('upload-progress-bar');
  if (bar) {
    bar.style.width = '0%';
    bar.classList.remove('upload-progress-bar-success');
  }
}

function goToStep(step) {
  const prev = document.getElementById(`step-${currentStep}`);
  const next = document.getElementById(`step-${step}`);

  // Update wizard indicator
  document.querySelectorAll('.wizard-step').forEach(ws => {
    const s = parseInt(ws.dataset.step);
    ws.classList.remove('active', 'completed');
    if (s < step) ws.classList.add('completed');
    if (s === step) ws.classList.add('active');
  });

  if (prev) prev.style.display = 'none';
  if (next) {
    next.style.display = 'block';
    gsap.fromTo(next, { x: step > currentStep ? 30 : -30, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.4, ease: 'power3.out' });
  }
  currentStep = step;
}

function getFileIcon(filename) {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const iconMap = {
    pdf: 'fa-file-pdf',
    doc: 'fa-file-word', docx: 'fa-file-word',
    ppt: 'fa-file-powerpoint', pptx: 'fa-file-powerpoint',
    xls: 'fa-file-excel', xlsx: 'fa-file-excel',
    jpg: 'fa-file-image', jpeg: 'fa-file-image', png: 'fa-file-image', gif: 'fa-file-image', webp: 'fa-file-image',
    py: 'fa-file-code', js: 'fa-file-code', html: 'fa-file-code', css: 'fa-file-code', cpp: 'fa-file-code', c: 'fa-file-code', java: 'fa-file-code',
    txt: 'fa-file-lines', csv: 'fa-file-csv',
  };
  return iconMap[ext] || 'fa-file';
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function sanitizeFileName(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/* ── Recent Uploads ────────────────────────────────────── */
async function loadUserUploads(userId) {
  const container = document.getElementById('upload-status-section');
  const { data } = await supabase
    .from('uploads')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (!data || data.length === 0) return;

  container.innerHTML = `
    <div class="recent-uploads-header">
      <h3><i class="fa-solid fa-list-check"></i> Your Recent Uploads</h3>
      <span class="recent-uploads-count">${data.length} files</span>
    </div>
    <div class="recent-uploads-grid">
      ${data.map(u => {
        const statusClass = u.status === 'approved' ? 'success' : u.status === 'rejected' ? 'danger' : 'warning';
        const statusIcon = u.status === 'approved' ? 'fa-circle-check' : u.status === 'rejected' ? 'fa-circle-xmark' : 'fa-clock';
        const statusText = u.status === 'approved' ? 'Approved' : u.status === 'rejected' ? 'Rejected' : 'Processing...';
        const typeInfo = UPLOAD_TYPES.find(t => t.value === u.type);

        return `
          <div class="recent-upload-card">
            <div class="recent-upload-icon">
              <i class="fa-solid ${typeInfo?.icon || 'fa-file'}"></i>
            </div>
            <div class="recent-upload-info">
              <span class="recent-upload-title">${u.title}</span>
              <span class="recent-upload-meta">${typeInfo?.label || u.type} · ${new Date(u.created_at).toLocaleDateString()}</span>
            </div>
            <div class="recent-upload-status">
              <span class="badge badge-${statusClass}">
                <i class="fa-solid ${statusIcon}"></i> ${statusText}
              </span>
              ${u.points_awarded ? `<span class="recent-upload-points">+${u.points_awarded} pts</span>` : ''}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  // Staggered animation
  gsap.fromTo('.recent-upload-card', { y: 15, opacity: 0 },
    { y: 0, opacity: 1, duration: 0.35, stagger: 0.06, ease: 'power2.out' });
}
