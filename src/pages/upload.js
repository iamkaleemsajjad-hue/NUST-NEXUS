import { getCurrentUser, getUserProfile } from '../utils/auth.js';
import { calculateSemester } from '../utils/semester.js';
import { hashFile } from '../utils/hash.js';
import { renderSidebar, initSidebar } from '../components/sidebar.js';
import { renderHeader, initHeader, setBreadcrumb } from '../components/header.js';
import { showToast } from '../components/toast.js';
import { supabase } from '../utils/supabase.js';
import { router } from '../router.js';
import { POINTS, UPLOAD_TYPES } from '../config.js';
import gsap from 'gsap';

let currentStep = 1;
let uploadData = {};

export async function renderUploadPage() {
  const app = document.getElementById('app');
  const user = await getCurrentUser();
  if (!user) { router.navigate('/login'); return; }
  const profile = await getUserProfile(user.id);
  if (!profile) { router.navigate('/login'); return; }
  const semester = calculateSemester(profile.admission_year);

  currentStep = 1;
  uploadData = { userSemester: semester, school: profile.school, degree: profile.degree };

  app.innerHTML = `
    <div class="app-layout">
      ${renderSidebar(profile)}
      <div class="main-content">
        ${renderHeader(profile)}
        <div class="page-container">
          <h2 style="margin-bottom:var(--space-xl);"><i class="fa-solid fa-cloud-arrow-up"></i> Upload Resources</h2>
          
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

          <div class="card upload-wizard-card" id="upload-wizard">
            <!-- Step 1: Semester -->
            <div class="wizard-content" id="step-1">
              <h3>Select Semester</h3>
              <p class="form-helper" style="margin-bottom:var(--space-lg);">Choose which semester's content you want to upload</p>
              <div class="semester-grid" id="semester-grid"></div>
            </div>
            <!-- Step 2: Course -->
            <div class="wizard-content" id="step-2" style="display:none;">
              <h3>Select Course</h3>
              <div id="course-list" class="selection-grid"></div>
            </div>
            <!-- Step 3: Professor -->
            <div class="wizard-content" id="step-3" style="display:none;">
              <h3>Select Professor</h3>
              <div id="professor-list" class="selection-grid"></div>
            </div>
            <!-- Step 4: Type -->
            <div class="wizard-content" id="step-4" style="display:none;">
              <h3>What are you uploading?</h3>
              <div class="type-grid" id="type-grid"></div>
            </div>
            <!-- Step 5: File Upload -->
            <div class="wizard-content" id="step-5" style="display:none;">
              <h3>Upload File</h3>
              <div class="form-group">
                <label class="form-label">Title / Name</label>
                <input type="text" class="form-input" id="upload-title" 
                  placeholder="e.g. Lab 5 - Data Structures" required />
                <div class="form-helper">Include the specific identifier (e.g., Lab 5, Assignment 3)</div>
              </div>
              <div class="file-drop-zone" id="file-drop-zone">
                <i class="fa-solid fa-cloud-arrow-up"></i>
                <p>Drag & drop your file here</p>
                <span>or click to browse</span>
                <input type="file" id="file-input" style="display:none;" />
                <div class="form-helper" style="margin-top:8px;">
                  <i class="fa-solid fa-ban"></i> ZIP files are not allowed. Upload files individually.
                </div>
              </div>
              <div id="file-preview" style="display:none;" class="file-preview">
                <i class="fa-solid fa-file"></i>
                <span id="file-name"></span>
                <span id="file-size"></span>
                <button class="btn btn-ghost btn-sm" id="remove-file"><i class="fa-solid fa-xmark"></i></button>
              </div>
              <button class="btn btn-primary btn-block btn-lg" id="submit-upload" style="margin-top:var(--space-lg);" disabled>
                <i class="fa-solid fa-rocket"></i> Upload & Submit
              </button>
            </div>
          </div>

          <!-- Upload Status Section -->
          <div id="upload-status-section" style="margin-top:var(--space-xl);"></div>
        </div>
      </div>
    </div>
  `;

  initSidebar();
  initHeader(profile);
  setBreadcrumb('Upload Resources');
  initUploadWizard(profile);
  loadUserUploads(user.id);
}

function initUploadWizard(profile) {
  // Step 1: Semester grid
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

  // Step 4: Type grid
  const typeGrid = document.getElementById('type-grid');
  UPLOAD_TYPES.forEach(t => {
    const btn = document.createElement('button');
    btn.className = 'selection-btn type-btn';
    btn.innerHTML = `<i class="fa-solid ${t.icon}"></i><span>${t.label}</span>
      ${t.value === 'project' ? '<span class="badge badge-warning" style="margin-top:4px;">+50 pts</span>' : '<span class="badge badge-primary" style="margin-top:4px;">+5 pts</span>'}`;
    btn.addEventListener('click', () => {
      uploadData.type = t.value;
      goToStep(5);
    });
    typeGrid.appendChild(btn);
  });

  // File handling
  const dropZone = document.getElementById('file-drop-zone');
  const fileInput = document.getElementById('file-input');
  
  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    handleFile(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));

  document.getElementById('remove-file')?.addEventListener('click', () => {
    uploadData.file = null;
    document.getElementById('file-preview').style.display = 'none';
    document.getElementById('file-drop-zone').style.display = 'flex';
    document.getElementById('submit-upload').disabled = true;
  });

  document.getElementById('submit-upload')?.addEventListener('click', () => submitUpload(profile));
}

function handleFile(file) {
  if (!file) return;
  if (file.name.endsWith('.zip') || file.name.endsWith('.rar') || file.name.endsWith('.7z')) {
    showToast('ZIP/RAR files are not allowed. Please upload files individually.', 'error');
    return;
  }
  uploadData.file = file;
  document.getElementById('file-drop-zone').style.display = 'none';
  document.getElementById('file-preview').style.display = 'flex';
  document.getElementById('file-name').textContent = file.name;
  document.getElementById('file-size').textContent = `(${(file.size / 1024).toFixed(1)} KB)`;
  document.getElementById('submit-upload').disabled = false;
}

async function loadCourses(profile) {
  const container = document.getElementById('course-list');
  container.innerHTML = '<div class="skeleton skeleton-card"></div>';

  const { data: school } = await supabase.from('schools').select('id').eq('name', profile.school).single();
  if (!school) { container.innerHTML = '<p>No courses found for your school.</p>'; return; }

  const { data: courses } = await supabase
    .from('courses')
    .select('*')
    .eq('school_id', school.id)
    .eq('semester', uploadData.semester)
    .order('code');

  if (!courses || courses.length === 0) {
    container.innerHTML = '<div class="empty-state"><i class="fa-solid fa-book"></i><h4>No courses found</h4><p>No courses for this semester in your department</p></div>';
    return;
  }

  container.innerHTML = courses.map(c => `
    <button class="selection-btn course-btn" data-id="${c.id}">
      <span class="selection-code">${c.code}</span>
      <span>${c.name}</span>
    </button>
  `).join('');

  container.querySelectorAll('.course-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      uploadData.courseId = btn.dataset.id;
      goToStep(3);
      loadProfessors();
    });
  });
}

async function loadProfessors() {
  const container = document.getElementById('professor-list');
  container.innerHTML = '<div class="skeleton skeleton-card"></div>';

  const { data: teachers } = await supabase
    .from('course_teachers')
    .select('teacher_id, teachers(id, name, designation)')
    .eq('course_id', uploadData.courseId);

  // Also get all teachers from the school
  const { data: profile } = await supabase.from('profiles').select('school').eq('id', (await getCurrentUser()).id).single();
  const { data: school } = await supabase.from('schools').select('id').eq('name', profile.school).single();
  const { data: allTeachers } = await supabase.from('teachers').select('*').eq('school_id', school?.id).order('name');

  const teacherList = allTeachers || [];
  
  if (teacherList.length === 0) {
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

  container.innerHTML = teacherList.map(t => `
    <button class="selection-btn" data-id="${t.id}">
      <i class="fa-solid fa-chalkboard-user"></i>
      <span>${t.name}</span>
      <span class="selection-sub">${t.designation}</span>
    </button>
  `).join('') + `<button class="btn btn-ghost btn-block" id="skip-professor" style="margin-top:12px;">Skip Professor</button>`;

  container.querySelectorAll('.selection-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      uploadData.teacherId = btn.dataset.id;
      goToStep(4);
    });
  });
  document.getElementById('skip-professor')?.addEventListener('click', () => {
    uploadData.teacherId = null;
    goToStep(4);
  });
}

async function submitUpload(profile) {
  const btn = document.getElementById('submit-upload');
  
  try {
    // Rate limiting check
    const { checkRateLimit, sanitizeText } = await import('../utils/sanitize.js');
    const rl = checkRateLimit('upload', 10, 60000); // Max 10 uploads per minute
    if (!rl.allowed) {
      showToast(`Too many upload attempts. Please wait ${Math.ceil(rl.remainingMs/1000)}s`, 'error');
      return;
    }

    const rawTitle = document.getElementById('upload-title').value;
  const title = sanitizeText(rawTitle, 100);
  
  if (!title) { showToast('Please enter a valid title', 'warning'); return; }
  if (!uploadData.file) { showToast('Please select a file', 'warning'); return; }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Uploading...';

  // Hash the file (optional, but good for admin reference)
  const fileHash = await hashFile(uploadData.file);

  const filePath = `uploads/${profile.id}/${Date.now()}-${uploadData.file.name}`;
  const { uploadToStorj } = await import('../utils/storj.js');
  const storjRes = await uploadToStorj(filePath, uploadData.file);
  const fileUrl = storjRes.url;

  if (storjRes.error || !fileUrl) {
    showToast('File upload failed: ' + (storjRes.error?.message || 'Unknown error'), 'error');
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-rocket"></i> Upload & Submit';
    return;
  }

  const status = 'pending';
  const pointsAwarded = 0;

  // Insert upload record
  const { data: upload, error: insertError } = await supabase.from('uploads').insert({
    user_id: profile.id,
    course_id: uploadData.courseId,
    teacher_id: uploadData.teacherId,
    semester: uploadData.semester,
    type: uploadData.type,
    title,
    file_url: fileUrl,
    file_hash: fileHash,
    file_size: uploadData.file.size,
    status,
    points_awarded: pointsAwarded,
    reviewed_at: null,
  }).select().single();

  if (insertError) {
    showToast('Upload record failed: ' + insertError.message, 'error');
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-rocket"></i> Upload & Submit';
    return;
  }

  // Add audit log
  await supabase.from('audit_logs').insert({
    user_id: profile.id,
    upload_id: upload.id,
    action: 'uploaded',
  });

  showToast('Upload submitted! It is now pending admin approval.', 'success');

  // Reset and reload
  currentStep = 1;
  document.getElementById('file-preview').style.display = 'none';
  document.getElementById('file-drop-zone').style.display = 'flex';
  document.getElementById('submit-upload').disabled = true;
  document.getElementById('submit-upload').innerHTML = '<i class="fa-solid fa-rocket"></i> Upload & Submit';
  document.getElementById('upload-title').value = '';
  
    renderUploadPage();
  } catch (error) {
    console.error('Upload process error:', error);
    showToast('Upload failed due to unexpected error: ' + error.message, 'error');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-rocket"></i> Upload & Submit';
    }
  }
}

function goToStep(step) {
  const prev = document.getElementById(`step-${currentStep}`);
  const next = document.getElementById(`step-${step}`);
  
  // Update wizard steps UI
  document.querySelectorAll('.wizard-step').forEach(ws => {
    const s = parseInt(ws.dataset.step);
    ws.classList.remove('active', 'completed');
    if (s < step) ws.classList.add('completed');
    if (s === step) ws.classList.add('active');
  });

  if (prev) prev.style.display = 'none';
  if (next) {
    next.style.display = 'block';
    gsap.fromTo(next, { x: 30, opacity: 0 }, { x: 0, opacity: 1, duration: 0.4, ease: 'power3.out' });
  }
  currentStep = step;
}

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
    <h3 style="margin-bottom:var(--space-lg);"><i class="fa-solid fa-list-check"></i> Your Recent Uploads</h3>
    ${data.map(u => `
      <div class="upload-status-item card" style="padding:var(--space-md) var(--space-lg);margin-bottom:var(--space-sm);">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <strong>${u.title}</strong>
            <span class="badge badge-${u.status === 'approved' ? 'success' : u.status === 'rejected' ? 'danger' : 'warning'}" style="margin-left:8px;">
              ${u.status === 'approved' ? '✓ Approved' : u.status === 'rejected' ? '✗ Rejected' : '⏳ Pending'}
            </span>
          </div>
          <span style="color:var(--text-secondary);font-size:0.8125rem;">${new Date(u.created_at).toLocaleDateString()}</span>
        </div>
        <div class="status-line status-${u.status}"></div>
      </div>
    `).join('')}
  `;
}
