import { getCurrentUser, getUserProfile } from '../utils/auth.js';
import { supabase } from '../utils/supabase.js';
import { renderSidebar, initSidebar } from '../components/sidebar.js';
import { renderHeader, initHeader, setBreadcrumb } from '../components/header.js';
import { showToast } from '../components/toast.js';
import { router } from '../router.js';
import gsap from 'gsap';

export async function renderYourUploadsPage() {
  const app = document.getElementById('app');
  const user = await getCurrentUser();
  if (!user) { router.navigate('/login'); return; }
  const profile = await getUserProfile(user.id);
  if (!profile) { router.navigate('/login'); return; }

  app.innerHTML = `
    <div class="app-layout">
      ${renderSidebar(profile)}
      <div class="main-content">
        ${renderHeader(profile)}
        <div class="page-container">
          <h2 style="margin-bottom:var(--space-xl);"><i class="fa-solid fa-folder-open"></i> Your Uploads</h2>
          <div id="your-uploads-list">
            <div class="skeleton skeleton-card" style="height:200px;"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  initSidebar();
  initHeader(profile);
  setBreadcrumb('Your Uploads');

  await loadUserUploads(user.id);
}

async function loadUserUploads(userId) {
  const container = document.getElementById('your-uploads-list');
  if (!container) return;

  // Fetch uploads with related counts
  const { data: uploads, error } = await supabase
    .from('uploads')
    .select('*, courses(name, code)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error || !uploads || uploads.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding:60px 20px;">
        <i class="fa-solid fa-cloud-arrow-up" style="font-size:3rem;color:var(--text-muted);margin-bottom:var(--space-md);"></i>
        <p style="color:var(--text-secondary);">You haven't uploaded anything yet.</p>
        <a href="#/upload" class="btn btn-primary" style="margin-top:var(--space-md);">
          <i class="fa-solid fa-plus"></i> Upload Now
        </a>
      </div>`;
    return;
  }

  // Fetch aggregated stats for all uploads in parallel
  const uploadIds = uploads.map(u => u.id);

  const [ratingsRes, commentsRes, reportsRes, votesRes] = await Promise.all([
    supabase.from('upload_ratings').select('upload_id, stars').in('upload_id', uploadIds),
    supabase.from('upload_comments').select('upload_id').eq('is_deleted', false).in('upload_id', uploadIds),
    supabase.from('upload_reports').select('upload_id, reason, status, created_at').in('upload_id', uploadIds),
    supabase.from('upload_upvotes').select('upload_id, vote_type').in('upload_id', uploadIds),
  ]);

  // Build lookup maps
  const ratingMap = {};
  (ratingsRes.data || []).forEach(r => {
    if (!ratingMap[r.upload_id]) ratingMap[r.upload_id] = [];
    ratingMap[r.upload_id].push(r.stars);
  });

  const commentCountMap = {};
  (commentsRes.data || []).forEach(c => {
    commentCountMap[c.upload_id] = (commentCountMap[c.upload_id] || 0) + 1;
  });

  const reportMap = {};
  (reportsRes.data || []).forEach(r => {
    if (!reportMap[r.upload_id]) reportMap[r.upload_id] = [];
    reportMap[r.upload_id].push(r);
  });

  const voteMap = {};
  (votesRes.data || []).forEach(v => {
    if (!voteMap[v.upload_id]) voteMap[v.upload_id] = { up: 0, down: 0 };
    voteMap[v.upload_id][v.vote_type]++;
  });

  const statusStyles = {
    pending: { color: 'var(--warning)', bg: 'rgba(var(--warning-rgb),0.1)', icon: 'fa-clock', label: 'Pending' },
    approved: { color: 'var(--success)', bg: 'rgba(var(--success-rgb),0.1)', icon: 'fa-circle-check', label: 'Approved' },
    rejected: { color: 'var(--danger)', bg: 'rgba(var(--danger-rgb),0.1)', icon: 'fa-circle-xmark', label: 'Rejected' },
  };

  container.innerHTML = uploads.map(u => {
    const s = statusStyles[u.status] || statusStyles.pending;
    const ratings = ratingMap[u.id] || [];
    const avgRating = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : '—';
    const commentCount = commentCountMap[u.id] || 0;
    const reports = reportMap[u.id] || [];
    const votes = voteMap[u.id] || { up: 0, down: 0 };

    return `
      <div class="card your-upload-card" id="upload-card-${u.id}" style="margin-bottom:var(--space-md);transition:all 0.3s ease;">
        <div style="display:flex;align-items:flex-start;gap:var(--space-md);flex-wrap:wrap;">
          <!-- Left: Title & Info -->
          <div style="flex:1;min-width:200px;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
              <span class="badge" style="background:${s.bg};color:${s.color};font-size:0.7rem;">
                <i class="fa-solid ${s.icon}"></i> ${s.label}
              </span>
              <span style="font-size:0.75rem;color:var(--text-muted);">${new Date(u.created_at).toLocaleDateString()}</span>
            </div>
            <h4 style="margin:0 0 4px;font-size:1rem;color:var(--text-primary);">${u.title}</h4>
            <p style="font-size:0.8125rem;color:var(--text-muted);margin:0;">
              ${u.courses?.code || ''} ${u.courses?.name || ''} · Semester ${u.semester} · ${u.type.replace('_', ' ')}
            </p>
          </div>

          <!-- Right: Stats -->
          <div style="display:flex;gap:var(--space-lg);align-items:center;flex-wrap:wrap;">
            <div style="text-align:center;" title="Average Rating">
              <div style="font-size:1.1rem;color:#F1C40F;">
                <i class="fa-solid fa-star"></i> ${avgRating}
              </div>
              <div style="font-size:0.65rem;color:var(--text-muted);">${ratings.length} rating${ratings.length !== 1 ? 's' : ''}</div>
            </div>
            <div style="text-align:center;" title="Comments">
              <div style="font-size:1.1rem;color:var(--primary);">
                <i class="fa-solid fa-comment"></i> ${commentCount}
              </div>
              <div style="font-size:0.65rem;color:var(--text-muted);">comment${commentCount !== 1 ? 's' : ''}</div>
            </div>
            <div style="text-align:center;" title="Votes">
              <div style="font-size:1.1rem;">
                <span style="color:var(--success);"><i class="fa-solid fa-thumbs-up"></i> ${votes.up}</span>
                <span style="margin:0 4px;color:var(--text-muted);">/</span>
                <span style="color:var(--danger);"><i class="fa-solid fa-thumbs-down"></i> ${votes.down}</span>
              </div>
              <div style="font-size:0.65rem;color:var(--text-muted);">votes</div>
            </div>
            ${reports.length > 0 ? `
              <div style="text-align:center;" title="Reports">
                <div style="font-size:1.1rem;color:var(--danger);">
                  <i class="fa-solid fa-flag"></i> ${reports.length}
                </div>
                <div style="font-size:0.65rem;color:var(--text-muted);">report${reports.length !== 1 ? 's' : ''}</div>
              </div>
            ` : ''}
            <button class="btn btn-danger btn-sm" onclick="window._deleteUpload('${u.id}')" title="Delete Upload" style="padding:6px 12px;">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>

        ${reports.length > 0 ? `
          <details style="margin-top:var(--space-md);border-top:1px solid var(--border);padding-top:var(--space-md);">
            <summary style="cursor:pointer;color:var(--danger);font-size:0.8125rem;font-weight:600;">
              <i class="fa-solid fa-flag"></i> ${reports.length} Report${reports.length !== 1 ? 's' : ''}
            </summary>
            <div style="margin-top:var(--space-sm);">
              ${reports.map(r => `
                <div style="padding:8px 12px;background:rgba(var(--danger-rgb),0.05);border-radius:var(--radius-sm);margin-bottom:6px;font-size:0.8125rem;">
                  <span style="color:var(--text-secondary);">${r.reason}</span>
                  <span style="float:right;font-size:0.7rem;color:var(--text-muted);">${new Date(r.created_at).toLocaleDateString()} · ${r.status}</span>
                </div>
              `).join('')}
            </div>
          </details>
        ` : ''}
      </div>
    `;
  }).join('');

  // Animate cards
  gsap.fromTo('.your-upload-card', 
    { y: 20, opacity: 0 }, 
    { y: 0, opacity: 1, duration: 0.4, stagger: 0.08, ease: 'power3.out' }
  );

  // Delete handler
  window._deleteUpload = async (uploadId) => {
    if (!confirm('Are you sure you want to delete this upload? This action cannot be undone.')) return;

    const { error } = await supabase.from('uploads')
      .update({ status: 'rejected' })
      .eq('id', uploadId)
      .eq('user_id', userId);

    if (error) {
      showToast('Failed to delete upload.', 'error');
      return;
    }

    showToast('Upload deleted successfully.', 'success');
    const card = document.getElementById(`upload-card-${uploadId}`);
    if (card) {
      gsap.to(card, { height: 0, opacity: 0, marginBottom: 0, padding: 0, duration: 0.4, ease: 'power2.in', onComplete: () => card.remove() });
    }
  };
}
