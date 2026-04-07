import { getCurrentUser, getUserProfile } from '../../utils/auth.js';
import { renderSidebar, initSidebar } from '../../components/sidebar.js';
import { renderHeader, initHeader, setBreadcrumb } from '../../components/header.js';
import { showToast } from '../../components/toast.js';
import { supabase } from '../../utils/supabase.js';
import { router } from '../../router.js';

export async function renderAdminCourses() {
  const app = document.getElementById('app');
  const user = await getCurrentUser();
  if (!user) return router.navigate('/login');
  const profile = await getUserProfile(user.id);
  if (!profile || profile.role !== 'admin') return router.navigate('/dashboard');

  const { data: schools } = await supabase.from('schools').select('*').order('name');

  app.innerHTML = `
    <div class="app-layout">
      ${renderSidebar(profile)}
      <div class="main-content">
        ${renderHeader(profile)}
        <div class="page-container">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-xl);">
            <h2><i class="fa-solid fa-book"></i> Manage Courses</h2>
            <button class="btn btn-primary" id="add-course-btn"><i class="fa-solid fa-plus"></i> Add Course</button>
          </div>

          <div class="card" id="course-form-card" style="display:none;margin-bottom:var(--space-xl);">
            <h3 id="course-form-title">Add New Course</h3>
            <form id="course-form" style="margin-top:var(--space-lg);">
              <input type="hidden" id="cf-id" />
              <div class="grid-2">
                <div class="form-group"><label class="form-label">Course Name *</label><input type="text" class="form-input" id="cf-name" required /></div>
                <div class="form-group"><label class="form-label">Course Code *</label><input type="text" class="form-input" id="cf-code" required /></div>
                <div class="form-group">
                  <label class="form-label">School *</label>
                  <select class="form-select" id="cf-school" required>
                    <option value="">Select School</option>
                    ${schools.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
                  </select>
                </div>
                <div class="form-group"><label class="form-label">Degree *</label><input type="text" class="form-input" id="cf-degree" placeholder="e.g., BSCS" required /></div>
                <div class="form-group">
                  <label class="form-label">Semester *</label>
                  <select class="form-select" id="cf-semester" required>
                    ${[1,2,3,4,5,6,7,8].map(s => `<option value="${s}">${s}</option>`).join('')}
                  </select>
                </div>
              </div>
              <div style="display:flex;gap:var(--space-md);">
                <button type="submit" class="btn btn-primary" id="cf-submit">Add Course</button>
                <button type="button" class="btn btn-ghost" id="cf-cancel">Cancel</button>
              </div>
            </form>
          </div>

          <!-- Filters -->
          <div class="card" style="margin-bottom:var(--space-lg);">
            <div style="display:flex;gap:var(--space-md);flex-wrap:wrap;">
              <select class="form-select" id="course-filter-school" style="max-width:200px;">
                <option value="">All Schools</option>
                ${schools.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
              </select>
              <input type="text" class="form-input" id="course-filter-search" placeholder="Search courses..." style="max-width:300px;" />
              <button class="btn btn-primary" id="course-filter-btn"><i class="fa-solid fa-search"></i></button>
            </div>
          </div>

          <div id="courses-table-container"></div>
        </div>
      </div>
    </div>
  `;

  initSidebar(); initHeader(profile); setBreadcrumb('Manage Courses');

  document.getElementById('add-course-btn').addEventListener('click', () => {
    document.getElementById('course-form-card').style.display = 'block';
    document.getElementById('course-form-title').textContent = 'Add New Course';
    document.getElementById('cf-submit').textContent = 'Add Course';
    document.getElementById('cf-id').value = '';
    document.getElementById('course-form').reset();
  });
  document.getElementById('cf-cancel').addEventListener('click', () => {
    document.getElementById('course-form-card').style.display = 'none';
  });
  document.getElementById('course-filter-btn').addEventListener('click', loadCoursesTable);
  document.getElementById('course-filter-search').addEventListener('keypress', (e) => { if (e.key === 'Enter') loadCoursesTable(); });

  document.getElementById('course-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('cf-id').value;
    const payload = {
      name: document.getElementById('cf-name').value.trim(),
      code: document.getElementById('cf-code').value.trim().toUpperCase(),
      school_id: document.getElementById('cf-school').value,
      degree: document.getElementById('cf-degree').value.trim().toUpperCase(),
      semester: parseInt(document.getElementById('cf-semester').value),
    };
    let error;
    if (id) ({ error } = await supabase.from('courses').update(payload).eq('id', id));
    else ({ error } = await supabase.from('courses').insert(payload));
    if (error) showToast('Failed: ' + error.message, 'error');
    else {
      showToast(id ? 'Course updated!' : 'Course added!', 'success');
      document.getElementById('course-form-card').style.display = 'none';
      loadCoursesTable();
    }
  });

  loadCoursesTable();
}

async function loadCoursesTable() {
  const container = document.getElementById('courses-table-container');
  const schoolFilter = document.getElementById('course-filter-school').value;
  const searchFilter = document.getElementById('course-filter-search').value.trim();

  let query = supabase.from('courses').select('*, schools(name)').order('school_id').order('semester').order('code');
  if (schoolFilter) query = query.eq('school_id', schoolFilter);
  if (searchFilter) query = query.or(`name.ilike.%${searchFilter}%,code.ilike.%${searchFilter}%`);

  const { data } = await query;
  if (!data || data.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>No courses found</p></div>';
    return;
  }

  container.innerHTML = `
    <div class="table-container">
      <table class="data-table">
        <thead><tr><th>Code</th><th>Name</th><th>School</th><th>Degree</th><th>Sem</th><th>Actions</th></tr></thead>
        <tbody>${data.map(c => `<tr>
          <td><code style="color:var(--primary);">${c.code}</code></td>
          <td>${c.name}</td>
          <td><span class="badge badge-primary">${c.schools?.name || ''}</span></td>
          <td>${c.degree}</td>
          <td>${c.semester}</td>
          <td>
            <button class="btn btn-ghost btn-sm edit-course" data-id="${c.id}" data-name="${c.name}" data-code="${c.code}"
              data-school="${c.school_id}" data-degree="${c.degree}" data-semester="${c.semester}"><i class="fa-solid fa-pen"></i></button>
            <button class="btn btn-ghost btn-sm del-course" data-id="${c.id}" style="color:var(--danger);"><i class="fa-solid fa-trash"></i></button>
          </td>
        </tr>`).join('')}</tbody>
      </table>
    </div>
  `;

  container.querySelectorAll('.edit-course').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('course-form-card').style.display = 'block';
      document.getElementById('course-form-title').textContent = 'Edit Course';
      document.getElementById('cf-submit').textContent = 'Update Course';
      document.getElementById('cf-id').value = btn.dataset.id;
      document.getElementById('cf-name').value = btn.dataset.name;
      document.getElementById('cf-code').value = btn.dataset.code;
      document.getElementById('cf-school').value = btn.dataset.school;
      document.getElementById('cf-degree').value = btn.dataset.degree;
      document.getElementById('cf-semester').value = btn.dataset.semester;
    });
  });
  container.querySelectorAll('.del-course').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this course?')) return;
      await supabase.from('courses').delete().eq('id', btn.dataset.id);
      showToast('Course deleted', 'info');
      loadCoursesTable();
    });
  });
}
