import { getCurrentUser, getUserProfile, completeOnboarding } from '../utils/auth.js';
import { parseNustEmail } from '../utils/email-parser.js';
import { validatePassword, getPasswordStrength } from '../utils/validators.js';
import { calculateSemester, getSemesterLabel } from '../utils/semester.js';
import { showToast } from '../components/toast.js';
import { router } from '../router.js';
import { sanitizeText } from '../utils/sanitize.js';
import gsap from 'gsap';

export async function renderOnboardingPage() {
  const app = document.getElementById('app');
  const user = await getCurrentUser();
  
  if (!user) {
    router.navigate('/login');
    return;
  }

  const parsed = parseNustEmail(user.email);
  const semester = calculateSemester(parsed.year);

  app.innerHTML = `
    <div class="onboarding-page">
      <div class="onboarding-container">
        <div class="onboarding-card card-glass" id="onboarding-card">
          <div class="onboarding-header">
            <img src="/logo.png" alt="NUST NEXUS" class="onboarding-logo" />
            <h2>Welcome to <span class="text-gradient">NUST NEXUS</span></h2>
            <p>Let's set up your profile</p>
          </div>

          <div class="onboarding-info">
            <div class="info-grid">
              <div class="info-item">
                <i class="fa-solid fa-school"></i>
                <span class="info-label">School</span>
                <span class="info-value">${parsed.school}</span>
              </div>
              <div class="info-item">
                <i class="fa-solid fa-graduation-cap"></i>
                <span class="info-label">Degree</span>
                <span class="info-value">${parsed.degree}</span>
              </div>
              <div class="info-item">
                <i class="fa-solid fa-calendar"></i>
                <span class="info-label">Admission Year</span>
                <span class="info-value">${parsed.year || 'N/A'}</span>
              </div>
              <div class="info-item">
                <i class="fa-solid fa-book-open"></i>
                <span class="info-label">Current Semester</span>
                <span class="info-value">${getSemesterLabel(semester)}</span>
              </div>
            </div>
          </div>

          <form id="onboarding-form">
            <div class="form-group">
              <label class="form-label">Display Name</label>
              <input type="text" class="form-input" id="ob-name" 
                value="${parsed.name}" placeholder="Your display name" required />
            </div>
            
            <div class="form-group">
              <label class="form-label">Set Password</label>
              <div class="input-with-icon">
                <i class="fa-solid fa-lock"></i>
                <input type="password" class="form-input" id="ob-password" 
                  placeholder="Create a strong password" required />
                <button type="button" class="password-toggle" id="toggle-ob-pw">
                  <i class="fa-solid fa-eye"></i>
                </button>
              </div>
              <div class="password-strength" id="pw-strength" data-strength="0">
                <div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div>
              </div>
              <div class="password-rules" id="pw-rules">
                <div class="rule" id="rule-length"><i class="fa-solid fa-circle"></i> At least 8 characters</div>
                <div class="rule" id="rule-upper"><i class="fa-solid fa-circle"></i> At least 1 uppercase letter</div>
                <div class="rule" id="rule-special"><i class="fa-solid fa-circle"></i> At least 1 special character</div>
                <div class="rule" id="rule-space"><i class="fa-solid fa-circle"></i> No spaces</div>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Confirm Password</label>
              <div class="input-with-icon">
                <i class="fa-solid fa-lock"></i>
                <input type="password" class="form-input" id="ob-confirm-password" 
                  placeholder="Confirm your password" required />
              </div>
            </div>

            <div class="terms-section">
              <label class="checkbox-label">
                <input type="checkbox" id="ob-terms" required />
                <span class="checkmark"></span>
                <span>I accept the <a href="#" id="terms-link">Terms & Conditions</a></span>
              </label>
            </div>

            <button type="submit" class="btn btn-primary btn-block btn-lg" id="ob-submit">
              <span>Complete Setup</span>
              <i class="fa-solid fa-rocket"></i>
            </button>
          </form>
        </div>
      </div>
    </div>
  `;

  initOnboarding(user, parsed);
}

function initOnboarding(user, parsed) {
  gsap.fromTo('#onboarding-card', { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out' });

  // Password strength indicator
  const pwInput = document.getElementById('ob-password');
  pwInput.addEventListener('input', () => {
    const pw = pwInput.value;
    const strength = getPasswordStrength(pw);
    document.getElementById('pw-strength').setAttribute('data-strength', strength);
    
    // Update rules
    updateRule('rule-length', pw.length >= 8);
    updateRule('rule-upper', /[A-Z]/.test(pw));
    updateRule('rule-special', /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pw));
    updateRule('rule-space', !/\s/.test(pw));
  });

  // Password visibility
  document.getElementById('toggle-ob-pw')?.addEventListener('click', () => {
    const pw = document.getElementById('ob-password');
    const icon = document.querySelector('#toggle-ob-pw i');
    pw.type = pw.type === 'password' ? 'text' : 'password';
    icon.className = pw.type === 'password' ? 'fa-solid fa-eye' : 'fa-solid fa-eye-slash';
  });

  // Terms link
  document.getElementById('terms-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    showTermsModal();
  });

  // Form submit
  document.getElementById('onboarding-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = sanitizeText(document.getElementById('ob-name').value, 120);
    const password = document.getElementById('ob-password').value;
    const confirmPw = document.getElementById('ob-confirm-password').value;
    const terms = document.getElementById('ob-terms').checked;
    const btn = document.getElementById('ob-submit');

    if (!name) { showToast('Please enter your name', 'warning'); return; }
    
    const { isValid, errors } = validatePassword(password);
    if (!isValid) { showToast(errors[0], 'error'); return; }
    if (password !== confirmPw) { showToast('Passwords do not match', 'error'); return; }
    if (!terms) { showToast('Please accept the Terms & Conditions', 'warning'); return; }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Setting up...';

    const { error } = await completeOnboarding(user.id, user.email, name, password);
    
    if (error) {
      showToast(error.message || 'Setup failed', 'error');
      btn.disabled = false;
      btn.innerHTML = '<span>Complete Setup</span><i class="fa-solid fa-rocket"></i>';
      return;
    }

    showToast('Profile setup complete! Welcome to NUST NEXUS!', 'success');
    router.navigate('/dashboard');
  });
}

function updateRule(ruleId, passed) {
  const el = document.getElementById(ruleId);
  if (!el) return;
  const icon = el.querySelector('i');
  if (passed) {
    el.style.color = 'var(--success)';
    icon.className = 'fa-solid fa-circle-check';
  } else {
    el.style.color = 'var(--text-muted)';
    icon.className = 'fa-solid fa-circle';
  }
}

function showTermsModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content" style="max-width:640px;">
      <div class="modal-header">
        <h3>Terms & Conditions</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
      <div class="modal-body" style="max-height:400px;overflow-y:auto;">
        <h4>NUST NEXUS Usage Agreement</h4>
        <br/>
        <p><strong>1. Content Responsibility</strong></p>
        <p>By uploading any academic content (lab reports, assignments, quizzes, etc.), you agree to remove your personal information including your name and CMS ID from all uploaded documents. We are not responsible if your identity is revealed through uploaded content.</p>
        <br/>
        <p><strong>2. Academic Integrity</strong></p>
        <p>The resources shared on NUST NEXUS are for reference purposes only. You are responsible for ensuring your use of these materials complies with your institution's academic integrity policies. The quizzes and assessments are your responsibility — we are not liable for any consequences arising from their use.</p>
        <br/>
        <p><strong>3. Original Content</strong></p>
        <p>You must only upload content that you have the right to share. Duplicate content will be automatically detected and rejected.</p>
        <br/>
        <p><strong>4. Points System</strong></p>
        <p>Points are earned through contributions and spent on downloads. Points have no monetary value and cannot be transferred.</p>
        <br/>
        <p><strong>5. Privacy</strong></p>
        <p>Your email and profile information are used solely for platform functionality. We do not share your data with third parties.</p>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}
