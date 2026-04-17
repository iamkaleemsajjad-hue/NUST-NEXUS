import { getCurrentUser, getUserProfile } from '../../utils/auth.js';
import { renderSidebar, initSidebar } from '../../components/sidebar.js';
import { renderHeader, initHeader, setBreadcrumb } from '../../components/header.js';
import { showToast } from '../../components/toast.js';
import { supabase } from '../../utils/supabase.js';
import { escapeHtml, sanitizeText } from '../../utils/sanitize.js';
import { router } from '../../router.js';
import gsap from 'gsap';

export async function renderAdminGivePoints() {
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
            <h2 style="color:var(--warning);"><i class="fa-solid fa-coins"></i> Give Points</h2>
          </div>

          <!-- Info card -->
          <div style="margin-bottom:var(--space-xl);padding:var(--space-lg);background:rgba(255,204,0,0.08);border:1px solid rgba(255,204,0,0.25);border-radius:var(--radius-lg);">
            <h4 style="color:var(--warning);margin-bottom:8px;"><i class="fa-solid fa-info-circle"></i> How It Works</h4>
            <p style="color:var(--text-secondary);font-size:0.875rem;line-height:1.6;margin:0;">
              Award points to students as a reward. Each award creates a <strong>congratulations popup</strong> 
              that appears on their next dashboard visit. You can give points to a specific student or to all students at once.
            </p>
          </div>

          <!-- Mode Tabs -->
          <div style="display:flex;gap:var(--space-md);margin-bottom:var(--space-xl);">
            <button class="btn btn-primary" id="tab-specific" style="flex:1;">
              <i class="fa-solid fa-user"></i> Specific User
            </button>
            <button class="btn btn-ghost" id="tab-bulk" style="flex:1;">
              <i class="fa-solid fa-users"></i> All Students (Bulk)
            </button>
          </div>

          <!-- Specific User Mode -->
          <div class="card" id="mode-specific" style="padding:var(--space-xl);margin-bottom:var(--space-xl);">
            <h3 style="margin-bottom:var(--space-lg);font-size:1rem;"><i class="fa-solid fa-user-plus"></i> Award Points to a Specific User</h3>
            
            <!-- User search -->
            <div class="form-group" style="margin-bottom:var(--space-lg);">
              <label class="form-label">Search User</label>
              <input type="text" class="form-input" id="user-search" placeholder="Type a display name to search..." autocomplete="off">
              <div id="user-search-results" style="margin-top:8px;"></div>
            </div>

            <!-- Selected user display -->
            <div id="selected-user" style="display:none;margin-bottom:var(--space-lg);padding:var(--space-md);background:rgba(0,204,255,0.08);border:1px solid rgba(0,204,255,0.2);border-radius:var(--radius-md);">
              <div style="display:flex;align-items:center;justify-content:space-between;">
                <div>
                  <strong id="selected-name" style="font-size:0.9rem;"></strong>
                  <span id="selected-points" style="font-size:0.8rem;color:var(--text-muted);margin-left:8px;"></span>
                </div>
                <button class="btn btn-ghost btn-sm" id="clear-user" style="color:var(--danger);"><i class="fa-solid fa-xmark"></i></button>
              </div>
            </div>

            <form id="specific-form">
              <div style="display:flex;gap:var(--space-md);flex-wrap:wrap;align-items:flex-end;">
                <div class="form-group" style="flex:1;min-width:120px;margin:0;">
                  <label class="form-label">Points Amount</label>
                  <input type="number" class="form-input" id="specific-amount" placeholder="e.g. 50" min="1" max="10000" required>
                </div>
                <div class="form-group" style="flex:2;min-width:200px;margin:0;">
                  <label class="form-label">Reason (optional)</label>
                  <input type="text" class="form-input" id="specific-reason" placeholder="e.g. Great contribution!" maxlength="200">
                </div>
                <button type="submit" class="btn btn-primary" id="specific-submit" style="flex-shrink:0;" disabled>
                  <i class="fa-solid fa-gift"></i> Give Points
                </button>
              </div>
            </form>
          </div>

          <!-- Bulk Mode (hidden by default) -->
          <div class="card" id="mode-bulk" style="padding:var(--space-xl);margin-bottom:var(--space-xl);display:none;">
            <h3 style="margin-bottom:var(--space-lg);font-size:1rem;"><i class="fa-solid fa-users"></i> Award Points to ALL Students</h3>
            <div style="margin-bottom:var(--space-lg);padding:var(--space-md);background:rgba(255,68,68,0.06);border:1px solid rgba(255,68,68,0.15);border-radius:var(--radius-md);">
              <p style="color:var(--text-secondary);font-size:0.8rem;margin:0;">
                <i class="fa-solid fa-triangle-exclamation" style="color:var(--warning);"></i>
                This will award points to <strong>every student</strong> on the platform. Use with care.
              </p>
            </div>
            <form id="bulk-form">
              <div style="display:flex;gap:var(--space-md);flex-wrap:wrap;align-items:flex-end;">
                <div class="form-group" style="flex:1;min-width:120px;margin:0;">
                  <label class="form-label">Points per Student</label>
                  <input type="number" class="form-input" id="bulk-amount" placeholder="e.g. 10" min="1" max="10000" required>
                </div>
                <div class="form-group" style="flex:2;min-width:200px;margin:0;">
                  <label class="form-label">Reason (optional)</label>
                  <input type="text" class="form-input" id="bulk-reason" placeholder="e.g. Eid Mubarak bonus!" maxlength="200">
                </div>
                <button type="submit" class="btn btn-warning" id="bulk-submit" style="flex-shrink:0;">
                  <i class="fa-solid fa-paper-plane"></i> Award to All
                </button>
              </div>
            </form>
          </div>

          <!-- Recent rewards history -->
          <div style="margin-bottom:var(--space-md);">
            <h3 style="font-size:1rem;"><i class="fa-solid fa-clock-rotate-left"></i> Recent Rewards</h3>
          </div>
          <div id="rewards-history">
            <div class="skeleton skeleton-card" style="height:80px;margin-bottom:8px;"></div>
            <div class="skeleton skeleton-card" style="height:80px;"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  initSidebar();
  initHeader(profile);
  setBreadcrumb('Give Points');

  let _selectedUserId = null;

  // ── Tab switching ──
  const tabSpecific = document.getElementById('tab-specific');
  const tabBulk = document.getElementById('tab-bulk');
  const modeSpecific = document.getElementById('mode-specific');
  const modeBulk = document.getElementById('mode-bulk');

  tabSpecific.addEventListener('click', () => {
    tabSpecific.className = 'btn btn-primary'; tabSpecific.style.flex = '1';
    tabBulk.className = 'btn btn-ghost'; tabBulk.style.flex = '1';
    modeSpecific.style.display = ''; modeBulk.style.display = 'none';
  });
  tabBulk.addEventListener('click', () => {
    tabBulk.className = 'btn btn-primary'; tabBulk.style.flex = '1';
    tabSpecific.className = 'btn btn-ghost'; tabSpecific.style.flex = '1';
    modeBulk.style.display = ''; modeSpecific.style.display = 'none';
  });

  // ── User search ──
  let searchTimeout = null;
  document.getElementById('user-search').addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const q = sanitizeText(e.target.value, 100).trim();
    const resultsEl = document.getElementById('user-search-results');
    if (q.length < 2) { resultsEl.innerHTML = ''; return; }

    searchTimeout = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, display_name, email, points, role')
        .ilike('display_name', `%${q}%`)
        .neq('role', 'admin')
        .limit(8);

      if (!data || data.length === 0) {
        resultsEl.innerHTML = '<p style="color:var(--text-muted);font-size:0.8rem;">No users found</p>';
        return;
      }

      resultsEl.innerHTML = data.map(u => `
        <div class="user-search-item" data-id="${u.id}" data-name="${escapeHtml(u.display_name)}" data-points="${u.points || 0}"
          style="padding:10px 14px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-md);margin-bottom:6px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;transition:background 0.2s;">
          <div>
            <strong style="font-size:0.875rem;">${escapeHtml(u.display_name)}</strong>
            <span style="font-size:0.75rem;color:var(--text-muted);margin-left:8px;">${escapeHtml(u.email || '')}</span>
          </div>
          <span style="font-size:0.8rem;color:var(--warning);"><i class="fa-solid fa-coins"></i> ${u.points || 0} pts</span>
        </div>
      `).join('');

      // Hover effects
      resultsEl.querySelectorAll('.user-search-item').forEach(item => {
        item.addEventListener('mouseenter', () => { item.style.background = 'rgba(0,204,255,0.06)'; });
        item.addEventListener('mouseleave', () => { item.style.background = 'var(--bg-card)'; });
        item.addEventListener('click', () => {
          _selectedUserId = item.dataset.id;
          document.getElementById('selected-name').textContent = item.dataset.name;
          document.getElementById('selected-points').textContent = `(${item.dataset.points} pts currently)`;
          document.getElementById('selected-user').style.display = '';
          document.getElementById('specific-submit').disabled = false;
          resultsEl.innerHTML = '';
          document.getElementById('user-search').value = '';
        });
      });
    }, 300);
  });

  // Clear selected user
  document.getElementById('clear-user').addEventListener('click', () => {
    _selectedUserId = null;
    document.getElementById('selected-user').style.display = 'none';
    document.getElementById('specific-submit').disabled = true;
  });

  // ── Specific user form ──
  document.getElementById('specific-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!_selectedUserId) { showToast('Select a user first', 'error'); return; }
    const amount = parseInt(document.getElementById('specific-amount').value);
    const reason = sanitizeText(document.getElementById('specific-reason').value, 200);
    if (!amount || amount < 1) { showToast('Enter a valid amount', 'error'); return; }

    const btn = document.getElementById('specific-submit');
    btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending...';

    const { error } = await supabase.rpc('admin_give_points', {
      target_user_id: _selectedUserId,
      amount: amount,
      reason: reason || 'Reward from Admin',
      admin_id: profile.id
    });

    if (error) {
      showToast('Failed: ' + error.message, 'error');
      btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-gift"></i> Give Points';
      return;
    }

    showToast(`Successfully awarded ${amount} points!`, 'success');
    btn.innerHTML = '<i class="fa-solid fa-gift"></i> Give Points'; btn.disabled = false;
    document.getElementById('specific-amount').value = '';
    document.getElementById('specific-reason').value = '';
    _selectedUserId = null;
    document.getElementById('selected-user').style.display = 'none';
    btn.disabled = true;
    loadRewardsHistory();
  });

  // ── Bulk form ──
  document.getElementById('bulk-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const amount = parseInt(document.getElementById('bulk-amount').value);
    const reason = sanitizeText(document.getElementById('bulk-reason').value, 200);
    if (!amount || amount < 1) { showToast('Enter a valid amount', 'error'); return; }

    if (!confirm(`Are you sure you want to give ${amount} points to ALL students?`)) return;

    const btn = document.getElementById('bulk-submit');
    btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';

    const { error } = await supabase.rpc('admin_give_points_bulk', {
      amount: amount,
      reason: reason || 'Bulk reward from Admin',
      admin_id: profile.id
    });

    if (error) {
      showToast('Failed: ' + error.message, 'error');
      btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Award to All';
      return;
    }

    showToast(`Successfully awarded ${amount} points to all students!`, 'success');
    btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Award to All';
    document.getElementById('bulk-amount').value = '';
    document.getElementById('bulk-reason').value = '';
    loadRewardsHistory();
  });

  // ── Load recent rewards history ──
  async function loadRewardsHistory() {
    const container = document.getElementById('rewards-history');
    const { data } = await supabase
      .from('point_rewards')
      .select('*, profiles:user_id (display_name)')
      .order('created_at', { ascending: false })
      .limit(20);

    if (!data || data.length === 0) {
      container.innerHTML = '<div class="empty-state"><i class="fa-solid fa-gift"></i><p>No rewards given yet.</p></div>';
      return;
    }

    container.innerHTML = data.map(r => `
      <div style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-md);margin-bottom:8px;">
        <div style="width:40px;height:40px;border-radius:50%;background:rgba(255,204,0,0.12);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <i class="fa-solid fa-coins" style="color:var(--warning);"></i>
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:500;font-size:0.875rem;">
            <span style="color:var(--warning);font-weight:700;">+${r.amount}</span> pts → 
            <strong>${escapeHtml(r.profiles?.display_name || 'Unknown')}</strong>
          </div>
          <div style="font-size:0.75rem;color:var(--text-muted);">${escapeHtml(r.reason || 'No reason')} · ${new Date(r.created_at).toLocaleString()}</div>
        </div>
        <span class="badge ${r.seen ? 'badge-success' : 'badge-warning'}" style="font-size:0.65rem;">${r.seen ? 'Seen' : 'Unseen'}</span>
      </div>
    `).join('');

    gsap.fromTo(container.children, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.3, stagger: 0.03, ease: 'power2.out' });
  }

  loadRewardsHistory();

  // Entrance animations
  gsap.fromTo('.stat-card', { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, stagger: 0.08, ease: 'power3.out' });
  gsap.fromTo('.card', { y: 15, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, stagger: 0.1, delay: 0.1, ease: 'power3.out' });
}
