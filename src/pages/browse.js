import { getCurrentUser, getUserProfile } from '../utils/auth.js';
import { calculateSemester, getSemesterLabel, getAccessibleSemesters } from '../utils/semester.js';
import { renderSidebar, initSidebar } from '../components/sidebar.js';
import { renderHeader, initHeader, setBreadcrumb } from '../components/header.js';
import { showToast } from '../components/toast.js';
import { supabase } from '../utils/supabase.js';
import { router } from '../router.js';
import { UPLOAD_TYPES } from '../config.js';
import { escapeHtml, sanitizeText, checkRateLimit } from '../utils/sanitize.js';
import { subscribeToTable } from '../utils/realtime.js';
import gsap from 'gsap';

let _browseProfile = null;

export async function renderBrowsePage() {
  const app = document.getElementById('app');
  const user = await getCurrentUser();
  if (!user) { router.navigate('/login'); return; }
  const profile = await getUserProfile(user.id);
  if (!profile) { router.navigate('/login'); return; }
  _browseProfile = profile;

  const adminUser = profile.role === 'admin';
  const semester = calculateSemester(profile.admission_year);
  const accessibleSemesters = adminUser ? [1,2,3,4,5,6,7,8] : getAccessibleSemesters(semester);

  app.innerHTML = `
    <div class="app-layout">
      ${renderSidebar(profile)}
      <div class="main-content">
        ${renderHeader(profile)}
        <div class="page-container">
          <h2 style="margin-bottom:var(--space-xl);"><i class="fa-solid fa-compass"></i> Browse Resources</h2>
          
          <!-- Filters -->
          <div class="card" style="margin-bottom:var(--space-xl);">
            <div style="display:flex;gap:var(--space-md);flex-wrap:wrap;align-items:flex-end;">
              <div class="form-group" style="margin-bottom:0;flex:1;min-width:150px;">
                <label class="form-label">Semester</label>
                <select class="form-select" id="filter-semester">
                  <option value="">All Accessible</option>
                  ${accessibleSemesters.map(s => `<option value="${s}">${getSemesterLabel(s)} Semester</option>`).join('')}
                </select>
              </div>
              <div class="form-group" style="margin-bottom:0;flex:1;min-width:150px;">
                <label class="form-label">Type</label>
                <select class="form-select" id="filter-type">
                  <option value="">All Types</option>
                  ${UPLOAD_TYPES.map((t) => `<option value="${t.value}">${t.label}</option>`).join('')}
                </select>
              </div>
              <div class="form-group" style="margin-bottom:0;flex:2;min-width:200px;">
                <label class="form-label">Search</label>
                <input type="text" class="form-input" id="filter-search" placeholder="Search by title or course..." />
              </div>
              <button class="btn btn-primary" id="filter-btn" style="height:48px;">
                <i class="fa-solid fa-search"></i> Filter
              </button>
            </div>
          </div>

          <div id="resources-container">
            <div class="skeleton skeleton-card" style="height:300px;"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  initSidebar(); initHeader(profile); setBreadcrumb('Browse Resources');

  document.getElementById('filter-btn')?.addEventListener('click', () => loadResources(profile, accessibleSemesters));
  
  // Debounced search
  let searchTimer;
  document.getElementById('filter-search')?.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => loadResources(profile, accessibleSemesters), 400);
  });

  loadResources(profile, accessibleSemesters);

  // Entrance animations
  gsap.fromTo('.filter-section', { y: -15, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out' });
  gsap.fromTo('#resources-container', { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, delay: 0.2, ease: 'power3.out' });

  // Real-time: auto-refresh when uploads change
  subscribeToTable('browse-uploads', 'uploads', 'status=eq.approved', () => {
    loadResources(profile, accessibleSemesters);
  });
}

async function loadResources(profile, accessibleSemesters) {
  const container = document.getElementById('resources-container');
  const semesterFilter = document.getElementById('filter-semester').value;
  const typeFilter = document.getElementById('filter-type').value;
  const searchFilter = sanitizeText(document.getElementById('filter-search').value, 200);
  const adminUser = profile.role === 'admin';

  container.innerHTML = '<div class="skeleton skeleton-card" style="height:300px;"></div>';

  // Fetch resources, ratings, and votes in parallel
  const [resourcesResult, ratingsResult, votesResult] = await Promise.all([
    (async () => {
      let query = supabase.from('uploads')
        .select('*, profiles(display_name), courses(name, code, semester)')
        .eq('status', 'approved')
        .order('created_at', { ascending: false });

      if (semesterFilter) {
        query = query.eq('semester', parseInt(semesterFilter));
      } else if (!adminUser) {
        query = query.in('semester', accessibleSemesters);
      }
      if (typeFilter) query = query.eq('type', typeFilter);
      if (searchFilter) query = query.ilike('title', `%${searchFilter}%`);
      return query;
    })(),
    supabase.from('upload_ratings').select('upload_id, stars, user_id'),
    supabase.from('upload_upvotes').select('upload_id, user_id, vote_type')
  ]);

  const { data, error } = resourcesResult;
  const allRatings = ratingsResult.data || [];
  const allVotes = votesResult.data || [];

  // Build ratings lookup
  const ratingsMap = {};
  allRatings.forEach(r => {
    if (!ratingsMap[r.upload_id]) ratingsMap[r.upload_id] = { sum: 0, count: 0, myRating: 0 };
    ratingsMap[r.upload_id].sum += r.stars;
    ratingsMap[r.upload_id].count++;
    if (r.user_id === profile.id) ratingsMap[r.upload_id].myRating = r.stars;
  });

  // Build votes lookup
  const votesMap = {};
  allVotes.forEach(v => {
    if (!votesMap[v.upload_id]) votesMap[v.upload_id] = { up: 0, down: 0, myVote: null };
    votesMap[v.upload_id][v.vote_type]++;
    if (v.user_id === profile.id) votesMap[v.upload_id].myVote = v.vote_type;
  });

  if (error) {
    container.innerHTML = `<div class="empty-state"><p>Error loading resources: ${error.message}</p></div>`;
    return;
  }

  if (!data || data.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-folder-open"></i>
        <h4>No resources found</h4>
        <p>Try adjusting your filters or check back later.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <p style="color:var(--text-secondary);margin-bottom:var(--space-lg);">${data.length} resources found</p>
    <div class="resource-grid">
      ${data.map((r) => {
        const meta = UPLOAD_TYPES.find((t) => t.value === r.type);
        const iconClass = meta?.icon || 'fa-file';
        const typeLabel = meta?.label || r.type;
        const vm = votesMap[r.id] || { up: 0, down: 0, myVote: null };
        return `
          <div class="resource-card card" id="resource-${r.id}">
            <div class="resource-header">
              <div class="resource-type-icon">
                <i class="fa-solid ${iconClass}"></i>
              </div>
              <div style="flex:1;">
                <h4 style="font-size:1rem;margin-bottom:4px;">${escapeHtml(r.title)}</h4>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                  <span class="badge badge-primary">${escapeHtml(typeLabel)}</span>
                  <span class="badge badge-success">Sem ${r.semester}</span>
                  ${r.courses ? `<span class="badge badge-warning">${r.courses.code}</span>` : ''}
                </div>
              </div>
            </div>
            ${r.description ? `<p style="color:var(--text-secondary);font-size:0.8125rem;margin:var(--space-md) 0;">${escapeHtml(String(r.description)).substring(0, 120)}${String(r.description).length > 120 ? '...' : ''}</p>` : ''}
            <!-- Star Rating -->
            ${(() => {
              const rm = ratingsMap[r.id] || { sum: 0, count: 0, myRating: 0 };
              const avg = rm.count > 0 ? (rm.sum / rm.count).toFixed(1) : '0.0';
              const alreadyRated = rm.myRating > 0;
              return `
              <div style="display:flex;align-items:center;gap:8px;margin-top:var(--space-sm);" class="star-rating-row" data-upload-id="${r.id}">
                <div class="star-interactive" style="display:flex;gap:2px;${alreadyRated ? '' : 'cursor:pointer;'}">
                  ${[1,2,3,4,5].map(s => `
                    <i class="fa-${s <= rm.myRating ? 'solid' : 'regular'} fa-star ${alreadyRated ? '' : 'star-icon'}" 
                       ${alreadyRated ? '' : `data-star="${s}" data-upload="${r.id}"`}
                       style="font-size:0.85rem;color:${s <= rm.myRating ? '#ffcc00' : 'var(--text-muted)'};${alreadyRated ? 'opacity:0.85;' : 'cursor:pointer;transition:color 0.15s,transform 0.15s;'}"
                       ${alreadyRated ? '' : 'onmouseenter="this.style.transform=\'scale(1.25)\'" onmouseleave="this.style.transform=\'scale(1)\'"'}></i>
                  `).join('')}
                </div>
                <span style="font-size:0.78rem;color:var(--text-muted);">${avg} <span style="opacity:0.6;">(${rm.count})</span>${alreadyRated ? ' <i class="fa-solid fa-lock" style="font-size:0.6rem;opacity:0.4;"></i>' : ''}</span>
              </div>`;
            })()}
            <!-- Upvote / Downvote Bar -->
            <div class="vote-bar" style="display:flex;align-items:center;gap:var(--space-md);margin-top:var(--space-md);padding:8px 0;">
              <button class="btn btn-ghost btn-sm vote-btn" data-upload="${r.id}" data-type="up"
                style="color:${vm.myVote === 'up' ? 'var(--success)' : 'var(--text-muted)'};font-weight:600;display:flex;align-items:center;gap:4px;">
                <i class="fa-solid fa-thumbs-up"></i> <span class="vote-count-up">${vm.up}</span>
              </button>
              <button class="btn btn-ghost btn-sm vote-btn" data-upload="${r.id}" data-type="down"
                style="color:${vm.myVote === 'down' ? 'var(--danger)' : 'var(--text-muted)'};font-weight:600;display:flex;align-items:center;gap:4px;">
                <i class="fa-solid fa-thumbs-down"></i> <span class="vote-count-down">${vm.down}</span>
              </button>
              <button class="btn btn-ghost btn-sm toggle-comments-btn" data-upload="${r.id}" style="margin-left:auto;color:var(--text-muted);display:flex;align-items:center;gap:4px;">
                <i class="fa-solid fa-comment"></i> Comments
              </button>
            </div>
            <!-- Comments Section (collapsed) -->
            <div class="comments-section" id="comments-${r.id}" style="display:none;border-top:1px solid var(--border);padding-top:var(--space-md);margin-top:var(--space-sm);">
              <div class="comments-list" id="comments-list-${r.id}">
                <div style="text-align:center;padding:12px;color:var(--text-muted);font-size:0.8rem;">Loading comments...</div>
              </div>
              <div style="display:flex;gap:8px;margin-top:var(--space-md);">
                <input type="text" class="form-input" id="comment-input-${r.id}" placeholder="Add a comment..." style="flex:1;font-size:0.85rem;" maxlength="1000" />
                <button class="btn btn-primary btn-sm post-comment-btn" data-upload="${r.id}">
                  <i class="fa-solid fa-paper-plane"></i>
                </button>
              </div>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:var(--space-md);padding-top:var(--space-md);border-top:1px solid var(--border);">
              <span style="color:var(--text-muted);font-size:0.75rem;">
                <i class="fa-solid fa-user"></i> ${r.profiles?.display_name || 'Unknown'} •
                ${new Date(r.created_at).toLocaleDateString()}
              </span>
              <div style="display:flex;gap:8px;">
                ${adminUser ? `
                  <button class="btn btn-ghost btn-sm" style="color:var(--danger);" onclick="window.deleteUpload('${r.id}', '${r.file_url}')" title="Delete Resource">
                    <i class="fa-solid fa-trash"></i>
                  </button>
                ` : `
                  <button class="btn btn-ghost btn-sm report-btn" data-id="${r.id}" data-title="${escapeHtml(r.title)}" title="Report this resource" style="color:var(--warning);">
                    <i class="fa-solid fa-flag"></i>
                  </button>
                `}
                <button class="btn btn-primary btn-sm download-btn" data-id="${r.id}" data-url="${r.file_url}" data-title="${escapeHtml(r.title)}" data-type="${r.type}">
                  <i class="fa-solid fa-download"></i> Download
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  gsap.fromTo('.resource-card', { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, stagger: 0.05, ease: 'power3.out' });

  // ── Star rating click handlers ──
  container.querySelectorAll('.star-icon').forEach(star => {
    star.addEventListener('click', async (e) => {
      e.stopPropagation();
      const uploadId = star.dataset.upload;
      const stars = parseInt(star.dataset.star);
      const rl = checkRateLimit('rate', 20, 3600000);
      if (!rl.allowed) { showToast('Too many ratings. Please slow down.', 'warning'); return; }

      const { error: rateErr } = await supabase
        .from('upload_ratings')
        .insert({ upload_id: uploadId, user_id: profile.id, stars });

      if (rateErr) { showToast('Failed to rate: ' + rateErr.message, 'error'); return; }

      const row = container.querySelector(`.star-rating-row[data-upload-id="${uploadId}"]`);
      if (row) {
        row.querySelectorAll('.star-icon, .fa-star').forEach(s => {
          const v = parseInt(s.dataset.star || '0');
          s.className = `fa-${v <= stars ? 'solid' : 'regular'} fa-star`;
          s.style.color = v <= stars ? '#ffcc00' : 'var(--text-muted)';
          s.style.opacity = '0.85';
          s.style.cursor = 'default';
          s.replaceWith(s.cloneNode(true));
        });
      }
      showToast(`Rated ${stars} star${stars !== 1 ? 's' : ''}!`, 'success');
    });
  });

  // ── Vote (upvote / downvote) handlers ──
  container.querySelectorAll('.vote-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const uploadId = btn.dataset.upload;
      const voteType = btn.dataset.type;
      const rl = checkRateLimit('vote', 30, 3600000);
      if (!rl.allowed) { showToast('Too many votes. Please slow down.', 'warning'); return; }

      // Check if already voted
      const { data: existing } = await supabase.from('upload_upvotes')
        .select('id, vote_type')
        .eq('upload_id', uploadId)
        .eq('user_id', profile.id)
        .maybeSingle();

      if (existing) {
        if (existing.vote_type === voteType) {
          // Toggle off: remove vote
          await supabase.from('upload_upvotes').delete().eq('id', existing.id);
        } else {
          // Switch vote
          await supabase.from('upload_upvotes').update({ vote_type: voteType }).eq('id', existing.id);
        }
      } else {
        // New vote
        await supabase.from('upload_upvotes').insert({ upload_id: uploadId, user_id: profile.id, vote_type: voteType });
      }

      // Refresh vote counts for this card
      const { data: freshVotes } = await supabase.from('upload_upvotes')
        .select('vote_type, user_id')
        .eq('upload_id', uploadId);

      let up = 0, down = 0, myVote = null;
      (freshVotes || []).forEach(v => {
        if (v.vote_type === 'up') up++;
        else down++;
        if (v.user_id === profile.id) myVote = v.vote_type;
      });

      // Update UI
      const card = document.getElementById(`resource-${uploadId}`);
      if (card) {
        card.querySelector('.vote-count-up').textContent = up;
        card.querySelector('.vote-count-down').textContent = down;
        const upBtn = card.querySelector('.vote-btn[data-type="up"]');
        const downBtn = card.querySelector('.vote-btn[data-type="down"]');
        upBtn.style.color = myVote === 'up' ? 'var(--success)' : 'var(--text-muted)';
        downBtn.style.color = myVote === 'down' ? 'var(--danger)' : 'var(--text-muted)';
      }

      // Auto-moderation check
      const { data: removed } = await supabase.rpc('check_upload_automod', { p_upload_id: uploadId });
      if (removed) {
        showToast('This resource has been auto-removed due to community downvotes.', 'info');
        const cardEl = document.getElementById(`resource-${uploadId}`);
        if (cardEl) gsap.to(cardEl, { height: 0, opacity: 0, marginBottom: 0, padding: 0, overflow: 'hidden', duration: 0.5, ease: 'power2.in', onComplete: () => cardEl.remove() });
      }
    });
  });

  // ── Toggle comments section ──
  container.querySelectorAll('.toggle-comments-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const uploadId = btn.dataset.upload;
      const section = document.getElementById(`comments-${uploadId}`);
      if (!section) return;
      const isHidden = section.style.display === 'none';
      section.style.display = isHidden ? 'block' : 'none';
      if (isHidden) loadComments(uploadId);
    });
  });

  // ── Post comment ──
  container.querySelectorAll('.post-comment-btn').forEach(btn => {
    btn.addEventListener('click', () => postComment(btn.dataset.upload, profile));
  });

  // Enter key to post comment
  container.querySelectorAll('[id^="comment-input-"]').forEach(input => {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const uploadId = input.id.replace('comment-input-', '');
        postComment(uploadId, profile);
      }
    });
  });

  // ── Download handlers ──
  container.querySelectorAll('.download-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const uploadId = btn.dataset.id;
      const fileUrl = btn.dataset.url;
      const title = btn.dataset.title;
      const type = btn.dataset.type;

      const rl = checkRateLimit('download', 10, 3600000);
      if (!rl.allowed) {
        showToast(`Too many downloads. Please wait ${Math.ceil(rl.remainingMs / 60000)} min`, 'error');
        return;
      }

      const { POINTS } = await import('../config.js');
      const pointCost = type === 'project' ? POINTS.DOWNLOAD_PROJECT_COST : POINTS.DOWNLOAD_COST;

      if (profile.role !== 'admin') {
        if (profile.points < pointCost) {
          showToast(`Not enough points! You need ${pointCost} points to download this.`, 'error');
          return;
        }
        const confirmDownload = confirm(`Downloading this ${type === 'project' ? 'project' : 'resource'} will cost ${pointCost} points. Do you want to proceed?`);
        if (!confirmDownload) return;

        const { data: rpcResult, error: rpcError } = await supabase.rpc('deduct_download_points', {
          point_cost: pointCost,
          upload_id: uploadId
        });

        if (rpcError || !rpcResult?.success) {
          showToast(rpcResult?.error || 'Failed to deduct points!', 'error');
          return;
        }
        profile.points = rpcResult.points_remaining;
      } else {
        await supabase.from('downloads').insert({ upload_id: uploadId, user_id: profile.id });
      }

      window.open(fileUrl, '_blank');
      showToast(`Downloading: ${title}`, 'success');
    });
  });

  // ── Report handlers ──
  container.querySelectorAll('.report-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      showReportModal(btn.dataset.id, btn.dataset.title, profile.id);
    });
  });

  // ── Admin delete handler ──
  window.deleteUpload = async (id, fileUrl) => {
    if(!confirm('Are you strictly sure you want to permanently delete this resource and its associated file?')) return;
    try {
      const urlObj = new URL(fileUrl);
      const pathParts = urlObj.pathname.split('/public/uploads/');
      if (pathParts.length > 1) {
        const filePath = decodeURIComponent(pathParts[1]); 
        const { error: storageError } = await supabase.storage.from('uploads').remove([filePath]);
        if (storageError) console.warn('Storage deletion error:', storageError);
      }
    } catch (e) {
      console.warn('Could not parse file URL for storage deletion', e);
    }
    const { error } = await supabase.from('uploads').delete().eq('id', id);
    if (error) { showToast('Error deleting record: ' + error.message, 'error'); return; }
    showToast('Resource permanently deleted', 'success');
    const btn = document.getElementById('filter-btn');
    if (btn) btn.click();
  };

  // ── Auto-open comment from notification ──
  const hash = window.location.hash;
  const highlightMatch = hash.match(/highlight=([a-f0-9-]+)/);
  if (highlightMatch) {
    const commentId = highlightMatch[1];
    // Find which upload this comment belongs to by checking all comment sections
    setTimeout(async () => {
      const { data: cmt } = await supabase.from('upload_comments').select('upload_id').eq('id', commentId).maybeSingle();
      if (cmt) {
        const section = document.getElementById(`comments-${cmt.upload_id}`);
        if (section) {
          section.style.display = 'block';
          await loadComments(cmt.upload_id);
          setTimeout(() => {
            const el = document.getElementById(`comment-${commentId}`);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              el.style.background = 'rgba(0, 204, 255, 0.1)';
              setTimeout(() => { el.style.background = ''; }, 3000);
            }
          }, 300);
        }
      }
    }, 500);
  }
}

// ── Load Comments for an upload ──
async function loadComments(uploadId) {
  const listEl = document.getElementById(`comments-list-${uploadId}`);
  if (!listEl) return;

  const profile = _browseProfile;

  // Fetch comments with likes and replies
  const { data: comments } = await supabase
    .from('upload_comments')
    .select('*, profiles:user_id(display_name), upload_comment_likes(id, user_id)')
    .eq('upload_id', uploadId)
    .eq('is_deleted', false)
    .is('parent_id', null)
    .order('created_at', { ascending: true });

  // Fetch replies
  const { data: replies } = await supabase
    .from('upload_comments')
    .select('*, profiles:user_id(display_name), upload_comment_likes(id, user_id)')
    .eq('upload_id', uploadId)
    .eq('is_deleted', false)
    .not('parent_id', 'is', null)
    .order('created_at', { ascending: true });

  const repliesMap = {};
  (replies || []).forEach(r => {
    if (!repliesMap[r.parent_id]) repliesMap[r.parent_id] = [];
    repliesMap[r.parent_id].push(r);
  });

  if (!comments || comments.length === 0) {
    listEl.innerHTML = '<div style="text-align:center;padding:12px;color:var(--text-muted);font-size:0.8125rem;">No comments yet. Be the first!</div>';
    return;
  }

  listEl.innerHTML = comments.map(c => renderComment(c, repliesMap[c.id] || [], profile)).join('');

  // Attach like handlers
  listEl.querySelectorAll('.like-comment-btn').forEach(btn => {
    btn.addEventListener('click', () => handleLikeComment(btn.dataset.commentId, uploadId));
  });

  // Attach reply toggle handlers
  listEl.querySelectorAll('.reply-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const replyBox = document.getElementById(`reply-box-${btn.dataset.commentId}`);
      if (replyBox) replyBox.style.display = replyBox.style.display === 'none' ? 'flex' : 'none';
    });
  });

  // Attach reply submit handlers
  listEl.querySelectorAll('.submit-reply-btn').forEach(btn => {
    btn.addEventListener('click', () => handlePostReply(btn.dataset.commentId, uploadId));
  });
}

function renderComment(comment, replies, profile) {
  const likes = comment.upload_comment_likes || [];
  const likeCount = likes.length;
  const myLike = likes.find(l => l.user_id === profile.id);
  const timeAgo = getTimeAgo(comment.created_at);

  return `
    <div class="comment-item" id="comment-${comment.id}" style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div style="flex:1;">
          <span style="font-weight:600;font-size:0.8125rem;color:var(--text-primary);">${escapeHtml(comment.profiles?.display_name || 'User')}</span>
          <span style="font-size:0.7rem;color:var(--text-muted);margin-left:8px;">${timeAgo}</span>
          <p style="margin:4px 0 0;font-size:0.85rem;color:var(--text-secondary);line-height:1.4;">${escapeHtml(comment.body)}</p>
        </div>
      </div>
      <div style="display:flex;gap:var(--space-md);margin-top:6px;align-items:center;">
        <button class="like-comment-btn" data-comment-id="${comment.id}" 
          style="background:none;border:none;cursor:pointer;font-size:0.8rem;display:flex;align-items:center;gap:4px;color:${myLike ? '#e74c3c' : 'var(--text-muted)'};transition:color 0.2s;">
          <i class="fa-${myLike ? 'solid' : 'regular'} fa-heart"></i>
          <span class="like-count-${comment.id}">${likeCount > 0 ? likeCount : ''}</span>
        </button>
        <button class="reply-toggle-btn" data-comment-id="${comment.id}"
          style="background:none;border:none;cursor:pointer;font-size:0.75rem;color:var(--text-muted);">
          Reply
        </button>
      </div>
      <!-- Reply Input -->
      <div id="reply-box-${comment.id}" style="display:none;margin-top:8px;gap:8px;margin-left:24px;">
        <input type="text" class="form-input" id="reply-input-${comment.id}" placeholder="Reply..." style="flex:1;font-size:0.8rem;" maxlength="1000" />
        <button class="btn btn-primary btn-sm submit-reply-btn" data-comment-id="${comment.id}" style="padding:4px 10px;">
          <i class="fa-solid fa-reply"></i>
        </button>
      </div>
      <!-- Replies -->
      ${replies.length > 0 ? `
        <div class="replies-container" style="margin-left:24px;margin-top:8px;border-left:2px solid rgba(255,255,255,0.08);padding-left:12px;">
          ${replies.map(r => {
            const rLikes = r.upload_comment_likes || [];
            const rLikeCount = rLikes.length;
            const rMyLike = rLikes.find(l => l.user_id === profile.id);
            return `
              <div class="comment-item reply-item" id="comment-${r.id}" style="padding:6px 0;">
                <span style="font-weight:600;font-size:0.78rem;color:var(--text-primary);">${escapeHtml(r.profiles?.display_name || 'User')}</span>
                <span style="font-size:0.65rem;color:var(--text-muted);margin-left:6px;">${getTimeAgo(r.created_at)}</span>
                <p style="margin:2px 0 0;font-size:0.8rem;color:var(--text-secondary);line-height:1.3;">${escapeHtml(r.body)}</p>
                <button class="like-comment-btn" data-comment-id="${r.id}"
                  style="background:none;border:none;cursor:pointer;font-size:0.75rem;display:flex;align-items:center;gap:3px;color:${rMyLike ? '#e74c3c' : 'var(--text-muted)'};margin-top:3px;transition:color 0.2s;">
                  <i class="fa-${rMyLike ? 'solid' : 'regular'} fa-heart"></i>
                  <span class="like-count-${r.id}">${rLikeCount > 0 ? rLikeCount : ''}</span>
                </button>
              </div>
            `;
          }).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

// ── Post a new comment ──
async function postComment(uploadId, profile) {
  const input = document.getElementById(`comment-input-${uploadId}`);
  if (!input) return;
  const body = sanitizeText(input.value, 1000);
  if (body.length < 1) { showToast('Comment cannot be empty.', 'warning'); return; }

  const rl = checkRateLimit('comment', 15, 3600000);
  if (!rl.allowed) { showToast('Too many comments. Please slow down.', 'warning'); return; }

  const { error } = await supabase.from('upload_comments').insert({
    upload_id: uploadId,
    user_id: profile.id,
    body
  });

  if (error) { showToast('Failed to post comment.', 'error'); return; }
  input.value = '';
  showToast('Comment posted!', 'success');
  await loadComments(uploadId);
}

// ── Like/Unlike a comment ──
async function handleLikeComment(commentId, uploadId) {
  const profile = _browseProfile;
  const rl = checkRateLimit('like_comment', 30, 3600000);
  if (!rl.allowed) { showToast('Too many likes. Please slow down.', 'warning'); return; }

  // Check if already liked
  const { data: existing } = await supabase.from('upload_comment_likes')
    .select('id')
    .eq('comment_id', commentId)
    .eq('user_id', profile.id)
    .maybeSingle();

  if (existing) {
    await supabase.from('upload_comment_likes').delete().eq('id', existing.id);
  } else {
    await supabase.from('upload_comment_likes').insert({
      comment_id: commentId,
      user_id: profile.id,
      type: 'like'
    });
  }

  // Refresh comment section
  await loadComments(uploadId);
}

// ── Post a reply to a comment ──
async function handlePostReply(parentCommentId, uploadId) {
  const profile = _browseProfile;
  const input = document.getElementById(`reply-input-${parentCommentId}`);
  if (!input) return;
  const body = sanitizeText(input.value, 1000);
  if (body.length < 1) return;

  const rl = checkRateLimit('reply', 15, 3600000);
  if (!rl.allowed) { showToast('Too many replies. Please slow down.', 'warning'); return; }

  const { error } = await supabase.from('upload_comments').insert({
    upload_id: uploadId,
    user_id: profile.id,
    body,
    parent_id: parentCommentId
  });

  if (error) { showToast('Failed to post reply.', 'error'); return; }

  // Create notification for the parent comment author
  const { data: parentComment } = await supabase.from('upload_comments')
    .select('user_id')
    .eq('id', parentCommentId)
    .single();

  if (parentComment && parentComment.user_id !== profile.id) {
    await supabase.from('notifications').insert({
      title: 'New Reply',
      message: `${profile.display_name} replied to your comment`,
      target_user_id: parentComment.user_id,
      created_by: profile.id,
      link_type: 'comment',
      link_id: parentCommentId,
      is_read: false
    });
  }

  input.value = '';
  showToast('Reply posted!', 'success');
  await loadComments(uploadId);
}

// ── Time ago helper ──
function getTimeAgo(dateStr) {
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

/**
 * Show a report modal for flagging a resource
 */
function showReportModal(uploadId, uploadTitle, reporterId) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content" style="max-width:480px;">
      <div class="modal-header">
        <h3><i class="fa-solid fa-flag" style="color:var(--warning);"></i> Report Resource</h3>
        <button class="modal-close" id="close-report-modal">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
      <div class="modal-body">
        <p style="color:var(--text-secondary);margin-bottom:var(--space-lg);font-size:0.875rem;">
          Reporting: <strong>${uploadTitle}</strong>
        </p>
        <div class="form-group">
          <label class="form-label">Why are you reporting this resource?</label>
          <textarea class="form-input" id="report-reason" rows="4" 
            placeholder="e.g. Fake content, copyright violation, contains personal info, inappropriate material..."
            maxlength="500" required style="resize:vertical;"></textarea>
          <span class="form-helper" style="display:flex;justify-content:space-between;">
            <span>Be specific so admins can take action</span>
            <span id="report-char-count">0/500</span>
          </span>
        </div>
        <div style="display:flex;gap:var(--space-md);justify-content:flex-end;margin-top:var(--space-lg);">
          <button class="btn btn-ghost" id="cancel-report-btn">Cancel</button>
          <button class="btn btn-danger" id="submit-report-btn">
            <i class="fa-solid fa-flag"></i> Submit Report
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeModal = () => modal.remove();
  modal.querySelector('#close-report-modal').addEventListener('click', closeModal);
  modal.querySelector('#cancel-report-btn').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  const textarea = modal.querySelector('#report-reason');
  const charCount = modal.querySelector('#report-char-count');
  textarea.addEventListener('input', () => {
    charCount.textContent = `${textarea.value.length}/500`;
  });

  modal.querySelector('#submit-report-btn').addEventListener('click', async () => {
    const reason = textarea.value.trim();
    if (!reason || reason.length < 10) {
      showToast('Please provide a detailed reason (at least 10 characters)', 'warning');
      return;
    }

    const rl = checkRateLimit('report', 5, 3600000);
    if (!rl.allowed) {
      showToast(`Too many reports. Please wait ${Math.ceil(rl.remainingMs / 60000)} min`, 'error');
      return;
    }

    const { data: existing } = await supabase
      .from('upload_reports')
      .select('id')
      .eq('upload_id', uploadId)
      .eq('reporter_id', reporterId)
      .eq('status', 'pending')
      .maybeSingle();

    if (existing) {
      showToast('You already have a pending report for this resource', 'warning');
      closeModal();
      return;
    }

    const submitBtn = modal.querySelector('#submit-report-btn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> Submitting...';

    const { error } = await supabase.from('upload_reports').insert({
      upload_id: uploadId,
      reporter_id: reporterId,
      reason: reason,
    });

    if (error) {
      showToast('Failed to submit report: ' + error.message, 'error');
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fa-solid fa-flag"></i> Submit Report';
      return;
    }

    showToast('Report submitted! An admin will review it shortly.', 'success');
    closeModal();
  });
}
