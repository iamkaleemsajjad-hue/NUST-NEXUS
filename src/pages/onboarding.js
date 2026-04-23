import { getCurrentUser, getUserProfile, completeOnboarding } from '../utils/auth.js';
import { parseNustEmail } from '../utils/email-parser.js';
import { getLogoSVG } from '../components/logo.js';
import { validatePassword, getPasswordStrength } from '../utils/validators.js';
import { calculateSemester, getSemesterLabel } from '../utils/semester.js';
import { showToast } from '../components/toast.js';
import { router } from '../router.js';
import { sanitizeText, checkRateLimit } from '../utils/sanitize.js';
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
        <div class="onboarding-card" id="onboarding-card" style="background: var(--bg-deep); color: var(--text-primary); box-shadow: var(--shadow-lg);">
          <div class="onboarding-header">
            ${getLogoSVG('onboarding-logo', '140', '140')}
            <h2 style="color: var(--text-primary); margin-top: 15px;">Welcome to <span class="text-gradient">SCHOLAR NEXUS</span></h2>
            <p style="color: var(--text-secondary);">Let's set up your profile</p>
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

    // ── OWASP: Rate limit onboarding — max 10 per 3 minutes ──
    const rl = checkRateLimit('onboarding', 10, 180000);
    if (!rl.allowed) { showToast('Too many attempts. Please wait 3 minutes.', 'error'); return; }

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

    showToast('Profile setup complete! Welcome to SCHOLAR NEXUS!', 'success');
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
    <div class="modal-content" style="max-width:680px;">
      <div class="modal-header">
        <h3>Terms & Conditions</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
      <div class="modal-body" style="max-height:450px;overflow-y:auto;line-height:1.7;">
        <h4>🎓 SCHOLAR NEXUS Usage Agreement</h4>
        <p style="color:var(--text-muted);font-size:0.8rem;margin-bottom:16px;">Last updated: April 2026</p>
        <hr style="border:0;border-top:1px solid var(--border);margin:16px 0;" />

        <p><strong>⚠️ DISCLAIMER</strong></p>
        <p>SCHOLAR NEXUS is an independent platform. It is <strong>not affiliated with, endorsed by, sponsored by, or connected to any university, educational institution, or government body</strong> in any way.</p>
        <hr style="border:0;border-top:1px solid var(--border);margin:16px 0;" />

        <p><strong>1. User-Generated Content — User Responsibility</strong></p>
        <p>SCHOLAR NEXUS operates as a user-driven platform. All materials (including notes, assignments, quizzes, and academic resources) are uploaded by users.</p>
        <p>By uploading content, you confirm that:</p>
        <ul style="margin-left:20px;margin-top:6px;margin-bottom:12px;">
          <li>You are the original creator or have the legal right to share the material</li>
          <li>The content is your own work or you have proper authorization to distribute it</li>
          <li>The content does not violate any institutional policies, copyright laws, or confidentiality obligations</li>
          <li>You have removed all personal identifiers (such as name, student ID, or roll number)</li>
        </ul>
        <p>SCHOLAR NEXUS does not claim ownership of user-submitted content and does not guarantee its accuracy, legality, or authenticity.</p>
        <hr style="border:0;border-top:1px solid var(--border);margin:16px 0;" />

        <p><strong>2. Academic Integrity & Intended Use</strong></p>
        <p>This platform is intended strictly for <strong>learning support and reference purposes</strong>.</p>
        <p>By using this platform, you agree:</p>
        <ul style="margin-left:20px;margin-top:6px;margin-bottom:12px;">
          <li>Not to engage in cheating, plagiarism, or academic misconduct</li>
          <li>To comply with your institution’s academic integrity policies</li>
          <li>To use all materials responsibly as study aids only</li>
        </ul>
        <p>SCHOLAR NEXUS is not responsible for how users utilize the content.</p>
        <hr style="border:0;border-top:1px solid var(--border);margin:16px 0;" />

        <p><strong>3. Prohibited Content 🚫</strong></p>
        <p>Users must not upload:</p>
        <ul style="margin-left:20px;margin-top:6px;margin-bottom:12px;">
          <li>Official examination papers or confidential institutional documents</li>
          <li>Restricted or unpublished academic materials</li>
          <li>Copyrighted content without proper authorization</li>
          <li>Any material that violates institutional rules or applicable laws</li>
          <li>Any content you do not have the legal right to share</li>
        </ul>
        <p>Only self-created notes, personal study materials, and authorized content are permitted.</p>
        <p style="color:var(--warning);"><strong>⚠️ Users who upload prohibited content do so at their own risk and are solely responsible for any resulting consequences.</strong></p>
        <hr style="border:0;border-top:1px solid var(--border);margin:16px 0;" />

        <p><strong>4. Limitation of Liability</strong></p>
        <p>SCHOLAR NEXUS functions solely as an intermediary for user-generated content.</p>
        <ul style="margin-left:20px;margin-top:6px;margin-bottom:12px;">
          <li>We do not actively monitor or verify all uploads</li>
          <li>We do not endorse any content shared by users</li>
          <li>We make no guarantees regarding the accuracy, completeness, or reliability of content</li>
        </ul>
        <p>To the fullest extent permitted by law, SCHOLAR NEXUS shall not be liable for any direct, indirect, incidental, or consequential damages arising from:</p>
        <ul style="margin-left:20px;margin-top:6px;margin-bottom:12px;">
          <li>User-submitted content</li>
          <li>Use or misuse of platform resources</li>
          <li>Academic or institutional actions taken against users</li>
        </ul>
        <p>All responsibility for uploaded material remains with the user.</p>
        <hr style="border:0;border-top:1px solid var(--border);margin:16px 0;" />

        <p><strong>5. Reporting & Content Removal Policy</strong></p>
        <p>SCHOLAR NEXUS provides a reporting system that allows users to flag content that may:</p>
        <ul style="margin-left:20px;margin-top:6px;margin-bottom:12px;">
          <li>Violate these Terms</li>
          <li>Infringe copyright or institutional policies</li>
          <li>Be inaccurate, misleading, or inappropriate</li>
        </ul>
        <p>By submitting a report, users agree to provide accurate information.</p>
        <p>Upon review, SCHOLAR NEXUS may:</p>
        <ul style="margin-left:20px;margin-top:6px;margin-bottom:12px;">
          <li>Remove or restrict access to content</li>
          <li>Issue warnings or take action against user accounts</li>
          <li>Suspend or permanently terminate accounts involved in violations</li>
        </ul>
        <p>We reserve the right to act on reports at our discretion and to comply with valid legal or institutional requests.</p>
        <hr style="border:0;border-top:1px solid var(--border);margin:16px 0;" />

        <p><strong>6. Points System</strong></p>
        <p>Points are earned through contributions and used to access resources.</p>
        <p>Points hold no monetary value and are non-transferable and non-refundable.</p>
        <hr style="border:0;border-top:1px solid var(--border);margin:16px 0;" />

        <p><strong>7. Privacy</strong></p>
        <p>User data (including email and profile information) is used solely for platform functionality.</p>
        <p>We do not sell or share personal data with third parties.</p>
        <hr style="border:0;border-top:1px solid var(--border);margin:16px 0;" />

        <p><strong>8. No Institutional Affiliation</strong></p>
        <p>SCHOLAR NEXUS is an independent platform with no affiliation to any institution.</p>
        <p>All content is submitted by users, and responsibility for such content lies entirely with the individual who uploaded it.</p>
        <hr style="border:0;border-top:1px solid var(--border);margin:16px 0;" />

        <p><strong>9. Acceptance of Terms</strong></p>
        <p>By accessing or using SCHOLAR NEXUS, you confirm that you have read, understood, and agreed to these Terms & Conditions.</p>
        <p>If you do not agree, you must discontinue use of the platform.</p>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}
