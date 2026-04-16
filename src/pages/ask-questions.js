import { getCurrentUser, getUserProfile } from '../utils/auth.js';
import { renderSidebar, initSidebar } from '../components/sidebar.js';
import { renderHeader, initHeader, setBreadcrumb } from '../components/header.js';
import { showToast } from '../components/toast.js';
import { supabase } from '../utils/supabase.js';
import { sanitizeText, escapeHtml, checkRateLimit } from '../utils/sanitize.js';
import { router } from '../router.js';
import { POINTS } from '../config.js';

const SUBJECT_TAGS = ['DLD', 'OOP', 'Calculus', 'DSA', 'OS', 'DBMS', 'Networks', 'Physics', 'Math', 'Linear Algebra', 'Probability', 'Other'];
const AUTO_ACCEPT_DAYS = 14; // After 14 days, highest-voted answer is auto-accepted

let _profile = null;
let _isAdmin = false;
let _activeTags = [];
let _searchQuery = '';
let _questions = [];

export async function renderAskQuestionsPage() {
  const app = document.getElementById('app');
  const user = await getCurrentUser();
  if (!user) { router.navigate('/login'); return; }
  const profile = await getUserProfile(user.id);
  if (!profile) { router.navigate('/login'); return; }

  _profile = profile;
  _isAdmin = profile.role === 'admin';
  _activeTags = [];
  _searchQuery = '';

  app.innerHTML = `
    <div class="app-layout">
      ${renderSidebar(profile)}
      <div class="main-content">
        ${renderHeader(profile)}
        <div class="page-container">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-xl);">
            <h2><i class="fa-solid fa-circle-question"></i> Ask Questions</h2>
            <button class="btn btn-primary" id="qa-ask-btn">
              <i class="fa-solid fa-plus"></i> Ask Question
            </button>
          </div>

          <!-- Search -->
          <div class="qa-search-bar">
            <div class="qa-search-input-wrap">
              <i class="fa-solid fa-magnifying-glass"></i>
              <input type="text" class="qa-search-input" id="qa-search" placeholder="Search questions...">
            </div>
          </div>

          <!-- Tag filters -->
          <div class="qa-tag-filters" id="qa-tag-filters">
            ${SUBJECT_TAGS.map(t => `<button class="tag-pill" data-tag="${t}">${t}</button>`).join('')}
          </div>

          <!-- Two-column layout -->
          <div class="qa-page-layout">
            <!-- Question list -->
            <div id="qa-question-list">
              <div class="skeleton skeleton-card" style="height:120px;"></div>
            </div>

            <!-- Leaderboard sidebar -->
            <div class="qa-leaderboard-sidebar">
              <div class="qa-leaderboard-card">
                <div class="qa-lb-header"><i class="fa-solid fa-trophy"></i> Top Contributors</div>
                <div id="qa-leaderboard-body">
                  ${[1,2,3,4,5].map(() => `<div class="lb-row"><div class="skeleton skeleton-text" style="width:100%;height:18px;"></div></div>`).join('')}
                </div>
              </div>

              <!-- Rules info card -->
              <div class="card" style="margin-top:var(--space-md);padding:var(--space-md);">
                <h4 style="font-size:0.85rem;margin-bottom:var(--space-sm);"><i class="fa-solid fa-shield-halved" style="color:var(--warning);"></i> Community Rules</h4>
                <ul style="font-size:0.8rem;color:var(--text-muted);line-height:1.8;list-style:disc;padding-left:16px;">
                  <li>Max <strong>50 questions</strong> per week</li>
                  <li>Max <strong>100 answers</strong> per week per user</li>
                  <li>After <strong>14 days</strong>, top-voted answer is auto-accepted</li>
                  <li>No anonymous spam</li>
                  <li>Be respectful</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Question Detail Panel (slide-in) -->
    <div class="qa-panel-overlay" id="qa-panel-overlay"></div>
    <div class="qa-detail-panel" id="qa-detail-panel">
      <div class="qa-panel-header">
        <h3 id="qa-panel-title" style="font-size:1rem;margin:0;flex:1;min-width:0;padding-right:8px;"></h3>
        <button class="btn btn-ghost btn-sm" id="qa-panel-close"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <!-- Scrollable content area -->
      <div class="qa-panel-scroll" id="qa-panel-body"></div>
      <!-- Sticky answer input at bottom (always visible) -->
      <div class="qa-panel-footer" id="qa-panel-footer" style="display:none;">
        <div class="qa-footer-inner">
          <div class="reply-avatar-init" style="flex-shrink:0;">${(profile.display_name || 'U').charAt(0).toUpperCase()}</div>
          <textarea id="qa-footer-answer" class="qa-footer-textarea" placeholder="Write an answer..." rows="1"></textarea>
          <button class="btn btn-primary btn-sm" id="qa-footer-submit" style="flex-shrink:0;">
            <i class="fa-solid fa-paper-plane"></i>
          </button>
        </div>
      </div>
    </div>

    <!-- Ask Question Modal -->
    <div id="qa-ask-modal" style="display:none;" class="qa-modal-overlay">
      <div class="qa-modal-box">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-xl);">
          <h3><i class="fa-solid fa-circle-question"></i> Ask a Question</h3>
          <button class="btn btn-ghost btn-sm" id="qa-ask-modal-close"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <form id="qa-ask-form">
          <div class="form-group">
            <label class="form-label">Title</label>
            <input type="text" class="form-input" id="q-title" placeholder="What's your question? Be specific." required>
          </div>
          <div class="form-group">
            <label class="form-label">Details</label>
            <textarea class="form-textarea" id="q-body" rows="5" placeholder="Provide more context, what you've tried, etc." required></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Tags <span style="color:var(--text-muted);font-size:0.8rem;">(select all that apply)</span></label>
            <div style="display:flex;flex-wrap:wrap;gap:8px;" id="q-tag-selector">
              ${SUBJECT_TAGS.map(t => `<button type="button" class="tag-pill" data-tag="${t}">${t}</button>`).join('')}
            </div>
          </div>
          <div style="display:flex;gap:var(--space-md);margin-top:var(--space-lg);">
            <button type="submit" class="btn btn-primary" id="qa-ask-submit">
              <i class="fa-solid fa-paper-plane"></i> Submit Question
            </button>
            <button type="button" class="btn btn-ghost" id="qa-ask-cancel">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  `;

  // Add sticky footer CSS dynamically
  addPanelFooterStyles();

  initSidebar();
  initHeader(profile);
  setBreadcrumb('Ask Questions');

  await Promise.all([loadQuestions(), loadLeaderboard()]);

  // Search
  document.getElementById('qa-search')?.addEventListener('input', (e) => {
    _searchQuery = e.target.value.toLowerCase().trim();
    renderQuestionList();
  });

  // Tag filter pills
  document.getElementById('qa-tag-filters')?.querySelectorAll('.tag-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const tag = pill.dataset.tag;
      if (_activeTags.includes(tag)) {
        _activeTags = _activeTags.filter(t => t !== tag);
        pill.classList.remove('active');
      } else {
        _activeTags.push(tag);
        pill.classList.add('active');
      }
      renderQuestionList();
    });
  });

  // Ask Question modal
  document.getElementById('qa-ask-btn')?.addEventListener('click', () => {
    document.getElementById('qa-ask-modal').style.display = 'flex';
  });
  document.getElementById('qa-ask-modal-close')?.addEventListener('click', () => {
    document.getElementById('qa-ask-modal').style.display = 'none';
  });
  document.getElementById('qa-ask-cancel')?.addEventListener('click', () => {
    document.getElementById('qa-ask-modal').style.display = 'none';
  });

  // Tag selector in ask modal
  document.getElementById('q-tag-selector')?.querySelectorAll('.tag-pill').forEach(pill => {
    pill.addEventListener('click', () => pill.classList.toggle('active'));
  });

  document.getElementById('qa-ask-form')?.addEventListener('submit', handleAskQuestion);

  // Panel close
  document.getElementById('qa-panel-close')?.addEventListener('click', closePanel);
  document.getElementById('qa-panel-overlay')?.addEventListener('click', closePanel);

  // Footer textarea auto-resize
  document.getElementById('qa-footer-answer')?.addEventListener('input', (e) => {
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  });
}

function addPanelFooterStyles() {
  if (document.getElementById('qa-panel-footer-style')) return;
  const style = document.createElement('style');
  style.id = 'qa-panel-footer-style';
  style.textContent = `
    .qa-detail-panel { display: flex; flex-direction: column; }
    .qa-panel-scroll { flex: 1; overflow-y: auto; padding: var(--space-xl); }
    .qa-panel-footer {
      border-top: 1px solid var(--border);
      background: var(--bg-surface);
      padding: 12px var(--space-xl);
      flex-shrink: 0;
    }
    .qa-footer-inner {
      display: flex;
      gap: 10px;
      align-items: flex-end;
    }
    .qa-footer-textarea {
      flex: 1;
      padding: 10px 14px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      color: var(--text-primary);
      font-size: 0.9rem;
      resize: none;
      overflow: hidden;
      min-height: 40px;
      max-height: 120px;
      line-height: 1.5;
      transition: border-color var(--transition-fast);
      font-family: inherit;
    }
    .qa-footer-textarea:focus {
      outline: none;
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(0,204,255,0.08);
    }
  `;
  document.head.appendChild(style);
}

// ── QUESTION LOADING ──────────────────────────────────────────

async function loadQuestions() {
  const { data, error } = await supabase
    .from('questions')
    .select(`
      *,
      profiles:user_id (id, display_name),
      question_upvotes (user_id),
      question_answers (id, is_accepted, upvotes_count, is_deleted)
    `)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false });

  if (error) { console.error('loadQuestions:', error); return; }
  _questions = data || [];

  // Run auto-accept check silently in background
  autoAcceptOldQuestions(_questions);

  renderQuestionList();
}

// Auto-award Top Answer bonus: after 14 days, answer with most upvotes gets +20 points
async function autoAcceptOldQuestions(questions) {
  const cutoff = Date.now() - AUTO_ACCEPT_DAYS * 24 * 3600000;
  for (const q of questions) {
    if (new Date(q.created_at).getTime() > cutoff) continue; // not old enough

    // Find answer with most upvotes that hasn't received the bonus yet
    const answers = (q.question_answers || []).filter(a => !a.is_deleted && !a.upvote_bonus_given);
    if (!answers.length) continue;

    const top = answers.reduce((best, a) => (a.upvotes_count || 0) > (best.upvotes_count || 0) ? a : best, answers[0]);
    if (!top || (top.upvotes_count || 0) === 0) continue;

    // Mark as having received the bonus
    await supabase.from('question_answers').update({ upvote_bonus_given: true }).eq('id', top.id);

    // Award bonus points to answer author
    const { data: ansRow } = await supabase.from('question_answers').select('user_id').eq('id', top.id).single();
    if (ansRow) {
      const { data: ap } = await supabase.from('profiles').select('points').eq('id', ansRow.user_id).single();
      if (ap) {
        await supabase.from('profiles').update({ points: (ap.points || 0) + POINTS.ANSWER_UPVOTE_BONUS }).eq('id', ansRow.user_id);
      }
    }
  }
}

function renderQuestionList() {
  const container = document.getElementById('qa-question-list');
  if (!container) return;

  let filtered = _questions;

  if (_activeTags.length > 0) {
    filtered = filtered.filter(q => q.tags && _activeTags.some(t => q.tags.includes(t)));
  }

  if (_searchQuery) {
    filtered = filtered.filter(q =>
      q.title.toLowerCase().includes(_searchQuery) ||
      (q.body || '').toLowerCase().includes(_searchQuery)
    );
  }

  // Sort by upvotes (descending), then by date (newest first)
  filtered.sort((a, b) => {
    const upvotesA = (a.question_upvotes || []).length;
    const upvotesB = (b.question_upvotes || []).length;
    if (upvotesA !== upvotesB) return upvotesB - upvotesA;
    return new Date(b.created_at) - new Date(a.created_at);
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-circle-question"></i>
        <h4>${_searchQuery || _activeTags.length ? 'No matching questions' : 'No questions yet'}</h4>
        <p>${_searchQuery || _activeTags.length ? 'Try different filters.' : 'Be the first to ask a question!'}</p>
      </div>`;
    return;
  }

  container.innerHTML = filtered.map(q => {
    const upvotes = (q.question_upvotes || []).length;
    const voted = (q.question_upvotes || []).some(u => u.user_id === _profile.id);
    const answers = (q.question_answers || []).filter(a => !a.is_deleted);
    const hasAccepted = answers.some(a => a.is_accepted);
    const tags = (q.tags || []).slice(0, 4);
    const authorName = q.profiles?.display_name || 'Unknown';
    const ageMs = Date.now() - new Date(q.created_at).getTime();
    const ageDays = Math.floor(ageMs / 86400000);

    return `
      <div class="question-card" id="qcard-${q.id}" onclick="window.openQuestion('${q.id}')">
        <div class="q-vote-col">
          <button class="upvote-btn ${voted ? 'voted' : ''}" id="qvote-${q.id}"
            onclick="event.stopPropagation(); window.toggleQuestionUpvote('${q.id}')">
            <i class="fa-solid fa-chevron-up"></i>
            <span id="qvote-count-${q.id}">${upvotes}</span>
          </button>
        </div>
        <div class="q-content">
          <div class="q-title">${escapeHtml(q.title)}</div>
          ${tags.length ? `<div class="q-tags">${tags.map(t => `<span class="q-tag-badge">${t}</span>`).join('')}</div>` : ''}
          <div class="q-meta">
            <span class="q-meta-item"><i class="fa-solid fa-comment"></i> ${answers.length} answer${answers.length !== 1 ? 's' : ''}</span>
            ${hasAccepted ? `<span class="accepted-badge"><i class="fa-solid fa-check"></i> Solved</span>` : ''}
            ${!hasAccepted && ageDays >= AUTO_ACCEPT_DAYS && answers.length > 0 ? `<span class="tag-needed" style="font-size:0.72rem;"><i class="fa-solid fa-clock"></i> Auto-accepting soon</span>` : ''}
            <span class="q-meta-item"><i class="fa-solid fa-user"></i> ${escapeHtml(authorName)}</span>
            <span class="q-meta-item"><i class="fa-regular fa-clock"></i> ${timeAgo(q.created_at)}</span>
            ${_isAdmin ? `
              <span onclick="event.stopPropagation();">
                <button class="btn btn-ghost btn-sm" style="color:var(--danger);padding:2px 8px;"
                  onclick="window.adminDeleteQuestion('${q.id}')">
                  <i class="fa-solid fa-trash"></i>
                </button>
              </span>` : ''}
          </div>
        </div>
      </div>`;
  }).join('');

  window.openQuestion = openQuestion;
  window.toggleQuestionUpvote = toggleQuestionUpvote;
  window.adminDeleteQuestion = adminDeleteQuestion;
}

// ── LEADERBOARD ───────────────────────────────────────────────

async function loadLeaderboard() {
  const { data } = await supabase
    .from('question_answers')
    .select('user_id, upvotes_count, profiles:user_id (display_name)')
    .eq('is_deleted', false);

  const body = document.getElementById('qa-leaderboard-body');
  if (!body) return;

  if (!data || data.length === 0) {
    body.innerHTML = `<div class="lb-row" style="color:var(--text-muted);font-size:0.8rem;padding:var(--space-md);">No contributors yet</div>`;
    return;
  }

  const userMap = {};
  data.forEach(a => {
    if (!a.user_id) return;
    const name = a.profiles?.display_name || 'Unknown';
    if (!userMap[a.user_id]) userMap[a.user_id] = { name, pts: 0 };
    userMap[a.user_id].pts += (a.upvotes_count || 0);
  });

  const top = Object.entries(userMap).sort((a, b) => b[1].pts - a[1].pts).slice(0, 7);
  const rankClasses = ['gold', 'silver', 'bronze', '', '', '', ''];
  const rankIcons = ['🥇', '🥈', '🥉', '4', '5', '6', '7'];

  body.innerHTML = top.map(([uid, info], i) => `
    <div class="lb-row">
      <div class="lb-rank ${rankClasses[i]}">${rankIcons[i]}</div>
      <div class="lb-avatar">${info.name.charAt(0).toUpperCase()}</div>
      <div class="lb-info">
        <div class="lb-name">${escapeHtml(info.name)}</div>
        <div class="lb-pts">${info.pts} upvote pts</div>
      </div>
    </div>
  `).join('');
}

// ── QUESTION DETAIL PANEL ─────────────────────────────────────

let _currentQuestionId = null;

async function openQuestion(questionId) {
  _currentQuestionId = questionId;
  const q = _questions.find(x => x.id === questionId);
  if (!q) return;

  document.getElementById('qa-panel-title').textContent = q.title;
  document.getElementById('qa-panel-body').innerHTML = `<div class="skeleton skeleton-card" style="height:200px;"></div>`;
  document.getElementById('qa-detail-panel').classList.add('open');
  document.getElementById('qa-panel-overlay').classList.add('open');

  // Show footer only for non-admins
  const footer = document.getElementById('qa-panel-footer');
  if (!_isAdmin && footer) {
    footer.style.display = 'block';
    // Wire up submit
    document.getElementById('qa-footer-submit').onclick = () => handlePostAnswer(questionId);
    document.getElementById('qa-footer-answer').onkeydown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handlePostAnswer(questionId);
      }
    };
  }

  const { data: answers } = await supabase
    .from('question_answers')
    .select(`
      *,
      profiles:user_id (id, display_name),
      answer_upvotes (user_id),
      answer_replies (*, profiles:user_id (display_name))
    `)
    .eq('question_id', questionId)
    .eq('is_deleted', false)
    .order('is_accepted', { ascending: false })
    .order('created_at', { ascending: true });

  if (answers) {
    answers.sort((a, b) => {
      if (a.is_accepted !== b.is_accepted) return a.is_accepted ? -1 : 1;
      const votesA = (a.answer_upvotes || []).length;
      const votesB = (b.answer_upvotes || []).length;
      if (votesA !== votesB) return votesB - votesA;
      return new Date(a.created_at) - new Date(b.created_at);
    });
  }

  const myUpvotes = (q.question_upvotes || []);
  const iQVoted = myUpvotes.some(u => u.user_id === _profile.id);
  const qUpvotes = myUpvotes.length;

  const panel = document.getElementById('qa-panel-body');
  panel.innerHTML = `
    <!-- Question header -->
    <div style="margin-bottom:var(--space-xl);">
      <div style="display:flex;gap:var(--space-md);align-items:flex-start;margin-bottom:var(--space-md);">
        <button class="upvote-btn ${iQVoted ? 'voted' : ''}" id="q-upvote-btn-${questionId}"
          onclick="window.toggleQuestionUpvote('${questionId}')">
          <i class="fa-solid fa-chevron-up"></i>
          <span id="q-upvote-count-${questionId}">${qUpvotes}</span>
        </button>
        <div>
          <h3 style="font-size:1.05rem;margin-bottom:8px;">${escapeHtml(q.title)}</h3>
          ${(q.tags||[]).length ? `<div class="q-tags">${q.tags.map(t=>`<span class="q-tag-badge">${t}</span>`).join('')}</div>` : ''}
          <div class="q-meta" style="margin-top:8px;">
            <span class="q-meta-item"><i class="fa-solid fa-user"></i> ${escapeHtml(q.profiles?.display_name || 'Unknown')} ${_isAdmin ? `<span style="font-size:0.75rem;opacity:0.8;">(ID: ${q.user_id})</span>` : ''}</span>
            <span class="q-meta-item"><i class="fa-regular fa-clock"></i> ${timeAgo(q.created_at)}</span>
          </div>
        </div>
      </div>
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-md);padding:var(--space-lg);line-height:1.7;color:var(--text-secondary);white-space:pre-wrap;word-break:break-word;">
        ${escapeHtml(q.body || '')}
      </div>
      ${_isAdmin ? `
        <button class="btn btn-ghost btn-sm" style="color:var(--danger);margin-top:8px;" onclick="window.adminDeleteQuestion('${q.id}')">
          <i class="fa-solid fa-trash"></i> Delete Question
        </button>` : ''}
    </div>

    <!-- Answers header -->
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:var(--space-lg);">
      <h4 style="font-size:0.95rem;color:var(--text-muted);margin:0;">
        <i class="fa-solid fa-comments"></i> ${(answers||[]).length} Answer${(answers||[]).length !== 1 ? 's' : ''}
      </h4>
      <span style="font-size:0.78rem;color:var(--text-muted);">
        <i class="fa-solid fa-info-circle"></i> Top voted answer is auto-accepted after ${AUTO_ACCEPT_DAYS} days
      </span>
    </div>

    <!-- Answers list -->
    <div id="qa-answers-list">
      ${(answers || []).map(a => renderAnswerBlock(a, q)).join('')}
    </div>

    <!-- Spacer so last answer isn't hidden by footer -->
    <div style="height:16px;"></div>
  `;

  // Attach global handlers
  window.toggleAnswerUpvote = (answerId) => handleAnswerUpvote(answerId, questionId);
  window.acceptAnswer = (answerId) => handleAcceptAnswer(answerId, questionId);
  window.toggleReplies = toggleReplies;
  window.submitReply = (answerId) => handleSubmitReply(answerId);
  window.adminDeleteAnswer = (answerId) => handleAdminDeleteAnswer(answerId);
  window.adminDeleteReply = (replyId) => handleAdminDeleteReply(replyId);
}

function renderAnswerBlock(a, q) {
  const votes = (a.answer_upvotes || []).length;
  const iVoted = (a.answer_upvotes || []).some(u => u.user_id === _profile.id);
  const replies = (a.answer_replies || []).filter(r => !r.is_deleted);
  const isAccepted = a.is_accepted;
  const isTopAnswer = a.upvote_bonus_given;
  const isQuestionOwner = q.user_id === _profile.id;
  const questionHasAccepted = q.accepted_answer_id != null;

  return `
    <div class="answer-block ${isAccepted ? 'accepted-answer' : ''}" id="ans-${a.id}">
      <div style="display:flex;gap:var(--space-md);align-items:flex-start;margin-bottom:var(--space-sm);">
        <button class="upvote-btn ${iVoted ? 'voted' : ''}" id="avote-${a.id}"
          onclick="window.toggleAnswerUpvote('${a.id}')">
          <i class="fa-solid fa-chevron-up"></i>
          <span id="avote-count-${a.id}">${votes}</span>
        </button>
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px;">
            <strong style="font-size:0.875rem;">${escapeHtml(a.profiles?.display_name || 'Unknown')}</strong>
            ${_isAdmin ? `<span style="font-size:0.75rem;color:var(--text-muted);">(ID: ${a.user_id})</span>` : ''}
            <span style="color:var(--text-muted);font-size:0.8rem;">${timeAgo(a.created_at)}</span>
            ${isAccepted ? `<span class="accepted-badge"><i class="fa-solid fa-check"></i> Accepted</span>` : ''}
            ${isTopAnswer ? `<span class="top-answer-badge"><i class="fa-solid fa-star"></i> Top Answer • +20pts</span>` : ''}
          </div>
          <div class="answer-body">${escapeHtml(a.body)}</div>
        </div>
      </div>
      <div class="answer-actions">
        <button class="btn btn-ghost btn-sm" onclick="window.toggleReplies('${a.id}')">
          <i class="fa-solid fa-reply"></i> Reply (${replies.length})
        </button>
        ${!questionHasAccepted && isQuestionOwner && a.user_id !== _profile.id ? `
          <button class="btn btn-ghost btn-sm" style="color:var(--success);" onclick="window.acceptAnswer('${a.id}')">
            <i class="fa-solid fa-check"></i> Accept Answer (+10pts)
          </button>` : ''}
        ${_isAdmin ? `
          <button class="btn btn-ghost btn-sm" style="color:var(--danger);" onclick="window.adminDeleteAnswer('${a.id}')">
            <i class="fa-solid fa-trash"></i> Delete
          </button>` : ''}
      </div>

      <!-- Replies thread -->
      <div class="reply-thread" id="replies-${a.id}" style="display:none;">
        <div id="replies-list-${a.id}">
          ${replies.map(r => renderReplyItem(r, a.id)).join('')}
        </div>
        <div class="reply-input-row" style="margin-top:var(--space-sm);">
          <div class="reply-avatar-init">${_profile.display_name.charAt(0).toUpperCase()}</div>
          <input type="text" id="reply-input-${a.id}" placeholder="Write a reply...">
          <button class="btn btn-primary btn-sm" onclick="window.submitReply('${a.id}')">
            <i class="fa-solid fa-paper-plane"></i>
          </button>
        </div>
      </div>
    </div>`;
}

function renderReplyItem(r, answerId) {
  const name = r.profiles?.display_name || 'Unknown';
  return `
    <div class="reply-item" id="reply-${r.id}">
      <div class="reply-avatar-init">${name.charAt(0).toUpperCase()}</div>
      <div class="reply-content">
        <div class="reply-author">${escapeHtml(name)}</div>
        <div class="reply-body">${escapeHtml(r.body)}</div>
        <div class="reply-meta">${timeAgo(r.created_at)}
          ${_isAdmin ? `
            <button class="btn btn-ghost btn-sm" style="color:var(--danger);padding:0 6px;font-size:0.75rem;"
              onclick="window.adminDeleteReply('${r.id}')">
              <i class="fa-solid fa-trash"></i>
            </button>` : ''}
        </div>
      </div>
    </div>`;
}

function toggleReplies(answerId) {
  const thread = document.getElementById(`replies-${answerId}`);
  if (!thread) return;
  const isHidden = thread.style.display === 'none';
  thread.style.display = isHidden ? 'block' : 'none';
  if (isHidden) {
    document.getElementById(`reply-input-${answerId}`)?.focus();
  }
}

function closePanel() {
  document.getElementById('qa-detail-panel')?.classList.remove('open');
  document.getElementById('qa-panel-overlay')?.classList.remove('open');
  const footer = document.getElementById('qa-panel-footer');
  if (footer) footer.style.display = 'none';
  _currentQuestionId = null;
}

// ── ACTIONS ───────────────────────────────────────────────────

async function handleAskQuestion(e) {
  e.preventDefault();

  // Per-user DB rate limit: count questions in last 7 days
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600000).toISOString();
  const { count } = await supabase.from('questions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', _profile.id)
    .eq('is_deleted', false)
    .gte('created_at', weekAgo);

  if ((count || 0) >= 50) {
    showToast('Weekly limit reached: max 50 questions per week.', 'error');
    return;
  }

  const rawTitle = document.getElementById('q-title').value;
  const rawBody = document.getElementById('q-body').value;
  const selectedTags = [...document.querySelectorAll('#q-tag-selector .tag-pill.active')].map(p => p.dataset.tag);

  const title = sanitizeText(rawTitle, 10000000);
  const body = sanitizeText(rawBody, 10000000);

  const btn = document.getElementById('qa-ask-submit');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Posting...';

  const { error } = await supabase.from('questions').insert({
    user_id: _profile.id,
    title,
    body,
    tags: selectedTags,
  });

  btn.disabled = false;
  btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit Question';

  if (error) { showToast('Error posting question: ' + error.message, 'error'); return; }

  showToast('Question posted!', 'success');
  document.getElementById('qa-ask-modal').style.display = 'none';
  document.getElementById('qa-ask-form').reset();
  document.querySelectorAll('#q-tag-selector .tag-pill').forEach(p => p.classList.remove('active'));
  await loadQuestions();
}

async function handlePostAnswer(questionId) {
  const textarea = document.getElementById('qa-footer-answer');
  if (!textarea) return;

  // Per-user DB rate limit: count answers in last 7 days
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600000).toISOString();
  const { count } = await supabase.from('question_answers')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', _profile.id)
    .eq('is_deleted', false)
    .gte('created_at', weekAgo);

  if ((count || 0) >= 100) {
    showToast('Weekly limit reached: max 100 answers per week per user.', 'error');
    return;
  }

  const body = sanitizeText(textarea.value, 10000000);

  const btn = document.getElementById('qa-footer-submit');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>';

  const { error } = await supabase.from('question_answers').insert({
    question_id: questionId,
    user_id: _profile.id,
    body,
  });

  btn.disabled = false;
  btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i>';

  if (error) { showToast('Error posting answer: ' + error.message, 'error'); return; }

  showToast('Answer posted!', 'success');
  textarea.value = '';
  textarea.style.height = 'auto';
  await loadQuestions();
  await openQuestion(questionId);
  // Scroll to bottom of answers
  setTimeout(() => {
    const panel = document.getElementById('qa-panel-body');
    if (panel) panel.scrollTop = panel.scrollHeight;
  }, 300);
}

async function handleAcceptAnswer(answerId, questionId) {
  if (!confirm('Accept this answer? You can only accept one answer per question. They will receive 10 points.')) return;
  
  // Mark answer as accepted
  const { error } = await supabase.from('question_answers').update({ is_accepted: true }).eq('id', answerId);
  if (error) { showToast('Error accepting answer.', 'error'); return; }

  // Update question
  await supabase.from('questions').update({ accepted_answer_id: answerId }).eq('id', questionId);

  // Award 10 points
  const { data: ansRow } = await supabase.from('question_answers').select('user_id').eq('id', answerId).single();
  if (ansRow) {
    const { data: ap } = await supabase.from('profiles').select('points').eq('id', ansRow.user_id).single();
    if (ap) {
      await supabase.from('profiles').update({ points: (ap.points || 0) + POINTS.ANSWER_ACCEPTED }).eq('id', ansRow.user_id);
    }
  }

  showToast('Answer logic accepted and points awarded!', 'success');
  await loadQuestions();
  await openQuestion(questionId);
}

async function toggleQuestionUpvote(questionId) {
  const q = _questions.find(x => x.id === questionId);
  if (!q) return;

  const alreadyVoted = (q.question_upvotes || []).some(u => u.user_id === _profile.id);

  if (alreadyVoted) {
    await supabase.from('question_upvotes').delete()
      .eq('question_id', questionId).eq('user_id', _profile.id);
    q.question_upvotes = q.question_upvotes.filter(u => u.user_id !== _profile.id);
  } else {
    const { error } = await supabase.from('question_upvotes').insert({
      question_id: questionId,
      user_id: _profile.id,
    });
    if (error) { showToast('Could not upvote.', 'error'); return; }
    q.question_upvotes = [...(q.question_upvotes || []), { user_id: _profile.id }];
  }

  const newCount = q.question_upvotes.length;
  const voted = !alreadyVoted;
  [`qvote-${questionId}`, `q-upvote-btn-${questionId}`].forEach(id => {
    document.getElementById(id)?.classList.toggle('voted', voted);
  });
  [`qvote-count-${questionId}`, `q-upvote-count-${questionId}`].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = newCount;
  });

  // Re-render to apply sorting
  renderQuestionList();
}

async function handleAnswerUpvote(answerId, questionId) {
  const btn = document.getElementById(`avote-${answerId}`);
  const countEl = document.getElementById(`avote-count-${answerId}`);
  if (!btn) return;

  const alreadyVoted = btn.classList.contains('voted');

  if (alreadyVoted) {
    const { error } = await supabase.from('answer_upvotes').delete()
      .eq('answer_id', answerId).eq('user_id', _profile.id);
    if (error) { showToast('Error removing upvote.', 'error'); return; }
    btn.classList.remove('voted');
    const newCount = Math.max(0, parseInt(countEl?.textContent || '0') - 1);
    if (countEl) countEl.textContent = newCount;
    await supabase.from('question_answers').update({ upvotes_count: newCount }).eq('id', answerId);
  } else {
    const { error } = await supabase.from('answer_upvotes').insert({
      answer_id: answerId,
      user_id: _profile.id,
    });
    if (error) { showToast('Already upvoted.', 'warning'); return; }
    btn.classList.add('voted');
    const newCount = parseInt(countEl?.textContent || '0') + 1;
    if (countEl) countEl.textContent = newCount;

    const { data: ansRow } = await supabase.from('question_answers')
      .select('upvotes_count, user_id')
      .eq('id', answerId).single();

    if (ansRow) {
      const updatedCount = (ansRow.upvotes_count || 0) + 1;
      await supabase.from('question_answers').update({ upvotes_count: updatedCount }).eq('id', answerId);
    }
  }
}

async function handleSubmitReply(answerId) {
  const input = document.getElementById(`reply-input-${answerId}`);
  if (!input) return;
  const body = sanitizeText(input.value, 10000000);
  if (body.length < 1) return;

  const { error } = await supabase.from('answer_replies').insert({
    answer_id: answerId,
    user_id: _profile.id,
    body,
  });

  if (error) { showToast('Error posting reply.', 'error'); return; }

  input.value = '';
  const { data: newReply } = await supabase.from('answer_replies')
    .select('*, profiles:user_id (display_name)')
    .eq('answer_id', answerId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const list = document.getElementById(`replies-list-${answerId}`);
  if (list && newReply) {
    list.insertAdjacentHTML('beforeend', renderReplyItem(newReply, answerId));
  }
}

// ── ADMIN DELETIONS ───────────────────────────────────────────

async function adminDeleteQuestion(questionId) {
  if (!_isAdmin) return;
  if (!confirm('Delete this question and all its answers?')) return;
  const { error } = await supabase.from('questions').update({ is_deleted: true }).eq('id', questionId);
  if (error) { showToast('Error deleting question.', 'error'); return; }
  showToast('Question deleted.', 'success');
  closePanel();
  await loadQuestions();
}

async function handleAdminDeleteAnswer(answerId) {
  if (!_isAdmin) return;
  if (!confirm('Delete this answer?')) return;
  const { error } = await supabase.from('question_answers').update({ is_deleted: true }).eq('id', answerId);
  if (error) { showToast('Error deleting answer.', 'error'); return; }
  showToast('Answer deleted.', 'success');
  document.getElementById(`ans-${answerId}`)?.remove();
}

async function handleAdminDeleteReply(replyId) {
  if (!_isAdmin) return;
  if (!confirm('Delete this reply?')) return;
  const { error } = await supabase.from('answer_replies').update({ is_deleted: true }).eq('id', replyId);
  if (error) { showToast('Error deleting reply.', 'error'); return; }
  showToast('Reply deleted.', 'success');
  document.getElementById(`reply-${replyId}`)?.remove();
}

// ── UTIL ───────────────────────────────────────────────────────
function timeAgo(dateStr) {
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
