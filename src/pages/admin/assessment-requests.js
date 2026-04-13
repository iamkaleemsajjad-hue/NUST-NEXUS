import { getCurrentUser, getUserProfile } from '../../utils/auth.js';
import { renderSidebar, initSidebar } from '../../components/sidebar.js';
import { renderHeader, initHeader, setBreadcrumb } from '../../components/header.js';
import { showToast } from '../../components/toast.js';
import { supabase } from '../../utils/supabase.js';
import { escapeHtml } from '../../utils/sanitize.js';
import { router } from '../../router.js';
import { POINTS } from '../../config.js';
import gsap from 'gsap';

export async function renderAdminAssessmentRequests() {
  const app = document.getElementById('app');
  const user = await getCurrentUser();
  if (!user) { router.navigate('/login'); return; }
  const profile = await getUserProfile(user.id);
  if (!profile || profile.role !== 'admin') { router.navigate('/dashboard'); return; }

  app.innerHTML = `
    <div class="app-layout">
      ${renderSidebar(profile)}
      <div class="main-content">
        ${renderHeader(profile)}
        <div class="page-container">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-xl);">
            <h2><i class="fa-solid fa-file-circle-question"></i> Assessment Requests</h2>
            <button class="btn btn-ghost btn-sm" onclick="window.loadAdminAssessments()">
              <i class="fa-solid fa-arrows-rotate"></i> Refresh
            </button>
          </div>

          <!-- Stats row -->
          <div class="grid-3" id="assess-stats">
            <div class="stat-card card">
              <div class="stat-icon" style="background:rgba(0,204,255,0.1);color:var(--primary);"><i class="fa-solid fa-file-circle-question"></i></div>
              <div class="stat-info"><span class="stat-value" id="stat-total">—</span><span class="stat-label">Total Requests</span></div>
            </div>
            <div class="stat-card card">
              <div class="stat-icon" style="background:rgba(255,184,0,0.1);color:var(--warning);"><i class="fa-solid fa-clock"></i></div>
              <div class="stat-info"><span class="stat-value" id="stat-open">—</span><span class="stat-label">Open</span></div>
            </div>
            <div class="stat-card card">
              <div class="stat-icon" style="background:rgba(0,255,136,0.1);color:var(--success);"><i class="fa-solid fa-check-circle"></i></div>
              <div class="stat-info"><span class="stat-value" id="stat-fulfilled">—</span><span class="stat-label">Fulfilled</span></div>
            </div>
          </div>

          <!-- Filter -->
          <div style="display:flex;gap:8px;margin:var(--space-xl) 0 var(--space-md);">
            <button class="btn btn-secondary btn-sm active-filter" data-filter="all" onclick="window.filterAssessments('all', this)">All</button>
            <button class="btn btn-ghost btn-sm" data-filter="open" onclick="window.filterAssessments('open', this)">Open</button>
            <button class="btn btn-ghost btn-sm" data-filter="fulfilled" onclick="window.filterAssessments('fulfilled', this)">Fulfilled — Awaiting Double Points</button>
          </div>

          <!-- List -->
          <div id="admin-assessment-list">
            <div class="skeleton skeleton-card" style="height:120px;margin-bottom:12px;"></div>
            <div class="skeleton skeleton-card" style="height:120px;"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  initSidebar();
  initHeader(profile);
  setBreadcrumb('Assessment Requests');

  gsap.fromTo('.stat-card', { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, stagger: 0.08, ease: 'power3.out' });

  let _allRequests = [];
  let _currentFilter = 'all';

  window.loadAdminAssessments = async function() {
    const { data } = await supabase
      .from('assessment_requests')
      .select(`
        *,
        profiles:user_id (id, display_name, email),
        fulfilled_profile:fulfilled_by (id, display_name)
      `)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    _allRequests = data || [];

    // Update stats
    const total = _allRequests.length;
    const open = _allRequests.filter(r => r.status === 'open').length;
    const fulfilled = _allRequests.filter(r => r.status === 'fulfilled').length;
    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-open').textContent = open;
    document.getElementById('stat-fulfilled').textContent = fulfilled;

    renderList();
  };

  window.filterAssessments = function(filter, btn) {
    _currentFilter = filter;
    document.querySelectorAll('[data-filter]').forEach(b => {
      b.className = b.className.replace('btn-secondary', 'btn-ghost').replace(' active-filter', '');
    });
    btn.className = btn.className.replace('btn-ghost', 'btn-secondary') + ' active-filter';
    renderList();
  };

  function renderList() {
    const container = document.getElementById('admin-assessment-list');
    let list = _allRequests;

    if (_currentFilter === 'open') list = list.filter(r => r.status === 'open');
    if (_currentFilter === 'fulfilled') list = list.filter(r => r.status === 'fulfilled');

    if (!list.length) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-file-circle-question"></i>
          <h4>No requests</h4>
          <p>No assessment requests match this filter.</p>
        </div>`;
      return;
    }

    const now = Date.now();

    container.innerHTML = list.map(r => {
      const ageMs = now - new Date(r.created_at).getTime();
      const ageDays = Math.floor(ageMs / 86400000);

      // Tag logic
      let statusTag = '';
      if (r.status === 'fulfilled' && !r.double_points_given) {
        statusTag = `<span class="tag-needed"><i class="fa-solid fa-coins"></i> Needs Double Points</span>`;
      } else if (r.status === 'fulfilled' && r.double_points_given) {
        statusTag = `<span class="tag-fulfilled"><i class="fa-solid fa-check"></i> Double Points Given</span>`;
      } else if (r.status === 'open' && ageDays >= 3) {
        statusTag = `<span class="tag-needed"><i class="fa-solid fa-triangle-exclamation"></i> Needed (${ageDays}d old)</span>`;
      } else {
        statusTag = `<span class="tag-open"><i class="fa-solid fa-circle-dot"></i> Open</span>`;
      }

      return `
        <div class="card" style="margin-bottom:var(--space-md);" id="areq-${r.id}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:var(--space-md);flex-wrap:wrap;">
            <div style="flex:1;min-width:0;">
              <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px;">
                <h4 style="font-size:0.9375rem;">${escapeHtml(r.subject)}${r.course_code ? ` <span style="color:var(--text-muted);font-weight:400;font-size:0.8rem;">(${escapeHtml(r.course_code)})</span>` : ''}</h4>
                ${statusTag}
              </div>
              <p style="color:var(--text-secondary);font-size:0.875rem;line-height:1.6;margin-bottom:var(--space-sm);">${escapeHtml(r.description)}</p>
              <div style="font-size:0.8rem;color:var(--text-muted);display:flex;gap:16px;flex-wrap:wrap;">
                <span><i class="fa-solid fa-user"></i> Requested by: <strong>${escapeHtml(r.profiles?.display_name || 'Unknown')}</strong> (${escapeHtml(r.profiles?.email || '')})</span>
                <span><i class="fa-regular fa-clock"></i> ${new Date(r.created_at).toLocaleString()}</span>
                ${r.status === 'fulfilled' ? `<span><i class="fa-solid fa-cloud-arrow-up"></i> Fulfilled by: <strong>${escapeHtml(r.fulfilled_profile?.display_name || 'Unknown')}</strong></span>` : ''}
              </div>
            </div>
            <div style="display:flex;flex-direction:column;gap:8px;flex-shrink:0;">
              ${r.status === 'fulfilled' && !r.double_points_given ? `
                <button class="btn btn-primary btn-sm" onclick="window.giveDoublePoints('${r.id}', '${r.fulfilled_by}', '${r.fulfilled_upload_id || ''}')">
                  <i class="fa-solid fa-coins"></i> Give Double Points
                </button>
              ` : ''}
              ${r.status === 'open' ? `
                <button class="btn btn-secondary btn-sm" onclick="window.markFulfilled('${r.id}')">
                  <i class="fa-solid fa-check"></i> Mark Fulfilled
                </button>
              ` : ''}
              <button class="btn btn-ghost btn-sm" style="color:var(--danger);" onclick="window.adminDeleteAssReq('${r.id}')">
                <i class="fa-solid fa-trash"></i> Delete
              </button>
            </div>
          </div>
        </div>`;
    }).join('');
  }

  window.adminDeleteAssReq = async function(id) {
    if (!confirm('Delete this assessment request?')) return;
    const { error } = await supabase.from('assessment_requests').update({ is_deleted: true }).eq('id', id);
    if (error) { showToast('Error deleting request.', 'error'); return; }
    showToast('Request deleted.', 'success');
    await window.loadAdminAssessments();
  };

  window.markFulfilled = async function(id) {
    const fulfillerIdRaw = prompt('Enter the user ID of the person who fulfilled this request (leave blank to skip assigning):');
    const fulfillerId = fulfillerIdRaw?.trim() || null;

    const updates = { status: 'fulfilled' };
    if (fulfillerId) updates.fulfilled_by = fulfillerId;

    const { error } = await supabase.from('assessment_requests').update(updates).eq('id', id);
    if (error) { showToast('Error updating request.', 'error'); return; }
    showToast('Request marked as fulfilled.', 'success');
    await window.loadAdminAssessments();
  };

  window.giveDoublePoints = async function(requestId, fulfillerId, uploadId) {
    if (!fulfillerId || fulfillerId === 'null') {
      showToast('No fulfiller recorded for this request. Mark it fulfilled first with a user ID.', 'warning');
      return;
    }

    if (!confirm('Award double points to the person who fulfilled this assessment request?')) return;

    // Determine base points: check the linked upload type
    let basePoints = POINTS.UPLOAD_GENERAL; // default
    if (uploadId && uploadId !== 'null') {
      const { data: upload } = await supabase.from('uploads').select('type, points_awarded').eq('id', uploadId).single();
      if (upload?.points_awarded) basePoints = upload.points_awarded;
    }

    // Award extra bonus matching the base upload points (effectively doubling total)
    const { data: fp } = await supabase.from('profiles').select('points').eq('id', fulfillerId).single();
    if (!fp) { showToast('Could not find fulfiller profile.', 'error'); return; }

    const { error: pe } = await supabase.from('profiles').update({
      points: (fp.points || 0) + basePoints + POINTS.ASSESSMENT_FULFILL_BONUS
    }).eq('id', fulfillerId);

    if (pe) { showToast('Error awarding points.', 'error'); return; }

    // Mark double points as given
    await supabase.from('assessment_requests').update({ double_points_given: true }).eq('id', requestId);

    showToast(`Double points awarded! +${basePoints + POINTS.ASSESSMENT_FULFILL_BONUS} pts given.`, 'success');
    await window.loadAdminAssessments();
  };

  await window.loadAdminAssessments();
}
