import { getCurrentUser, getUserProfile } from '../utils/auth.js';
import { renderSidebar, initSidebar } from '../components/sidebar.js';
import { renderHeader, initHeader, setBreadcrumb } from '../components/header.js';
import { showToast } from '../components/toast.js';
import { supabase } from '../utils/supabase.js';
import { router } from '../router.js';
import gsap from 'gsap';

export async function renderIdeasPage() {
  const app = document.getElementById('app');
  const user = await getCurrentUser();
  if (!user) { router.navigate('/login'); return; }
  const profile = await getUserProfile(user.id);
  if (!profile) { router.navigate('/login'); return; }

  const adminUser = profile.role === 'admin';

  app.innerHTML = `
    <div class="app-layout">
      ${renderSidebar(profile)}
      <div class="main-content">
        ${renderHeader(profile)}
        <div class="page-container">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-xl);">
            <h2><i class="fa-solid fa-lightbulb"></i> Project Ideas</h2>
            ${!adminUser ? `
              <button class="btn btn-primary" id="new-idea-btn">
                <i class="fa-solid fa-plus"></i> Submit Idea
              </button>
            ` : `
              <span class="badge badge-primary" style="font-size:0.875rem;padding:8px 16px;">
                <i class="fa-solid fa-eye"></i> Admin View — All Ideas
              </span>
            `}
          </div>

          ${!adminUser ? `
            <!-- Idea Submission Form (students only) -->
            <div class="card" id="idea-form-card" style="display:none;margin-bottom:var(--space-xl);">
              <h3 style="margin-bottom:var(--space-lg);">Share Your Project Idea</h3>
              <form id="idea-form">
                <div class="form-group">
                  <label class="form-label">Project Title *</label>
                  <input type="text" class="form-input" id="idea-title" placeholder="Give your idea a catchy title" required />
                </div>
                <div class="form-group">
                  <label class="form-label">Description *</label>
                  <textarea class="form-textarea" id="idea-desc" placeholder="Describe your project idea, its goals, and potential impact..." required></textarea>
                </div>
                <div class="grid-2">
                  <div class="form-group">
                    <label class="form-label">Category</label>
                    <select class="form-select" id="idea-category">
                      <option value="web">Web Development</option>
                      <option value="mobile">Mobile App</option>
                      <option value="ai">AI / Machine Learning</option>
                      <option value="iot">IoT</option>
                      <option value="game">Game Development</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Difficulty</label>
                    <select class="form-select" id="idea-difficulty">
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </select>
                  </div>
                </div>
                <div style="display:flex;gap:var(--space-md);">
                  <button type="submit" class="btn btn-primary">
                    <i class="fa-solid fa-paper-plane"></i> Submit Idea
                  </button>
                  <button type="button" class="btn btn-ghost" id="cancel-idea-btn">Cancel</button>
                </div>
              </form>
            </div>
          ` : ''}

          <div id="ideas-list">
            <div class="skeleton skeleton-card" style="height:200px;"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  initSidebar(); initHeader(profile); setBreadcrumb('Project Ideas');

  if (!adminUser) {
    document.getElementById('new-idea-btn')?.addEventListener('click', () => {
      document.getElementById('idea-form-card').style.display = 'block';
    });
    document.getElementById('cancel-idea-btn')?.addEventListener('click', () => {
      document.getElementById('idea-form-card').style.display = 'none';
    });

    document.getElementById('idea-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        title: document.getElementById('idea-title').value.trim(),
        description: document.getElementById('idea-desc').value.trim(),
        category: document.getElementById('idea-category').value,
        difficulty: document.getElementById('idea-difficulty').value,
        user_id: user.id,
      };

      const { error } = await supabase.from('project_ideas').insert(payload);
      if (error) {
        showToast('Failed: ' + error.message, 'error');
      } else {
        showToast('Idea submitted! 🎉', 'success');
        document.getElementById('idea-form-card').style.display = 'none';
        document.getElementById('idea-form').reset();
        loadIdeas(profile);
      }
    });
  }

  loadIdeas(profile);
}

async function loadIdeas(profile) {
  const container = document.getElementById('ideas-list');
  
  const { data } = await supabase
    .from('project_ideas')
    .select('*, profiles(display_name)')
    .order('created_at', { ascending: false });

  if (!data || data.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-lightbulb"></i>
        <h4>No ideas yet</h4>
        <p>Be the first to share a project idea!</p>
      </div>
    `;
    return;
  }

  const categoryIcons = {
    web: 'fa-globe', mobile: 'fa-mobile-screen', ai: 'fa-robot',
    iot: 'fa-microchip', game: 'fa-gamepad', other: 'fa-puzzle-piece'
  };
  const difficultyColors = {
    beginner: 'badge-success', intermediate: 'badge-warning', advanced: 'badge-danger'
  };

  container.innerHTML = `
    <div class="resource-grid">
      ${data.map(idea => `
        <div class="card resource-card">
          <div class="resource-header">
            <div class="resource-type-icon">
              <i class="fa-solid ${categoryIcons[idea.category] || 'fa-lightbulb'}"></i>
            </div>
            <div style="flex:1;">
              <h4 style="font-size:1rem;margin-bottom:4px;">${idea.title}</h4>
              <div style="display:flex;gap:6px;flex-wrap:wrap;">
                <span class="badge badge-primary">${idea.category || 'General'}</span>
                <span class="badge ${difficultyColors[idea.difficulty] || 'badge-primary'}">${idea.difficulty || 'N/A'}</span>
              </div>
            </div>
          </div>
          <p style="color:var(--text-secondary);font-size:0.875rem;margin:var(--space-md) 0;line-height:1.5;">
            ${idea.description?.substring(0, 200)}${idea.description?.length > 200 ? '...' : ''}
          </p>
          <div style="display:flex;justify-content:space-between;align-items:center;padding-top:var(--space-md);border-top:1px solid var(--grid);">
            <span style="color:var(--text-muted);font-size:0.75rem;">
              <i class="fa-solid fa-user"></i> ${idea.profiles?.display_name || 'Anonymous'} •
              ${new Date(idea.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  gsap.fromTo('.resource-card', { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, stagger: 0.05, ease: 'power3.out' });
}
