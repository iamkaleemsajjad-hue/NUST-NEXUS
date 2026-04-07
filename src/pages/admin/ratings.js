import { getCurrentUser, getUserProfile } from '../../utils/auth.js';
import { renderSidebar, initSidebar } from '../../components/sidebar.js';
import { renderHeader, initHeader, setBreadcrumb } from '../../components/header.js';
import { supabase } from '../../utils/supabase.js';
import { router } from '../../router.js';
import gsap from 'gsap';

export async function renderAdminRatings() {
  const app = document.getElementById('app');
  const user = await getCurrentUser();
  if (!user) return router.navigate('/login');
  const profile = await getUserProfile(user.id);
  if (!profile || profile.role !== 'admin') return router.navigate('/dashboard');

  const { data: schools } = await supabase.from('schools').select('*').order('name');

  app.innerHTML = `
    <div class="app-layout">
      ${renderSidebar(profile)}
      <div class="main-content">
        ${renderHeader(profile)}
        <div class="page-container">
          <h2 style="margin-bottom:var(--space-xl);"><i class="fa-solid fa-star"></i> Teacher Ratings Overview</h2>

          <!-- Filters -->
          <div class="card" style="margin-bottom:var(--space-lg);">
            <div style="display:flex;gap:var(--space-md);flex-wrap:wrap;">
              <select class="form-select" id="rating-filter-school" style="max-width:200px;">
                <option value="">All Schools</option>
                ${schools?.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
              </select>
              <select class="form-select" id="rating-sort" style="max-width:200px;">
                <option value="highest">Highest Rated</option>
                <option value="lowest">Lowest Rated</option>
                <option value="most">Most Reviews</option>
              </select>
              <button class="btn btn-primary" id="rating-filter-btn"><i class="fa-solid fa-filter"></i> Filter</button>
            </div>
          </div>

          <div id="ratings-container">
            <div class="skeleton skeleton-card" style="height:400px;"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  initSidebar(); initHeader(profile); setBreadcrumb('Teacher Ratings');

  document.getElementById('rating-filter-btn')?.addEventListener('click', loadRatings);
  loadRatings();
}

async function loadRatings() {
  const container = document.getElementById('ratings-container');
  const schoolFilter = document.getElementById('rating-filter-school').value;
  const sortBy = document.getElementById('rating-sort').value;

  container.innerHTML = '<div class="skeleton skeleton-card" style="height:300px;"></div>';

  // Get all teachers
  let teacherQuery = supabase.from('teachers').select('*, schools(name)').order('name');
  if (schoolFilter) teacherQuery = teacherQuery.eq('school_id', schoolFilter);
  const { data: teachers } = await teacherQuery;

  // Get all ratings
  const { data: allRatings } = await supabase.from('teacher_ratings')
    .select('*, profiles(display_name)');

  if (!teachers || teachers.length === 0) {
    container.innerHTML = '<div class="empty-state"><i class="fa-solid fa-star"></i><h4>No teachers found</h4></div>';
    return;
  }

  // Build rating stats
  const teacherStats = teachers.map(t => {
    const teacherRatings = allRatings?.filter(r => r.teacher_id === t.id) || [];
    const avg = teacherRatings.length > 0 
      ? (teacherRatings.reduce((sum, r) => sum + r.rating, 0) / teacherRatings.length) 
      : 0;
    const comments = teacherRatings.filter(r => r.comment);
    return { ...t, avg, count: teacherRatings.length, comments, ratings: teacherRatings };
  });

  // Sort
  if (sortBy === 'highest') teacherStats.sort((a, b) => b.avg - a.avg);
  else if (sortBy === 'lowest') teacherStats.sort((a, b) => a.avg - b.avg);
  else if (sortBy === 'most') teacherStats.sort((a, b) => b.count - a.count);

  container.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:var(--space-md);">
      ${teacherStats.map((t, idx) => {
        const initials = t.name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
        const starFull = Math.round(t.avg);
        return `
          <div class="card" style="padding:var(--space-lg);">
            <div style="display:flex;gap:var(--space-lg);align-items:center;">
              <div style="text-align:center;min-width:40px;">
                <span style="font-family:var(--font-display);font-weight:800;font-size:1.25rem;color:var(--text-muted);">#${idx + 1}</span>
              </div>
              ${t.avatar_url 
                ? `<img src="${t.avatar_url}" style="width:50px;height:50px;border-radius:50%;object-fit:cover;border:2px solid var(--grid);" />`
                : `<div class="avatar avatar-lg avatar-placeholder" style="width:50px;height:50px;font-size:1rem;">${initials}</div>`
              }
              <div style="flex:1;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <div>
                    <h4 style="margin-bottom:2px;">${t.name}</h4>
                    <span style="color:var(--text-secondary);font-size:0.8125rem;">${t.designation} • ${t.schools?.name || ''}</span>
                  </div>
                  <div style="text-align:right;">
                    <div style="color:var(--warning);font-size:1.25rem;">
                      ${'★'.repeat(starFull)}${'☆'.repeat(5 - starFull)}
                    </div>
                    <span style="font-family:var(--font-mono);font-weight:700;color:var(--text-primary);">
                      ${t.avg ? t.avg.toFixed(1) : '—'}
                    </span>
                    <span style="color:var(--text-muted);font-size:0.75rem;"> (${t.count} reviews)</span>
                  </div>
                </div>
              </div>
            </div>

            ${t.comments.length > 0 ? `
              <details style="margin-top:var(--space-md);">
                <summary style="cursor:pointer;color:var(--primary);font-size:0.875rem;font-weight:500;">
                  <i class="fa-solid fa-comments"></i> View ${t.comments.length} comment${t.comments.length > 1 ? 's' : ''}
                </summary>
                <div style="margin-top:var(--space-md);max-height:250px;overflow-y:auto;">
                  ${t.comments.map(c => `
                    <div style="padding:var(--space-sm) var(--space-md);border-left:2px solid var(--grid);margin-bottom:var(--space-sm);">
                      <div style="display:flex;justify-content:space-between;margin-bottom:2px;">
                        <strong style="font-size:0.8125rem;">${c.profiles?.display_name || 'Anonymous'}</strong>
                        <span style="color:var(--warning);font-size:0.75rem;">${'★'.repeat(c.rating)}</span>
                      </div>
                      <p style="color:var(--text-secondary);font-size:0.8125rem;">${c.comment}</p>
                      <span style="color:var(--text-muted);font-size:0.6875rem;">${new Date(c.created_at).toLocaleDateString()}</span>
                    </div>
                  `).join('')}
                </div>
              </details>
            ` : ''}
          </div>
        `;
      }).join('')}
    </div>
  `;

  gsap.fromTo('#ratings-container .card', { y: 15, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3, stagger: 0.05, ease: 'power3.out' });
}
