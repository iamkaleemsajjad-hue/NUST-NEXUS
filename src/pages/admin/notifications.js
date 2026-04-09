import { getCurrentUser, getUserProfile } from '../../utils/auth.js';
import { renderSidebar, initSidebar } from '../../components/sidebar.js';
import { renderHeader, initHeader, setBreadcrumb } from '../../components/header.js';
import { showToast } from '../../components/toast.js';
import { supabase } from '../../utils/supabase.js';
import { router } from '../../router.js';

export async function renderAdminNotifications() {
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
          <h2 style="margin-bottom:var(--space-xl);"><i class="fa-solid fa-bell"></i> Manage Notifications</h2>
          
          <div class="card" style="margin-bottom:var(--space-xl);">
            <h3 style="margin-bottom:var(--space-lg);">Send Broadcast Notification</h3>
            <form id="notif-form">
              <div class="form-group"><label class="form-label">Title</label><input type="text" class="form-input" id="notif-title" required /></div>
              <div class="form-group"><label class="form-label">Message</label><textarea class="form-textarea" id="notif-message" required></textarea></div>
              <button type="submit" class="btn btn-primary"><i class="fa-solid fa-paper-plane"></i> Send to All Students</button>
            </form>
          </div>

          <h3 style="margin-bottom:var(--space-lg);">Active Notifications</h3>
          <div id="notif-list"></div>
        </div>
      </div>
    </div>
  `;

  initSidebar(); initHeader(profile); setBreadcrumb('Notifications');

  document.getElementById('notif-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('notif-title').value.trim();
    const message = document.getElementById('notif-message').value.trim();
    const { error } = await supabase.from('notifications').insert({ title, message, created_by: profile.id });
    if (error) showToast('Failed: ' + error.message, 'error');
    else {
      showToast('Notification sent!', 'success');
      document.getElementById('notif-form').reset();
      loadNotifications();
    }
  });

  loadNotifications();
}

async function loadNotifications() {
  const container = document.getElementById('notif-list');
  const { data } = await supabase.from('notifications').select('*').order('created_at', { ascending: false });
  if (!data || data.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>No notifications</p></div>';
    return;
  }
  container.innerHTML = data.map(n => `
    <div class="card" style="margin-bottom:var(--space-md);">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <h4>${n.title}</h4>
          <p style="color:var(--text-secondary);margin-top:4px;">${n.message}</p>
          <span style="color:var(--text-muted);font-size:0.75rem;">${new Date(n.created_at).toLocaleString()}</span>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-ghost btn-sm toggle-notif" data-id="${n.id}" data-active="${n.is_active}" 
            style="color:${n.is_active ? 'var(--success)' : 'var(--text-muted)'};">
            <i class="fa-solid ${n.is_active ? 'fa-eye' : 'fa-eye-slash'}"></i>
          </button>
          <button class="btn btn-ghost btn-sm del-notif" data-id="${n.id}" style="color:var(--danger);">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.toggle-notif').forEach(btn => {
    btn.addEventListener('click', async () => {
      const active = btn.dataset.active === 'true';
      await supabase.from('notifications').update({ is_active: !active }).eq('id', btn.dataset.id);
      loadNotifications();
    });
  });
  container.querySelectorAll('.del-notif').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete?')) return;
      await supabase.from('notifications').delete().eq('id', btn.dataset.id);
      loadNotifications();
    });
  });
}
