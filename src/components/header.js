import { supabase } from '../utils/supabase.js';

/**
 * Render the top header bar
 */
export function renderHeader(profile) {
  const isAdminUser = profile?.role === 'admin';

  return `
    <header class="top-header" id="top-header">
      <div class="header-left">
        <button class="mobile-menu-btn" id="mobile-menu-btn">
          <i class="fa-solid fa-bars"></i>
        </button>
        <div class="header-breadcrumb">
          <span class="breadcrumb-text" id="breadcrumb-text">Dashboard</span>
        </div>
      </div>
      <div class="header-right">
        ${!isAdminUser ? `
          <div class="header-points points-display" id="header-points">
            <i class="fa-solid fa-coins"></i>
            <span id="points-value">${profile?.points || 0}</span> pts
          </div>
        ` : ''}
        <div class="header-clock" id="header-clock"></div>
        <button class="header-notification-btn" id="notification-btn">
          <i class="fa-solid fa-bell"></i>
          <span class="notification-dot" id="notification-dot" style="display:none;"></span>
        </button>
      </div>
    </header>
    
    <!-- Notification Panel -->
    <div class="notification-panel" id="notification-panel" style="display:none;">
      <div class="notification-panel-header">
        <h4><i class="fa-solid fa-bell"></i> Notifications</h4>
        <button class="modal-close" id="close-notifications">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
      <div class="notification-list" id="notification-list">
        <div class="empty-state" style="padding:2rem;">
          <i class="fa-solid fa-bell-slash"></i>
          <p>No notifications yet</p>
        </div>
      </div>
    </div>
  `;
}

/**
 * Initialize header events and live clock
 */
export function initHeader(profile) {
  // Live clock
  function updateClock() {
    const now = new Date();
    const clock = document.getElementById('header-clock');
    if (clock) {
      clock.innerHTML = `
        <i class="fa-regular fa-clock"></i>
        <span>${now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
        <span class="clock-time">${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
      `;
    }
  }
  updateClock();
  setInterval(updateClock, 30000);

  // Notification panel toggle
  const notifBtn = document.getElementById('notification-btn');
  const notifPanel = document.getElementById('notification-panel');
  const closeNotif = document.getElementById('close-notifications');

  if (notifBtn && notifPanel) {
    notifBtn.addEventListener('click', () => {
      const isOpen = notifPanel.style.display !== 'none';
      notifPanel.style.display = isOpen ? 'none' : 'block';
      if (!isOpen) loadNotifications(profile);
    });
  }
  if (closeNotif) {
    closeNotif.addEventListener('click', () => {
      notifPanel.style.display = 'none';
    });
  }

  // Mobile menu
  const mobileBtn = document.getElementById('mobile-menu-btn');
  if (mobileBtn) {
    mobileBtn.addEventListener('click', () => {
      const sidebar = document.getElementById('sidebar');
      sidebar?.classList.toggle('mobile-open');
    });
  }

  // Load notifications (both broadcast + targeted replies)
  loadAllNotifications(profile);
}

async function loadNotifications(profile) {
  const list = document.getElementById('notification-list');
  const dot = document.getElementById('notification-dot');
  
  let items = [];

  // 1. Load broadcast notifications (no target_user_id or target_user_id IS NULL)
  const { data: broadcasts } = await supabase
    .from('notifications')
    .select('*')
    .eq('is_active', true)
    .is('target_user_id', null)
    .order('created_at', { ascending: false })
    .limit(20);

  if (broadcasts) {
    items.push(...broadcasts.map(n => ({
      type: 'broadcast',
      title: n.title,
      message: n.message,
      time: n.created_at,
      icon: 'fa-bullhorn',
    })));
  }

  // 2. Load targeted notifications for this user
  if (profile?.id) {
    const { data: targeted } = await supabase
      .from('notifications')
      .select('*')
      .eq('target_user_id', profile.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(10);

    if (targeted) {
      items.push(...targeted.map(n => ({
        type: 'reply',
        title: n.title,
        message: n.message,
        time: n.created_at,
        icon: 'fa-reply',
      })));
    }
  }

  // 3. Load admin replies to this user's feedback
  if (profile?.id && profile.role !== 'admin') {
    const { data: replies } = await supabase
      .from('feedback')
      .select('*')
      .eq('user_id', profile.id)
      .not('admin_reply', 'is', null)
      .order('replied_at', { ascending: false })
      .limit(5);

    if (replies) {
      items.push(...replies.map(f => ({
        type: 'reply',
        title: 'Admin Reply',
        message: f.admin_reply,
        time: f.replied_at,
        icon: 'fa-reply',
      })));
    }
  }

  // Sort by time
  items.sort((a, b) => new Date(b.time) - new Date(a.time));

  if (items.length > 0) {
    dot.style.display = 'block';
    list.innerHTML = items.map(n => `
      <div class="notification-item ${n.type === 'reply' ? 'reply' : ''}">
        <div class="notification-icon"><i class="fa-solid ${n.icon}"></i></div>
        <div class="notification-content">
          <strong>${n.title}</strong>
          <p>${n.message}</p>
          <span class="notification-time">${new Date(n.time).toLocaleDateString()}</span>
        </div>
      </div>
    `).join('');
  } else {
    list.innerHTML = `
      <div class="empty-state" style="padding:2rem;">
        <i class="fa-solid fa-bell-slash"></i>
        <p>No notifications yet</p>
      </div>
    `;
  }
}

async function loadAllNotifications(profile) {
  if (!profile) return;
  const dot = document.getElementById('notification-dot');
  
  // Quick check if there are any notifications
  let hasNotifications = false;

  // Check broadcast notifications
  const { count: broadcastCount } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)
    .is('target_user_id', null);

  if (broadcastCount > 0) hasNotifications = true;

  // Check targeted notifications
  if (profile.id) {
    const { count: targetedCount } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('target_user_id', profile.id)
      .eq('is_active', true);

    if (targetedCount > 0) hasNotifications = true;
  }

  // Check feedback replies for students
  if (profile.role !== 'admin' && profile.id) {
    const { count: replyCount } = await supabase
      .from('feedback')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', profile.id)
      .not('admin_reply', 'is', null);

    if (replyCount > 0) hasNotifications = true;
  }

  if (dot && hasNotifications) {
    dot.style.display = 'block';
  }
}

/**
 * Update breadcrumb text
 */
export function setBreadcrumb(text) {
  const el = document.getElementById('breadcrumb-text');
  if (el) el.textContent = text;
}
