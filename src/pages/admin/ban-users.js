import { getCurrentUser, getUserProfile } from '../../utils/auth.js';
import { renderSidebar, initSidebar } from '../../components/sidebar.js';
import { renderHeader, initHeader, setBreadcrumb } from '../../components/header.js';
import { showToast } from '../../components/toast.js';
import { supabase } from '../../utils/supabase.js';
import { escapeHtml, sanitizeEmail } from '../../utils/sanitize.js';
import { router } from '../../router.js';
import gsap from 'gsap';

export async function renderAdminBanUsers() {
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
            <h2 style="color:var(--danger);"><i class="fa-solid fa-ban"></i> Ban Users</h2>
          </div>

          <!-- Ban warning card -->
          <div style="margin-bottom:var(--space-xl);padding:var(--space-lg);background:rgba(255,68,68,0.08);border:1px solid rgba(255,68,68,0.25);border-radius:var(--radius-lg);">
            <h4 style="color:var(--danger);margin-bottom:8px;"><i class="fa-solid fa-triangle-exclamation"></i> Important</h4>
            <p style="color:var(--text-secondary);font-size:0.875rem;line-height:1.6;margin:0;">
              Banning a user <strong>permanently blocks</strong> them from logging in, signing up, or accessing the platform with that email.
              No verification email is sent. This action can be reversed by unbanning.
            </p>
          </div>

          <!-- Stats row -->
          <div class="grid-3" style="margin-bottom:var(--space-xl);">
            <div class="stat-card card">
              <div class="stat-icon" style="background:rgba(255,68,68,0.1);color:var(--danger);"><i class="fa-solid fa-ban"></i></div>
              <div class="stat-info"><span class="stat-value" id="stat-banned">—</span><span class="stat-label">Banned Users</span></div>
            </div>
            <div class="stat-card card">
              <div class="stat-icon" style="background:rgba(0,204,255,0.1);color:var(--primary);"><i class="fa-solid fa-users"></i></div>
              <div class="stat-info"><span class="stat-value" id="stat-total-users">—</span><span class="stat-label">Total Users</span></div>
            </div>
            <div class="stat-card card">
              <div class="stat-icon" style="background:rgba(0,255,136,0.1);color:var(--success);"><i class="fa-solid fa-user-check"></i></div>
              <div class="stat-info"><span class="stat-value" id="stat-active">—</span><span class="stat-label">Active Users</span></div>
            </div>
          </div>

          <!-- Ban form -->
          <div class="card" style="margin-bottom:var(--space-xl);padding:var(--space-xl);">
            <h3 style="margin-bottom:var(--space-lg);font-size:1rem;"><i class="fa-solid fa-user-slash"></i> Ban a User by Email</h3>
            <form id="ban-form" style="display:flex;gap:var(--space-md);align-items:flex-end;flex-wrap:wrap;">
              <div class="form-group" style="flex:1;min-width:250px;margin:0;">
                <label class="form-label">User Email</label>
                <input type="email" class="form-input" id="ban-email" placeholder="user@nust.edu.pk" required>
              </div>
              <div class="form-group" style="flex:1;min-width:200px;margin:0;">
                <label class="form-label">Reason (optional)</label>
                <input type="text" class="form-input" id="ban-reason" placeholder="Spam, abuse, etc." maxlength="200">
              </div>
              <button type="submit" class="btn btn-danger" id="ban-submit-btn" style="flex-shrink:0;">
                <i class="fa-solid fa-ban"></i> Ban User
              </button>
            </form>
          </div>

          <!-- Banned users list -->
          <div style="margin-bottom:var(--space-md);">
            <h3 style="font-size:1rem;"><i class="fa-solid fa-list"></i> Banned Users</h3>
          </div>
          <div id="banned-list">
            <div class="skeleton skeleton-card" style="height:80px;margin-bottom:8px;"></div>
            <div class="skeleton skeleton-card" style="height:80px;"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Add danger button style if not present
  if (!document.getElementById('ban-btn-style')) {
    const s = document.createElement('style');
    s.id = 'ban-btn-style';
    s.textContent = `.btn-danger { background: var(--danger); color: #fff; border: none; }
    .btn-danger:hover { background: #cc0000; }`;
    document.head.appendChild(s);
  }

  initSidebar();
  initHeader(profile);
  setBreadcrumb('Ban Users');

  gsap.fromTo('.stat-card', { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, stagger: 0.08, ease: 'power3.out' });

  await loadStats();
  await loadBannedUsers();

  document.getElementById('ban-form')?.addEventListener('submit', handleBanUser);

  async function loadStats() {
    const { count: total } = await supabase.from('profiles').select('id', { count: 'exact', head: true });
    const { count: banned } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_banned', true);
    document.getElementById('stat-total-users').textContent = total || 0;
    document.getElementById('stat-banned').textContent = banned || 0;
    document.getElementById('stat-active').textContent = (total || 0) - (banned || 0);
  }

  async function loadBannedUsers() {
    // Fetch directly from banned_emails to include newcomers
    const { data: bannedEmails } = await supabase
      .from('banned_emails')
      .select('*')
      .order('created_at', { ascending: false });

    // Also fetch associated profiles if they exist
    const { data: bannedProfiles } = await supabase
      .from('profiles')
      .select('id, display_name, email, is_banned')
      .eq('is_banned', true);

    const merged = (bannedEmails || []).map(b => {
      const p = (bannedProfiles || []).find(prof => prof.email === b.email);
      return {
        id: p ? p.id : b.id, // profile id or banned_email id
        email: b.email,
        display_name: p ? p.display_name : 'Unregistered User',
        ban_reason: b.reason,
        banned_at: b.created_at,
        is_registered: !!p
      };
    });

    const container = document.getElementById('banned-list');

    if (!merged || merged.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-circle-check" style="color:var(--success);"></i>
          <h4>No banned users</h4>
          <p>All users are currently active.</p>
        </div>`;
      return;
    }

    container.innerHTML = merged.map(u => `
      <div class="card" style="margin-bottom:var(--space-sm);padding:var(--space-md) var(--space-lg);" id="ban-row-${u.id}">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:var(--space-md);flex-wrap:wrap;">
          <div>
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">
              <div style="width:32px;height:32px;border-radius:50%;background:var(--danger);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.875rem;flex-shrink:0;">
                ${(u.display_name || u.email || 'U').charAt(0).toUpperCase()}
              </div>
              <div>
                <div style="font-weight:600;font-size:0.9rem;">${escapeHtml(u.display_name)} ${u.is_registered ? '' : '<span style="font-size:0.75rem;color:var(--text-muted);">(Newcomer)</span>'}</div>
                <div style="font-size:0.8rem;color:var(--text-muted);">${escapeHtml(u.email || 'No email')}</div>
              </div>
              <span style="padding:2px 10px;background:rgba(255,68,68,0.12);border:1px solid rgba(255,68,68,0.3);border-radius:var(--radius-full);color:var(--danger);font-size:0.72rem;font-weight:700;">
                BANNED
              </span>
            </div>
            ${u.ban_reason ? `<div style="font-size:0.8rem;color:var(--text-muted);"><i class="fa-solid fa-comment"></i> Reason: ${escapeHtml(u.ban_reason)}</div>` : ''}
            ${u.banned_at ? `<div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px;"><i class="fa-regular fa-clock"></i> Banned: ${new Date(u.banned_at).toLocaleString()}</div>` : ''}
          </div>
          <button class="btn btn-secondary btn-sm" onclick="window.unbanUser('${u.email}', '${escapeHtml(u.display_name || u.email)}')">
            <i class="fa-solid fa-rotate-left"></i> Unban
          </button>
        </div>
      </div>
    `).join('');

    window.unbanUser = async (email, name) => {
      if (!confirm(`Unban ${name}? They will be able to log in or sign up again.`)) return;
      
      // Delete from banned_emails table
      await supabase.from('banned_emails').delete().eq('email', email);
      
      // Update profile if exists
      const { error } = await supabase.from('profiles').update({
        is_banned: false,
        ban_reason: null,
        banned_at: null,
        banned_by: null
      }).eq('email', email);
      
      showToast(`${name} has been unbanned.`, 'success');
      await loadStats();
      await loadBannedUsers();
    };
  }

  async function handleBanUser(e) {
    e.preventDefault();
    const emailRaw = document.getElementById('ban-email').value;
    const reason = document.getElementById('ban-reason').value.trim();
    const { valid, email } = sanitizeEmail(emailRaw);

    if (!valid) { showToast('Enter a valid email address.', 'warning'); return; }

    const btn = document.getElementById('ban-submit-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Banning...';

    // Find user profile by email
    const { data: targetUser } = await supabase
      .from('profiles')
      .select('id, display_name, email, is_banned')
      .eq('email', email)
      .maybeSingle();

    if (targetUser && targetUser.is_banned) {
      showToast('This user is already banned.', 'warning');
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-ban"></i> Ban User';
      return;
    }

    if (targetUser && targetUser.id === profile.id) {
      showToast('You cannot ban yourself.', 'error');
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-ban"></i> Ban User';
      return;
    }

    // Insert into banned_emails table to block signup / login unequivocally
    const { error: banEmailErr } = await supabase.from('banned_emails').upsert({
      email,
      reason: reason || null,
      banned_by: profile.id,
    }, { onConflict: 'email' });

    if (banEmailErr) {
       showToast('Error registering ban: ' + banEmailErr.message, 'error');
       btn.disabled = false;
       btn.innerHTML = '<i class="fa-solid fa-ban"></i> Ban User';
       return;
    }

    // Update profile if existed
    if (targetUser) {
      await supabase.from('profiles').update({
        is_banned: true,
        ban_reason: reason || null,
        banned_at: new Date().toISOString(),
        banned_by: profile.id,
      }).eq('id', targetUser.id);
    }

    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-ban"></i> Ban User';

    showToast(`${targetUser?.display_name || email} has been permanently banned.`, 'success');
    document.getElementById('ban-form').reset();
    await loadStats();
    await loadBannedUsers();
  }
}
