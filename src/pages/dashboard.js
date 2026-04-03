import { getCurrentUser, getUserProfile, getLoginHistory, recordLogin } from '../utils/auth.js';
import { calculateSemester, getSemesterLabel } from '../utils/semester.js';
import { getSchoolFullName } from '../utils/email-parser.js';
import { renderSidebar, initSidebar } from '../components/sidebar.js';
import { renderHeader, initHeader, setBreadcrumb } from '../components/header.js';
import { showToast } from '../components/toast.js';
import { supabase } from '../utils/supabase.js';
import { router } from '../router.js';
import gsap from 'gsap';

export async function renderDashboardPage() {
  const app = document.getElementById('app');
  const user = await getCurrentUser();
  if (!user) { router.navigate('/login'); return; }

  const profile = await getUserProfile(user.id);
  if (!profile || !profile.onboarding_complete) { router.navigate('/onboarding'); return; }

  const semester = calculateSemester(profile.admission_year);
  const loginHistory = await getLoginHistory(user.id);
  
  // Get upload stats
  const { count: uploadCount } = await supabase.from('uploads').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
  const { count: downloadCount } = await supabase.from('downloads').select('*', { count: 'exact', head: true }).eq('user_id', user.id);

  const initials = (profile.display_name || 'U').charAt(0).toUpperCase();

  app.innerHTML = `
    <div class="app-layout">
      ${renderSidebar(profile)}
      <div class="main-content">
        ${renderHeader(profile)}
        <div class="page-container">
          <!-- Welcome Section -->
          <div class="dashboard-welcome" id="dash-welcome">
            <div class="welcome-left">
              <div class="welcome-avatar-section">
                <div class="avatar-upload-wrapper">
                  ${profile.avatar_url 
                    ? `<img src="${profile.avatar_url}" class="avatar avatar-xl" id="user-avatar" alt="Profile" />`
                    : `<div class="avatar avatar-xl avatar-placeholder" id="user-avatar">${initials}</div>`
                  }
                  <label class="avatar-upload-btn" for="avatar-input" title="Upload Photo">
                    <i class="fa-solid fa-camera"></i>
                  </label>
                  <input type="file" id="avatar-input" accept="image/*" style="display:none;" />
                </div>
              </div>
              <div class="welcome-info">
                <h1>Welcome back, <span class="text-gradient">${profile.display_name}</span>!</h1>
                <p class="welcome-meta">
                  <span><i class="fa-solid fa-school"></i> ${getSchoolFullName(profile.school)}</span>
                  <span><i class="fa-solid fa-graduation-cap"></i> ${profile.degree}</span>
                  <span><i class="fa-solid fa-book-open"></i> ${getSemesterLabel(semester)} Semester</span>
                </p>
              </div>
            </div>
          </div>

          <!-- Stats Grid -->
          <div class="grid-4 dash-stats" id="dash-stats">
            <div class="stat-card card">
              <div class="stat-icon" style="background:rgba(241,196,15,0.1);color:#F1C40F;">
                <i class="fa-solid fa-coins"></i>
              </div>
              <div class="stat-info">
                <span class="stat-value" id="stat-points" style="color:#F1C40F;text-shadow:0 0 10px rgba(241,196,15,0.2);">${profile.points || 0}</span>
                <span class="stat-label">Reward Points</span>
              </div>
            </div>
            <div class="stat-card card">
              <div class="stat-icon" style="background:rgba(0,255,136,0.1);color:var(--success);">
                <i class="fa-solid fa-cloud-arrow-up"></i>
              </div>
              <div class="stat-info">
                <span class="stat-value">${uploadCount || 0}</span>
                <span class="stat-label">Uploads</span>
              </div>
            </div>
            <div class="stat-card card">
              <div class="stat-icon" style="background:rgba(26,188,254,0.1);color:var(--accent);">
                <i class="fa-solid fa-cloud-arrow-down"></i>
              </div>
              <div class="stat-info">
                <span class="stat-value">${downloadCount || 0}</span>
                <span class="stat-label">Downloads</span>
              </div>
            </div>
            <div class="stat-card card">
              <div class="stat-icon" style="background:rgba(var(--primary-rgb),0.1);color:var(--primary);">
                <i class="fa-solid fa-book-open"></i>
              </div>
              <div class="stat-info">
                <span class="stat-value">${getSemesterLabel(semester)}</span>
                <span class="stat-label">Current Semester</span>
              </div>
            </div>
          </div>

          <div class="grid-2" style="margin-top:var(--space-xl);">
            <!-- Login History -->
            <div class="card" id="dash-history">
              <h3 style="margin-bottom:var(--space-lg);"><i class="fa-solid fa-clock-rotate-left"></i> Login History</h3>
              ${loginHistory.length > 0 ? `
                <div class="table-container">
                  <table class="data-table">
                    <thead>
                      <tr><th>Date</th><th>Time</th><th>Day</th></tr>
                    </thead>
                    <tbody>
                      ${loginHistory.map(l => {
                        const d = new Date(l.login_at);
                        return `<tr>
                          <td>${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                          <td>${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</td>
                          <td>${d.toLocaleDateString('en-US', { weekday: 'long' })}</td>
                        </tr>`;
                      }).join('')}
                    </tbody>
                  </table>
                </div>
              ` : '<div class="empty-state"><p>First login! Welcome aboard 🎉</p></div>'}
            </div>

            <!-- Audit Logs Preview -->
            <div class="card" id="dash-audit">
              <h3 style="margin-bottom:var(--space-lg);"><i class="fa-solid fa-list-check"></i> Recent Activity</h3>
              <div id="audit-log-content">
                <div class="skeleton skeleton-card" style="height:200px;"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  initSidebar();
  initHeader(profile);
  setBreadcrumb('Dashboard');
  loadAuditLogs(user.id);

  // Animations
  gsap.fromTo('#dash-welcome', { y: -20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: 'power3.out' });
  gsap.fromTo('.stat-card', { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, stagger: 0.1, delay: 0.2, ease: 'power3.out' });
  gsap.fromTo('#dash-history', { x: -30, opacity: 0 }, { x: 0, opacity: 1, duration: 0.6, delay: 0.5, ease: 'power3.out' });
  gsap.fromTo('#dash-audit', { x: 30, opacity: 0 }, { x: 0, opacity: 1, duration: 0.6, delay: 0.5, ease: 'power3.out' });

  // Avatar upload
  document.getElementById('avatar-input')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    showToast('Uploading avatar...', 'info');
    const fileName = `${user.id}-${Date.now()}.${file.name.split('.').pop()}`;
    
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, { upsert: true });
    
    if (uploadError) {
      showToast('Failed to upload avatar', 'error');
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
    
    await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
    showToast('Avatar updated!', 'success');
    
    const avatarEl = document.getElementById('user-avatar');
    if (avatarEl.tagName === 'IMG') {
      avatarEl.src = publicUrl;
    } else {
      avatarEl.outerHTML = `<img src="${publicUrl}" class="avatar avatar-xl" id="user-avatar" alt="Profile" />`;
    }
  });
}

async function loadAuditLogs(userId) {
  const container = document.getElementById('audit-log-content');
  if (!container) return;

  const { data } = await supabase
    .from('audit_logs')
    .select('*, uploads(title, type, status)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (!data || data.length === 0) {
    container.innerHTML = '<div class="empty-state"><i class="fa-solid fa-clipboard-list"></i><p>No activity yet</p></div>';
    return;
  }

  container.innerHTML = `
    <div class="audit-timeline">
      ${data.map(log => {
        const statusColor = log.action === 'approved' ? 'var(--success)' : log.action === 'rejected' ? 'var(--danger)' : 'var(--warning)';
        const statusIcon = log.action === 'approved' ? 'fa-circle-check' : log.action === 'rejected' ? 'fa-circle-xmark' : 'fa-clock';
        const d = new Date(log.created_at);
        return `
          <div class="audit-item">
            <div class="audit-line" style="background:${statusColor};"></div>
            <div class="audit-dot" style="background:${statusColor};"></div>
            <div class="audit-content">
              <div class="audit-title">
                <i class="fa-solid ${statusIcon}" style="color:${statusColor};"></i>
                <span>${log.uploads?.title || 'Upload'} — ${log.action}</span>
              </div>
              <span class="audit-time">${d.toLocaleDateString()} ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}
