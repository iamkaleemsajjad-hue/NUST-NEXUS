import { getCurrentUser, getUserProfile, updateProfile, updatePassword } from '../utils/auth.js';
import { supabase } from '../utils/supabase.js';
import { validatePassword, getPasswordStrength } from '../utils/validators.js';
import { renderSidebar, initSidebar } from '../components/sidebar.js';
import { renderHeader, initHeader, setBreadcrumb } from '../components/header.js';
import { showToast } from '../components/toast.js';
import { router } from '../router.js';
import { sanitizeText, checkRateLimit } from '../utils/sanitize.js';
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

          <!-- Account Deletion -->
          <div class="card" style="margin-top:var(--space-xl); border: 1px solid var(--danger); background: rgba(255,0,0,0.02);" id="deletion-card">
            <h3 style="margin-bottom:var(--space-md); color:var(--danger);"><i class="fa-solid fa-triangle-exclamation"></i> Danger Zone</h3>
            ${profile.deletion_requested_at ? `
              <div class="alert alert-warning" style="margin-bottom: var(--space-md);">
                <strong>Deletion Requested</strong><br/>
                You requested account deletion on ${new Date(profile.deletion_requested_at).toLocaleString()}.
                Your profile, uploads, and data will be permanently purged after 14 days.
              </div>
              <button class="btn btn-secondary" id="btn-cancel-deletion">
                <i class="fa-solid fa-rotate-left"></i> Cancel Deletion Request
              </button>
            ` : `
              <p style="color:var(--text-secondary); margin-bottom:var(--space-lg);">
                Permanently delete your SCHOLAR NEXUS account and remove all your data (questions, answers, uploads).
                <strong>Once requested, you enter a 14-day grace period. After 14 days, your data is irrevocably deleted.</strong>
              </p>
              <button class="btn btn-danger" id="btn-request-deletion">
                <i class="fa-solid fa-trash"></i> Request Permanent Deletion
              </button>
            `}
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
    // ── OWASP: Rate limit name updates — max 10 per hour ──
    const rl = checkRateLimit('name_update', 10, 3600000);
    if (!rl.allowed) { showToast('Too many updates. Please wait.', 'error'); return; }
    const name = sanitizeText(document.getElementById('settings-name').value, 120);
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
    // ── OWASP: Rate limit password changes — max 5 per hour ──
    const rl = checkRateLimit('password_change', 5, 3600000);
    if (!rl.allowed) { showToast('Too many attempts. Please wait.', 'error'); return; }
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

  // Account Deletion Logic
  document.getElementById('btn-request-deletion')?.addEventListener('click', async () => {
    if (!confirm('Are you absolutely sure you want to delete your account? This will permanently erase your data after 14 days.')) return;
    const { error } = await supabase.from('profiles').update({
      deletion_requested_at: new Date().toISOString()
    }).eq('id', user.id);
    if (error) {
      showToast('Failed to request deletion.', 'error');
    } else {
      showToast('Account deletion requested.', 'success');
      renderSettingsPage(); // refresh
    }
  });

  document.getElementById('btn-cancel-deletion')?.addEventListener('click', async () => {
    if (!confirm('Cancel your account deletion request? Your data will be kept safe.')) return;
    const { error } = await supabase.from('profiles').update({
      deletion_requested_at: null
    }).eq('id', user.id);
    if (error) {
      showToast('Failed to cancel deletion.', 'error');
    } else {
      showToast('Account deletion cancelled.', 'success');
      renderSettingsPage(); // refresh
    }
  });
}
