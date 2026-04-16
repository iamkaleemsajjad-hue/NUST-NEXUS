import { getCurrentUser, getUserProfile } from '../../utils/auth.js';
import { renderSidebar, initSidebar } from '../../components/sidebar.js';
import { renderHeader, initHeader, setBreadcrumb } from '../../components/header.js';
import { showToast } from '../../components/toast.js';
import { supabase } from '../../utils/supabase.js';
import { router } from '../../router.js';

export async function renderAdminTeachers() {
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
            <h2><i class="fa-solid fa-user-tie"></i> Manage Teachers</h2>
            <button class="btn btn-primary" id="add-teacher-btn"><i class="fa-solid fa-plus"></i> Add Teacher</button>
          </div>

          <!-- Teacher Form -->
          <div class="card" id="teacher-form-card" style="display:none;margin-bottom:var(--space-xl);">
            <h3 id="teacher-form-title">Add New Teacher</h3>
            <form id="teacher-form" style="margin-top:var(--space-lg);">
              <input type="hidden" id="tf-id" />
              <div class="grid-2">
                <div class="form-group">
                  <label class="form-label">Full Name *</label>
                  <input type="text" class="form-input" id="tf-name" required />
                </div>
                <div class="form-group">
                  <label class="form-label">Designation *</label>
                  <input type="text" class="form-input" id="tf-designation" placeholder="e.g., Assistant Professor" required />
                </div>
                <div class="form-group">
                  <label class="form-label">School *</label>
                  <select class="form-select" id="tf-school" required>
                    <option value="">Select School</option>
                    ${schools.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Profile Photo</label>
                  <input type="file" class="form-input" id="tf-avatar" accept="image/*" style="padding:8px;" />
                  <span class="form-helper">JPG, PNG (max 2MB)</span>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Description</label>
                <textarea class="form-textarea" id="tf-description" placeholder="Teaching style, grading policy, specialization, etc." style="min-height:80px;"></textarea>
              </div>
              <!-- Existing avatar preview -->
              <div id="tf-avatar-preview" style="display:none;margin-bottom:var(--space-md);">
                <label class="form-label">Current Photo</label>
                <img id="tf-avatar-img" src="" alt="Teacher" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:2px solid var(--border);" />
              </div>
              <div style="display:flex;gap:var(--space-md);">
                <button type="submit" class="btn btn-primary" id="tf-submit">Add Teacher</button>
                <button type="button" class="btn btn-ghost" id="tf-cancel">Cancel</button>
              </div>
            </form>
          </div>

          <!-- Search -->
          <div class="card" style="margin-bottom:var(--space-lg);">
            <div style="display:flex;gap:var(--space-md);flex-wrap:wrap;">
              <select class="form-select" id="teacher-filter-school" style="max-width:200px;">
                <option value="">All Schools</option>
                ${schools.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
              </select>
              <input type="text" class="form-input" id="teacher-filter-search" placeholder="Search teachers..." style="max-width:300px;" />
              <button class="btn btn-primary" id="teacher-filter-btn"><i class="fa-solid fa-search"></i></button>
            </div>
          </div>

          <div id="teachers-table-container"></div>
        </div>
      </div>
    </div>
  `;

  initSidebar(); initHeader(profile); setBreadcrumb('Manage Teachers');

  document.getElementById('add-teacher-btn').addEventListener('click', () => {
    document.getElementById('teacher-form-card').style.display = 'block';
    document.getElementById('teacher-form-title').textContent = 'Add New Teacher';
    document.getElementById('tf-submit').textContent = 'Add Teacher';
    document.getElementById('tf-id').value = '';
    document.getElementById('tf-avatar-preview').style.display = 'none';
    document.getElementById('teacher-form').reset();
  });
  document.getElementById('tf-cancel').addEventListener('click', () => {
    document.getElementById('teacher-form-card').style.display = 'none';
  });
  document.getElementById('teacher-filter-btn').addEventListener('click', loadTeachersTable);
  document.getElementById('teacher-filter-search').addEventListener('keypress', (e) => { if (e.key === 'Enter') loadTeachersTable(); });

  document.getElementById('teacher-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formEl = document.getElementById('teacher-form');
    const idEl = document.getElementById('tf-id');
    const nameEl = document.getElementById('tf-name');
    const designationEl = document.getElementById('tf-designation');
    const schoolEl = document.getElementById('tf-school');
    const descriptionEl = document.getElementById('tf-description');
    const avatarEl = document.getElementById('tf-avatar');
    const submitBtn = document.getElementById('tf-submit');

    // Guard: if any element is missing (DOM destroyed), abort gracefully
    if (!formEl || !idEl || !nameEl || !designationEl || !schoolEl || !submitBtn) {
      showToast('Form elements not found. Please refresh the page.', 'error');
      return;
    }

    const id = idEl.value;
    const avatarFile = avatarEl?.files?.[0];

    let avatarUrl = null;

    // Upload avatar if provided
    if (avatarFile) {
      if (avatarFile.size > 2 * 1024 * 1024) {
        showToast('Image must be under 2MB', 'error');
        return;
      }
      const fileName = `teacher-${Date.now()}.${avatarFile.name.split('.').pop()}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, avatarFile, { upsert: true });

      if (uploadError) {
        showToast('Failed to upload photo: ' + uploadError.message, 'error');
        return;
      }

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
      avatarUrl = publicUrl;
    }

    const payload = {
      name: nameEl.value.trim(),
      designation: designationEl.value.trim(),
      school_id: schoolEl.value,
      description: descriptionEl?.value?.trim() || null,
    };

    if (!payload.name || !payload.designation || !payload.school_id) {
      showToast('Please fill in all required fields', 'warning');
      return;
    }

    if (avatarUrl) payload.avatar_url = avatarUrl;

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> Saving...';

    let error;
    if (id) {
      ({ error } = await supabase.from('teachers').update(payload).eq('id', id));
    } else {
      ({ error } = await supabase.from('teachers').insert(payload));
    }

    submitBtn.disabled = false;
    submitBtn.textContent = id ? 'Update Teacher' : 'Add Teacher';

    if (error) {
      showToast('Failed: ' + error.message, 'error');
    } else {
      showToast(id ? 'Teacher updated!' : 'Teacher added!', 'success');
      document.getElementById('teacher-form-card').style.display = 'none';
      loadTeachersTable();
    }
  });

  loadTeachersTable();
}

async function loadTeachersTable() {
  const container = document.getElementById('teachers-table-container');
  const schoolFilter = document.getElementById('teacher-filter-school').value;
  const searchFilter = document.getElementById('teacher-filter-search').value.trim();

  let query = supabase.from('teachers').select('*, schools(name)').order('name');
  if (schoolFilter) query = query.eq('school_id', schoolFilter);
  if (searchFilter) query = query.ilike('name', `%${searchFilter}%`);

  const { data: teachers } = await query;

  // Get ratings
  const { data: ratings } = await supabase.from('teacher_ratings').select('teacher_id, rating');
  const ratingMap = {};
  ratings?.forEach(r => {
    if (!ratingMap[r.teacher_id]) ratingMap[r.teacher_id] = [];
    ratingMap[r.teacher_id].push(r.rating);
  });

  if (!teachers || teachers.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>No teachers found</p></div>';
    return;
  }

  container.innerHTML = `
    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Photo</th>
            <th>Name</th>
            <th>Designation</th>
            <th>School</th>
            <th>Rating</th>
            <th>Description</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${teachers.map(t => {
            const avg = ratingMap[t.id] ? (ratingMap[t.id].reduce((a,b)=>a+b,0) / ratingMap[t.id].length).toFixed(1) : '—';
            const count = ratingMap[t.id]?.length || 0;
            const initials = t.name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
            return `
              <tr>
                <td>
                  ${t.avatar_url 
                    ? `<img src="${t.avatar_url}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;" alt="${t.name}" />`
                    : `<div class="avatar avatar-placeholder" style="font-size:0.75rem;">${initials}</div>`
                  }
                </td>
                <td><strong>${t.name}</strong></td>
                <td>${t.designation}</td>
                <td><span class="badge badge-primary">${t.schools?.name || ''}</span></td>
                <td>
                  <span style="color:var(--warning);">★ ${avg}</span>
                  <span style="color:var(--text-muted);font-size:0.75rem;"> (${count})</span>
                </td>
                <td style="max-width:200px;">
                  <span style="color:var(--text-secondary);font-size:0.8125rem;">
                    ${t.description ? t.description.substring(0, 60) + (t.description.length > 60 ? '...' : '') : '—'}
                  </span>
                </td>
                <td>
                  <button class="btn btn-ghost btn-sm edit-teacher" data-id="${t.id}" data-name="${t.name}" 
                    data-designation="${t.designation}" data-school="${t.school_id}" 
                    data-description="${(t.description || '').replace(/"/g, '&quot;')}"
                    data-avatar="${t.avatar_url || ''}">
                    <i class="fa-solid fa-pen"></i>
                  </button>
                  <button class="btn btn-ghost btn-sm del-teacher" data-id="${t.id}" style="color:var(--danger);">
                    <i class="fa-solid fa-trash"></i>
                  </button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  container.querySelectorAll('.edit-teacher').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('teacher-form-card').style.display = 'block';
      document.getElementById('teacher-form-title').textContent = 'Edit Teacher';
      document.getElementById('tf-submit').textContent = 'Update Teacher';
      document.getElementById('tf-id').value = btn.dataset.id;
      document.getElementById('tf-name').value = btn.dataset.name;
      document.getElementById('tf-designation').value = btn.dataset.designation;
      document.getElementById('tf-school').value = btn.dataset.school;
      document.getElementById('tf-description').value = btn.dataset.description;
      
      if (btn.dataset.avatar) {
        document.getElementById('tf-avatar-preview').style.display = 'block';
        document.getElementById('tf-avatar-img').src = btn.dataset.avatar;
      } else {
        document.getElementById('tf-avatar-preview').style.display = 'none';
      }
    });
  });

  container.querySelectorAll('.del-teacher').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this teacher?')) return;
      await supabase.from('teachers').delete().eq('id', btn.dataset.id);
      showToast('Teacher deleted', 'info');
      loadTeachersTable();
    });
  });
}
