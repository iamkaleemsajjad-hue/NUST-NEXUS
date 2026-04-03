import { getCurrentUser, getUserProfile } from '../utils/auth.js';
import { renderSidebar, initSidebar } from '../components/sidebar.js';
import { renderHeader, initHeader, setBreadcrumb } from '../components/header.js';
import { showToast } from '../components/toast.js';
import { supabase } from '../utils/supabase.js';
import { router } from '../router.js';
import gsap from 'gsap';

export async function renderFeedbackPage() {
  const app = document.getElementById('app');
  const user = await getCurrentUser();
  if (!user) { router.navigate('/login'); return; }
  const profile = await getUserProfile(user.id);
  if (!profile) { router.navigate('/login'); return; }

  // Admin redirects to admin feedback management
  if (profile.role === 'admin') {
    router.navigate('/admin/feedback');
    return;
  }

  app.innerHTML = `
    <div class="app-layout">
      ${renderSidebar(profile)}
      <div class="main-content">
        ${renderHeader(profile)}
        <div class="page-container">
          <h2 style="margin-bottom:var(--space-xl);"><i class="fa-solid fa-comment-dots"></i> Feedback</h2>
          
          <!-- Submit Feedback -->
          <div class="card" style="margin-bottom:var(--space-xl);" id="feedback-card">
            <h3 style="margin-bottom:var(--space-lg);">Send Feedback to Admin</h3>
            <form id="feedback-form">
              <div class="form-group">
                <label class="form-label">Your Message *</label>
                <textarea class="form-textarea" id="feedback-msg" placeholder="Share your suggestions, issues, or compliments..." required></textarea>
              </div>
              <button type="submit" class="btn btn-primary">
                <i class="fa-solid fa-paper-plane"></i> Send Feedback
              </button>
            </form>
          </div>

          <!-- Previous Feedback -->
          <h3 style="margin-bottom:var(--space-lg);">Your Previous Feedback</h3>
          <div id="feedback-list">
            <div class="skeleton skeleton-card" style="height:200px;"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  initSidebar(); initHeader(profile); setBreadcrumb('Feedback');

  document.getElementById('feedback-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = document.getElementById('feedback-msg').value.trim();
    
    const { error } = await supabase.from('feedback').insert({
      message,
      user_id: user.id,
      type: 'student',
      user_name: profile.display_name,
    });

    if (error) {
      showToast('Failed: ' + error.message, 'error');
    } else {
      showToast('Feedback sent! We\'ll review it soon.', 'success');
      document.getElementById('feedback-form').reset();
      loadFeedback(user.id);
    }
  });

  loadFeedback(user.id);
}

async function loadFeedback(userId) {
  const container = document.getElementById('feedback-list');
  
  const { data } = await supabase
    .from('feedback')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (!data || data.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-comments"></i>
        <h4>No feedback submitted yet</h4>
        <p>Use the form above to share your thoughts</p>
      </div>
    `;
    return;
  }

  container.innerHTML = data.map(f => `
    <div class="card" style="margin-bottom:var(--space-md);">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:var(--space-sm);">
        <p style="flex:1;">${f.message}</p>
        <span style="color:var(--text-muted);font-size:0.75rem;white-space:nowrap;margin-left:var(--space-md);">
          ${new Date(f.created_at).toLocaleDateString()}
        </span>
      </div>
      ${f.admin_reply ? `
        <div style="margin-top:var(--space-md);padding:var(--space-md);background:rgba(0,255,136,0.05);border:1px solid rgba(0,255,136,0.15);border-radius:var(--radius-md);">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:var(--space-sm);">
            <i class="fa-solid fa-reply" style="color:var(--success);"></i>
            <strong style="color:var(--success);font-size:0.875rem;">Admin Reply</strong>
            ${f.replied_at ? `<span style="color:var(--text-muted);font-size:0.75rem;">${new Date(f.replied_at).toLocaleDateString()}</span>` : ''}
          </div>
          <p style="color:var(--text-secondary);font-size:0.875rem;">${f.admin_reply}</p>
        </div>
      ` : `
        <span class="badge badge-warning" style="margin-top:var(--space-sm);">
          <i class="fa-solid fa-clock"></i> Awaiting reply
        </span>
      `}
    </div>
  `).join('');

  gsap.fromTo('#feedback-list .card', { y: 15, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, stagger: 0.08, ease: 'power3.out' });
}
