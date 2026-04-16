import { supabase } from '../utils/supabase.js';
import { showToast } from '../components/toast.js';
import { router } from '../router.js';
import gsap from 'gsap';
import { getLogoSVG } from '../components/logo.js';
import { validatePassword } from '../utils/validators.js';
import { sanitizeText, validateFields, sanitizeEmail, checkRateLimit, pickAllowedFields } from '../utils/sanitize.js';

export async function renderLoginPage() {
  const app = document.getElementById('app');

  app.innerHTML = `
    <div class="login-split-container">
      <!-- Left Side Logo Display -->
      <div class="login-left">
        <div class="login-hero-logo logo-3d-spin">
          ${getLogoSVG('hero-logo-svg', '180', '180', true)}
        </div>
        <h1 class="login-hero-title">NEVIN NEXUS</h1>
        <p class="login-hero-tagline">Innovating the Future</p>
        <div class="hero-features">
          <div class="hero-feature"><i class="fa-solid fa-cloud-arrow-up"></i> Share Resources</div>
          <div class="hero-feature"><i class="fa-solid fa-user-graduate"></i> Academic Hub</div>
          <div class="hero-feature"><i class="fa-solid fa-users-viewfinder"></i> Collaborate</div>
        </div>
      </div>

      <!-- Right Side Form -->
      <div class="login-right">
        <div class="card login-card" id="login-box" style="box-shadow: none; background: transparent; border: none; padding: 0;">
          <div class="login-header-wrapper" style="align-items: flex-start;">
            <div class="login-form-header">
              <h2 id="form-title">Welcome Back</h2>
              <p class="login-form-subtitle" id="form-subtitle">Sign in to your account to continue</p>
            </div>
          </div>

          <!-- Tabs -->
          <div class="login-tabs">
            <button class="login-tab active" data-tab="signin" id="tab-signin">Sign In</button>
            <button class="login-tab" data-tab="signup" id="tab-signup">Sign Up</button>
          </div>

          <!-- Sign In Form -->
          <form id="signin-form" class="login-form-body">
            <div class="form-group">
              <label class="form-label">Email Address</label>
              <div class="input-with-icon">
                <i class="fa-solid fa-envelope"></i>
                <input type="email" class="form-input" id="signin-email" placeholder="your.email@university.edu.pk" required />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Password</label>
              <div class="input-with-icon">
                <i class="fa-solid fa-lock"></i>
                <input type="password" class="form-input" id="signin-password" placeholder="Enter your password" required />
                <button type="button" class="password-toggle" id="signin-toggle">
                  <i class="fa-solid fa-eye"></i>
                </button>
              </div>
            </div>
            <button type="submit" class="btn btn-primary btn-block btn-lg" id="signin-btn">
              <i class="fa-solid fa-right-to-bracket"></i> Sign In
            </button>

            <div style="text-align:center;margin-top:var(--space-md);">
              <a href="javascript:void(0)" id="forgot-password-link" style="color:var(--text-secondary);font-size:0.8125rem;text-decoration:underline;cursor:pointer;">
                <i class="fa-solid fa-key" style="margin-right:4px;"></i>Forgot password? Sign up again &amp; reset in Settings
              </a>
            </div>

            <!-- Feedback Button inside the card -->
            <div class="login-inline-feedback text-center">
              <button type="button" class="btn btn-ghost btn-block" id="public-feedback-btn">
                <i class="fa-solid fa-comment-dots"></i> Send Feedback
              </button>
            </div>
          </form>

          <!-- Sign Up Form (hidden by default) -->
          <form id="signup-form" class="login-form-body" style="display:none;">
            <div class="form-group">
              <label class="form-label">Email Address</label>
              <div class="input-with-icon">
                <i class="fa-solid fa-envelope"></i>
                <input type="email" class="form-input" id="signup-email" placeholder="your.email@university.edu.pk" required />
              </div>
              <span class="form-helper">Use your university email (@student.university.edu, @alumni.university.edu, etc.)</span>
            </div>

            <button type="submit" class="btn btn-primary btn-block btn-lg" id="signup-btn">
              <i class="fa-solid fa-user-plus"></i> Create Account
            </button>
          </form>

          <!-- OTP Verification (hidden) -->
          <div id="otp-section" style="display:none;" class="login-form-body">
            <div class="otp-header text-center">
              <div class="otp-icon"><i class="fa-solid fa-shield-halved"></i></div>
              <h3>Verify Your Email</h3>
              <p style="color:var(--text-secondary);margin-top:8px;">Enter the 8-digit code sent to your email</p>
            </div>
            <div class="otp-inputs" id="otp-inputs">
              <input type="text" maxlength="1" class="otp-digit" data-index="0" />
              <input type="text" maxlength="1" class="otp-digit" data-index="1" />
              <input type="text" maxlength="1" class="otp-digit" data-index="2" />
              <input type="text" maxlength="1" class="otp-digit" data-index="3" />
              <input type="text" maxlength="1" class="otp-digit" data-index="4" />
              <input type="text" maxlength="1" class="otp-digit" data-index="5" />
              <input type="text" maxlength="1" class="otp-digit" data-index="6" />
              <input type="text" maxlength="1" class="otp-digit" data-index="7" />
            </div>
            <button class="btn btn-primary btn-block" id="verify-otp-btn" style="margin-top:var(--space-xl);">
              <i class="fa-solid fa-check-circle"></i> Verify
            </button>
            <p style="text-align:center;margin-top:var(--space-md);">
              <button class="btn btn-ghost" id="resend-otp-btn">Resend Code</button>
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Feedback Modal -->
    <div class="modal-overlay" id="feedback-modal" style="display:none;">
      <div class="modal-content" style="max-width:500px;">
        <div class="modal-header">
          <h3><i class="fa-solid fa-comment-dots"></i> Public Feedback</h3>
          <button class="modal-close" id="close-feedback-modal">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div class="modal-body">
          <p style="color:var(--text-secondary);margin-bottom:var(--space-lg);">Share your thoughts — no account needed.</p>
          <form id="feedback-form">
            <div class="form-group">
              <label class="form-label">Your Name (optional)</label>
              <input type="text" class="form-input" id="feedback-name" placeholder="Anonymous" />
            </div>
            <div class="form-group">
              <label class="form-label">Message *</label>
              <textarea class="form-textarea" id="feedback-message" placeholder="What would you like us to know?" required></textarea>
            </div>
            <button type="submit" class="btn btn-primary btn-block">
              <i class="fa-solid fa-paper-plane"></i> Submit Feedback
            </button>
          </form>
        </div>
      </div>
    </div>
  `;

  initLoginEvents();

  // GSAP Entry Animations
  gsap.fromTo(".login-left", 
    { opacity: 0, x: -30 },
    { opacity: 1, x: 0, duration: 0.8, ease: "power3.out" }
  );
  gsap.fromTo(".login-right",
    { opacity: 0, x: 30 },
    { opacity: 1, x: 0, duration: 0.8, ease: "power3.out" }
  );
  gsap.fromTo(".login-hero-logo",
    { opacity: 0, scale: 0.8 },
    { opacity: 1, scale: 1, duration: 0.6, delay: 0.2, ease: "back.out(1.5)" }
  );
  gsap.fromTo(".hero-feature", 
    { opacity: 0, y: 15 },
    { opacity: 1, y: 0, duration: 0.4, stagger: 0.1, delay: 0.4 }
  );
}

function initLoginEvents() {
  // Tab switching
  const tabSignin = document.getElementById('tab-signin');
  const tabSignup = document.getElementById('tab-signup');
  const signinForm = document.getElementById('signin-form');
  const signupForm = document.getElementById('signup-form');
  const otpSection = document.getElementById('otp-section');
  const formHeader = document.querySelector('.login-form-header');

  tabSignin?.addEventListener('click', () => {
    tabSignin.classList.add('active');
    tabSignup.classList.remove('active');
    signinForm.style.display = 'block';
    signupForm.style.display = 'none';
    otpSection.style.display = 'none';
    formHeader.querySelector('h2').textContent = 'Welcome Back';
    formHeader.querySelector('p').textContent = 'Sign in to your account to continue';
  });

  tabSignup?.addEventListener('click', () => {
    tabSignup.classList.add('active');
    tabSignin.classList.remove('active');
    signupForm.style.display = 'block';
    signinForm.style.display = 'none';
    otpSection.style.display = 'none';
    formHeader.querySelector('h2').textContent = 'Create Account';
    formHeader.querySelector('p').textContent = 'Join the NEVIN NEXUS community';
  });

  // Forgot password → switch to sign up tab
  document.getElementById('forgot-password-link')?.addEventListener('click', () => {
    tabSignup?.click();
    showToast('Sign up again , then reset your password in Settings !', 'info');
  });

  // Password toggles
  setupPasswordToggle('signin-toggle', 'signin-password');

  // Sign In
  document.getElementById('signin-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const { valid: emailOk, email } = sanitizeEmail(document.getElementById('signin-email').value);
    const password = document.getElementById('signin-password').value;
    const btn = document.getElementById('signin-btn');

    if (!emailOk) {
      showToast('Enter a valid email address', 'error');
      return;
    }

    const rl = checkRateLimit('signin', 12, 900000);
    if (!rl.allowed) {
      showToast('Too many sign-in attempts. Please wait before trying again.', 'error');
      return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Signing in...';

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      showToast(error.message, 'error');
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Sign In';
    }
    // Auth state change in main.js handles redirect
  });

  // Sign Up
  let pendingEmail = '';
  document.getElementById('signup-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const emailRaw = document.getElementById('signup-email').value;
    const btn = document.getElementById('signup-btn');

    const { valid: emailOk, email } = sanitizeEmail(emailRaw);
    if (!emailOk) {
      showToast('Enter a valid university email address', 'error');
      return;
    }

    if (!email.endsWith('.edu.pk')) {
      showToast('invalid email ! Use your university email ! ', 'error');
      return;
    }

    const rl = checkRateLimit('signup', 3, 300000); // Max 3 signups per 5 mins
    
    if (!rl.allowed) {
      showToast(`Too many attempts. Please wait ${Math.ceil(rl.remainingMs/60000)} minutes`, 'error');
      return;
    }



    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Creating account...';

    // Pre-flight ban check via RPC (bypasses RLS issues for anon callers)
    const { data: isBanned, error: rpcErr } = await supabase.rpc('is_email_banned', { p_email: email });

    if (rpcErr) {
      console.error('Ban check error:', rpcErr);
      // Fallback: don't block if RPC fails due to connectivity, but log it
    } else if (isBanned) {
      showToast('This email has been banned from NEVIN NEXUS. Registration is blocked.', 'error');
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Create Account';
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email: email,
      options: {
        shouldCreateUser: true
      }
    });

    if (error) {
      showToast(error.message, 'error');
      if (error.message.includes('rate limit')) {
        showToast('Supabase email limit reached. Please configure custom SMTP in Supabase dashboard.', 'warning');
      }
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Create Account';
      return;
    }

    pendingEmail = email;
    showToast('Verification code sent to your email!', 'success');

    // Show OTP section
    signinForm.style.display = 'none';
    signupForm.style.display = 'none';
    otpSection.style.display = 'block';
    document.querySelector('.login-tabs').style.display = 'none';
    formHeader.querySelector('h2').textContent = 'Verify Email';
    formHeader.querySelector('p').textContent = `Code sent to ${email}`;

    initOTPInputs();
  });

  // OTP Verification
  document.getElementById('verify-otp-btn')?.addEventListener('click', async () => {
    const digits = document.querySelectorAll('.otp-digit');
    const otp = Array.from(digits).map(d => d.value).join('');

    if (otp.length !== 8) {
      showToast('Please enter the 8-digit code', 'warning');
      return;
    }

    const btn = document.getElementById('verify-otp-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Verifying...';

    const { error } = await supabase.auth.verifyOtp({
      email: pendingEmail,
      token: otp,
      type: 'email',
    });

    if (error) {
      showToast(error.message, 'error');
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-check-circle"></i> Verify';
    } else {
      showToast('Email verified! Setting up your profile...', 'success');
    }
  });

  // Resend OTP
  document.getElementById('resend-otp-btn')?.addEventListener('click', async () => {
    // Check ban status via RPC before resending OTP
    const { data: isBannedResend } = await supabase.rpc('is_email_banned', { p_email: pendingEmail });

    if (isBannedResend) {
      showToast('This email has been banned from NEVIN NEXUS.', 'error');
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email: pendingEmail,
      options: { 
        shouldCreateUser: true
      }
    });
    if (error) showToast(error.message, 'error');
    else showToast('New code sent!', 'success');
  });

  // Public Feedback
  document.getElementById('public-feedback-btn')?.addEventListener('click', () => {
    document.getElementById('feedback-modal').style.display = 'flex';
  });
  document.getElementById('close-feedback-modal')?.addEventListener('click', () => {
    document.getElementById('feedback-modal').style.display = 'none';
  });
  document.getElementById('feedback-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'feedback-modal') e.target.style.display = 'none';
  });

  document.getElementById('feedback-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const rl = checkRateLimit('feedback_public', 5, 3600000);
    if (!rl.allowed) {
      showToast('Too many feedback submissions. Try again later.', 'error');
      return;
    }

    const name = sanitizeText(document.getElementById('feedback-name').value || 'Anonymous', 80) || 'Anonymous';
    const message = sanitizeText(document.getElementById('feedback-message').value, 4000);
    const { isValid, errors } = validateFields(
      { message },
      { message: { type: 'string', required: true, maxLength: 4000 } }
    );
    if (!isValid) {
      showToast(errors[0] || 'Invalid message', 'warning');
      return;
    }

    const row = pickAllowedFields(
      {
        message,
        type: 'public',
        name,
        email: 'anonymous@public.feedback',
      },
      ['message', 'type', 'name', 'email']
    );

    const { error } = await supabase.from('feedback').insert(row);

    if (error) {
      showToast('Failed to send feedback', 'error');
    } else {
      showToast('Thank you for your feedback!', 'success');
      document.getElementById('feedback-modal').style.display = 'none';
      document.getElementById('feedback-form').reset();
    }
  });

  // GSAP entrance animations
  gsap.fromTo('.login-hero-logo', { scale: 0.8, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.8, ease: 'back.out(1.7)' });
  gsap.fromTo('.login-hero-title', { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, delay: 0.3, ease: 'power3.out' });
  gsap.fromTo('.login-hero-tagline', { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, delay: 0.5, ease: 'power3.out' });
  gsap.fromTo('.hero-feature', { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, stagger: 0.1, delay: 0.7, ease: 'power3.out' });
  gsap.fromTo('.login-right-content', { x: 30, opacity: 0 }, { x: 0, opacity: 1, duration: 0.7, delay: 0.3, ease: 'power3.out' });
}

function setupPasswordToggle(toggleId, inputId) {
  const toggle = document.getElementById(toggleId);
  const input = document.getElementById(inputId);
  toggle?.addEventListener('click', () => {
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    toggle.querySelector('i').className = isPassword ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
  });
}

function initOTPInputs() {
  const digits = document.querySelectorAll('.otp-digit');
  digits.forEach((input, index) => {
    input.value = '';
    input.addEventListener('input', (e) => {
      const val = e.target.value.replace(/[^0-9]/g, '');
      e.target.value = val;
      if (val && index < 7) digits[index + 1].focus();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !e.target.value && index > 0) {
        digits[index - 1].focus();
      }
    });
    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const pasted = (e.clipboardData.getData('text') || '').replace(/[^0-9]/g, '').slice(0, 8);
      pasted.split('').forEach((ch, i) => {
        if (digits[i]) digits[i].value = ch;
      });
      if (pasted.length > 0) digits[Math.min(pasted.length, 7)].focus();
    });
  });
  digits[0]?.focus();
}
