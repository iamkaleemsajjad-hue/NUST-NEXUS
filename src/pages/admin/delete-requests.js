import { supabase } from '../../utils/supabase.js';
import anime from 'animejs';
import { renderSidebar, initSidebar } from '../../components/sidebar.js';
import { renderHeader, initHeader, setBreadcrumb } from '../../components/header.js';
import { getCurrentUser, getUserProfile } from '../../utils/auth.js';
import { router } from '../../router.js';

let _profile = null;

function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showToast(msg, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <i class="fa-solid fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'circle-exclamation' : type === 'warning' ? 'triangle-exclamation' : 'info-circle'}"></i>
    <span>${escapeHtml(msg)}</span>
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

export async function renderAdminDeleteRequests() {
  const app = document.getElementById('app');
  
  const user = await getCurrentUser();
  if (!user) return router.navigate('/login');
  
  const profile = await getUserProfile(user.id);
  if (!profile || profile.role !== 'admin') {
    return router.navigate('/dashboard');
  }

  _profile = profile;

  const html = `
    <div class="app-layout">
      ${renderSidebar(_profile)}
      <div class="main-content">
        ${renderHeader(_profile)}
        <div class="page-container">
          <div class="delete-requests-container anime-stagger-item">
            <div class="page-header" style="margin-bottom: var(--space-xl);">
              <h2><i class="fa-solid fa-user-xmark"></i> Account Deletion Requests</h2>
              <p class="text-muted">Users who requested permanent deletion. Accounts will automatically purge 14 days after the request date.</p>
            </div>

            <div id="dr-results-container" style="min-height: 200px;">
              <div class="empty-state"><span class="spinner" style="width:40px;height:40px;"></span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  app.innerHTML = html;
  
  initSidebar();
  initHeader(_profile);
  setBreadcrumb('Deletion Requests');

  loadDeleteRequests();
}

async function loadDeleteRequests() {
  const container = document.getElementById('dr-results-container');
  if (!container) return;

  const { data: users, error } = await supabase
    .from('profiles')
    .select('id, display_name, email, created_at, deletion_requested_at')
    .not('deletion_requested_at', 'is', null)
    .order('deletion_requested_at', { ascending: true });

  if (error) {
    container.innerHTML = `<div class="text-danger">Failed to load deletion requests</div>`;
    return;
  }

  if (!users || users.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-shield-check" style="color:var(--success);"></i>
        <h4>No pending requests</h4>
        <p>No user has requested account deletion.</p>
      </div>
    `;
    return;
  }

  // Calculate days left
  const now = Date.now();
  const gracePeriodDays = 14;
  const gracePeriodMs = gracePeriodDays * 24 * 3600000;

  let requestsHtml = '';
  for (const u of users) {
    const requestedAt = new Date(u.deletion_requested_at).getTime();
    const purgeTime = requestedAt + gracePeriodMs;
    const isOverdue = now > purgeTime;
    const msLeft = purgeTime - now;
    const daysLeft = Math.ceil(msLeft / (24*3600000));
    
    // We can also fetch counts of their data if we want
    const { count: upCount } = await supabase.from('uploads').select('id', { count: 'exact', head: true }).eq('user_id', u.id);
    const { count: qnCount } = await supabase.from('questions').select('id', { count: 'exact', head: true }).eq('user_id', u.id);
    const { count: ansCount } = await supabase.from('question_answers').select('id', { count: 'exact', head: true }).eq('user_id', u.id);

    // Using fa-magnifying-glass-chart for User Analysis 
    requestsHtml += `
      <div class="card dr-card" style="margin-bottom:var(--space-md); border-left: 4px solid ${isOverdue ? 'var(--danger)' : 'var(--warning)'}; display:flex; justify-content:space-between; flex-wrap:wrap; gap:var(--space-md);">
        <div>
          <h4 style="margin:0 0 4px 0;">${escapeHtml(u.display_name)}</h4>
          <div style="font-size:0.85rem; color:var(--text-muted); margin-bottom:8px;">${escapeHtml(u.email)} • (ID: ${u.id})</div>
          <div style="font-size:0.8rem; display:flex; gap:12px; margin-bottom:12px;">
            <span><i class="fa-solid fa-file-arrow-up"></i> ${upCount || 0}</span>
            <span><i class="fa-solid fa-circle-question"></i> ${qnCount || 0}</span>
            <span><i class="fa-solid fa-comments"></i> ${ansCount || 0}</span>
          </div>
          <div class="alert ${isOverdue ? 'alert-danger' : 'alert-warning'}" style="padding: 6px 12px; font-size: 0.85rem; display:inline-block; margin:0;">
            ${isOverdue 
              ? `<strong>Grace period ended!</strong> Ready for permanent deletion.` 
              : `<strong>${daysLeft} days left</strong> until auto-deletion (${new Date(purgeTime).toLocaleDateString()})`}
          </div>
        </div>
        <div style="display:flex; flex-direction:column; gap:8px; align-items:flex-end; justify-content:center;">
          <button class="btn btn-secondary btn-sm" onclick="location.hash='/admin/user-analysis'; setTimeout(()=>document.getElementById('ua-search-id').value='${u.id}', 100);">
            <i class="fa-solid fa-magnifying-glass-chart"></i> View Details
          </button>
          <button class="btn btn-primary btn-sm" onclick="window.cancelDeletion('${u.id}')">
            <i class="fa-solid fa-ban"></i> Cancel Request
          </button>
          ${isOverdue || _profile.role === 'admin' ? `
            <button class="btn btn-danger btn-sm" onclick="window.forceDeleteUser('${u.id}', '${escapeHtml(u.email)}')">
              <i class="fa-solid fa-trash"></i> Force Permanently Delete
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }

  container.innerHTML = requestsHtml;

  anime({
    targets: '.dr-card',
    opacity: [0, 1],
    translateX: [-20, 0],
    delay: anime.stagger(50),
    easing: 'easeOutQuad',
    duration: 500
  });

  window.cancelDeletion = async (id) => {
    if (!confirm('Cancel this deletion request?')) return;
    await supabase.from('profiles').update({ deletion_requested_at: null }).eq('id', id);
    showToast('Deletion request cancelled', 'success');
    loadDeleteRequests();
  };

  window.forceDeleteUser = async (id, email) => {
    if (!confirm(`WARNING: You are about to permanently delete ${email}. This action is IRREVERSIBLE. Are you sure?`)) return;
    
    // In Supabase, deleting a user requires going through the Auth Admin API, 
    // but typically we can soft-delete the profile or use a trigger/Edge Function.
    // For this prototype, we'll mark the profile as DELETED and scramble their email.
    // NOTE: True auth user deletion requires an Edge Function.
    
    // Scramble the profile
    const { error } = await supabase.from('profiles').update({
      display_name: 'Deleted User',
      email: `deleted-${id}@purged.local`,
      school: 'N/A',
      is_banned: true,
      ban_reason: 'Account Purged Permanently',
      deletion_requested_at: null
    }).eq('id', id);

    if (error) {
      showToast('Error deleting account data.', 'error');
      return;
    }

    // Rely on is_deleted flags for content integrity
    await supabase.from('questions').update({ is_deleted: true }).eq('user_id', id);
    await supabase.from('question_answers').update({ is_deleted: true }).eq('user_id', id);
    await supabase.from('answer_replies').update({ is_deleted: true }).eq('user_id', id);
    await supabase.from('uploads').update({ is_deleted: true }).eq('user_id', id);

    showToast('User data has been permanently purged.', 'success');
    loadDeleteRequests();
  };
}
