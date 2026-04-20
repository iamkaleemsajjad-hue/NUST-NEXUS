import { supabase } from '../utils/supabase.js';

/**
 * Render the top header bar
 */
export function renderHeader(profile) {
  const isAdminUser = profile?.role === 'admin';

  return `
    <header class="top-header" id="top-header">
      <div class="header-left">
        <button class="header-toggle-btn" id="sidebar-toggle-btn">
          <i class="fa-solid fa-bars"></i>
        </button>
        <div class="header-breadcrumb">
          <span class="breadcrumb-text" id="breadcrumb-text">Dashboard</span>
        </div>
      </div>
      <div class="header-right">
        <div class="header-clock" id="header-clock"></div>
        ${!isAdminUser ? `
          <div class="header-points points-display" id="header-points">
            <i class="fa-solid fa-coins"></i>
            <span id="points-value">${profile?.points || 0}</span>
          </div>
        ` : ''}
        <button class="header-notification-btn" id="notification-btn">
          <i class="fa-solid fa-bell"></i>
          <span class="notification-dot" id="notification-dot" style="display:none;"></span>
        </button>
        <div class="header-profile" id="header-profile-btn">
          ${profile?.avatar_url
            ? `<img src="${profile.avatar_url}" class="header-avatar" alt="Profile" />`
            : `<div class="header-avatar header-avatar-placeholder">${(profile?.display_name || 'U').charAt(0).toUpperCase()}</div>`
          }
        </div>
        <div class="profile-dropdown" id="profile-dropdown" style="display:none;">
          <div class="dropdown-header">
            <strong class="dropdown-name">${profile?.display_name || 'User'}</strong>
            <span class="dropdown-role">${isAdminUser ? 'Administrator' : profile?.degree || 'Student'}</span>
          </div>
          <div class="dropdown-divider"></div>
          <a href="#/settings" class="dropdown-item">
            <i class="fa-solid fa-user"></i> My profile
          </a>
          <button class="dropdown-item text-danger" id="header-logout-btn">
            <i class="fa-solid fa-right-from-bracket"></i> Log out
          </button>
        </div>
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
let _clockInterval = null;

export function initHeader(profile) {
  // Live clock — clear previous interval to prevent stacking
  if (_clockInterval) {
    clearInterval(_clockInterval);
    _clockInterval = null;
  }

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
  _clockInterval = setInterval(updateClock, 30000);

  // Profile dropdown toggle
  const profileBtn = document.getElementById('header-profile-btn');
  const profileDropdown = document.getElementById('profile-dropdown');
  if (profileBtn && profileDropdown) {
    profileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = profileDropdown.style.display !== 'none';
      profileDropdown.style.display = isOpen ? 'none' : 'block';
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!profileBtn.contains(e.target) && !profileDropdown.contains(e.target)) {
        profileDropdown.style.display = 'none';
      }
    });
  }

  // Header logout
  const headerLogoutBtn = document.getElementById('header-logout-btn');
  if (headerLogoutBtn) {
    headerLogoutBtn.addEventListener('click', async () => {
      import('../utils/supabase.js').then(async ({ supabase }) => {
        await supabase.auth.signOut();
        import('../router.js').then(({ router }) => router.navigate('/login'));
      });
    });
  }

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

  // Make header menu button toggle sidebar + overlay on mobile
  const toggleBtn = document.getElementById('sidebar-toggle-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const sidebar = document.getElementById('sidebar');
      const mainContent = document.querySelector('.main-content');
      const isMobile = window.innerWidth <= 768;

      if (isMobile) {
        // Mobile: use slide-in overlay
        sidebar?.classList.toggle('mobile-open');
        let overlay = document.getElementById('sidebar-overlay');
        if (!overlay) {
          overlay = document.createElement('div');
          overlay.id = 'sidebar-overlay';
          overlay.className = 'sidebar-overlay';
          document.body.appendChild(overlay);
          overlay.addEventListener('click', () => {
            sidebar?.classList.remove('mobile-open');
            overlay.classList.remove('active');
          });
        }
        if (sidebar?.classList.contains('mobile-open')) {
          overlay.classList.add('active');
        } else {
          overlay.classList.remove('active');
        }
      } else {
        // Desktop: collapse
        sidebar?.classList.toggle('collapsed');
        mainContent?.classList.toggle('collapsed');
      }
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
      id: n.id,
      type: 'broadcast',
      title: n.title,
      message: n.message,
      time: n.created_at,
      icon: 'fa-bullhorn',
      linkType: null,
      linkId: null,
      isRead: true,
    })));
  }

  // 2. Load targeted notifications for this user (comment replies etc.)
  if (profile?.id) {
    const { data: targeted } = await supabase
      .from('notifications')
      .select('*')
      .eq('target_user_id', profile.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(20);

    if (targeted) {
      items.push(...targeted.map(n => ({
        id: n.id,
        type: 'reply',
        title: n.title,
        message: n.message,
        time: n.created_at,
        icon: n.link_type === 'comment' ? 'fa-comment' : 'fa-reply',
        linkType: n.link_type,
        linkId: n.link_id,
        isRead: n.is_read || false,
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
        id: f.id,
        type: 'reply',
        title: 'Admin Reply',
        message: f.admin_reply,
        time: f.replied_at,
        icon: 'fa-reply',
        linkType: null,
        linkId: null,
        isRead: true,
      })));
    }
  }

  // Sort by time
  items.sort((a, b) => new Date(b.time) - new Date(a.time));

  // Count unread
  const unreadCount = items.filter(n => !n.isRead).length;

  if (items.length > 0) {
    if (unreadCount > 0) dot.style.display = 'block';
    
    list.innerHTML = items.map(n => {
      const isClickable = n.linkType === 'comment' && n.linkId;
      return `
      <div class="notification-item ${n.type === 'reply' ? 'reply' : ''} ${!n.isRead ? 'unread' : ''} ${isClickable ? 'clickable' : ''}"
           ${isClickable ? `data-notif-id="${n.id}" data-link-id="${n.linkId}" style="cursor:pointer;"` : ''}
           >
        <div class="notification-icon"><i class="fa-solid ${n.icon}"></i></div>
        <div class="notification-content">
          <strong>${n.title}</strong>
          ${!n.isRead ? '<span class="notif-unread-badge" style="display:inline-block;width:8px;height:8px;background:var(--primary);border-radius:50%;margin-left:6px;"></span>' : ''}
          <p>${n.message}</p>
          <span class="notification-time">${getNotifTimeAgo(n.time)}</span>
        </div>
      </div>
    `;}).join('');

    // Add click handlers for deep-linked notifications
    list.querySelectorAll('.notification-item.clickable').forEach(el => {
      el.addEventListener('click', async () => {
        const notifId = el.dataset.notifId;
        const linkId = el.dataset.linkId;
        
        // Mark as read
        if (notifId) {
          await supabase.from('notifications').update({ is_read: true }).eq('id', notifId);
          el.classList.remove('unread');
          const badge = el.querySelector('.notif-unread-badge');
          if (badge) badge.remove();
        }

        // Navigate to browse page with highlight param
        const notifPanel = document.getElementById('notification-panel');
        if (notifPanel) notifPanel.style.display = 'none';
        
        window.location.hash = `/browse?highlight=${linkId}`;
      });
    });
  } else {
    list.innerHTML = `
      <div class="empty-state" style="padding:2rem;">
        <i class="fa-solid fa-bell-slash"></i>
        <p>No notifications yet</p>
      </div>
    `;
  }
}

function getNotifTimeAgo(dateStr) {
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
