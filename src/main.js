import './styles/index.css';
import './styles/pages.css';
import { router } from './router.js';
import { supabase } from './utils/supabase.js';
import { recordLogin } from './utils/auth.js';
import { getCached, setCache, bustCache } from './utils/cache.js';
import { renderLoginPage } from './pages/login.js';
import { renderLandingPage } from './pages/landing.js';
import { renderOnboardingPage } from './pages/onboarding.js';
import { renderDashboardPage } from './pages/dashboard.js';
import { renderUploadPage } from './pages/upload.js';
import { renderBrowsePage } from './pages/browse.js';
import { renderYourUploadsPage } from './pages/your-uploads.js';
import { renderTeachersPage } from './pages/teachers.js';
import { renderIdeasPage } from './pages/ideas.js';
import { renderIdeaRoomPage } from './pages/idea-room.js';
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
import { renderAdminGivePoints } from './pages/admin/give-points.js';
import { renderAdminRoomSessions } from './pages/admin/room-sessions.js';
import { unsubscribeAll } from './utils/realtime.js';


// Public routes (no auth required)
const publicRoutes = ['/', '/login'];

// Register routes
router.addRoute('/', renderLandingPage);
router.addRoute('/login', renderLoginPage);
router.addRoute('/onboarding', renderOnboardingPage);
router.addRoute('/dashboard', renderDashboardPage);
router.addRoute('/upload', renderUploadPage);
router.addRoute('/browse', renderBrowsePage);
router.addRoute('/your-uploads', renderYourUploadsPage);
router.addRoute('/teachers', renderTeachersPage);
router.addRoute('/ideas', renderIdeasPage);
router.addRoute('/idea-room', renderIdeaRoomPage);
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
router.addRoute('/admin/give-points', renderAdminGivePoints);
router.addRoute('/admin/room-sessions', renderAdminRoomSessions);


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

  // Use cached auth check to avoid redundant API calls on rapid navigation
  const cachedUser = getCached('auth_guard_user');
  if (cachedUser) return true;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    router.navigate('/login');
    return false;
  }
  // Warm BOTH auth cache keys so getCurrentUser() in page handlers
  // gets an instant hit and doesn't call getUser() again.
  setCache('auth_guard_user', user, 60000);
  setCache('auth_current_user', user, 30000);
  return true;
};

// Flag: prevents onAuthStateChange from interfering during initial startup
let _initDone = false;

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
  if (!hash || hash === '/') {
    // Always call handleRoute() directly for '/' so that reloading the page
    // (where hash is already '#/' and navigate('/') would be a no-op) still
    // renders the landing page before onAuthStateChange can fire.
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
      // Render the landing page directly — don't use navigate('/') because
      // if the hash is already '#/' a hashchange won't fire, leaving the page
      // blank until onAuthStateChange incorrectly redirects to /login.
      window.location.hash = '/';
      await router.handleRoute();
    }
  } else {
    router.handleRoute();
  }

  // Mark init as complete so onAuthStateChange only handles genuinely new events
  _initDone = true;

  // Listen for auth state changes
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_OUT') {
      localStorage.removeItem('scholar_nexus_login_ts');
      router.navigate('/');
    } else if (event === 'SIGNED_IN') {
      const user = session?.user;
      // Check if user is banned — force sign out immediately
      if (user) {
        let { data: banCheck } = await supabase
          .from('profiles')
          .select('is_banned, ban_reason')
          .eq('id', user.id)
          .single();

        if (banCheck?.is_banned && banCheck?.ban_reason === 'Account Purged Permanently') {
          // Auto-recover/migrate old deleted account format
          await supabase.from('profiles').update({
            is_banned: false,
            ban_reason: null,
            onboarding_complete: false
          }).eq('id', user.id);
          banCheck = { is_banned: false, ban_reason: null };
        }

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
                    Your account has been permanently banned from SCHOLAR NEXUS.
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
      // Only redirect to dashboard on a genuine new sign-in (after init() is done).
      // Skip during startup — init() already handled the initial navigation so we
      // don't accidentally override the landing page render on reload.
      if (!_initDone) return;
      if (user && (window.location.hash === '#/login' || window.location.hash === '#/')) {
        // Skip redirect if user is in password reset mode
        if (window.__resetPasswordMode) return;
        
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
  const KEY = 'scholar_nexus_login_ts';

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
// When the user switches back to this tab, bust stale data caches,
// re-warm auth caches from the existing session, and re-render the page.
// This ensures pages only make their OWN data API calls (no redundant auth).
let _lastVisibleTime = Date.now();
let _tabRefreshInProgress = false;

document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible') {
    const away = Date.now() - _lastVisibleTime;

    // Skip if user was away less than 3 seconds (quick alt-tab)
    if (away < 3000) return;

    // Skip for public routes — no data to refresh
    const currentHash = window.location.hash;
    if (!currentHash || currentHash === '#/' || currentHash === '#/login') return;

    // Prevent duplicate refreshes if the handler is already running
    if (_tabRefreshInProgress) return;
    _tabRefreshInProgress = true;

    try {
      // 1. Validate the session is still alive (single network call)
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.navigate('/login');
        return;
      }

      // 2. Bust ALL data caches
      bustCache('all');

      // 3. Immediately re-warm auth caches from the session we already have.
      //    This prevents redundant getUser() calls during the page re-render.
      const user = session.user;
      setCache('auth_current_user', user, 30000);
      setCache('auth_guard_user', user, 60000);

      // 4. Pre-fetch and cache the user profile so page handlers don't wait for it.
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      if (profile) {
        setCache(`auth_profile_${user.id}`, profile, 60000);
      }

      // 5. Re-render the current page — auth is pre-warmed, so ONLY page data APIs fire.
      await router.handleRoute();
    } catch (err) {
      console.warn('[tab-switch] Error refreshing:', err);
    } finally {
      _tabRefreshInProgress = false;
    }
  } else {
    // Record the time the user left this tab
    _lastVisibleTime = Date.now();
  }
});

// Start
init();

