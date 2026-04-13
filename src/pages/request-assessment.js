import { getCurrentUser, getUserProfile } from '../utils/auth.js';
import { renderSidebar, initSidebar } from '../components/sidebar.js';
import { renderHeader, initHeader, setBreadcrumb } from '../components/header.js';
import { showToast } from '../components/toast.js';
import { supabase } from '../utils/supabase.js';
import { sanitizeText, escapeHtml } from '../utils/sanitize.js';
import { router } from '../router.js';

let _profile = null;
let _isAdmin = false;
let _requests = [];

export async function renderRequestAssessmentPage() {
  const app = document.getElementById('app');
  const user = await getCurrentUser();
  if (!user) { router.navigate('/login'); return; }
  const profile = await getUserProfile(user.id);
  if (!profile) { router.navigate('/login'); return; }

  _profile = profile;
  _isAdmin = profile.role === 'admin';

  app.innerHTML = `
    <div class="app-layout">
      ${renderSidebar(profile)}
      <div class="main-content">
        ${renderHeader(profile)}
        <div class="page-container">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-xl);">
            <h2><i class="fa-solid fa-file-circle-plus"></i> Request Assessment</h2>
            ${!_isAdmin ? `
              <button class="btn btn-primary" id="open-req-modal-btn">
                <i class="fa-solid fa-plus"></i> New Request
              </button>` : ''}
          </div>

          <!-- Info banner -->
          <div style="margin-bottom:var(--space-xl);padding:var(--space-md) var(--space-lg);background:rgba(241,196,15,0.08);border:1px solid rgba(241,196,15,0.2);border-radius:var(--radius-md);">
            <p style="font-size:0.9rem;color:var(--text-secondary);margin:0;">
              <i class="fa-solid fa-star" style="color:#F1C40F;"></i>
              <strong> Double Points Reward:</strong> Upload an assessment someone requested, and the admin will award you <strong>double points</strong> as a bonus!
            </p>
          </div>

          <!-- Filter row -->
          <div style="display:flex;gap:8px;margin-bottom:var(--space-lg);">
            <button class="btn btn-secondary btn-sm" data-filter="all" onclick="window.filterReq('all',this)">All</button>
            <button class="btn btn-ghost btn-sm" data-filter="open" onclick="window.filterReq('open',this)">Open</button>
            <button class="btn btn-ghost btn-sm" data-filter="fulfilled" onclick="window.filterReq('fulfilled',this)">Fulfilled</button>
          </div>

          <div id="req-list">
            <div class="skeleton skeleton-card" style="height:120px;margin-bottom:12px;"></div>
            <div class="skeleton skeleton-card" style="height:120px;"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- New Request Modal -->
    <div id="req-modal" style="display:none;" class="qa-modal-overlay">
      <div class="qa-modal-box">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-xl);">
          <h3><i class="fa-solid fa-file-circle-plus"></i> Request an Assessment</h3>
          <button class="btn btn-ghost btn-sm" id="req-modal-close"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <p style="color:var(--text-muted);font-size:0.875rem;margin-bottom:var(--space-lg);">
          Request a specific paper, mid, final, or lab assessment. If uploaded by someone, they earn <strong style="color:#F1C40F;">double points</strong>!
        </p>
        <form id="req-form">
          <div class="form-group">
            <label class="form-label">Subject *</label>
            <input type="text" class="form-input" id="req-subject" placeholder="e.g. Data Structures & Algorithms" maxlength="100" required>
          </div>
          <div class="form-group">
            <label class="form-label">Course Code</label>
            <input type="text" class="form-input" id="req-course" placeholder="e.g. CS-301" maxlength="20">
          </div>
          <div class="form-group">
            <label class="form-label">Description *</label>
            <textarea class="form-textarea" id="req-desc" rows="4"
              placeholder="Which specific assessment are you looking for? (e.g. Mid-1 2023, Final paper, Lab exam...)" required></textarea>
          </div>
          <div style="display:flex;gap:var(--space-md);margin-top:var(--space-lg);">
            <button type="submit" class="btn btn-primary" id="req-submit-btn">
              <i class="fa-solid fa-paper-plane"></i> Submit Request
            </button>
            <button type="button" class="btn btn-ghost" id="req-cancel-btn">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  `;

  initSidebar();
  initHeader(profile);
  setBreadcrumb('Request Assessment');

  // Modal events
  document.getElementById('open-req-modal-btn')?.addEventListener('click', () => {
    document.getElementById('req-modal').style.display = 'flex';
  });
  document.getElementById('req-modal-close')?.addEventListener('click', () => {
    document.getElementById('req-modal').style.display = 'none';
  });
  document.getElementById('req-cancel-btn')?.addEventListener('click', () => {
    document.getElementById('req-modal').style.display = 'none';
  });
  document.getElementById('req-form')?.addEventListener('submit', handleSubmitRequest);

  let _filterState = 'all';

  window.filterReq = function(filter, btn) {
    _filterState = filter;
    document.querySelectorAll('[data-filter]').forEach(b => {
      b.className = b.className.replace('btn-secondary', 'btn-ghost').replace(' active-filter', '');
    });
    btn.className = btn.className.replace('btn-ghost', 'btn-secondary') + ' active-filter';
    renderList(_filterState);
  };

  window.adminDeleteReqItem = async function(id) {
    if (!confirm('Delete this request?')) return;
    const { error } = await supabase.from('assessment_requests').update({ is_deleted: true }).eq('id', id);
    if (error) { showToast('Error deleting.', 'error'); return; }
    showToast('Request deleted.', 'success');
    await loadRequests();
  };

  await loadRequests();

  function renderList(filter = 'all') {
    const container = document.getElementById('req-list');
    let list = _requests;
    if (filter === 'open') list = list.filter(r => r.status === 'open');
    if (filter === 'fulfilled') list = list.filter(r => r.status === 'fulfilled');

    if (!list.length) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-file-circle-question"></i>
          <h4>No requests${filter !== 'all' ? ` with status "${filter}"` : ''} yet</h4>
          <p>${!_isAdmin ? 'Click "New Request" to ask for a specific assessment.' : 'No requests match this filter.'}</p>
        </div>`;
      return;
    }

    const now = Date.now();
    container.innerHTML = list.map(r => {
      const ageDays = Math.floor((now - new Date(r.created_at).getTime()) / 86400000);
      let statusTag = '';
      if (r.status === 'fulfilled') {
        statusTag = `<span class="tag-fulfilled"><i class="fa-solid fa-check"></i> Fulfilled</span>`;
      } else if (ageDays >= 3) {
        statusTag = `<span class="tag-needed"><i class="fa-solid fa-triangle-exclamation"></i> Needed (${ageDays}d)</span>`;
      } else {
        statusTag = `<span class="tag-open"><i class="fa-solid fa-circle-dot"></i> Open</span>`;
      }

      return `
        <div class="assessment-card">
          <div class="assessment-card-header">
            <div>
              <h4 style="font-size:0.9375rem;margin-bottom:4px;">
                ${escapeHtml(r.subject)}
                ${r.course_code ? `<span style="color:var(--text-muted);font-weight:400;font-size:0.8rem;">(${escapeHtml(r.course_code)})</span>` : ''}
              </h4>
              <div style="font-size:0.8rem;color:var(--text-muted);">
                <i class="fa-solid fa-user"></i> ${escapeHtml(r.profiles?.display_name || 'Unknown')}
                &nbsp;•&nbsp; ${timeAgo(r.created_at)}
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
              ${statusTag}
              ${_isAdmin ? `
                <button class="btn btn-ghost btn-sm" style="color:var(--danger);" onclick="window.adminDeleteReqItem('${r.id}')">
                  <i class="fa-solid fa-trash"></i>
                </button>` : ''}
            </div>
          </div>
          <p style="color:var(--text-secondary);font-size:0.875rem;line-height:1.6;margin-bottom:var(--space-md);">
            ${escapeHtml(r.description)}
          </p>
          ${r.status === 'open' ? `
            <a href="#/upload" class="btn btn-secondary btn-sm">
              <i class="fa-solid fa-cloud-arrow-up"></i> Upload This Assessment
            </a>` : ''}
        </div>`;
    }).join('');
  }

  async function loadRequests() {
    const { data } = await supabase
      .from('assessment_requests')
      .select('*, profiles:user_id (display_name)')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });
    _requests = data || [];
    renderList(_filterState || 'all');
  }

  async function handleSubmitRequest(e) {
    e.preventDefault();

    // Per-user DB rate limit
    const weekAgo = new Date(Date.now() - 7 * 24 * 3600000).toISOString();
    const { count } = await supabase.from('assessment_requests')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', _profile.id)
      .eq('is_deleted', false)
      .gte('created_at', weekAgo);

    if ((count || 0) >= 3) {
      showToast('Weekly limit: max 3 assessment requests per week.', 'error');
      return;
    }

    const subject = sanitizeText(document.getElementById('req-subject').value, 100);
    const courseCode = sanitizeText(document.getElementById('req-course').value, 20);
    const description = sanitizeText(document.getElementById('req-desc').value, 2000);

    if (subject.length < 2) { showToast('Subject is required.', 'warning'); return; }
    if (description.length < 10) { showToast('Please describe what you need.', 'warning'); return; }

    const btn = document.getElementById('req-submit-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Submitting...';

    const { error } = await supabase.from('assessment_requests').insert({
      user_id: _profile.id,
      subject,
      course_code: courseCode || null,
      description,
    });

    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit Request';

    if (error) { showToast('Error: ' + error.message, 'error'); return; }

    showToast('Assessment request submitted!', 'success');
    document.getElementById('req-modal').style.display = 'none';
    document.getElementById('req-form').reset();
    await loadRequests();
  }
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d < 30) return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString();
}
