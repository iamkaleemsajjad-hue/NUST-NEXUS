import './styles/index.css';
import './styles/pages.css';
import { router } from './router.js';
import { supabase } from './utils/supabase.js';
import { renderLoginPage } from './pages/login.js';
import { renderOnboardingPage } from './pages/onboarding.js';
import { renderDashboardPage } from './pages/dashboard.js';
import { renderUploadPage } from './pages/upload.js';
import { renderBrowsePage } from './pages/browse.js';
import { renderTeachersPage } from './pages/teachers.js';
import { renderIdeasPage } from './pages/ideas.js';
import { renderSettingsPage } from './pages/settings.js';
import { renderFeedbackPage } from './pages/feedback.js';
import { renderAdminDashboard } from './pages/admin/dashboard.js';
import { renderAdminTeachers } from './pages/admin/teachers.js';
import { renderAdminCourses } from './pages/admin/courses.js';
import { renderAdminNotifications } from './pages/admin/notifications.js';
import { renderAdminFeedback } from './pages/admin/feedback.js';
import { renderAdminRatings } from './pages/admin/ratings.js';

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
router.addRoute('/settings', renderSettingsPage);
router.addRoute('/feedback', renderFeedbackPage);
router.addRoute('/admin/dashboard', renderAdminDashboard);
router.addRoute('/admin/teachers', renderAdminTeachers);
router.addRoute('/admin/courses', renderAdminCourses);
router.addRoute('/admin/notifications', renderAdminNotifications);
router.addRoute('/admin/feedback', renderAdminFeedback);
router.addRoute('/admin/ratings', renderAdminRatings);

// Auth guard
router.beforeEach = async (to) => {
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
  // Check initial auth state
  const { data: { user } } = await supabase.auth.getUser();
  
  // Hide loader
  setTimeout(() => {
    const loader = document.getElementById('global-loader');
    if (loader) {
      loader.classList.remove('active');
    }
  }, 1200);

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
      router.navigate('/login');
    } else if (event === 'SIGNED_IN') {
      const user = session?.user;
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

// Start
init();
