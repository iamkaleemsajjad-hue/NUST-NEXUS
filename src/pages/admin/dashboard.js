import { getCurrentUser, getUserProfile } from '../../utils/auth.js';
import { renderSidebar, initSidebar } from '../../components/sidebar.js';
import { renderHeader, initHeader, setBreadcrumb } from '../../components/header.js';
import { showToast } from '../../components/toast.js';
import { supabase } from '../../utils/supabase.js';
import { escapeHtml } from '../../utils/sanitize.js';
import { router } from '../../router.js';
import { subscribeToTable } from '../../utils/realtime.js';
import gsap from 'gsap';

export async function renderAdminDashboard() {
  const app = document.getElementById('app');
  const user = await getCurrentUser();
  if (!user) { router.navigate('/login'); return; }
  const profile = await getUserProfile(user.id);
  if (!profile || profile.role !== 'admin') { router.navigate('/dashboard'); return; }

  // Get stats
  const { count: totalUsers } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student');
  const { count: totalUploads } = await supabase.from('uploads').select('*', { count: 'exact', head: true });
  const { count: pendingUploads } = await supabase.from('uploads').select('*', { count: 'exact', head: true }).eq('status', 'pending');
  const { count: totalFeedback } = await supabase.from('feedback').select('*', { count: 'exact', head: true });
  const { count: totalTeachers } = await supabase.from('teachers').select('*', { count: 'exact', head: true });
  const { count: totalCourses } = await supabase.from('courses').select('*', { count: 'exact', head: true });
  const { count: pendingReports } = await supabase.from('upload_reports').select('*', { count: 'exact', head: true }).eq('status', 'pending');

  app.innerHTML = `
    <div class="app-layout">
      ${renderSidebar(profile)}
      <div class="main-content">
        ${renderHeader(profile)}
        <div class="page-container">
          <h2 style="margin-bottom:var(--space-xl);"><i class="fa-solid fa-shield-halved"></i> Admin Dashboard</h2>
          
          <div class="grid-3" id="admin-stats">
            <div class="stat-card card">
              <div class="stat-icon" style="background:rgba(0,204,255,0.1);color:var(--primary);"><i class="fa-solid fa-users"></i></div>
              <div class="stat-info"><span class="stat-value">${totalUsers || 0}</span><span class="stat-label">Students</span></div>
            </div>
            <div class="stat-card card">
              <div class="stat-icon" style="background:rgba(0,255,136,0.1);color:var(--success);"><i class="fa-solid fa-cloud-arrow-up"></i></div>
              <div class="stat-info"><span class="stat-value">${totalUploads || 0}</span><span class="stat-label">Total Uploads</span></div>
            </div>
            <div class="stat-card card">
              <div class="stat-icon" style="background:rgba(255,184,0,0.1);color:var(--warning);"><i class="fa-solid fa-clock"></i></div>
              <div class="stat-info"><span class="stat-value">${pendingUploads || 0}</span><span class="stat-label">Pending Review</span></div>
            </div>
            <div class="stat-card card">
              <div class="stat-icon" style="background:rgba(26,188,254,0.1);color:var(--accent);"><i class="fa-solid fa-chalkboard-user"></i></div>
              <div class="stat-info"><span class="stat-value">${totalTeachers || 0}</span><span class="stat-label">Teachers</span></div>
            </div>
            <div class="stat-card card">
              <div class="stat-icon" style="background:rgba(0,184,212,0.1);color:var(--highlight);"><i class="fa-solid fa-book"></i></div>
              <div class="stat-info"><span class="stat-value">${totalCourses || 0}</span><span class="stat-label">Courses</span></div>
            </div>
            <div class="stat-card card">
              <div class="stat-icon" style="background:rgba(255,59,92,0.1);color:var(--danger);"><i class="fa-solid fa-comment-dots"></i></div>
              <div class="stat-info"><span class="stat-value">${totalFeedback || 0}</span><span class="stat-label">Feedback</span></div>
            </div>
            <div class="stat-card card">
              <div class="stat-icon" style="background:rgba(255,120,0,0.1);color:#ff7800;"><i class="fa-solid fa-flag"></i></div>
              <div class="stat-info"><span class="stat-value">${pendingReports || 0}</span><span class="stat-label">Pending Reports</span></div>
            </div>
          </div>

          <!-- Quick Actions -->
          <div class="card" style="margin-top:var(--space-xl);">
            <h3 style="margin-bottom:var(--space-lg);">Quick Actions</h3>
            <div style="display:flex;gap:var(--space-md);flex-wrap:wrap;">
              <a href="#/admin/teachers" class="btn btn-secondary"><i class="fa-solid fa-user-plus"></i> Manage Teachers</a>
              <a href="#/admin/courses" class="btn btn-secondary"><i class="fa-solid fa-book"></i> Manage Courses</a>
              <a href="#/admin/notifications" class="btn btn-secondary"><i class="fa-solid fa-bell"></i> Send Notification</a>
              <a href="#/admin/feedback" class="btn btn-secondary"><i class="fa-solid fa-envelope"></i> View Feedback</a>
            </div>
          </div>

          <!-- Pending Uploads Queue -->
          <div class="card" style="margin-top:var(--space-xl);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-lg);">
              <h3 style="margin:0;">Pending Uploads (Needs Verification)</h3>
              <button class="btn btn-ghost btn-sm" onclick="window.loadPendingUploads()"><i class="fa-solid fa-arrows-rotate"></i> Refresh</button>
            </div>
            <div id="pending-uploads">
              <div class="skeleton skeleton-card" style="height:100px;"></div>
            </div>
          </div>

          <!-- Recent Users -->
          <div class="card" style="margin-top:var(--space-xl);">
            <h3 style="margin-bottom:var(--space-lg);">Recent Students</h3>
            <div id="recent-users"></div>
          </div>

          <!-- Reported Uploads -->
          <div class="card" style="margin-top:var(--space-xl);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-lg);">
              <h3 style="margin:0;"><i class="fa-solid fa-flag" style="color:var(--warning);"></i> Reported Uploads</h3>
              <button class="btn btn-ghost btn-sm" onclick="window.loadReportedUploads()"><i class="fa-solid fa-arrows-rotate"></i> Refresh</button>
            </div>
            <div id="reported-uploads">
              <div class="skeleton skeleton-card" style="height:100px;"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  initSidebar();
  initHeader(profile);
  setBreadcrumb('Admin Dashboard');
  
  gsap.fromTo('.stat-card', { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, stagger: 0.08, ease: 'power3.out' });

  // Load recent users
  const { data: users } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'student')
    .order('created_at', { ascending: false })
    .limit(10);

  const container = document.getElementById('recent-users');
  if (users && users.length > 0) {
    container.innerHTML = `
      <div class="table-container">
        <table class="data-table">
          <thead><tr><th>Name</th><th>Email</th><th>School</th><th>Degree</th><th>Points</th><th>Joined</th></tr></thead>
          <tbody>
            ${users.map(u => `<tr>
              <td>${escapeHtml(u.display_name)}</td><td>${escapeHtml(u.email)}</td><td>${escapeHtml(u.school || '—')}</td>
              <td>${escapeHtml(u.degree || '—')}</td><td><span class="badge badge-primary">${u.points}</span></td>
              <td>${new Date(u.created_at).toLocaleDateString()}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  window.loadPendingUploads = async function() {
    const list = document.getElementById('pending-uploads');
    list.innerHTML = '<div class="spinner"></div>';
    
    const { data: pending } = await supabase
      .from('uploads')
      .select('*, profiles(display_name)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
      
    if (!pending || pending.length === 0) {
      list.innerHTML = '<div class="empty-state"><p>No pending uploads. Everything is up to date.</p></div>';
      return;
    }
    
    list.innerHTML = pending.map(item => `
      <div class="card" style="display:flex;justify-content:space-between;align-items:center;padding:12px;margin-bottom:8px;background:rgba(255,255,255,0.02);border:1px solid var(--border);">
        <div style="flex:1;min-width:0;padding-right:12px;">
          <h4 style="margin-bottom:4px;">${escapeHtml(item.title)}</h4>
          <p style="font-size:0.8rem;color:var(--text-secondary);margin:0;line-height:1.5;">
            <strong>Type:</strong> ${item.type} | <strong>By:</strong> ${escapeHtml(item.profiles?.display_name || 'Unknown')} <br>
            <strong>Student ID:</strong> <code style="font-size:0.75rem;background:var(--bg-deep);padding:2px 4px;border-radius:4px;user-select:all;">${item.user_id}</code><br>
            <strong>Date:</strong> ${new Date(item.created_at).toLocaleDateString()}
          </p>
        </div>
        <div style="display:flex;gap:8px;">
          <a href="${item.file_url}" target="_blank" class="btn btn-secondary btn-sm"><i class="fa-solid fa-eye"></i> View</a>
          <button class="btn btn-primary btn-sm" onclick="window.approveUpload('${item.id}', '${item.user_id}', '${item.type}')">
            <i class="fa-solid fa-check"></i> Approve
          </button>
          <button class="btn btn-danger btn-sm" onclick="window.rejectUpload('${item.id}')">
            <i class="fa-solid fa-xmark"></i> Reject
          </button>
        </div>
      </div>
    `).join('');
  };
  
  window.rejectUpload = async function(id) {
    if(!confirm('Reject this upload? No points will be awarded.')) return;
    
    const { error } = await supabase.from('uploads').update({ status: 'rejected' }).eq('id', id);
    if (error) {
      showToast('Error rejecting upload', 'error');
      return;
    }
    
    showToast('Upload rejected.', 'success');
    window.loadPendingUploads();
  };
  
  window.approveUpload = async function(id, userId, type) {
    if(!confirm('Approve this upload and award points?')) return;
    
    // Import POINTS from config
    const { POINTS } = await import('../../config.js');
    const pointsAwarded = type === 'project' ? POINTS.UPLOAD_PROJECT : POINTS.UPLOAD_GENERAL;
    
    // Update status mapping
    const { error } = await supabase.from('uploads').update({ status: 'approved', points_awarded: pointsAwarded }).eq('id', id);
    if (error) {
      showToast('Error approving upload', 'error');
      return;
    }
    
    // Give user points
    const { data: profile } = await supabase.from('profiles').select('points').eq('id', userId).single();
    await supabase.from('profiles').update({ points: (profile?.points || 0) + pointsAwarded }).eq('id', userId);
    
    showToast('Upload approved!', 'success');
    window.loadPendingUploads();
  };

  window.loadPendingUploads();

  // ── Reported Uploads ──
  window.loadReportedUploads = async function() {
    const reportList = document.getElementById('reported-uploads');
    reportList.innerHTML = '<div class="spinner"></div>';

    const { data: reports } = await supabase
      .from('upload_reports')
      .select('*, uploads(id, title, file_url, type, user_id, profiles(display_name)), reporter:profiles!upload_reports_reporter_id_fkey(display_name, email)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (!reports || reports.length === 0) {
      reportList.innerHTML = '<div class="empty-state"><p>No pending reports. All clear! ✅</p></div>';
      return;
    }

    reportList.innerHTML = reports.map(r => `
      <div class="card" style="display:flex;flex-direction:column;gap:8px;padding:14px;margin-bottom:10px;background:rgba(255,255,255,0.02);border:1px solid var(--border);" id="report-${r.id}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
          <div style="flex:1;min-width:0;">
            <h4 style="margin-bottom:4px;">
              <i class="fa-solid fa-flag" style="color:var(--warning);font-size:0.8rem;"></i>
              ${escapeHtml(r.uploads?.title || 'Deleted Resource')}
            </h4>
            <p style="font-size:0.8rem;color:var(--text-secondary);margin:0;line-height:1.6;">
              <strong>Reported by:</strong> ${escapeHtml(r.reporter?.display_name || 'Unknown')} (${escapeHtml(r.reporter?.email || '')})<br>
              <strong>Reason:</strong> <span style="color:var(--warning);">${escapeHtml(r.reason)}</span><br>
              <strong>Date:</strong> ${new Date(r.created_at).toLocaleDateString()} ${new Date(r.created_at).toLocaleTimeString()}
            </p>
          </div>
          <div style="display:flex;gap:8px;flex-shrink:0;">
            ${r.uploads?.file_url ? `<a href="${r.uploads.file_url}" target="_blank" class="btn btn-secondary btn-sm"><i class="fa-solid fa-eye"></i> View</a>` : ''}
            <button class="btn btn-ghost btn-sm" style="color:var(--text-muted);" onclick="window.dismissReport('${r.id}')">
              <i class="fa-solid fa-ban"></i> Dismiss
            </button>
            ${r.uploads ? `
              <button class="btn btn-danger btn-sm" onclick="window.deleteReportedUpload('${r.id}', '${r.uploads.id}', '${r.uploads.file_url || ''}')">
                <i class="fa-solid fa-trash"></i> Delete Resource
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `).join('');
  };

  window.dismissReport = async function(reportId) {
    if (!confirm('Dismiss this report? The resource will remain available.')) return;
    const { error } = await supabase.from('upload_reports').update({ status: 'dismissed' }).eq('id', reportId);
    if (error) {
      showToast('Error dismissing report: ' + error.message, 'error');
      return;
    }
    showToast('Report dismissed', 'success');
    window.loadReportedUploads();
  };

  window.deleteReportedUpload = async function(reportId, uploadId, fileUrl) {
    if (!confirm('Delete this resource AND mark the report as reviewed? This cannot be undone.')) return;

    // Delete from storage
    try {
      const urlObj = new URL(fileUrl);
      const pathParts = urlObj.pathname.split('/public/uploads/');
      if (pathParts.length > 1) {
        const filePath = decodeURIComponent(pathParts[1]);
        await supabase.storage.from('uploads').remove([filePath]);
      }
    } catch (e) {
      console.warn('Could not parse file URL for storage deletion', e);
    }

    // Delete the upload record (cascade will remove the report too)
    const { error: delError } = await supabase.from('uploads').delete().eq('id', uploadId);
    if (delError) {
      showToast('Error deleting resource: ' + delError.message, 'error');
      return;
    }

    showToast('Reported resource deleted permanently', 'success');
    window.loadReportedUploads();
  };

  window.loadReportedUploads();

  // Real-time: auto-refresh pending uploads when any upload changes
  subscribeToTable('admin-pending-uploads', 'uploads', null, (payload) => {
    console.log('[realtime] uploads changed:', payload.eventType);
    window.loadPendingUploads();
  });
}
