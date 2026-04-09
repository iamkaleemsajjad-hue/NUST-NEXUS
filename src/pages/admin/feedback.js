import { getCurrentUser, getUserProfile } from '../../utils/auth.js';
import { renderSidebar, initSidebar } from '../../components/sidebar.js';
import { renderHeader, initHeader, setBreadcrumb } from '../../components/header.js';
import { showToast } from '../../components/toast.js';
import { supabase } from '../../utils/supabase.js';
import { router } from '../../router.js';

export async function renderAdminFeedback() {
  const app = document.getElementById('app');
  const user = await getCurrentUser();
  if (!user) return router.navigate('/login');
  const profile = await getUserProfile(user.id);
  if (!profile || profile.role !== 'admin') return router.navigate('/dashboard');

  app.innerHTML = `
    <div class="app-layout">
      ${renderSidebar(profile)}
      <div class="main-content">
        ${renderHeader(profile)}
        <div class="page-container">
          <h2 style="margin-bottom:var(--space-xl);"><i class="fa-solid fa-comments"></i> Feedback Management</h2>

          <!-- Filter Tabs -->
          <div class="tabs" style="margin-bottom:var(--space-xl);">
            <button class="tab-btn active" data-filter="all" id="tab-all">All Feedback</button>
            <button class="tab-btn" data-filter="student" id="tab-student">Student</button>
            <button class="tab-btn" data-filter="public" id="tab-public">Public</button>
            <button class="tab-btn" data-filter="unreplied" id="tab-unreplied">Unreplied</button>
          </div>

          <div id="feedback-container">
            <div class="skeleton skeleton-card" style="height:300px;"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  initSidebar(); initHeader(profile); setBreadcrumb('Feedback Management');

  let currentFilter = 'all';
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      loadFeedback(currentFilter);
    });
  });

  loadFeedback('all');
}

async function loadFeedback(filter) {
  const container = document.getElementById('feedback-container');
  container.innerHTML = '<div class="skeleton skeleton-card" style="height:200px;"></div>';

  let query = supabase.from('feedback')
    .select('*, profiles(display_name)')
    .order('created_at', { ascending: false });

  if (filter === 'student') query = query.eq('type', 'student');
  else if (filter === 'public') query = query.eq('type', 'public');
  else if (filter === 'unreplied') query = query.is('admin_reply', null);

  const { data, error } = await query;

  if (error) {
    container.innerHTML = `<div class="empty-state"><p>Error: ${error.message}</p></div>`;
    return;
  }

  if (!data || data.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-inbox"></i>
        <h4>No feedback found</h4>
        <p>No feedback matching this filter</p>
      </div>
    `;
    return;
  }

  container.innerHTML = data.map(f => `
    <div class="card" style="margin-bottom:var(--space-md);" id="feedback-${f.id}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:var(--space-md);">
        <div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
            <strong>${f.profiles?.display_name || f.user_name || 'Anonymous'}</strong>
            <span class="badge ${f.type === 'student' ? 'badge-primary' : 'badge-warning'}">${f.type}</span>
            ${f.admin_reply ? '<span class="badge badge-success"><i class="fa-solid fa-check"></i> Replied</span>' : '<span class="badge badge-danger">Unreplied</span>'}
          </div>
          <span style="color:var(--text-muted);font-size:0.75rem;">
            ${new Date(f.created_at).toLocaleString()}
            ${f.user_id ? ` • User ID: ${f.user_id.substring(0, 8)}...` : ''}
          </span>
        </div>
      </div>

      <p style="margin-bottom:var(--space-md);line-height:1.6;">${f.message}</p>

      ${f.admin_reply ? `
        <div style="padding:var(--space-md);background:rgba(0,255,136,0.05);border:1px solid rgba(0,255,136,0.15);border-radius:var(--radius-md);margin-bottom:var(--space-md);">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:var(--space-sm);">
            <i class="fa-solid fa-reply" style="color:var(--success);"></i>
            <strong style="color:var(--success);font-size:0.875rem;">Your Reply</strong>
            ${f.replied_at ? `<span style="color:var(--text-muted);font-size:0.75rem;">${new Date(f.replied_at).toLocaleString()}</span>` : ''}
          </div>
          <p style="color:var(--text-secondary);font-size:0.875rem;">${f.admin_reply}</p>
        </div>
      ` : ''}

      <!-- Reply Form -->
      <div class="reply-form" style="border-top:1px solid var(--grid);padding-top:var(--space-md);">
        <div style="display:flex;gap:var(--space-md);align-items:flex-end;">
          <div style="flex:1;">
            <textarea class="form-textarea reply-textarea" id="reply-${f.id}" placeholder="${f.admin_reply ? 'Update your reply...' : 'Write a reply...'}" style="min-height:60px;">${f.admin_reply || ''}</textarea>
          </div>
          <button class="btn btn-primary btn-sm reply-btn" data-id="${f.id}" data-user-id="${f.user_id || ''}" data-user-name="${f.profiles?.display_name || f.user_name || 'User'}">
            <i class="fa-solid fa-reply"></i> ${f.admin_reply ? 'Update' : 'Reply'}
          </button>
        </div>
      </div>
    </div>
  `).join('');

  // Reply handlers
  container.querySelectorAll('.reply-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const feedbackId = btn.dataset.id;
      const userId = btn.dataset.userId;
      const userName = btn.dataset.userName;
      const textarea = document.getElementById(`reply-${feedbackId}`);
      const replyText = textarea.value.trim();

      if (!replyText) {
        showToast('Please write a reply first', 'warning');
        return;
      }

      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span>';

      // Update feedback with reply
      const { error } = await supabase.from('feedback')
        .update({ 
          admin_reply: replyText, 
          replied_at: new Date().toISOString() 
        })
        .eq('id', feedbackId);

      if (error) {
        showToast('Failed: ' + error.message, 'error');
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-reply"></i> Reply';
        return;
      }

      // Create targeted notification for the specific student (if it's a student feedback)
      if (userId) {
        await supabase.from('notifications').insert({
          title: 'Admin replied to your feedback',
          message: replyText.substring(0, 200),
          target_user_id: userId,
          is_active: true,
        });
      }

      showToast(`Reply sent to ${userName}!`, 'success');
      loadFeedback(document.querySelector('.tab-btn.active')?.dataset.filter || 'all');
    });
  });
}
