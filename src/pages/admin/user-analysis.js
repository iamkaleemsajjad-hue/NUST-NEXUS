import { supabase } from '../../utils/supabase.js';
import anime from 'animejs';
import { renderSidebar, initSidebar } from '../../components/sidebar.js';
import { renderHeader, initHeader, setBreadcrumb } from '../../components/header.js';
import { getCurrentUser, getUserProfile } from '../../utils/auth.js';
import { router } from '../../router.js';

let _profile = null;

function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function timeAgo(dateRef) {
  const diff = Date.now() - new Date(dateRef).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function showToast(msg, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <i class="fa-solid fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'circle-exclamation' : type === 'warning' ? 'triangle-exclamation' : 'info-circle'}"></i>
    <span>${escapeHtml(msg)}</span>
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

export async function renderAdminUserAnalysis() {
  const app = document.getElementById('app');
  
  const user = await getCurrentUser();
  if (!user) return router.navigate('/login');
  
  const profile = await getUserProfile(user.id);
  if (!profile || profile.role !== 'admin') {
    return router.navigate('/dashboard');
  }

  _profile = profile;

  const html = `
    <div class="app-layout">
      ${renderSidebar(_profile)}
      <div class="main-content">
        ${renderHeader(_profile)}
        <div class="page-container">
          <div class="user-analysis-container anime-stagger-item">
            <div class="page-header" style="margin-bottom: var(--space-xl);">
              <h2><i class="fa-solid fa-magnifying-glass-chart"></i> User Analysis</h2>
              <p class="text-muted">Search for a user by Student ID (UUID) to view and manage their full activity log.</p>
            </div>

            <div class="card" style="margin-bottom: var(--space-xl);">
              <form id="ua-search-form" style="display:flex; gap: var(--space-md); align-items:flex-end;">
                <div class="form-group" style="flex:1; margin-bottom: 0;">
                  <label>Student ID (UUID)</label>
                  <input type="text" id="ua-search-id" class="form-control" placeholder="e.g. 123e4567-e89b-12d3..." required>
                </div>
                <button type="submit" class="btn btn-primary" id="ua-search-btn">
                  <i class="fa-solid fa-magnifying-glass"></i> Search
                </button>
              </form>
            </div>

            <div id="ua-results-container" style="display:none; min-height: 200px;"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  app.innerHTML = html;
  
  initSidebar();
  initHeader(_profile);
  setBreadcrumb('User Analysis');

  const form = document.getElementById('ua-search-form');
  if (form) {
    form.addEventListener('submit', handleSearch);
  }
}

async function handleSearch(e) {
  e.preventDefault();
  const searchId = document.getElementById('ua-search-id').value.trim();
  if (!searchId) return;

  const btn = document.getElementById('ua-search-btn');
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> Searching...`;

  try {
    const { data: userProfile, error: profileErr } = await supabase.from('profiles').select('*').eq('id', searchId).maybeSingle();
    
    if (profileErr || !userProfile) {
      document.getElementById('ua-results-container').style.display = 'block';
      document.getElementById('ua-results-container').innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-user-slash"></i>
          <h4>User Not Found</h4>
          <p>No student exists with the provided ID.</p>
        </div>
      `;
      btn.disabled = false;
      btn.innerHTML = `<i class="fa-solid fa-magnifying-glass"></i> Search`;
      return;
    }

    await loadUserActivity(userProfile);
  } catch (err) {
    showToast('Failed to fetch user.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid fa-magnifying-glass"></i> Search`;
  }
}

async function loadUserActivity(userProfile) {
  const container = document.getElementById('ua-results-container');
  container.style.display = 'block';
  container.innerHTML = `<div class="empty-state"><span class="spinner" style="width:40px;height:40px;"></span></div>`;

  // Fetch all related entities: Uploads, Questions, Answers, Replies
  const [uploadsRes, questionsRes, answersRes, repliesRes] = await Promise.all([
    supabase.from('uploads').select('*').eq('user_id', userProfile.id).order('created_at', { ascending: false }),
    supabase.from('questions').select('*').eq('user_id', userProfile.id).order('created_at', { ascending: false }),
    supabase.from('question_answers').select('*, questions(title)').eq('user_id', userProfile.id).order('created_at', { ascending: false }),
    supabase.from('answer_replies').select('*').eq('user_id', userProfile.id).order('created_at', { ascending: false })
  ]);

  const uploads = uploadsRes.data || [];
  const questions = questionsRes.data || [];
  const answers = answersRes.data || [];
  const replies = repliesRes.data || [];

  window.uaDeleteUpload = async (id, filePath) => {
    if (!confirm('Are you sure you want to permanently delete this material?')) return;
    if (filePath) await supabase.storage.from('resources').remove([filePath]);
    await supabase.from('uploads').update({ is_deleted: true }).eq('id', id);
    showToast('Upload deleted', 'success');
    loadUserActivity(userProfile);
  };

  window.uaDeleteQuestion = async (id) => {
    if (!confirm('Are you sure you want to delete this question?')) return;
    await supabase.from('questions').update({ is_deleted: true }).eq('id', id);
    showToast('Question deleted', 'success');
    loadUserActivity(userProfile);
  };

  window.uaDeleteAnswer = async (id) => {
    if (!confirm('Are you sure you want to delete this answer?')) return;
    await supabase.from('question_answers').update({ is_deleted: true }).eq('id', id);
    showToast('Answer deleted', 'success');
    loadUserActivity(userProfile);
  };

  window.uaDeleteReply = async (id) => {
    if (!confirm('Are you sure you want to delete this reply?')) return;
    await supabase.from('answer_replies').update({ is_deleted: true }).eq('id', id);
    showToast('Reply deleted', 'success');
    loadUserActivity(userProfile);
  };

  container.innerHTML = `
    <!-- User Profile Header -->
    <div class="card" style="margin-bottom:var(--space-lg); border-left: 4px solid var(--primary);">
      <h3 style="margin-bottom:var(--space-xs); display:flex; align-items:center; gap:8px;">
        <i class="fa-solid fa-address-card" style="color:var(--primary);"></i> ${escapeHtml(userProfile.display_name)}
        ${userProfile.is_banned ? '<span class="badge badge-danger">BANNED</span>' : ''}
      </h3>
      <div style="font-size:0.9rem; color:var(--text-secondary);">
        <div><strong>Email:</strong> ${escapeHtml(userProfile.email)}</div>
        <div><strong>ID:</strong> ${userProfile.id}</div>
        <div><strong>Points:</strong> ${userProfile.points || 0}</div>
        <div><strong>Role:</strong> ${escapeHtml(userProfile.role)}</div>
        <div><strong>Joined:</strong> ${new Date(userProfile.created_at).toLocaleDateString()}</div>
      </div>
    </div>

    <!-- Tabs Container -->
    <div style="display:flex; gap: var(--space-md); flex-wrap: wrap;">
      
      <!-- Uploads Column -->
      <div style="flex:1; min-width:300px;">
        <h4><i class="fa-solid fa-file-arrow-up"></i> Uploads (${uploads.length})</h4>
        <div style="display:flex; flex-direction:column; gap:8px; margin-top:8px;">
          ${uploads.length === 0 ? '<div class="text-muted">No uploads.</div>' : 
            uploads.map(u => `
              <div class="card p-3 ua-anim-item" style="${u.is_deleted ? 'opacity:0.5' : ''}">
                <div style="display:flex; justify-content:space-between;">
                  <strong style="word-break:break-word;">${escapeHtml(u.title_name)}</strong>
                  ${u.is_deleted ? '<span class="badge badge-danger">Deleted</span>' : 
                   `<button class="btn btn-ghost btn-sm" style="color:var(--danger);" onclick="window.uaDeleteUpload('${u.id}', '${u.file_path}')"><i class="fa-solid fa-trash"></i></button>`}
                </div>
                <div style="font-size:0.8rem; color:var(--text-muted); margin-top:4px;">
                  ${u.status} • ${timeAgo(u.created_at)}
                </div>
              </div>
            `).join('')
          }
        </div>
      </div>

      <!-- Questions Column -->
      <div style="flex:1; min-width:300px;">
        <h4><i class="fa-solid fa-circle-question"></i> Questions (${questions.length})</h4>
        <div style="display:flex; flex-direction:column; gap:8px; margin-top:8px;">
          ${questions.length === 0 ? '<div class="text-muted">No questions.</div>' : 
            questions.map(q => `
              <div class="card p-3 ua-anim-item" style="${q.is_deleted ? 'opacity:0.5' : ''}">
                <div style="display:flex; justify-content:space-between;">
                  <strong style="word-break:break-word;">${escapeHtml(q.title)}</strong>
                  ${q.is_deleted ? '<span class="badge badge-danger">Deleted</span>' : 
                   `<button class="btn btn-ghost btn-sm" style="color:var(--danger);" onclick="window.uaDeleteQuestion('${q.id}')"><i class="fa-solid fa-trash"></i></button>`}
                </div>
                <div style="font-size:0.8rem; color:var(--text-muted); margin-top:4px;">
                  ${timeAgo(q.created_at)}
                </div>
              </div>
            `).join('')
          }
        </div>
      </div>

      <!-- Answers & Replies Column -->
      <div style="flex:1; min-width:300px;">
        <h4><i class="fa-solid fa-comments"></i> Answers (${answers.length})</h4>
        <div style="display:flex; flex-direction:column; gap:8px; margin-top:8px; margin-bottom: var(--space-lg);">
          ${answers.length === 0 ? '<div class="text-muted">No answers.</div>' : 
            answers.map(a => `
              <div class="card p-3 ua-anim-item" style="${a.is_deleted ? 'opacity:0.5' : ''}">
                <div style="display:flex; justify-content:space-between;">
                  <div style="font-size:0.9rem; word-break:break-word;">
                    <em>${escapeHtml(a.questions?.title || 'Unknown Q')}</em><br/>
                    ${escapeHtml(a.body)}
                  </div>
                  ${a.is_deleted ? '<span class="badge badge-danger" style="margin-left:8px;">Deleted</span>' : 
                   `<button class="btn btn-ghost btn-sm" style="color:var(--danger); margin-left:8px;" onclick="window.uaDeleteAnswer('${a.id}')"><i class="fa-solid fa-trash"></i></button>`}
                </div>
              </div>
            `).join('')
          }
        </div>

        <h4><i class="fa-solid fa-reply"></i> Replies (${replies.length})</h4>
        <div style="display:flex; flex-direction:column; gap:8px; margin-top:8px;">
          ${replies.length === 0 ? '<div class="text-muted">No replies.</div>' : 
            replies.map(r => `
              <div class="card p-3 ua-anim-item" style="${r.is_deleted ? 'opacity:0.5' : ''}">
                <div style="display:flex; justify-content:space-between;">
                  <div style="font-size:0.9rem; word-break:break-word;">${escapeHtml(r.body)}</div>
                  ${r.is_deleted ? '<span class="badge badge-danger" style="margin-left:8px;">Deleted</span>' : 
                   `<button class="btn btn-ghost btn-sm" style="color:var(--danger); margin-left:8px;" onclick="window.uaDeleteReply('${r.id}')"><i class="fa-solid fa-trash"></i></button>`}
                </div>
              </div>
            `).join('')
          }
        </div>
      </div>
    </div>
  `;

  anime({
    targets: '.ua-anim-item',
    opacity: [0, 1],
    translateY: [15, 0],
    delay: anime.stagger(50),
    easing: 'easeOutQuad',
    duration: 600
  });
}
