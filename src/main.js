import './styles/index.css';
import './styles/pages.css';
import { router } from './router.js';
import { supabase } from './utils/supabase.js';
import { recordLogin } from './utils/auth.js';
import { renderLoginPage } from './pages/login.js';
import { renderOnboardingPage } from './pages/onboarding.js';
import { renderDashboardPage } from './pages/dashboard.js';
import { renderUploadPage } from './pages/upload.js';
import { renderBrowsePage } from './pages/browse.js';
import { renderTeachersPage } from './pages/teachers.js';
import { renderIdeasPage } from './pages/ideas.js';
import { renderSettingsPage } from './pages/settings.js';
import { renderFeedbackPage } from './pages/feedback.js';
import { renderAskQuestionsPage } from './pages/ask-questions.js';
import { renderRequestAssessmentPage } from './pages/request-assessment.js';
import { renderAdminDashboard } from './pages/admin/dashboard.js';
import { renderAdminTeachers } from './pages/admin/teachers.js';
import { renderAdminCourses } from './pages/admin/courses.js';
import { renderAdminNotifications } from './pages/admin/notifications.js';
import { renderAdminFeedback } from './pages/admin/feedback.js';
import { renderAdminRatings } from './pages/admin/ratings.js';
import { renderLoginHistoryPage } from './pages/admin/login-history.js';
import { renderAdminAssessmentRequests } from './pages/admin/assessment-requests.js';
import { renderAdminUserAnalysis } from './pages/admin/user-analysis.js';
import { renderAdminDeleteRequests } from './pages/admin/delete-requests.js';
import { renderAdminBanUsers } from './pages/admin/ban-users.js';
import { unsubscribeAll } from './utils/realtime.js';


// Public routes (no auth required)
const publicRoutes = ['/login'];

// Register routes
router.addRoute('/login', renderLoginPage);
router.addRoute('/onboarding', renderOnboardingPage);
router.addRoute('/dashboard', renderDashboardPage);
router.addRoute('/upload', renderUploadPage);
router.addRoute('/browse', renderBrowsePage);
router.addRoute('/teachers', renderTeachersPage);
router.addRoute('/ideas', renderIdeasPage);
router.addRoute('/ask-questions', renderAskQuestionsPage);
router.addRoute('/request-assessment', renderRequestAssessmentPage);
router.addRoute('/settings', renderSettingsPage);
router.addRoute('/feedback', renderFeedbackPage);
router.addRoute('/admin/dashboard', renderAdminDashboard);
router.addRoute('/admin/teachers', renderAdminTeachers);
router.addRoute('/admin/courses', renderAdminCourses);
router.addRoute('/admin/notifications', renderAdminNotifications);
router.addRoute('/admin/feedback', renderAdminFeedback);
router.addRoute('/admin/ratings', renderAdminRatings);
router.addRoute('/admin/login-history', renderLoginHistoryPage);
router.addRoute('/admin/assessment-requests', renderAdminAssessmentRequests);
router.addRoute('/admin/user-analysis', renderAdminUserAnalysis);
router.addRoute('/admin/delete-requests', renderAdminDeleteRequests);
router.addRoute('/admin/ban-users', renderAdminBanUsers);


// Auth guard + cleanup + instant skeleton
router.beforeEach = async (to) => {
  // Cleanup realtime subscriptions on every navigation
  unsubscribeAll();

  // Show instant skeleton loader on navigation (except login)
  if (!publicRoutes.includes(to)) {
    const app = document.getElementById('app');
    if (app) {
      app.innerHTML = `
        <div class="app-layout">
          <aside class="sidebar" style="pointer-events:none;">
            <div class="sidebar-header"><div style="display:flex;align-items:center;gap:12px;padding:20px;"><div class="skeleton" style="width:36px;height:36px;border-radius:50%;"></div><div class="skeleton skeleton-text" style="width:100px;"></div></div></div>
            <nav style="padding:0 12px;">${Array(7).fill('').map(() => `<div class="skeleton skeleton-text" style="height:40px;margin:6px 0;border-radius:8px;"></div>`).join('')}</nav>
          </aside>
          <div class="main-content">
            <header class="top-header" style="pointer-events:none;">
              <div style="display:flex;align-items:center;gap:12px;padding:0 20px;">
                <div class="skeleton" style="width:28px;height:28px;border-radius:6px;"></div>
                <div class="skeleton skeleton-text" style="width:120px;"></div>
              </div>
              <div style="display:flex;align-items:center;gap:12px;padding:0 20px;">
                <div class="skeleton skeleton-text" style="width:80px;"></div>
                <div class="skeleton" style="width:36px;height:36px;border-radius:50%;"></div>
              </div>
            </header>
            <div class="page-container">
              <div class="skeleton skeleton-text" style="width:200px;height:28px;margin-bottom:24px;"></div>
              <div class="grid-3">${Array(3).fill('').map(() => `<div class="card" style="pointer-events:none;"><div class="skeleton skeleton-text" style="width:50%;height:14px;"></div><div class="skeleton skeleton-text" style="width:70%;height:32px;margin-top:12px;"></div></div>`).join('')}</div>
              <div class="card" style="margin-top:24px;pointer-events:none;"><div class="skeleton skeleton-text" style="width:40%;"></div><div class="skeleton skeleton-text" style="width:100%;height:120px;margin-top:12px;"></div></div>
            </div>
          </div>
        </div>
      `;
    }
  }

  if (publicRoutes.includes(to)) return true;
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    router.navigate('/login');
    return false;
  }
  return true;
};

// Initialize app
async function init() {
  // Ensure loader hides even if auth checks take long or fail
  setTimeout(() => {
    const loader = document.getElementById('global-loader');
    if (loader) {
      loader.classList.remove('active');
    }
  }, 1200);

  let user = null;
  try {
    // Check initial auth state
    const res = await supabase.auth.getUser();
    user = res.data?.user || null;
  } catch (err) {
    console.error('Auth initialization error:', err);
  }


  // Handle initial route
  const hash = window.location.hash.slice(1);
  if (!hash) {
    if (user) {
      // Check if onboarding is complete
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_complete, role')
        .eq('id', user.id)
        .single();
      
      if (profile && !profile.onboarding_complete) {
        router.navigate('/onboarding');
      } else if (profile?.role === 'admin') {
        router.navigate('/admin/dashboard');
      } else {
        router.navigate('/dashboard');
      }
    } else {
      router.navigate('/login');
    }
  } else {
    router.handleRoute();
  }

  // Listen for auth state changes
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_OUT') {
      localStorage.removeItem('nevin_nexus_login_ts');
      router.navigate('/login');
    } else if (event === 'SIGNED_IN') {
      const user = session?.user;
      // Check if user is banned — force sign out immediately
      if (user) {
        const { data: banCheck } = await supabase
          .from('profiles')
          .select('is_banned, ban_reason')
          .eq('id', user.id)
          .single();
        if (banCheck?.is_banned) {
          await supabase.auth.signOut();
          // Show ban message on login page
          const app = document.getElementById('app');
          if (app) {
            app.innerHTML = `
              <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:var(--bg-deep);">
                <div style="max-width:420px;text-align:center;padding:48px 32px;background:var(--bg-card);border:1px solid rgba(255,68,68,0.3);border-radius:16px;">
                  <div style="font-size:3rem;margin-bottom:16px;">🚫</div>
                  <h2 style="color:var(--danger);margin-bottom:12px;">Account Banned</h2>
                  <p style="color:var(--text-secondary);font-size:0.9rem;line-height:1.6;margin-bottom:24px;">
                    Your account has been permanently banned from NEVIN NEXUS.
                    ${banCheck.ban_reason ? `<br><br><strong>Reason:</strong> ${banCheck.ban_reason}` : ''}
                  </p>
                  <p style="color:var(--text-muted);font-size:0.8rem;">If you believe this is an error, contact the administrator.</p>
                </div>
              </div>`;
          }
          return;
        }
      }
      // Persist login row
      if (user) {
        try { await recordLogin(user.id); } catch (e) { console.warn('recordLogin:', e); }
      }
      if (user && window.location.hash === '#/login') {
        const { data: profile } = await supabase
          .from('profiles')
          .select('onboarding_complete, role')
          .eq('id', user.id)
          .single();
        if (profile && !profile.onboarding_complete) {
          router.navigate('/onboarding');
        } else if (profile?.role === 'admin') {
          router.navigate('/admin/dashboard');
        } else {
          router.navigate('/dashboard');
        }
      }
    }
  });

  // ── Inactivity Auto-Logout (2 hours) ──
  initInactivityTracker();

  // ── Absolute 2-hour session expiry ──
  initAbsoluteSessionTimeout();
}

// Add ripple effect to buttons
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn');
  if (btn) {
    const rect = btn.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    btn.style.setProperty('--ripple-x', x + '%');
    btn.style.setProperty('--ripple-y', y + '%');
  }
});

/**
 * Auto-logout after 2 hours of inactivity.
 * Tracks mouse, keyboard, scroll, and touch events.
 */
function initInactivityTracker() {
  const INACTIVITY_LIMIT = 2 * 60 * 60 * 1000; // 2 hours in ms
  let inactivityTimer = null;

  function resetTimer() {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        console.warn('[inactivity] Auto-logging out after 2 hours of inactivity');
        await supabase.auth.signOut();
        router.navigate('/login');
      }
    }, INACTIVITY_LIMIT);
  }

  // Track user activity
  const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
  events.forEach(evt => document.addEventListener(evt, resetTimer, { passive: true }));

  // Start the timer
  resetTimer();
}

/**
 * Absolute session timeout: auto-logout exactly 2 hours after login,
 * regardless of user activity. Stores login timestamp in localStorage.
 */
function initAbsoluteSessionTimeout() {
  const SESSION_MAX_MS = 2 * 60 * 60 * 1000; // 2 hours
  const KEY = 'nevin_nexus_login_ts';

  // On SIGNED_IN, store login timestamp (only if not already set)
  if (!localStorage.getItem(KEY)) {
    localStorage.setItem(KEY, Date.now().toString());
  }

  function checkTimeout() {
    const loginTs = parseInt(localStorage.getItem(KEY) || '0', 10);
    if (!loginTs) return;
    const elapsed = Date.now() - loginTs;
    if (elapsed >= SESSION_MAX_MS) {
      console.warn('[session] Absolute 2-hour session expired — logging out');
      localStorage.removeItem(KEY);
      supabase.auth.signOut().then(() => router.navigate('/login'));
    }
  }

  // Check every 30 seconds
  setInterval(checkTimeout, 30000);
  // Also check immediately
  checkTimeout();
}

// ── Tab Presence Logic ──
// We no longer trigger a full re-render on visibilitychange to preserve user input (forms).
// Instead, we just refresh the auth state if needed.
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible') {
    // Check if session is still valid — this ensures we don't work with a stale session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session && window.location.hash !== '#/login') {
      import('./router.js').then(({ router }) => router.navigate('/login'));
    }
  }
});

// Start
init();

