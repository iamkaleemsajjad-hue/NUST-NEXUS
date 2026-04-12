import { getCurrentUser, getUserProfile } from '../utils/auth.js';
import { calculateSemester, getSemesterLabel, getAccessibleSemesters } from '../utils/semester.js';
import { renderSidebar, initSidebar } from '../components/sidebar.js';
import { renderHeader, initHeader, setBreadcrumb } from '../components/header.js';
import { showToast } from '../components/toast.js';
import { supabase } from '../utils/supabase.js';
import { router } from '../router.js';
import { UPLOAD_TYPES } from '../config.js';
import { escapeHtml, sanitizeText } from '../utils/sanitize.js';
import gsap from 'gsap';

export async function renderBrowsePage() {
  const app = document.getElementById('app');
  const user = await getCurrentUser();
  if (!user) { router.navigate('/login'); return; }
  const profile = await getUserProfile(user.id);
  if (!profile) { router.navigate('/login'); return; }

  const adminUser = profile.role === 'admin';
  const semester = calculateSemester(profile.admission_year);
  const accessibleSemesters = adminUser ? [1,2,3,4,5,6,7,8] : getAccessibleSemesters(semester);

  app.innerHTML = `
    <div class="app-layout">
      ${renderSidebar(profile)}
      <div class="main-content">
        ${renderHeader(profile)}
        <div class="page-container">
          <h2 style="margin-bottom:var(--space-xl);"><i class="fa-solid fa-compass"></i> Browse Resources</h2>
          
          <!-- Filters -->
          <div class="card" style="margin-bottom:var(--space-xl);">
            <div style="display:flex;gap:var(--space-md);flex-wrap:wrap;align-items:flex-end;">
              <div class="form-group" style="margin-bottom:0;flex:1;min-width:150px;">
                <label class="form-label">Semester</label>
                <select class="form-select" id="filter-semester">
                  <option value="">All Accessible</option>
                  ${accessibleSemesters.map(s => `<option value="${s}">${getSemesterLabel(s)} Semester</option>`).join('')}
                </select>
              </div>
              <div class="form-group" style="margin-bottom:0;flex:1;min-width:150px;">
                <label class="form-label">Type</label>
                <select class="form-select" id="filter-type">
                  <option value="">All Types</option>
                  ${UPLOAD_TYPES.map((t) => `<option value="${t.value}">${t.label}</option>`).join('')}
                </select>
              </div>
              <div class="form-group" style="margin-bottom:0;flex:2;min-width:200px;">
                <label class="form-label">Search</label>
                <input type="text" class="form-input" id="filter-search" placeholder="Search by title or course..." />
              </div>
              <button class="btn btn-primary" id="filter-btn" style="height:48px;">
                <i class="fa-solid fa-search"></i> Filter
              </button>
            </div>
          </div>

          <div id="resources-container">
            <div class="skeleton skeleton-card" style="height:300px;"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  initSidebar(); initHeader(profile); setBreadcrumb('Browse Resources');

  document.getElementById('filter-btn')?.addEventListener('click', () => loadResources(profile, accessibleSemesters));
  document.getElementById('filter-search')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') loadResources(profile, accessibleSemesters);
  });

  loadResources(profile, accessibleSemesters);
}

async function loadResources(profile, accessibleSemesters) {
  const container = document.getElementById('resources-container');
  const semesterFilter = document.getElementById('filter-semester').value;
  const typeFilter = document.getElementById('filter-type').value;
  const searchFilter = sanitizeText(document.getElementById('filter-search').value, 200);
  const adminUser = profile.role === 'admin';

  container.innerHTML = '<div class="skeleton skeleton-card" style="height:300px;"></div>';

  let query = supabase.from('uploads')
    .select('*, profiles(display_name), courses(name, code, semester)')
    .eq('status', 'approved')
    .order('created_at', { ascending: false });

  // Semester filter
  if (semesterFilter) {
    query = query.eq('semester', parseInt(semesterFilter));
  } else if (!adminUser) {
    // Students only see their accessible semesters
    query = query.in('semester', accessibleSemesters);
  }
  // Admin sees all semesters when no filter applied

  if (typeFilter) query = query.eq('type', typeFilter);
  if (searchFilter) query = query.ilike('title', `%${searchFilter}%`);

  const { data, error } = await query;

  if (error) {
    container.innerHTML = `<div class="empty-state"><p>Error loading resources: ${error.message}</p></div>`;
    return;
  }

  if (!data || data.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-folder-open"></i>
        <h4>No resources found</h4>
        <p>Try adjusting your filters or check back later.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <p style="color:var(--text-secondary);margin-bottom:var(--space-lg);">${data.length} resources found</p>
    <div class="resource-grid">
      ${data.map((r) => {
        const meta = UPLOAD_TYPES.find((t) => t.value === r.type);
        const iconClass = meta?.icon || 'fa-file';
        const typeLabel = meta?.label || r.type;
        return `
          <div class="resource-card card">
            <div class="resource-header">
              <div class="resource-type-icon">
                <i class="fa-solid ${iconClass}"></i>
              </div>
              <div style="flex:1;">
                <h4 style="font-size:1rem;margin-bottom:4px;">${escapeHtml(r.title)}</h4>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                  <span class="badge badge-primary">${escapeHtml(typeLabel)}</span>
                  <span class="badge badge-success">Sem ${r.semester}</span>
                  ${r.courses ? `<span class="badge badge-warning">${r.courses.code}</span>` : ''}
                </div>
              </div>
            </div>
            ${r.description ? `<p style="color:var(--text-secondary);font-size:0.8125rem;margin:var(--space-md) 0;">${escapeHtml(String(r.description)).substring(0, 120)}${String(r.description).length > 120 ? '...' : ''}</p>` : ''}
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:var(--space-md);padding-top:var(--space-md);border-top:1px solid var(--grid);">
              <span style="color:var(--text-muted);font-size:0.75rem;">
                <i class="fa-solid fa-user"></i> ${r.profiles?.display_name || 'Unknown'} •
                ${new Date(r.created_at).toLocaleDateString()}
              </span>
              <div style="display:flex;gap:8px;">
                ${adminUser ? `
                  <button class="btn btn-ghost btn-sm" style="color:var(--danger);" onclick="window.deleteUpload('${r.id}', '${r.file_url}')" title="Delete Resource">
                    <i class="fa-solid fa-trash"></i>
                  </button>
                ` : ''}
                <button class="btn btn-primary btn-sm download-btn" data-id="${r.id}" data-url="${r.file_url}" data-title="${escapeHtml(r.title)}" data-type="${r.type}">
                  <i class="fa-solid fa-download"></i> Download
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  gsap.fromTo('.resource-card', { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, stagger: 0.05, ease: 'power3.out' });

  // Download handlers
  container.querySelectorAll('.download-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const uploadId = btn.dataset.id;
      const fileUrl = btn.dataset.url;
      const title = btn.dataset.title;
      const type = btn.dataset.type;

      // Determine cost
      const { POINTS } = await import('../config.js');
      const pointCost = type === 'project' ? POINTS.DOWNLOAD_PROJECT_COST : POINTS.DOWNLOAD_COST;

      // Admin doesn't spend points
      if (profile.role !== 'admin') {
        if (profile.points < pointCost) {
          import('../components/toast.js').then(m => m.showToast(`Not enough points! You need ${pointCost} points to download this.`, 'error'));
          return;
        }

        const confirmDownload = confirm(`Downloading this ${type === 'project' ? 'project' : 'resource'} will cost ${pointCost} points. Do you want to proceed?`);
        if (!confirmDownload) return;

        // Deduct points
        const { error: updateError } = await supabase.from('profiles').update({ points: profile.points - pointCost }).eq('id', profile.id);
        if (updateError) {
          import('../components/toast.js').then(m => m.showToast('Failed to deduct points!', 'error'));
          return;
        }
        
        // Update local profile object
        profile.points -= pointCost;
        
        // Update header UI if points are displayed
        const pointsBadge = document.querySelector('.header-actions .badge-warning');
        if (pointsBadge && pointsBadge.innerHTML.includes('fa-star')) {
          pointsBadge.innerHTML = `<i class="fa-solid fa-star"></i> ${profile.points} Pts`;
        }
      }

      // Record download
      await supabase.from('downloads').insert({ upload_id: uploadId, user_id: profile.id });

      // Open file
      window.open(fileUrl, '_blank');
      import('../components/toast.js').then(m => m.showToast(`Downloading: ${title}`, 'success'));
    });
  });

  // Attach global click handler for deleting uploads
  window.deleteUpload = async (id, fileUrl) => {
    if(!confirm('Are you strictly sure you want to permanently delete this resource and its associated file?')) return;
    
    // Attempt to delete from Supabase storage first
    try {
      const urlObj = new URL(fileUrl);
      const pathParts = urlObj.pathname.split('/public/uploads/');
      if (pathParts.length > 1) {
        const filePath = decodeURIComponent(pathParts[1]); 
        
        // Remove from storage bucket
        const { error: storageError } = await supabase.storage.from('uploads').remove([filePath]);
        if (storageError) {
          console.warn('Storage deletion error:', storageError);
        }
      }
    } catch (e) {
      console.warn('Could not parse file URL for storage deletion', e);
    }

    // Now delete DB record
    const { error } = await supabase.from('uploads').delete().eq('id', id);
    if (error) {
      import('../components/toast.js').then(m => m.showToast('Error deleting record: ' + error.message, 'error'));
      return;
    }
    
    import('../components/toast.js').then(m => m.showToast('Resource permanently deleted', 'success'));
    
    // Reload the view
    const btn = document.getElementById('filter-btn');
    if (btn) btn.click();
  };
}
