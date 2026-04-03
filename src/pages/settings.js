import { getCurrentUser, getUserProfile, updateProfile, updatePassword } from '../utils/auth.js';
import { validatePassword, getPasswordStrength } from '../utils/validators.js';
import { renderSidebar, initSidebar } from '../components/sidebar.js';
import { renderHeader, initHeader, setBreadcrumb } from '../components/header.js';
import { showToast } from '../components/toast.js';
import { router } from '../router.js';
import gsap from 'gsap';

export async function renderSettingsPage() {
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
          <h2 style="margin-bottom:var(--space-xl);"><i class="fa-solid fa-gear"></i> Settings</h2>
          
          <div class="grid-2">
            <!-- Change Name -->
            <div class="card" id="name-card">
              <h3 style="margin-bottom:var(--space-lg);"><i class="fa-solid fa-user-pen"></i> Change Name</h3>
              <form id="name-form">
                <div class="form-group">
                  <label class="form-label">Display Name</label>
                  <input type="text" class="form-input" id="settings-name" value="${profile.display_name}" required />
                </div>
                <button type="submit" class="btn btn-primary">
                  <i class="fa-solid fa-check"></i> Update Name
                </button>
              </form>
            </div>

            <!-- Change Password -->
            <div class="card" id="pw-card">
              <h3 style="margin-bottom:var(--space-lg);"><i class="fa-solid fa-key"></i> Reset Password</h3>
              <form id="password-form">
                <div class="form-group">
                  <label class="form-label">New Password</label>
                  <input type="password" class="form-input" id="settings-new-pw" placeholder="New password" required />
                  <div class="password-strength" id="settings-pw-strength" data-strength="0">
                    <div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div>
                  </div>
                </div>
                <div class="form-group">
                  <label class="form-label">Confirm Password</label>
                  <input type="password" class="form-input" id="settings-confirm-pw" placeholder="Confirm password" required />
                </div>
                <button type="submit" class="btn btn-primary">
                  <i class="fa-solid fa-key"></i> Update Password
                </button>
              </form>
            </div>
          </div>

          <!-- Profile Info (Read-only) -->
          <div class="card" style="margin-top:var(--space-xl);" id="info-card">
            <h3 style="margin-bottom:var(--space-lg);"><i class="fa-solid fa-id-card"></i> Your Profile</h3>
            <div class="grid-3">
              <div><span class="form-label">Email</span><p>${profile.email}</p></div>
              <div><span class="form-label">School</span><p>${profile.school}</p></div>
              <div><span class="form-label">Degree</span><p>${profile.degree}</p></div>
              <div><span class="form-label">Admission Year</span><p>${profile.admission_year || 'N/A'}</p></div>
              <div><span class="form-label">Points</span><p>${profile.points}</p></div>
              <div><span class="form-label">Joined</span><p>${new Date(profile.created_at).toLocaleDateString()}</p></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  initSidebar();
  initHeader(profile);
  setBreadcrumb('Settings');

  gsap.fromTo('#name-card', { x: -30, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, ease: 'power3.out' });
  gsap.fromTo('#pw-card', { x: 30, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, ease: 'power3.out' });
  gsap.fromTo('#info-card', { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, delay: 0.2, ease: 'power3.out' });

  // Name update
  document.getElementById('name-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('settings-name').value.trim();
    if (!name) { showToast('Name cannot be empty', 'warning'); return; }
    
    const { error } = await updateProfile(user.id, { display_name: name });
    if (error) showToast('Failed to update name', 'error');
    else showToast('Name updated successfully!', 'success');
  });

  // Password strength
  document.getElementById('settings-new-pw')?.addEventListener('input', (e) => {
    const strength = getPasswordStrength(e.target.value);
    document.getElementById('settings-pw-strength').setAttribute('data-strength', strength);
  });

  // Password update
  document.getElementById('password-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newPw = document.getElementById('settings-new-pw').value;
    const confirmPw = document.getElementById('settings-confirm-pw').value;

    const { isValid, errors } = validatePassword(newPw);
    if (!isValid) { showToast(errors[0], 'error'); return; }
    if (newPw !== confirmPw) { showToast('Passwords do not match', 'error'); return; }

    const { error } = await updatePassword(newPw);
    if (error) showToast('Failed to update password: ' + error.message, 'error');
    else {
      showToast('Password updated!', 'success');
      document.getElementById('settings-new-pw').value = '';
      document.getElementById('settings-confirm-pw').value = '';
    }
  });
}
