import { supabase } from '../utils/supabase.js';
import { router } from '../router.js';
import { getLogoSVG } from './logo.js';

/**
 * Render the sidebar with sliding marker 
 */
export function renderSidebar(profile) {
  const isAdmin = profile?.role === 'admin';
  const currentHash = window.location.hash.replace('#', '') || '/dashboard';

  const studentLinks = [
    { href: '/dashboard', icon: 'fa-house', label: 'Dashboard' },
    { href: '/browse', icon: 'fa-compass', label: 'Browse Resources' },
    { href: '/upload', icon: 'fa-cloud-arrow-up', label: 'Upload' },
    { href: '/teachers', icon: 'fa-chalkboard-user', label: 'Teachers' },
    { href: '/ideas', icon: 'fa-lightbulb', label: 'Project Ideas' },
    { href: '/ask-questions', icon: 'fa-circle-question', label: 'Ask Questions' },
    { href: '/request-assessment', icon: 'fa-file-circle-plus', label: 'Request Assessment' },
    { href: '/feedback', icon: 'fa-comment-dots', label: 'Feedback' },
    { href: '/settings', icon: 'fa-gear', label: 'Settings' },
  ];

  const adminLinks = [
    { href: '/admin/dashboard', icon: 'fa-house', label: 'Dashboard' },
    { href: '/browse', icon: 'fa-compass', label: 'Browse Resources' },
    { href: '/teachers', icon: 'fa-chalkboard-user', label: 'Teachers' },
    { href: '/ideas', icon: 'fa-lightbulb', label: 'Project Ideas' },
    { href: '/ask-questions', icon: 'fa-circle-question', label: 'Ask Questions' },
    { href: '/request-assessment', icon: 'fa-file-circle-plus', label: 'Request Assessment' },
    { href: '/settings', icon: 'fa-gear', label: 'Settings' },
  ];

  const adminManageLinks = [
    { href: '/admin/teachers', icon: 'fa-user-tie', label: 'Manage Teachers' },
    { href: '/admin/courses', icon: 'fa-book', label: 'Manage Courses' },
    { href: '/admin/feedback', icon: 'fa-comments', label: 'Feedback Management' },
    { href: '/admin/ratings', icon: 'fa-star', label: 'Teacher Ratings' },
    { href: '/admin/notifications', icon: 'fa-bell', label: 'Notifications' },
    { href: '/admin/login-history', icon: 'fa-clock-rotate-left', label: 'Login History' },
    { href: '/admin/assessment-requests', icon: 'fa-file-circle-question', label: 'Assessment Requests' },
    { href: '/admin/ban-users', icon: 'fa-ban', label: 'Ban Users' },
  ];

  const links = isAdmin ? adminLinks : studentLinks;
  const initials = (profile?.display_name || 'U').charAt(0).toUpperCase();

  return `
    <aside class="sidebar" id="sidebar">
      <!-- Sidebar Header -->
      <div class="sidebar-header">
        <div class="sidebar-logo">
          ${getLogoSVG('sidebar-logo-img', '36', '36', false, currentHash === '/dashboard')}
          <span class="sidebar-brand">NUST NEXUS</span>
        </div>
      </div>

      <!-- Sidebar Navigation -->
      <nav class="sidebar-nav">
        <!-- Sliding Indicator -->
        <div class="sidebar-nav-indicator" id="sidebar-nav-indicator"></div>

        <ul class="sidebar-menu" id="sidebar-menu">
          ${links.map(link => `
            <li>
              <a href="#${link.href}" class="sidebar-link ${currentHash === link.href ? 'active' : ''}" data-path="${link.href}">
                <i class="fa-solid ${link.icon}"></i>
                <span class="sidebar-link-text">${link.label}</span>
              </a>
            </li>
          `).join('')}

          ${isAdmin ? `
            <li class="sidebar-divider">
              <span class="sidebar-divider-text">Admin Controls</span>
            </li>
            ${adminManageLinks.map(link => `
              <li>
                <a href="#${link.href}" class="sidebar-link ${currentHash === link.href ? 'active' : ''}" data-path="${link.href}">
                  <i class="fa-solid ${link.icon}"></i>
                  <span class="sidebar-link-text">${link.label}</span>
                </a>
              </li>
            `).join('')}
          ` : ''}
        </ul>
      </nav>

      <!-- Sidebar Footer Removed -->
    </aside>
  `;
}

/**
 * Initialize sidebar: toggle, logic, sliding marker
 */
export function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  const mainContent = document.querySelector('.main-content');

  // Initialize sliding indicator
  initSlidingMarker();

  // Listen for hash changes to update indicator
  window.addEventListener('hashchange', () => {
    updateActiveLink();
    moveSlidingMarker();
  });
}

/**
 * Initialize the sliding marker on the active sidebar link
 */
function initSlidingMarker() {
  requestAnimationFrame(() => {
    moveSlidingMarker(false);
  });
}

/**
 * Update which link is marked as "active" based on current hash
 */
function updateActiveLink() {
  const currentHash = window.location.hash.replace('#', '') || '/dashboard';
  const links = document.querySelectorAll('#sidebar-menu .sidebar-link');
  links.forEach(link => {
    const path = link.getAttribute('data-path');
    if (path === currentHash) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}

/**
 * Smoothly move the nav indicator to the currently active link
 */
function moveSlidingMarker(animate = true) {
  const indicator = document.getElementById('sidebar-nav-indicator');
  const activeLink = document.querySelector('#sidebar-menu .sidebar-link.active');

  if (!indicator || !activeLink) {
    if (indicator) indicator.style.opacity = '0';
    return;
  }

  const menu = document.getElementById('sidebar-menu');
  const menuRect = menu.getBoundingClientRect();
  const linkRect = activeLink.getBoundingClientRect();

  const top = linkRect.top - menuRect.top + menu.scrollTop;
  const height = linkRect.height;

  if (!animate) {
    indicator.style.transition = 'none';
  } else {
    indicator.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
  }

  indicator.style.top = `${top}px`;
  indicator.style.height = `${height}px`;
  indicator.style.opacity = '1';

  // Force reflow then re-enable transition
  if (!animate) {
    indicator.offsetHeight; // force reflow
    indicator.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
  }
}
