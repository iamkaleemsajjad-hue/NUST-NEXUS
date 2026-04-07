import { getCurrentUser, getUserProfile } from '../utils/auth.js';
import { renderSidebar, initSidebar } from '../components/sidebar.js';
import { renderHeader, initHeader, setBreadcrumb } from '../components/header.js';
import { showToast } from '../components/toast.js';
import { supabase } from '../utils/supabase.js';
import { sanitizeText, validateFields, pickAllowedFields, escapeHtml, checkRateLimit } from '../utils/sanitize.js';
import { router } from '../router.js';
import { POINTS } from '../config.js';
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

          <!-- Ideas List -->          ${!adminUser ? `
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
    
    <!-- Idea Modal -->
    <div id="idea-modal" class="modal" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;align-items:center;justify-content:center;">
      <div class="modal-content card" style="max-width:600px;width:90%;max-height:90vh;overflow-y:auto;position:relative;">
        <button id="close-modal-btn" class="btn btn-ghost" style="position:absolute;top:10px;right:10px;"><i class="fa-solid fa-xmark"></i></button>
        <h2 id="modal-idea-title" style="margin-bottom:var(--space-sm);"></h2>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:var(--space-md);">
          <span id="modal-idea-category" class="badge badge-primary"></span>
          <span id="modal-idea-difficulty" class="badge"></span>
          <span id="modal-idea-status" class="badge"></span>
        </div>
        <div id="modal-idea-rating-container" style="margin-bottom:var(--space-md);"></div>
        <p style="color:var(--text-muted);font-size:0.875rem;margin-bottom:var(--space-lg);">
          By <span id="modal-idea-author"></span> • <span id="modal-idea-date"></span>
        </p>
        <div id="modal-idea-desc" style="white-space:pre-wrap;line-height:1.6;font-size:0.95rem;word-break:break-word;overflow-wrap:anywhere;"></div>
        <div id="modal-admin-actions" style="display:none;gap:12px;margin-top:var(--space-xl);padding-top:var(--space-lg);border-top:1px solid var(--grid);"></div>
      </div>
    </div>
  `;

  window.isAdmin = adminUser;
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
      const rawTitle = document.getElementById('idea-title').value;
      const rawDesc = document.getElementById('idea-desc').value;
      const category = document.getElementById('idea-category').value;
      const difficulty = document.getElementById('idea-difficulty').value;

      const title = sanitizeText(rawTitle, 120);
      const description = sanitizeText(rawDesc, 4000);

      const payload = { title, description, category, difficulty };

      const { isValid, errors } = validateFields(payload, {
        title: { type: 'string', required: true, maxLength: 120 },
        description: { type: 'string', required: true, maxLength: 4000 },
        category: { type: 'string', required: true, enum: ['web', 'mobile', 'ai', 'iot', 'game', 'other'] },
        difficulty: { type: 'string', required: true, enum: ['beginner', 'intermediate', 'advanced'] },
      });
      if (!isValid) {
        showToast(errors[0] || 'Check your input', 'warning');
        return;
      }

      const rl = checkRateLimit('idea_submit', 6, 3600000);
      if (!rl.allowed) {
        showToast('Too many idea submissions. Try again later.', 'error');
        return;
      }

      const submitBtn = e.target.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner"></span> Checking...';

      // Check for similar ideas
      const { checkIdeaSimilarity } = await import('../utils/idea-similarity.js');
      const { isDuplicate, similarIdea, similarity, hash } = await checkIdeaSimilarity(supabase, title, description);

      if (isDuplicate) {
        showToast(`Similar idea already submitted by ${similarIdea?.profiles?.display_name || 'someone'} (${Math.round(similarity * 100)}% match). Try a different concept!`, 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit Idea';
        return;
      }

      submitBtn.innerHTML = '<span class="spinner"></span> Submitting...';

      const row = pickAllowedFields(
        {
          title,
          description,
          category,
          difficulty,
          user_id: user.id,
          idea_hash: hash,
        },
        ['title', 'description', 'category', 'difficulty', 'user_id', 'idea_hash']
      );

      const { error } = await supabase.from('project_ideas').insert(row);

      if (error) {
        showToast('Failed: ' + error.message, 'error');
      } else {
        showToast('Idea submitted! It is now pending admin approval.', 'success');
        document.getElementById('idea-form-card').style.display = 'none';
        document.getElementById('idea-form').reset();
        loadIdeas(profile);
      }
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit Idea';
    });
  }

  loadIdeas(profile);
}

async function loadIdeas(profile) {
  const container = document.getElementById('ideas-list');
  
  const { data } = await supabase
    .from('project_ideas')
    .select('*, profiles(display_name), idea_ratings(user_id, rating)')
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
  const statusColors = {
    approved: 'badge-success', pending: 'badge-warning', rejected: 'badge-danger'
  };

  container.innerHTML = `
    <div class="resource-grid">
      ${data.map(idea => {
        const ratings = idea.idea_ratings || [];
        const avg = ratings.length ? (ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(1) : '0.0';
        return `
        <div class="card resource-card" style="cursor:pointer;" onclick="window.openIdea('${idea.id}')">
          <div class="resource-header">
            <div class="resource-type-icon">
              <i class="fa-solid ${categoryIcons[idea.category] || 'fa-lightbulb'}"></i>
            </div>
            <div style="flex:1;">
              <h4 style="font-size:1rem;margin-bottom:4px;">${idea.title}</h4>
              <div style="display:flex;gap:6px;flex-wrap:wrap;">
                <span class="badge badge-primary">${idea.category || 'General'}</span>
                <span class="badge ${difficultyColors[idea.difficulty] || 'badge-primary'}">${idea.difficulty || 'N/A'}</span>
                <span class="badge ${statusColors[idea.status] || 'badge-warning'}">${idea.status ? idea.status.toUpperCase() : 'PENDING'}</span>
              </div>
              <div class="idea-rating-display">
                <div class="stars"><i class="fa-solid fa-star"></i></div>
                <span class="avg">${avg}</span>
                <span class="count">(${ratings.length} rating${ratings.length !== 1 ? 's' : ''})</span>
              </div>
            </div>
          </div>
          <p style="color:var(--text-secondary);font-size:0.875rem;margin:var(--space-md) 0;line-height:1.5;">
            ${escapeHtml(idea.description || '').substring(0, 200)}${(idea.description?.length || 0) > 200 ? '...' : ''}
          </p>
          <div style="display:flex;justify-content:space-between;align-items:center;padding-top:var(--space-md);border-top:1px solid var(--grid);">
            <span style="color:var(--text-muted);font-size:0.75rem;">
              <i class="fa-solid fa-user"></i> ${idea.profiles?.display_name || 'Anonymous'} •
              ${new Date(idea.created_at).toLocaleDateString()}
            </span>
            <button class="btn btn-ghost btn-sm" style="color:var(--primary);">
              Read More
            </button>
          </div>
        </div>
      `;
      }).join('')}
    </div>
  `;

  // Attach global click handler for ideas
  window.openIdea = (id) => {
    const idea = data.find(i => i.id === id);
    if (!idea) return;
    document.getElementById('modal-idea-title').textContent = idea.title;
    document.getElementById('modal-idea-category').textContent = idea.category || 'General';
    document.getElementById('modal-idea-difficulty').className = `badge ${difficultyColors[idea.difficulty] || 'badge-primary'}`;
    document.getElementById('modal-idea-difficulty').textContent = idea.difficulty || 'N/A';
    
    const ideaStatus = idea.status || 'pending';
    document.getElementById('modal-idea-status').className = `badge ${statusColors[ideaStatus] || 'badge-warning'}`;
    document.getElementById('modal-idea-status').textContent = ideaStatus.toUpperCase();
    
    document.getElementById('modal-idea-author').textContent = idea.profiles?.display_name || 'Anonymous';
    document.getElementById('modal-idea-date').textContent = new Date(idea.created_at).toLocaleDateString();
    document.getElementById('modal-idea-desc').textContent = idea.description || '';
    
    // Rating Logic
    const ratings = idea.idea_ratings || [];
    const avg = ratings.length ? (ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(1) : '0.0';
    const userRating = ratings.find(r => r.user_id === profile.id);
    
    let ratingHtml = `<div class="idea-rating-display"><div class="stars"><i class="fa-solid fa-star"></i></div><span class="avg">${avg}</span><span class="count">(${ratings.length} rating${ratings.length !== 1 ? 's' : ''})</span></div>`;
    
    if (userRating) {
      ratingHtml += `<div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 8px;">You rated this ${userRating.rating} stars.</div>`;
    } else {
      ratingHtml += `
        <div style="margin-top: 12px; display: flex; align-items: center; gap: 12px;">
          <p style="font-size: 0.85rem; margin: 0; color: var(--text-secondary);">Rate this idea:</p>
          <div class="star-rating-widget" id="idea-rating-widget">
            <input type="radio" name="idea_rate" id="rate-5" value="5"><label for="rate-5" class="fa-solid fa-star"></label>
            <input type="radio" name="idea_rate" id="rate-4" value="4"><label for="rate-4" class="fa-solid fa-star"></label>
            <input type="radio" name="idea_rate" id="rate-3" value="3"><label for="rate-3" class="fa-solid fa-star"></label>
            <input type="radio" name="idea_rate" id="rate-2" value="2"><label for="rate-2" class="fa-solid fa-star"></label>
            <input type="radio" name="idea_rate" id="rate-1" value="1"><label for="rate-1" class="fa-solid fa-star"></label>
          </div>
        </div>
      `;
    }
    const ratingContainer = document.getElementById('modal-idea-rating-container');
    ratingContainer.innerHTML = ratingHtml;
    
    if (!userRating) {
      document.querySelectorAll('#idea-rating-widget input').forEach(radio => {
        radio.addEventListener('change', async (e) => {
          const val = parseInt(e.target.value);
          const widget = document.getElementById('idea-rating-widget');
          if (widget.classList.contains('disabled')) return;
          widget.classList.add('disabled');
          widget.querySelectorAll('input').forEach(i => i.disabled = true);
          
          const { error } = await supabase.from('idea_ratings').insert({
            idea_id: idea.id,
            user_id: profile.id,
            rating: val
          });
          
          if (error) {
            import('../components/toast.js').then(m => m.showToast('Failed to save rating. Did you already rate?', 'error'));
            widget.classList.remove('disabled');
            widget.querySelectorAll('input').forEach(i => i.disabled = false);
          } else {
            import('../components/toast.js').then(m => m.showToast('Rating saved successfully!', 'success'));
            widget.parentElement.innerHTML = `<div style="font-size: 0.85rem; color: var(--success); margin-top: 8px;">You rated this ${val} stars.</div>`;
            
            // Background reload to update averages across UI without resetting scroll
            const currentPosition = window.pageYOffset;
            await loadIdeas(profile);
            window.scrollTo(0, currentPosition);
          }
        });
      });
    }

    // Admin actions
    const adminActionsContainer = document.getElementById('modal-admin-actions');
    if (window.isAdmin && ideaStatus === 'pending') {
      adminActionsContainer.style.display = 'flex';
      adminActionsContainer.innerHTML = `
        <button class="btn btn-primary" onclick="window.approveIdea('${idea.id}', '${idea.user_id}')">
          <i class="fa-solid fa-check"></i> Approve & Award Points
        </button>
        <button class="btn btn-danger" onclick="window.rejectIdea('${idea.id}')">
          <i class="fa-solid fa-xmark"></i> Reject
        </button>
      `;
    } else {
      adminActionsContainer.style.display = 'none';
      adminActionsContainer.innerHTML = '';
    }
    
    const modal = document.getElementById('idea-modal');
    modal.style.display = 'flex';
    gsap.fromTo('.modal-content', { scale: 0.9, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(1.2)' });
  };
  
  window.approveIdea = async (id, userId) => {
    if(!confirm('Approve this idea and award 5 points?')) return;
    document.getElementById('idea-modal').style.display = 'none';
    
    const { POINTS } = await import('../config.js');
    const { error } = await supabase.from('project_ideas').update({ status: 'approved' }).eq('id', id);
    
    if (error) {
      showToast('Error approving idea', 'error');
      return;
    }
    
    // Give user points
    const { data: userProfile } = await supabase.from('profiles').select('points').eq('id', userId).single();
    await supabase.from('profiles').update({ points: (userProfile?.points || 0) + POINTS.UNIQUE_IDEA }).eq('id', userId);
    
    showToast('Idea approved and points awarded!', 'success');
    loadIdeas(profile);
  };
  
  window.rejectIdea = async (id) => {
    if(!confirm('Reject this idea? No points will be awarded.')) return;
    document.getElementById('idea-modal').style.display = 'none';
    
    const { error } = await supabase.from('project_ideas').update({ status: 'rejected' }).eq('id', id);
    if (error) {
      showToast('Error rejecting idea', 'error');
      return;
    }
    
    showToast('Idea rejected.', 'success');
    loadIdeas(profile);
  };

  document.getElementById('close-modal-btn')?.addEventListener('click', () => {
    document.getElementById('idea-modal').style.display = 'none';
  });

  gsap.fromTo('.resource-card', { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, stagger: 0.05, ease: 'power3.out' });
}
