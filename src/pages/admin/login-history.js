/**
 * NUST NEXUS — Admin Login History Page
 * Shows comprehensive login analytics for all users.
 */

import { getCurrentUser, getUserProfile } from '../../utils/auth.js';
import { renderSidebar, initSidebar } from '../../components/sidebar.js';
import { renderHeader, initHeader, setBreadcrumb } from '../../components/header.js';
import { showToast } from '../../components/toast.js';
import { supabase } from '../../utils/supabase.js';
import { router } from '../../router.js';
import { escapeHtml } from '../../utils/sanitize.js';
import { subscribeToTable } from '../../utils/realtime.js';
import gsap from 'gsap';

export async function renderLoginHistoryPage() {
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
          <h2 style="margin-bottom:var(--space-xl);"><i class="fa-solid fa-clock-rotate-left"></i> Login History</h2>

          <!-- Summary Cards -->
          <div class="grid-4 login-history-stats" id="lh-stats">
            ${renderStatSkeletons()}
          </div>

          <!-- Search & Filters -->
          <div class="card" style="margin:var(--space-xl) 0;">
            <div style="display:flex;gap:var(--space-md);flex-wrap:wrap;align-items:flex-end;">
              <div class="form-group" style="margin-bottom:0;flex:2;min-width:200px;">
                <label class="form-label">Search User</label>
                <input type="text" class="form-input" id="lh-search" placeholder="Search by name or email..." />
              </div>
              <div class="form-group" style="margin-bottom:0;flex:1;min-width:140px;">
                <label class="form-label">Sort By</label>
                <select class="form-select" id="lh-sort">
                  <option value="last_login">Last Login</option>
                  <option value="login_count">Most Logins</option>
                  <option value="name">Name (A-Z)</option>
                </select>
              </div>
            </div>
          </div>

          <!-- Users Table -->
          <div id="lh-table-container">
            ${renderTableSkeleton()}
          </div>
        </div>
      </div>
    </div>
  `;

  initSidebar(); initHeader(profile); setBreadcrumb('Login History');

  // Load data
  await loadLoginHistoryData();

  // Debounced search
  let searchTimer;
  document.getElementById('lh-search')?.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => loadLoginHistoryData(), 300);
  });
  document.getElementById('lh-sort')?.addEventListener('change', () => loadLoginHistoryData());

  // Real-time updates
  subscribeToTable('admin-login-history', 'login_history', null, () => {
    loadLoginHistoryData();
  });
}

function renderStatSkeletons() {
  return Array(4).fill('').map(() => `
    <div class="card">
      <div class="skeleton skeleton-text" style="width:50%;height:14px;"></div>
      <div class="skeleton skeleton-text" style="width:70%;height:32px;margin-top:12px;"></div>
    </div>
  `).join('');
}

function renderTableSkeleton() {
  return `
    <div class="card" style="padding:0;overflow:hidden;">
      <div style="padding:var(--space-lg);">
        ${Array(6).fill('').map(() => `
          <div style="display:flex;align-items:center;gap:var(--space-md);padding:var(--space-md) 0;border-bottom:1px solid var(--border);">
            <div class="skeleton skeleton-avatar"></div>
            <div style="flex:1;">
              <div class="skeleton skeleton-text" style="width:40%;"></div>
              <div class="skeleton skeleton-text" style="width:60%;"></div>
            </div>
            <div class="skeleton skeleton-text" style="width:80px;"></div>
            <div class="skeleton skeleton-text" style="width:140px;"></div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

async function loadLoginHistoryData() {
  const searchQuery = (document.getElementById('lh-search')?.value || '').trim().toLowerCase();
  const sortBy = document.getElementById('lh-sort')?.value || 'last_login';

  // Fetch all profiles + login history in parallel
  const [profilesRes, historyRes] = await Promise.all([
    supabase.from('profiles').select('id, display_name, email, avatar_url, role, created_at'),
    supabase.from('login_history').select('user_id, login_at').order('login_at', { ascending: false })
  ]);

  if (profilesRes.error || historyRes.error) {
    showToast('Failed to load login data', 'error');
    return;
  }

  const profiles = profilesRes.data || [];
  const history = historyRes.data || [];

  // Build user stats map
  const userStats = new Map();
  for (const entry of history) {
    if (!userStats.has(entry.user_id)) {
      userStats.set(entry.user_id, { count: 0, lastLogin: entry.login_at, logins: [] });
    }
    const stat = userStats.get(entry.user_id);
    stat.count++;
    stat.logins.push(entry.login_at);
  }

  // Merge profiles with stats
  let users = profiles.map(p => {
    const stat = userStats.get(p.id) || { count: 0, lastLogin: null, logins: [] };
    return { ...p, loginCount: stat.count, lastLogin: stat.lastLogin, logins: stat.logins };
  });

  // Filter
  if (searchQuery) {
    users = users.filter(u =>
      (u.display_name || '').toLowerCase().includes(searchQuery) ||
      (u.email || '').toLowerCase().includes(searchQuery)
    );
  }

  // Sort
  if (sortBy === 'last_login') {
    users.sort((a, b) => (b.lastLogin ? new Date(b.lastLogin) : 0) - (a.lastLogin ? new Date(a.lastLogin) : 0));
  } else if (sortBy === 'login_count') {
    users.sort((a, b) => b.loginCount - a.loginCount);
  } else if (sortBy === 'name') {
    users.sort((a, b) => (a.display_name || '').localeCompare(b.display_name || ''));
  }

  // Summary stats
  const totalUsers = profiles.length;
  const totalLogins = history.length;
  const today = new Date().toDateString();
  const todayLogins = history.filter(h => new Date(h.login_at).toDateString() === today).length;
  const mostActive = users.reduce((best, u) => u.loginCount > (best?.loginCount || 0) ? u : best, null);

  renderStats(totalUsers, totalLogins, todayLogins, mostActive);
  renderUserTable(users);
}

function renderStats(totalUsers, totalLogins, todayLogins, mostActive) {
  const statsEl = document.getElementById('lh-stats');
  if (!statsEl) return;

  statsEl.innerHTML = `
    <div class="card stat-card-anim">
      <div style="display:flex;align-items:center;gap:var(--space-md);">
        <div style="width:48px;height:48px;border-radius:var(--radius-lg);background:rgba(76,175,80,0.15);display:flex;align-items:center;justify-content:center;">
          <i class="fa-solid fa-users" style="color:var(--success);font-size:1.25rem;"></i>
        </div>
        <div>
          <div style="color:var(--text-secondary);font-size:0.8125rem;">Total Users</div>
          <div style="font-size:1.75rem;font-weight:800;font-family:var(--font-display);" class="count-value">${totalUsers}</div>
        </div>
      </div>
    </div>
    <div class="card stat-card-anim">
      <div style="display:flex;align-items:center;gap:var(--space-md);">
        <div style="width:48px;height:48px;border-radius:var(--radius-lg);background:rgba(33,150,243,0.15);display:flex;align-items:center;justify-content:center;">
          <i class="fa-solid fa-arrow-right-to-bracket" style="color:var(--info);font-size:1.25rem;"></i>
        </div>
        <div>
          <div style="color:var(--text-secondary);font-size:0.8125rem;">Total Logins</div>
          <div style="font-size:1.75rem;font-weight:800;font-family:var(--font-display);" class="count-value">${totalLogins}</div>
        </div>
      </div>
    </div>
    <div class="card stat-card-anim">
      <div style="display:flex;align-items:center;gap:var(--space-md);">
        <div style="width:48px;height:48px;border-radius:var(--radius-lg);background:rgba(251,140,0,0.15);display:flex;align-items:center;justify-content:center;">
          <i class="fa-solid fa-calendar-day" style="color:var(--warning);font-size:1.25rem;"></i>
        </div>
        <div>
          <div style="color:var(--text-secondary);font-size:0.8125rem;">Logins Today</div>
          <div style="font-size:1.75rem;font-weight:800;font-family:var(--font-display);" class="count-value">${todayLogins}</div>
        </div>
      </div>
    </div>
    <div class="card stat-card-anim">
      <div style="display:flex;align-items:center;gap:var(--space-md);">
        <div style="width:48px;height:48px;border-radius:var(--radius-lg);background:rgba(207,102,121,0.15);display:flex;align-items:center;justify-content:center;">
          <i class="fa-solid fa-trophy" style="color:var(--danger);font-size:1.25rem;"></i>
        </div>
        <div>
          <div style="color:var(--text-secondary);font-size:0.8125rem;">Most Active</div>
          <div style="font-size:1rem;font-weight:700;font-family:var(--font-display);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px;">${mostActive ? escapeHtml(mostActive.display_name || 'Unknown') : 'N/A'}</div>
          ${mostActive ? `<div style="font-size:0.75rem;color:var(--text-muted);">${mostActive.loginCount} logins</div>` : ''}
        </div>
      </div>
    </div>
  `;

  gsap.fromTo('.stat-card-anim', { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, stagger: 0.1, ease: 'power3.out' });
}

function renderUserTable(users) {
  const container = document.getElementById('lh-table-container');
  if (!container) return;

  if (users.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-user-slash"></i>
        <h4>No users found</h4>
        <p>Try adjusting your search criteria.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>User</th>
            <th>Role</th>
            <th>Total Logins</th>
            <th>Last Login</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          ${users.map(u => {
            const lastLoginDate = u.lastLogin ? new Date(u.lastLogin) : null;
            const lastLoginStr = lastLoginDate ? formatLoginDate(lastLoginDate) : '<span style="color:var(--text-muted);">Never</span>';
            const initials = getInitials(u.display_name || u.email || '?');
            const avatarHtml = u.avatar_url
              ? `<img src="${escapeHtml(u.avatar_url)}" class="avatar" alt="" style="width:36px;height:36px;" />`
              : `<div class="avatar avatar-placeholder" style="width:36px;height:36px;font-size:0.8rem;">${escapeHtml(initials)}</div>`;

            return `
              <tr class="lh-row" data-user-id="${u.id}">
                <td>
                  <div style="display:flex;align-items:center;gap:var(--space-md);">
                    ${avatarHtml}
                    <div>
                      <div style="font-weight:600;">${escapeHtml(u.display_name || 'Unknown')}</div>
                      <div style="font-size:0.75rem;color:var(--text-muted);">${escapeHtml(u.email || '')}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <span class="badge ${u.role === 'admin' ? 'badge-danger' : 'badge-primary'}">${u.role || 'student'}</span>
                </td>
                <td>
                  <span style="font-family:var(--font-mono);font-weight:700;font-size:1.1rem;">${u.loginCount}</span>
                </td>
                <td style="font-size:0.8125rem;">${lastLoginStr}</td>
                <td>
                  <button class="btn btn-ghost btn-sm lh-expand-btn" data-user-id="${u.id}">
                    <i class="fa-solid fa-chevron-down"></i>
                  </button>
                </td>
              </tr>
              <tr class="lh-detail-row" id="lh-detail-${u.id}" style="display:none;">
                <td colspan="5" style="padding:0;">
                  <div class="lh-detail-content" style="padding:var(--space-md) var(--space-lg);background:rgba(255,255,255,0.02);border-top:1px solid var(--border);">
                    ${renderLoginDetailRows(u.logins)}
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  // Stagger animation for rows
  gsap.fromTo('.lh-row', { opacity: 0, x: -10 }, { opacity: 1, x: 0, duration: 0.3, stagger: 0.04, ease: 'power2.out' });

  // Expand/collapse handlers
  container.querySelectorAll('.lh-expand-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const userId = btn.dataset.userId;
      const detailRow = document.getElementById(`lh-detail-${userId}`);
      const icon = btn.querySelector('i');
      if (detailRow) {
        const isVisible = detailRow.style.display !== 'none';
        detailRow.style.display = isVisible ? 'none' : 'table-row';
        icon.style.transform = isVisible ? 'rotate(0deg)' : 'rotate(180deg)';
        if (!isVisible) {
          gsap.fromTo(detailRow, { opacity: 0 }, { opacity: 1, duration: 0.3 });
        }
      }
    });
  });
}

function renderLoginDetailRows(logins) {
  if (!logins || logins.length === 0) {
    return '<div style="color:var(--text-muted);padding:var(--space-sm);">No login records found.</div>';
  }

  const recentLogins = logins.slice(0, 20); // Show last 20
  return `
    <div style="font-size:0.8125rem;color:var(--text-secondary);margin-bottom:var(--space-sm);">
      Showing last ${recentLogins.length} of ${logins.length} logins
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:var(--space-sm);">
      ${recentLogins.map(loginAt => {
        const d = new Date(loginAt);
        return `
          <div style="padding:8px 12px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-sm);font-size:0.8125rem;">
            <i class="fa-solid fa-right-to-bracket" style="color:var(--success);margin-right:6px;"></i>
            ${formatLoginDate(d)}
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function formatLoginDate(date) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = days[date.getDay()];
  const month = months[date.getMonth()];
  const dateNum = date.getDate();
  const year = date.getFullYear();
  const hours = date.getHours();
  const mins = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const h12 = hours % 12 || 12;
  return `${day}, ${month} ${dateNum} ${year}, ${h12}:${mins} ${ampm}`;
}

function getInitials(name) {
  return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
}
