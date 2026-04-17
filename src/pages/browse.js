import { getCurrentUser, getUserProfile } from '../utils/auth.js';
import { calculateSemester, getSemesterLabel, getAccessibleSemesters } from '../utils/semester.js';
import { renderSidebar, initSidebar } from '../components/sidebar.js';
import { renderHeader, initHeader, setBreadcrumb } from '../components/header.js';
import { showToast } from '../components/toast.js';
import { supabase } from '../utils/supabase.js';
import { router } from '../router.js';
import { UPLOAD_TYPES } from '../config.js';
import { escapeHtml, sanitizeText, checkRateLimit } from '../utils/sanitize.js';
import { subscribeToTable } from '../utils/realtime.js';
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
  
  // Debounced search
  let searchTimer;
  document.getElementById('filter-search')?.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => loadResources(profile, accessibleSemesters), 400);
  });

  loadResources(profile, accessibleSemesters);

  // Entrance animations
  gsap.fromTo('.filter-section', { y: -15, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out' });
  gsap.fromTo('#resources-container', { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, delay: 0.2, ease: 'power3.out' });

  // Real-time: auto-refresh when uploads change
  subscribeToTable('browse-uploads', 'uploads', 'status=eq.approved', () => {
    loadResources(profile, accessibleSemesters);
  });
}

async function loadResources(profile, accessibleSemesters) {
  const container = document.getElementById('resources-container');
  const semesterFilter = document.getElementById('filter-semester').value;
  const typeFilter = document.getElementById('filter-type').value;
  const searchFilter = sanitizeText(document.getElementById('filter-search').value, 200);
  const adminUser = profile.role === 'admin';

  container.innerHTML = '<div class="skeleton skeleton-card" style="height:300px;"></div>';

  // Fetch ratings in parallel
  const [resourcesResult, ratingsResult] = await Promise.all([
    (async () => {
      let query = supabase.from('uploads')
        .select('*, profiles(display_name), courses(name, code, semester)')
        .eq('status', 'approved')
        .order('created_at', { ascending: false });

      if (semesterFilter) {
        query = query.eq('semester', parseInt(semesterFilter));
      } else if (!adminUser) {
        query = query.in('semester', accessibleSemesters);
      }
      if (typeFilter) query = query.eq('type', typeFilter);
      if (searchFilter) query = query.ilike('title', `%${searchFilter}%`);
      return query;
    })(),
    supabase.from('upload_ratings').select('upload_id, stars, user_id')
  ]);

  const { data, error } = resourcesResult;
  const allRatings = ratingsResult.data || [];

  // Build ratings lookup: { upload_id: { avg, count, myRating } }
  const ratingsMap = {};
  allRatings.forEach(r => {
    if (!ratingsMap[r.upload_id]) ratingsMap[r.upload_id] = { sum: 0, count: 0, myRating: 0 };
    ratingsMap[r.upload_id].sum += r.stars;
    ratingsMap[r.upload_id].count++;
    if (r.user_id === profile.id) ratingsMap[r.upload_id].myRating = r.stars;
  });

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
            <!-- Star Rating -->
            ${(() => {
              const rm = ratingsMap[r.id] || { sum: 0, count: 0, myRating: 0 };
              const avg = rm.count > 0 ? (rm.sum / rm.count).toFixed(1) : '0.0';
              const alreadyRated = rm.myRating > 0;
              return `
              <div style="display:flex;align-items:center;gap:8px;margin-top:var(--space-sm);" class="star-rating-row" data-upload-id="${r.id}">
                <div class="star-interactive" style="display:flex;gap:2px;${alreadyRated ? '' : 'cursor:pointer;'}">
                  ${[1,2,3,4,5].map(s => `
                    <i class="fa-${s <= rm.myRating ? 'solid' : 'regular'} fa-star ${alreadyRated ? '' : 'star-icon'}" 
                       ${alreadyRated ? '' : `data-star="${s}" data-upload="${r.id}"`}
                       style="font-size:0.85rem;color:${s <= rm.myRating ? '#ffcc00' : 'var(--text-muted)'};${alreadyRated ? 'opacity:0.85;' : 'cursor:pointer;transition:color 0.15s,transform 0.15s;'}"
                       ${alreadyRated ? '' : 'onmouseenter="this.style.transform=\'scale(1.25)\'" onmouseleave="this.style.transform=\'scale(1)\'"'}></i>
                  `).join('')}
                </div>
                <span style="font-size:0.78rem;color:var(--text-muted);">${avg} <span style="opacity:0.6;">(${rm.count})</span>${alreadyRated ? ' <i class="fa-solid fa-lock" style="font-size:0.6rem;opacity:0.4;"></i>' : ''}</span>
              </div>`;
            })()}
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:var(--space-md);padding-top:var(--space-md);border-top:1px solid var(--border);">
              <span style="color:var(--text-muted);font-size:0.75rem;">
                <i class="fa-solid fa-user"></i> ${r.profiles?.display_name || 'Unknown'} •
                ${new Date(r.created_at).toLocaleDateString()}
              </span>
              <div style="display:flex;gap:8px;">
                ${adminUser ? `
                  <button class="btn btn-ghost btn-sm" style="color:var(--danger);" onclick="window.deleteUpload('${r.id}', '${r.file_url}')" title="Delete Resource">
                    <i class="fa-solid fa-trash"></i>
                  </button>
                ` : `
                  <button class="btn btn-ghost btn-sm report-btn" data-id="${r.id}" data-title="${escapeHtml(r.title)}" title="Report this resource" style="color:var(--warning);">
                    <i class="fa-solid fa-flag"></i>
                  </button>
                `}
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

  // Star rating click handlers
  container.querySelectorAll('.star-icon').forEach(star => {
    star.addEventListener('click', async (e) => {
      e.stopPropagation();
      const uploadId = star.dataset.upload;
      const stars = parseInt(star.dataset.star);

      const rl = checkRateLimit('rate', 20, 3600000);
      if (!rl.allowed) {
        showToast('Too many ratings. Please slow down.', 'warning');
        return;
      }

      // Insert (not upsert) for one-time rating
      const { error: rateErr } = await supabase
        .from('upload_ratings')
        .insert({ upload_id: uploadId, user_id: profile.id, stars });

      if (rateErr) {
        showToast('Failed to rate: ' + rateErr.message, 'error');
        return;
      }

      // Update the stars visually in-place and lock them
      const row = container.querySelector(`.star-rating-row[data-upload-id="${uploadId}"]`);
      if (row) {
        row.querySelectorAll('.star-icon, .fa-star').forEach(s => {
          const v = parseInt(s.dataset.star || '0');
          s.className = `fa-${v <= stars ? 'solid' : 'regular'} fa-star`;
          s.style.color = v <= stars ? '#ffcc00' : 'var(--text-muted)';
          s.style.opacity = '0.85';
          s.style.cursor = 'default';
          s.replaceWith(s.cloneNode(true)); // Remove event listeners
        });
      }
      showToast(`Rated ${stars} star${stars !== 1 ? 's' : ''}!`, 'success');
    });
  });

  // Download handlers
  container.querySelectorAll('.download-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const uploadId = btn.dataset.id;
      const fileUrl = btn.dataset.url;
      const title = btn.dataset.title;
      const type = btn.dataset.type;

      // ── OWASP: Rate limit downloads — max 10 per hour ──
      const rl = checkRateLimit('download', 10, 3600000);
      if (!rl.allowed) {
        showToast(`Too many downloads. Please wait ${Math.ceil(rl.remainingMs / 60000)} min`, 'error');
        return;
      }

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

        // ── OWASP: Secure server-side point deduction via RPC (prevents client-side manipulation) ──
        const { data: rpcResult, error: rpcError } = await supabase.rpc('deduct_download_points', {
          point_cost: pointCost,
          upload_id: uploadId
        });

        if (rpcError || !rpcResult?.success) {
          import('../components/toast.js').then(m => m.showToast(rpcResult?.error || 'Failed to deduct points!', 'error'));
          return;
        }
        
        // Update local profile with server-confirmed balance
        profile.points = rpcResult.points_remaining;
        
        // Update header UI if points are displayed
        const pointsBadge = document.querySelector('.header-actions .badge-warning');
        if (pointsBadge && pointsBadge.innerHTML.includes('fa-star')) {
          pointsBadge.innerHTML = `<i class="fa-solid fa-star"></i> ${profile.points} Pts`;
        }
      } else {
        // Admin: just record the download, no points
        await supabase.from('downloads').insert({ upload_id: uploadId, user_id: profile.id });
      }

      // Open file
      window.open(fileUrl, '_blank');
      import('../components/toast.js').then(m => m.showToast(`Downloading: ${title}`, 'success'));
    });
  });

  // Report handlers
  container.querySelectorAll('.report-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const uploadId = btn.dataset.id;
      const uploadTitle = btn.dataset.title;
      showReportModal(uploadId, uploadTitle, profile.id);
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

/**
 * Show a report modal for flagging a resource
 */
function showReportModal(uploadId, uploadTitle, reporterId) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content" style="max-width:480px;">
      <div class="modal-header">
        <h3><i class="fa-solid fa-flag" style="color:var(--warning);"></i> Report Resource</h3>
        <button class="modal-close" id="close-report-modal">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
      <div class="modal-body">
        <p style="color:var(--text-secondary);margin-bottom:var(--space-lg);font-size:0.875rem;">
          Reporting: <strong>${uploadTitle}</strong>
        </p>
        <div class="form-group">
          <label class="form-label">Why are you reporting this resource?</label>
          <textarea class="form-input" id="report-reason" rows="4" 
            placeholder="e.g. Fake content, copyright violation, contains personal info, inappropriate material..."
            maxlength="500" required style="resize:vertical;"></textarea>
          <span class="form-helper" style="display:flex;justify-content:space-between;">
            <span>Be specific so admins can take action</span>
            <span id="report-char-count">0/500</span>
          </span>
        </div>
        <div style="display:flex;gap:var(--space-md);justify-content:flex-end;margin-top:var(--space-lg);">
          <button class="btn btn-ghost" id="cancel-report-btn">Cancel</button>
          <button class="btn btn-danger" id="submit-report-btn">
            <i class="fa-solid fa-flag"></i> Submit Report
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Close handlers
  const closeModal = () => modal.remove();
  modal.querySelector('#close-report-modal').addEventListener('click', closeModal);
  modal.querySelector('#cancel-report-btn').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  // Char counter
  const textarea = modal.querySelector('#report-reason');
  const charCount = modal.querySelector('#report-char-count');
  textarea.addEventListener('input', () => {
    charCount.textContent = `${textarea.value.length}/500`;
  });

  // Submit
  modal.querySelector('#submit-report-btn').addEventListener('click', async () => {
    const reason = textarea.value.trim();
    if (!reason || reason.length < 10) {
      showToast('Please provide a detailed reason (at least 10 characters)', 'warning');
      return;
    }

    // Rate limit: max 5 reports per hour
    const rl = checkRateLimit('report', 5, 3600000);
    if (!rl.allowed) {
      showToast(`Too many reports. Please wait ${Math.ceil(rl.remainingMs / 60000)} min`, 'error');
      return;
    }

    // Check for duplicate report
    const { data: existing } = await supabase
      .from('upload_reports')
      .select('id')
      .eq('upload_id', uploadId)
      .eq('reporter_id', reporterId)
      .eq('status', 'pending')
      .maybeSingle();

    if (existing) {
      showToast('You already have a pending report for this resource', 'warning');
      closeModal();
      return;
    }

    const submitBtn = modal.querySelector('#submit-report-btn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> Submitting...';

    const { error } = await supabase.from('upload_reports').insert({
      upload_id: uploadId,
      reporter_id: reporterId,
      reason: reason,
    });

    if (error) {
      showToast('Failed to submit report: ' + error.message, 'error');
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fa-solid fa-flag"></i> Submit Report';
      return;
    }

    showToast('Report submitted! An admin will review it shortly.', 'success');
    closeModal();
  });
}
