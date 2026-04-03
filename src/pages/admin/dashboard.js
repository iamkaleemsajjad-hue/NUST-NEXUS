import { getCurrentUser, getUserProfile } from '../../utils/auth.js';
import { renderSidebar, initSidebar } from '../../components/sidebar.js';
import { renderHeader, initHeader, setBreadcrumb } from '../../components/header.js';
import { supabase } from '../../utils/supabase.js';
import { router } from '../../router.js';
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

          <!-- Recent Users -->
          <div class="card" style="margin-top:var(--space-xl);">
            <h3 style="margin-bottom:var(--space-lg);">Recent Students</h3>
            <div id="recent-users"></div>
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
              <td>${u.display_name}</td><td>${u.email}</td><td>${u.school || '—'}</td>
              <td>${u.degree || '—'}</td><td><span class="badge badge-primary">${u.points}</span></td>
              <td>${new Date(u.created_at).toLocaleDateString()}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    `;
  }
}
