import { getCurrentUser, getUserProfile } from '../utils/auth.js';
import { renderSidebar, initSidebar } from '../components/sidebar.js';
import { renderHeader, initHeader, setBreadcrumb } from '../components/header.js';
import { showToast } from '../components/toast.js';
import { supabase } from '../utils/supabase.js';
import { router } from '../router.js';
import { getCached, setCache, bustCache } from '../utils/cache.js';
import gsap from 'gsap';

// Cache TTLs
const TEACHERS_CACHE_TTL = 5 * 60 * 1000;  // 5 min for teacher list
const RATINGS_CACHE_TTL = 2 * 60 * 1000;   // 2 min for ratings

export async function renderTeachersPage() {
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
          <h2 style="margin-bottom:var(--space-xl);"><i class="fa-solid fa-chalkboard-user"></i> Teacher Profiles</h2>
          
          <div class="card" style="margin-bottom:var(--space-lg);">
            <div style="display:flex;gap:var(--space-md);align-items:center;">
              <div style="position:relative;flex:1;">
                <i class="fa-solid fa-search" style="position:absolute;left:14px;top:50%;transform:translateY(-50%);color:var(--text-muted);"></i>
                <input type="text" class="form-input" id="teacher-search" 
                  placeholder="Search teachers by name or designation..." style="padding-left:40px;" />
              </div>
              <div style="color:var(--text-muted);font-size:0.8125rem;white-space:nowrap;" id="teacher-count"></div>
            </div>
          </div>

          <div id="teacher-list">
            <div class="teacher-grid grid-3">
              ${Array(6).fill('').map(() => `
                <div class="card">
                  <div style="display:flex;align-items:center;gap:var(--space-md);margin-bottom:var(--space-md);">
                    <div class="skeleton skeleton-avatar" style="width:64px;height:64px;"></div>
                    <div style="flex:1;">
                      <div class="skeleton skeleton-text" style="width:70%;"></div>
                      <div class="skeleton skeleton-text" style="width:50%;"></div>
                    </div>
                  </div>
                  <div class="skeleton skeleton-text" style="width:100%;height:40px;"></div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  initSidebar();
  initHeader(profile);
  setBreadcrumb('Teacher Profiles');

  // Debounced real-time search
  let searchTimer;
  document.getElementById('teacher-search')?.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => loadTeachers(profile), 300);
  });
  
  loadTeachers(profile);
}

async function loadTeachers(profile) {
  const container = document.getElementById('teacher-list');
  const search = document.getElementById('teacher-search').value.trim();
  const adminUser = profile.role === 'admin';

  // Build a cache key that includes the search term
  const cacheKey = `teachers_list_${search || 'all'}`;
  const ratingsCacheKey = `teachers_ratings_all`;
  const commentsCacheKey = `teachers_comments_all`;

  // Try cache first (only for non-search or same search)
  const cachedTeachers = getCached(cacheKey);
  const cachedRatings = getCached(ratingsCacheKey);
  const cachedComments = getCached(commentsCacheKey);

  let teachers, ratings, comments;

  if (cachedTeachers && cachedRatings && cachedComments) {
    // Serve from cache — no API calls!
    teachers = cachedTeachers;
    ratings = cachedRatings;
    comments = cachedComments;
  } else {
    // Show skeleton while loading
    container.innerHTML = `<div class="teacher-grid grid-3">${Array(6).fill('').map(() => `
      <div class="card"><div style="display:flex;align-items:center;gap:var(--space-md);margin-bottom:var(--space-md);">
        <div class="skeleton skeleton-avatar" style="width:64px;height:64px;"></div>
        <div style="flex:1;"><div class="skeleton skeleton-text" style="width:70%;"></div><div class="skeleton skeleton-text" style="width:50%;"></div></div>
      </div><div class="skeleton skeleton-text" style="width:100%;height:40px;"></div></div>`).join('')}</div>`;

    // Fetch all in parallel
    let query = supabase.from('teachers').select('*, schools(name)').order('name');
    if (search) query = query.ilike('name', `%${search}%`);

    const [teacherResult, ratingsResult, commentsResult] = await Promise.all([
      query,
      supabase.from('teacher_ratings').select('teacher_id, rating'),
      supabase.from('teacher_ratings').select('teacher_id').not('comment', 'is', null)
    ]);

    teachers = teacherResult.data;
    ratings = ratingsResult.data;
    comments = commentsResult.data;

    // Cache results
    if (teachers) setCache(cacheKey, teachers, TEACHERS_CACHE_TTL);
    if (ratings) setCache(ratingsCacheKey, ratings, RATINGS_CACHE_TTL);
    if (comments) setCache(commentsCacheKey, comments, RATINGS_CACHE_TTL);
  }

  if (!teachers || teachers.length === 0) {
    container.innerHTML = '<div class="empty-state"><i class="fa-solid fa-chalkboard-user"></i><h4>No teachers found</h4></div>';
    return;
  }

  const ratingMap = {};
  const commentCountMap = {};
  ratings?.forEach(r => {
    if (!ratingMap[r.teacher_id]) ratingMap[r.teacher_id] = [];
    ratingMap[r.teacher_id].push(r.rating);
  });
  comments?.forEach(c => {
    commentCountMap[c.teacher_id] = (commentCountMap[c.teacher_id] || 0) + 1;
  });

  // Anyone can rate any teacher
  const canRate = (teacher) => true;

  container.innerHTML = `
    <div class="teacher-grid grid-3">
      ${teachers.map(t => {
        const avg = ratingMap[t.id] ? (ratingMap[t.id].reduce((a,b)=>a+b,0) / ratingMap[t.id].length).toFixed(1) : '—';
        const count = ratingMap[t.id]?.length || 0;
        const commentCount = commentCountMap[t.id] || 0;
        const initials = t.name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
        return `
          <div class="teacher-card card" data-id="${t.id}">
            <div class="teacher-card-header">
              ${t.avatar_url 
                ? `<img src="${t.avatar_url}" class="avatar avatar-lg" alt="${t.name}" style="object-fit:cover;" />`
                : `<div class="avatar avatar-lg avatar-placeholder">${initials}</div>`
              }
              <div>
                <h4>${t.name}</h4>
                <span style="color:var(--text-secondary);font-size:0.8125rem;">${t.designation}</span>
                <span class="badge badge-primary" style="margin-top:4px;">${t.schools?.name || ''}</span>
              </div>
            </div>
            ${t.description ? `
              <p style="color:var(--text-secondary);font-size:0.8125rem;margin-bottom:var(--space-md);line-height:1.4;">
                ${t.description.substring(0, 100)}${t.description.length > 100 ? '...' : ''}
              </p>
            ` : ''}
            <div class="teacher-card-footer">
              <div class="teacher-rating">
                <span class="star-display">${'★'.repeat(Math.round(avg === '—' ? 0 : avg))}${'☆'.repeat(5-Math.round(avg === '—' ? 0 : avg))}</span>
                <span>${avg} (${count})</span>
              </div>
              <div style="display:flex;gap:8px;align-items:center;">
                <span style="color:var(--text-secondary);font-size:0.8125rem;">
                  <i class="fa-solid fa-comments"></i> ${commentCount}
                </span>
                <button class="btn btn-secondary btn-sm view-teacher-btn" data-id="${t.id}" data-can-rate="${canRate(t)}">
                  View
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  // Update count
  const countEl = document.getElementById('teacher-count');
  if (countEl) countEl.textContent = `${teachers.length} teacher${teachers.length !== 1 ? 's' : ''} found`;

  gsap.fromTo('.teacher-card', { y: 30, opacity: 0, scale: 0.95 }, { y: 0, opacity: 1, scale: 1, duration: 0.5, stagger: 0.06, ease: 'back.out(1.2)' });

  container.querySelectorAll('.view-teacher-btn').forEach(btn => {
    btn.addEventListener('click', () => showTeacherProfile(btn.dataset.id, btn.dataset.canRate === 'true', profile));
  });
}

async function showTeacherProfile(teacherId, canRate, profile) {
  // Try to serve teacher from cache, ratings always fetched fresh for accuracy
  let teacher;
  const cachedTeachers = getCached(`teachers_list_all`);
  if (cachedTeachers) {
    teacher = cachedTeachers.find(t => t.id === teacherId);
  }
  if (!teacher) {
    const { data } = await supabase.from('teachers').select('*, schools(name)').eq('id', teacherId).single();
    teacher = data;
  }

  // Fetch ratings WITHOUT profile display_name — ANONYMOUS!
  const { data: allRatings } = await supabase.from('teacher_ratings')
    .select('id, teacher_id, user_id, rating, comment, created_at')
    .eq('teacher_id', teacherId)
    .order('created_at', { ascending: false });

  const avg = allRatings?.length ? (allRatings.reduce((a,b)=>a+b.rating,0) / allRatings.length).toFixed(1) : '—';
  const userRating = allRatings?.find(r => r.user_id === profile.id);

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content" style="max-width:640px;">
      <div class="modal-header">
        <h3>${teacher.name}</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
      <div class="modal-body">
        <div style="text-align:center;margin-bottom:var(--space-xl);">
          ${teacher.avatar_url 
            ? `<img src="${teacher.avatar_url}" class="avatar avatar-xl" alt="${teacher.name}" style="margin:0 auto;object-fit:cover;" />`
            : `<div class="avatar avatar-xl avatar-placeholder" style="margin:0 auto;">${teacher.name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2)}</div>`
          }
          <h3 style="margin-top:var(--space-md);">${teacher.name}</h3>
          <p style="color:var(--text-secondary);">${teacher.designation} • ${teacher.schools?.name}</p>
          <div style="font-size:1.5rem;color:var(--warning);margin-top:var(--space-sm);">
            ${'★'.repeat(Math.round(avg === '—' ? 0 : avg))}${'☆'.repeat(5-Math.round(avg === '—' ? 0 : avg))}
            <span style="font-size:1rem;color:var(--text-secondary);"> ${avg} / 5</span>
          </div>
        </div>

        ${teacher.description ? `
          <div class="card" style="margin-bottom:var(--space-lg);background:var(--bg-surface);">
            <h4 style="margin-bottom:var(--space-sm);"><i class="fa-solid fa-info-circle" style="color:var(--primary);"></i> About</h4>
            <p style="color:var(--text-secondary);font-size:0.875rem;line-height:1.6;">${teacher.description}</p>
          </div>
        ` : ''}

        ${canRate ? `
          <div class="card" style="margin-bottom:var(--space-lg);background:var(--bg-surface);">
            <h4 style="margin-bottom:var(--space-md);">Rate this teacher</h4>
            <div class="star-rating" id="star-rating">
              ${[1,2,3,4,5].map(i => `<span class="star ${userRating && userRating.rating >= i ? 'active' : ''}" data-val="${i}">★</span>`).join('')}
            </div>
            <div class="form-group" style="margin-top:var(--space-md);margin-bottom:0;">
              <textarea class="form-textarea" id="rating-comment" placeholder="Leave a comment (optional, your identity stays anonymous)" style="min-height:60px;">${userRating?.comment || ''}</textarea>
            </div>
            <p style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;margin-bottom:var(--space-sm);">
              <i class="fa-solid fa-shield-halved" style="color:var(--success);"></i> Your identity is completely anonymous — no one can see who posted this.
            </p>
            <button class="btn btn-primary btn-sm" id="submit-rating" style="margin-top:var(--space-sm);">
              ${userRating ? 'Update Rating' : 'Submit Rating'}
            </button>
          </div>
        ` : '<p class="form-helper" style="margin-bottom:var(--space-lg);"><i class="fa-solid fa-info-circle"></i> You can only rate teachers from your own school.</p>'}

        <h4 style="margin-bottom:var(--space-md);">Comments (${allRatings?.filter(r => r.comment)?.length || 0})</h4>
        <div class="comments-list" style="max-height:300px;overflow-y:auto;">
          ${allRatings?.filter(r => r.comment)?.length ? allRatings.filter(r => r.comment).map(r => `
            <div class="comment-item" style="padding:var(--space-md);border-bottom:1px solid var(--border);">
              <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                <strong style="color:var(--text-muted);">
                  <i class="fa-solid fa-user-secret" style="margin-right:4px;opacity:0.7;"></i> Anonymous Student
                </strong>
                <span style="color:var(--warning);">${'★'.repeat(r.rating)}</span>
              </div>
              <p style="color:var(--text-secondary);font-size:0.875rem;">${r.comment}</p>
            </div>
          `).join('') : '<p style="color:var(--text-muted);text-align:center;">No comments yet</p>'}
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

  // Star rating interaction
  if (canRate) {
    let selectedRating = userRating?.rating || 0;
    const stars = modal.querySelectorAll('#star-rating .star');
    
    stars.forEach(star => {
      star.addEventListener('mouseenter', () => {
        const val = parseInt(star.dataset.val);
        stars.forEach((s,i) => s.classList.toggle('active', i < val));
      });
      star.addEventListener('click', () => {
        selectedRating = parseInt(star.dataset.val);
      });
    });

    modal.querySelector('#star-rating')?.addEventListener('mouseleave', () => {
      stars.forEach((s,i) => s.classList.toggle('active', i < selectedRating));
    });

    modal.querySelector('#submit-rating')?.addEventListener('click', async () => {
      if (!selectedRating) { showToast('Please select a rating', 'warning'); return; }
      const comment = modal.querySelector('#rating-comment').value.trim();
      
      if (userRating) {
        await supabase.from('teacher_ratings')
          .update({ rating: selectedRating, comment })
          .eq('id', userRating.id);
      } else {
        await supabase.from('teacher_ratings').insert({
          teacher_id: teacherId,
          user_id: profile.id,
          rating: selectedRating,
          comment,
        });
      }
      
      showToast('Rating submitted!', 'success');
      modal.remove();
      // Bust teacher-related caches so fresh data is fetched
      bustCache('teachers_');
      loadTeachers(profile);
    });
  }
}
