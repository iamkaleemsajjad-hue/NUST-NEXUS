import { getCurrentUser, getUserProfile, getLoginHistory, recordLogin } from '../utils/auth.js';
import { calculateSemester, getSemesterLabel } from '../utils/semester.js';
import { getSchoolFullName } from '../utils/email-parser.js';
import { renderSidebar, initSidebar } from '../components/sidebar.js';
import { renderHeader, initHeader, setBreadcrumb } from '../components/header.js';
import { showToast } from '../components/toast.js';
import { supabase } from '../utils/supabase.js';
import { router } from '../router.js';
import { subscribeToTable } from '../utils/realtime.js';
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
                <h1>Welcome back, <span style="color:var(--primary); font-weight:700;">${profile.display_name}</span>!</h1>
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
              <div class="stat-icon" style="background:rgba(var(--warning-rgb),0.1);color:var(--warning);">
                <i class="fa-solid fa-coins"></i>
              </div>
              <div class="stat-info">
                <span class="stat-value" id="stat-points" style="color:var(--warning);">${profile.points || 0}</span>
                <span class="stat-label">Reward Points</span>
              </div>
            </div>
            <div class="stat-card card">
              <div class="stat-icon" style="background:rgba(var(--success-rgb),0.1);color:var(--success);">
                <i class="fa-solid fa-cloud-arrow-up"></i>
              </div>
              <div class="stat-info">
                <span class="stat-value">${uploadCount || 0}</span>
                <span class="stat-label">Uploads</span>
              </div>
            </div>
            <div class="stat-card card">
              <div class="stat-icon" style="background:rgba(var(--secondary-rgb),0.1);color:var(--secondary);">
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
                      <tr><th>Date</th><th>Login</th><th>Logout</th></tr>
                    </thead>
                    <tbody>
                      ${loginHistory.map(l => {
                        const d = new Date(l.login_at);
                        const lo = l.logout_at ? new Date(l.logout_at) : null;
                        return `<tr>
                          <td>${d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</td>
                          <td>${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</td>
                          <td>${lo ? lo.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '<span class="badge badge-success" style="font-size:0.65rem;">Active</span>'}</td>
                        </tr>`;
                      }).join('')}
                    </tbody>
                  </table>
                </div>
              ` : '<div class="empty-state"><p>First login! Welcome aboard 🎉</p></div>'}
            </div>

            <!-- Recent Uploads -->
            <div class="card" id="dash-uploads">
              <h3 style="margin-bottom:var(--space-lg);"><i class="fa-solid fa-cloud-arrow-up"></i> Your Recent Uploads</h3>
              <div id="recent-uploads-content">
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
  loadRecentUploads(user.id);

  // Animations - enhanced with text reveals
  gsap.fromTo('#dash-welcome', { y: -20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: 'power3.out' });
  
  // Text typing animation for welcome heading
  const welcomeH2 = document.querySelector('#dash-welcome h2');
  if (welcomeH2) {
    const text = welcomeH2.textContent;
    welcomeH2.textContent = '';
    welcomeH2.style.borderRight = '2px solid var(--primary)';
    let i = 0;
    const typeInterval = setInterval(() => {
      welcomeH2.textContent += text[i];
      i++;
      if (i >= text.length) {
        clearInterval(typeInterval);
        setTimeout(() => { welcomeH2.style.borderRight = 'none'; }, 600);
      }
    }, 30);
  }

  gsap.fromTo('.stat-card', { y: 30, opacity: 0, scale: 0.9 }, { y: 0, opacity: 1, scale: 1, duration: 0.5, stagger: 0.1, delay: 0.3, ease: 'back.out(1.4)' });
  
  // Animate stat numbers counting up
  document.querySelectorAll('.stat-value').forEach(el => {
    const target = parseInt(el.textContent) || 0;
    if (target > 0) {
      el.textContent = '0';
      gsap.to({ val: 0 }, { val: target, duration: 1.2, delay: 0.5, ease: 'power2.out', onUpdate: function() { el.textContent = Math.round(this.targets()[0].val); }});
    }
  });

  gsap.fromTo('#dash-history', { x: -30, opacity: 0 }, { x: 0, opacity: 1, duration: 0.6, delay: 0.5, ease: 'power3.out' });
  gsap.fromTo('#dash-uploads', { x: 30, opacity: 0 }, { x: 0, opacity: 1, duration: 0.6, delay: 0.5, ease: 'power3.out' });
  
  // Add hover lift effect to all cards
  document.querySelectorAll('.stat-card, .card').forEach(card => {
    card.addEventListener('mouseenter', () => gsap.to(card, { y: -4, boxShadow: '0 8px 24px rgba(0,0,0,0.3)', duration: 0.25, ease: 'power2.out' }));
    card.addEventListener('mouseleave', () => gsap.to(card, { y: 0, boxShadow: '', duration: 0.25, ease: 'power2.out' }));
  });

  // Real-time: auto-refresh when user's uploads change status
  subscribeToTable('dashboard-my-uploads', 'uploads', `user_id=eq.${user.id}`, () => {
    loadRecentUploads(user.id);
  });

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

async function loadRecentUploads(userId) {
  const container = document.getElementById('recent-uploads-content');
  if (!container) return;

  const { data } = await supabase
    .from('uploads')
    .select('*, courses(name, code)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(8);

  if (!data || data.length === 0) {
    container.innerHTML = '<div class="empty-state"><i class="fa-solid fa-cloud-arrow-up"></i><p>No uploads yet. Start sharing!</p></div>';
    return;
  }

  const statusStyles = {
    pending: { color: 'var(--warning)', bg: 'rgba(var(--warning-rgb),0.1)', icon: 'fa-clock', label: 'Pending' },
    approved: { color: 'var(--success)', bg: 'rgba(var(--success-rgb),0.1)', icon: 'fa-circle-check', label: 'Approved' },
    rejected: { color: 'var(--danger)', bg: 'rgba(var(--danger-rgb),0.1)', icon: 'fa-circle-xmark', label: 'Rejected' },
  };

  container.innerHTML = data.map(u => {
    const s = statusStyles[u.status] || statusStyles.pending;
    return `
      <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border);">
        <div style="width:4px;height:36px;border-radius:2px;background:${s.color};"></div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:500;font-size:0.875rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${u.title}</div>
          <div style="font-size:0.75rem;color:var(--text-muted);">${u.courses?.code || u.type} · ${new Date(u.created_at).toLocaleDateString()}</div>
        </div>
        <span class="badge" style="background:${s.bg};color:${s.color};font-size:0.7rem;">
          <i class="fa-solid ${s.icon}"></i> ${s.label}
        </span>
      </div>
    `;
  }).join('');
}

