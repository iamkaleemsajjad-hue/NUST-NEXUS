import '../styles/landing.css';
import { router } from '../router.js';
import { supabase } from '../utils/supabase.js';
import gsap from 'gsap';

/* ── helpers ── */
function navigateTo(tab) {
  // tab: 'signin' | 'signup'
  window.__landingTab = tab;
  router.navigate('/login');
}

/* ── Particle canvas ── */
function initCanvas(canvas) {
  const ctx = canvas.getContext('2d');
  let W = canvas.width = canvas.offsetWidth;
  let H = canvas.height = canvas.offsetHeight;
  const particles = Array.from({ length: 70 }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    r: Math.random() * 1.5 + 0.3,
    vx: (Math.random() - 0.5) * 0.25,
    vy: (Math.random() - 0.5) * 0.25,
    o: Math.random() * 0.4 + 0.1,
  }));

  function draw() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${p.o})`;
      ctx.fill();
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0) p.x = W;
      if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H;
      if (p.y > H) p.y = 0;
    });
    requestAnimationFrame(draw);
  }
  draw();
  window.addEventListener('resize', () => {
    W = canvas.width = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
  });
}

/* ── Scroll reveal ── */
function initScrollReveal() {
  const els = document.querySelectorAll('.reveal');
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } });
  }, { threshold: 0.12 });
  els.forEach(el => obs.observe(el));
}

/* ── Typewriter ── */
function typewriter(el, words, speed = 80) {
  let wi = 0, ci = 0, deleting = false;
  function tick() {
    const word = words[wi];
    if (!deleting) {
      el.textContent = word.slice(0, ci + 1);
      ci++;
      if (ci === word.length) { deleting = true; setTimeout(tick, 1800); return; }
    } else {
      el.textContent = word.slice(0, ci - 1);
      ci--;
      if (ci === 0) { deleting = false; wi = (wi + 1) % words.length; }
    }
    setTimeout(tick, deleting ? speed / 2 : speed);
  }
  tick();
}

/* ── Nav scroll effect ── */
function initNav() {
  const nav = document.querySelector('.landing-nav');
  window.addEventListener('scroll', () => {
    nav?.classList.toggle('scrolled', window.scrollY > 40);
  }, { passive: true });
}

/* ── Mouse glow on exchange cards ── */
function initCardGlow() {
  document.querySelectorAll('.exchange-card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
      card.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
    });
  });
}

/* ── Counter animation ── */
function animateCount(el, target, duration = 1800) {
  let start = null;
  function step(ts) {
    if (!start) start = ts;
    const prog = Math.min((ts - start) / duration, 1);
    const ease = 1 - Math.pow(1 - prog, 3);
    el.textContent = Math.floor(ease * target).toLocaleString() + (el.dataset.suffix || '');
    if (prog < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function initCounters() {
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        const el = e.target;
        animateCount(el, parseInt(el.dataset.target || '0'));
        obs.unobserve(el);
      }
    });
  }, { threshold: 0.5 });
  document.querySelectorAll('.stat-value[data-target]').forEach(el => obs.observe(el));
}

/* ── Inline SVG loader ── */
async function loadSVG(path) {
  try {
    const res = await fetch(path);
    if (!res.ok) return '';
    return await res.text();
  } catch { return ''; }
}

/* ── Main render ── */
export async function renderLandingPage() {
  // If user is already logged in, skip landing and go to dashboard
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('profiles').select('onboarding_complete, role').eq('id', user.id).single();
      if (profile?.role === 'admin') { router.navigate('/admin/dashboard'); return; }
      if (profile && !profile.onboarding_complete) { router.navigate('/onboarding'); return; }
      router.navigate('/dashboard'); return;
    }
  } catch { /* not logged in — show landing */ }

  const app = document.getElementById('app');

  // Skeleton
  app.innerHTML = `
    <div class="landing-page" style="min-height:100vh;background:#000;">
      <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:24px;">
        <div class="landing-skeleton" style="width:280px;height:60px;border-radius:12px;"></div>
        <div class="landing-skeleton" style="width:420px;height:24px;border-radius:8px;"></div>
        <div class="landing-skeleton" style="width:320px;height:24px;border-radius:8px;"></div>
        <div style="display:flex;gap:16px;margin-top:16px;">
          <div class="landing-skeleton" style="width:140px;height:48px;border-radius:100px;"></div>
          <div class="landing-skeleton" style="width:120px;height:48px;border-radius:100px;"></div>
        </div>
      </div>
    </div>
  `;

  // Load SVGs in parallel
  const [ab1Svg, ab2Svg] = await Promise.all([
    loadSVG('/ab1.svg'),
    loadSVG('/ab2.svg'),
  ]);

  // Inject animated classes into ab2 SVG
  let ab2Animated = ab2Svg;
  if (ab2Svg) {
    // Add animation attributes to specific elements inside ab2
    ab2Animated = ab2Svg
      .replace(/<svg/, '<svg class="hero-ab2-svg"')
      .replace(/(<circle[^>]*r="[3-9][^"]*"[^>]*>)/g, (m) => m.replace('>', ' class="svg-pulse-ring">'))
      .replace(/(<path[^>]*stroke[^>]*opacity="0\.[1-3][^"]*"[^>]*\/>)/g, (m) => m.replace('/>', ' class="svg-scan-line"/>'));
  }

  app.innerHTML = `
    <div class="landing-page" id="landing-root">

      <!-- ══ NAV ══ -->
      <nav class="landing-nav" id="landing-nav">
        <a class="nav-logo" href="#/" onclick="return false;">
          <span class="nav-logo-text">Scholar Nexus</span>
        </a>
        <div class="nav-actions">
          <button class="nav-btn nav-btn-outline" id="nav-signin">Sign In</button>
          <button class="nav-btn nav-btn-solid" id="nav-signup">Sign Up</button>
        </div>
      </nav>

      <!-- ══ HERO ══ -->
      <section class="landing-hero" id="hero">
        <canvas id="landing-canvas"></canvas>
        <div class="hero-bg-gradient"></div>

        <div class="hero-content">
          <div class="hero-badge">
            <span class="hero-badge-dot"></span>
            Pakistan's Academic Platform
          </div>

          <h1 class="hero-title">
            <span class="hero-title-main">SCHOLAR</span>
            <span class="hero-title-main">NEXUS</span>
          </h1>

          <div class="hero-subtitle-block">
            <p class="hero-subtitle">Welcome to Your Study<br>Exchange Universe</p>
          </div>

          <p class="hero-tagline">
            Your global path to collaborative knowledge starts here.
            <br/>
            <em style="font-style:normal;color:rgba(255,255,255,0.3);">
              Knowledge should flow between students,<br>not stay locked in notebooks.
            </em>
          </p>

          <div class="hero-actions">
            <button class="hero-btn-primary" id="hero-get-started">
              Get Started
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <button class="hero-btn-secondary" id="hero-learn-more">
              Learn More
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 9l5 4 5-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          </div>
        </div>

        <!-- ab2 SVG animated visual -->
        <div class="hero-ab2-wrap">
          <div class="hero-ab2-glow"></div>
          ${ab2Animated || `
            <div style="width:500px;height:500px;display:flex;align-items:center;justify-content:center;opacity:0.15;">
              <div class="landing-skeleton hero-ab2-svg" style="width:480px;height:480px;border-radius:50%;"></div>
            </div>
          `}
        </div>

        <div class="hero-scroll-hint">
          <span class="scroll-line"></span>
          Scroll to explore
        </div>
      </section>

      <!-- ══ QUOTE ══ -->
      <div class="section-divider"></div>
      <section class="quote-section">
        <div class="quote-text reveal">
          <span class="typewriter-text" id="quote-tw"></span><span class="typewriter-cursor"></span>
        </div>
        <p class="quote-author reveal reveal-delay-1">— Scholar Nexus Philosophy</p>
      </section>
      <div class="section-divider"></div>

      <!-- ══ FEATURES ══ -->
      <section class="landing-section" id="features">
        <div class="section-label reveal">What We Offer</div>
        <h2 class="section-heading reveal reveal-delay-1">
          Everything a student needs,<br><em>in one place</em>
        </h2>
        <p class="section-sub reveal reveal-delay-2">
          From uploading past papers to collaborating in real-time idea rooms — Scholar Nexus is built by students, for students.
        </p>

        <div class="features-grid reveal reveal-delay-2">
          <div class="feature-item">
            <div class="feature-icon"><i class="fa-solid fa-cloud-arrow-up"></i></div>
            <div class="feature-title">Resource Sharing</div>
            <div class="feature-desc">Upload and access past papers, notes, assignments and study guides shared by fellow students across departments.</div>
          </div>
          <div class="feature-item">
            <div class="feature-icon"><i class="fa-solid fa-lightbulb"></i></div>
            <div class="feature-title">Idea Rooms</div>
            <div class="feature-desc">Collaborate in real-time with video, audio, screen-sharing and live chat. Build together, learn together.</div>
          </div>
          <div class="feature-item">
            <div class="feature-icon"><i class="fa-solid fa-star"></i></div>
            <div class="feature-title">Rate Your Teachers</div>
            <div class="feature-desc">Give honest feedback on faculty based on real experience. Help others choose better learning paths and build transparency in education.</div>
          </div>
          <div class="feature-item">
            <div class="feature-icon"><i class="fa-solid fa-circle-question"></i></div>
            <div class="feature-title">Ask Questions</div>
            <div class="feature-desc">Post your academic questions and get answers from peers who already survived the same struggle — fast.</div>
          </div>
          <div class="feature-item">
            <div class="feature-icon"><i class="fa-solid fa-trophy"></i></div>
            <div class="feature-title">Points & Rewards</div>
            <div class="feature-desc">Earn points for every contribution. The more you share, the more you gain. A fair learning exchange system.</div>
          </div>
          <div class="feature-item">
            <div class="feature-icon"><i class="fa-solid fa-clipboard-check"></i></div>
            <div class="feature-title">Assessment Requests</div>
            <div class="feature-desc">Request verified assessments and past papers from specific professors and courses — no more guessing what to study.</div>
          </div>
        </div>

        <!-- Stats -->
        <div class="stats-row reveal reveal-delay-3">
          <div class="stat-item">
            <div class="stat-value" data-target="2400" data-suffix="+">0+</div>
            <div class="stat-label">Resources Shared</div>
          </div>
          <div class="stat-item">
            <div class="stat-value" data-target="850" data-suffix="+">0+</div>
            <div class="stat-label">Active Students</div>
          </div>
          <div class="stat-item">
            <div class="stat-value" data-target="320" data-suffix="+">0+</div>
            <div class="stat-label">Teachers Rated</div>
          </div>
          <div class="stat-item">
            <div class="stat-value" data-target="120" data-suffix="+">0+</div>
            <div class="stat-label">Idea Rooms Created</div>
          </div>
        </div>
      </section>

      <div class="section-divider"></div>

      <!-- ══ TEACHER RATING ══ -->
      <section class="teacher-section" id="teachers">
        <div class="teacher-section-text">
          <div class="section-label reveal">Faculty Feedback</div>
          <h2 class="section-heading reveal reveal-delay-1">Rate Your<br>Teachers</h2>
          <p class="section-sub reveal reveal-delay-2" style="margin-bottom:0;">
            Give feedback about teachers based on real experience.<br><br>
            ✦ Help others choose better learning paths<br>
            ✦ Build transparency in education<br>
            ✦ Rate teaching style, clarity &amp; fairness<br><br>
            <span style="color:rgba(255,255,255,0.3);font-size:0.875rem;">Your honest rating helps future students make smarter choices.</span>
          </p>
        </div>
        <div class="teacher-rating-preview reveal reveal-delay-2">
          <div style="font-size:0.72rem;color:rgba(255,255,255,0.3);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid rgba(255,255,255,0.06);">
            Top Rated Faculty
          </div>
          ${[
      { init: 'AK', name: 'Dr. Ali Khan', dept: 'Computer Science', stars: 5 },
      { init: 'SR', name: 'Prof. Sara Raza', dept: 'Mathematics', stars: 4 },
      { init: 'MH', name: 'Dr. M. Hussain', dept: 'Physics', stars: 5 },
      { init: 'FQ', name: 'Ms. Fatima Qureshi', dept: 'Software Eng.', stars: 4 },
    ].map((t, i) => `
            <div class="teacher-card-preview" style="animation-delay:${0.1 * i}s;">
              <div class="teacher-avatar-preview">${t.init}</div>
              <div class="teacher-info-preview">
                <div class="teacher-name-preview">${t.name}</div>
                <div class="teacher-dept-preview">${t.dept}</div>
              </div>
              <div class="teacher-stars">${'★'.repeat(t.stars)}${'☆'.repeat(5 - t.stars)}</div>
            </div>
          `).join('')}
        </div>
      </section>

      <div class="section-divider"></div>

      <!-- ══ PEER EXCHANGE ══ -->
      <section class="exchange-section" id="exchange">
        <div class="section-label reveal">Peer Learning</div>
        <h2 class="section-heading reveal reveal-delay-1">
          Learn from people who<br><em>already survived the same struggle</em>
        </h2>
        <p class="section-sub reveal reveal-delay-2">
          It's a fair learning exchange system. You give, you get. Knowledge flows freely — no gatekeeping, no paywalls.
        </p>

        <div class="exchange-grid">
          <div class="exchange-card reveal reveal-delay-1">
            <span class="exchange-card-icon">📚</span>
            <div class="exchange-card-title">Upload &amp; Download Freely</div>
            <div class="exchange-card-desc">Share your notes, past papers and study material. Download what others have contributed. Every upload earns you points toward your academic reputation.</div>
          </div>
          <div class="exchange-card reveal reveal-delay-2">
            <span class="exchange-card-icon">🧠</span>
            <div class="exchange-card-title">Q&amp;A Between Students</div>
            <div class="exchange-card-desc">Stuck on a concept? Ask the community. Someone who aced that same course last semester is just a question away — real answers from real experience.</div>
          </div>
          <div class="exchange-card reveal reveal-delay-3">
            <span class="exchange-card-icon">🎥</span>
            <div class="exchange-card-title">Collaborative Idea Rooms</div>
            <div class="exchange-card-desc">Create or join Idea Rooms for group study sessions. Real-time video, chat and screen sharing — your study group, upgraded.</div>
          </div>
          <div class="exchange-card reveal reveal-delay-4">
            <span class="exchange-card-icon">🔒</span>
            <div class="exchange-card-title">University Emails Only</div>
            <div class="exchange-card-desc">Verified university email sign-up keeps the community trusted and safe. Only real students — no spam, no noise.</div>
          </div>
        </div>
      </section>

      <div class="section-divider"></div>

      <!-- ══ CTA ══ -->
      <section class="cta-section">
        <h2 class="cta-heading reveal">
          Ready to connect<br>with your people?
        </h2>
        <p class="cta-sub reveal reveal-delay-1">
          Join thousands of students already sharing knowledge, rating teachers and acing their exams together.
        </p>
        <button class="cta-btn reveal reveal-delay-2" id="cta-get-started">
          Get Started — It's Free
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3.5 9h11M10 5l4 4-4 4" stroke="#000" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </section>

      <!-- ══ FOOTER ══ -->
      <footer class="landing-footer">
        <span>© 2025 Scholar Nexus · All rights reserved</span>
        <div class="footer-links">
          <a href="#features">Features</a>
          <a href="#teachers">Ratings</a>
          <a href="#exchange">Exchange</a>
          <button class="nav-btn nav-btn-outline" id="footer-signin" style="padding:6px 16px;font-size:0.78rem;">Sign In</button>
        </div>
      </footer>

    </div>
  `;

  // ── Bind buttons ──
  document.getElementById('nav-signin')?.addEventListener('click', () => navigateTo('signin'));
  document.getElementById('nav-signup')?.addEventListener('click', () => navigateTo('signup'));
  document.getElementById('hero-get-started')?.addEventListener('click', () => navigateTo('signup'));
  document.getElementById('cta-get-started')?.addEventListener('click', () => navigateTo('signup'));
  document.getElementById('footer-signin')?.addEventListener('click', () => navigateTo('signin'));
  document.getElementById('hero-learn-more')?.addEventListener('click', () => {
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
  });

  // ── Canvas ──
  const canvas = document.getElementById('landing-canvas');
  if (canvas) initCanvas(canvas);

  // ── Nav scroll ──
  initNav();

  // ── Scroll reveal ──
  initScrollReveal();

  // ── Counters ──
  initCounters();

  // ── Card glow ──
  initCardGlow();

  // ── Typewriter quotes ──
  const twEl = document.getElementById('quote-tw');
  if (twEl) {
    typewriter(twEl, [
      'Knowledge should flow between students, not stay locked in notebooks.',
      'Learn from people who already survived the same struggle.',
      'Build transparency in education — one rating at a time.',
      'Your notes could be the reason someone passes their exam.',
    ], 55);
  }

  // ── GSAP hero entrance ──
  gsap.fromTo('.hero-badge', { opacity: 0, y: -12 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' });
  gsap.fromTo('.hero-title', { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.9, delay: 0.1, ease: 'power3.out' });
  gsap.fromTo('.hero-subtitle-block', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.8, delay: 0.35, ease: 'power3.out' });
  gsap.fromTo('.hero-tagline', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.7, delay: 0.5, ease: 'power3.out' });
  gsap.fromTo('.hero-actions', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.7, delay: 0.65, ease: 'power3.out' });
  gsap.fromTo('.hero-scroll-hint', { opacity: 0 }, { opacity: 1, duration: 1, delay: 1.2 });
  gsap.fromTo('.hero-ab2-wrap', { opacity: 0, x: 40 }, { opacity: 1, x: 0, duration: 1.1, delay: 0.2, ease: 'power3.out' });

  // ── ab2 SVG inner element animations (GSAP) ──
  setTimeout(() => {
    // Animate circles inside ab2
    const circles = document.querySelectorAll('.hero-ab2-wrap circle');
    if (circles.length) {
      gsap.to(circles, {
        opacity: 0.3,
        duration: 2,
        stagger: { each: 0.15, repeat: -1, yoyo: true },
        ease: 'sine.inOut',
      });
    }
    // Animate paths
    const paths = document.querySelectorAll('.hero-ab2-wrap path');
    if (paths.length) {
      gsap.to(paths, {
        opacity: (i) => 0.4 + (i % 3) * 0.2,
        duration: 3,
        stagger: { each: 0.08, repeat: -1, yoyo: true },
        ease: 'sine.inOut',
      });
    }
    // Subtle rotation on the whole ab2
    const ab2Root = document.querySelector('.hero-ab2-wrap > svg');
    if (ab2Root) {
      gsap.to(ab2Root, {
        rotateZ: 2,
        duration: 8,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
        transformOrigin: 'center center',
      });
    }
  }, 300);
}
