import '../styles/landing.css';
import { router } from '../router.js';
import { supabase } from '../utils/supabase.js';
import gsap from 'gsap';
import anime from 'animejs/lib/anime.es.js';

/* ── navigate to login with correct tab ── */
function goTo(tab) {
  window.__landingTab = tab;
  router.navigate('/login');
}

/* ── Mouse-track radial on buttons ── */
function trackMouse(el) {
  el.addEventListener('mousemove', (e) => {
    const r = el.getBoundingClientRect();
    el.style.setProperty('--rx', ((e.clientX - r.left) / r.width * 100) + '%');
    el.style.setProperty('--ry', ((e.clientY - r.top) / r.height * 100) + '%');
  });
}

/* ── Particle canvas ── */
function initCanvas(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H;
  const resize = () => { W = canvas.width = canvas.offsetWidth; H = canvas.height = canvas.offsetHeight; };
  resize();
  window.addEventListener('resize', resize, { passive: true });

  const pts = Array.from({ length: 70 }, () => ({
    x: Math.random() * (W || 1000), y: Math.random() * (H || 600),
    r: Math.random() * 1.3 + 0.3,
    vx: (Math.random() - 0.5) * 0.2, vy: (Math.random() - 0.5) * 0.2,
    o: Math.random() * 0.3 + 0.08,
  }));

  let raf;
  const draw = () => {
    ctx.clearRect(0, 0, W, H);
    for (const p of pts) {
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${p.o})`; ctx.fill();
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = W; else if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H; else if (p.y > H) p.y = 0;
    }
    raf = requestAnimationFrame(draw);
  };
  draw();
}

/* ── Scroll reveal ── */
function initScrollReveal() {
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } });
  }, { threshold: 0.1 });
  document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
}

/* ── Typewriter ── */
function typewriter(el, words, speed = 54) {
  let wi = 0, ci = 0, del = false;
  const tick = () => {
    if (!document.contains(el)) return;
    const w = words[wi];
    el.textContent = del ? w.slice(0, ci - 1) : w.slice(0, ci + 1);
    if (!del) { ci++; if (ci > w.length) { del = true; setTimeout(tick, 1900); return; } }
    else { ci--; if (ci < 0) { del = false; wi = (wi + 1) % words.length; ci = 0; } }
    setTimeout(tick, del ? speed / 2 : speed);
  };
  tick();
}

/* ── Animated counter ── */
function initCounters() {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target;
      const target = parseInt(el.dataset.target || '0');
      const suffix = el.dataset.suffix || '';
      anime({ targets: { v: 0 }, v: target, duration: 1800, easing: 'easeOutCubic',
        update(anim) { el.textContent = Math.floor(anim.animations[0].currentValue).toLocaleString() + suffix; },
        complete() { el.textContent = target.toLocaleString() + suffix; }
      });
      obs.unobserve(el);
    });
  }, { threshold: 0.5 });
  document.querySelectorAll('.stat-value[data-target]').forEach(el => obs.observe(el));
}

/* ── Exchange card mouse glow track ── */
function initCardGlow() {
  document.querySelectorAll('.exchange-card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
      card.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
    });
  });
}

/* ── anime.js button magnetic hover ── */
function initButtonAnimations() {
  /* Primary buttons — magnetic + glow pulse on hover */
  document.querySelectorAll('.hero-btn-primary, .cta-btn').forEach(btn => {
    trackMouse(btn);
    btn.addEventListener('mouseenter', () => {
      anime({ targets: btn, scale: 1.05, duration: 320, easing: 'easeOutBack' });
    });
    btn.addEventListener('mouseleave', () => {
      anime({ targets: btn, scale: 1, duration: 280, easing: 'easeOutBack' });
    });
    btn.addEventListener('mousedown', () => {
      anime({ targets: btn, scale: 0.96, duration: 100, easing: 'easeOutQuad' });
    });
    btn.addEventListener('mouseup', () => {
      anime({ targets: btn, scale: 1.03, duration: 200, easing: 'easeOutBack' });
    });
  });

  /* Secondary / outline buttons — border glow pulse */
  document.querySelectorAll('.hero-btn-secondary, .nav-btn-outline, .nav-btn-solid').forEach(btn => {
    btn.addEventListener('mouseenter', () => {
      anime({ targets: btn, scale: 1.04, duration: 260, easing: 'easeOutBack' });
    });
    btn.addEventListener('mouseleave', () => {
      anime({ targets: btn, scale: 1, duration: 240, easing: 'easeOutBack' });
    });
  });
}

/* ── anime.js border glow loop on feature items ── */
function initFeatureGlows() {
  const items = document.querySelectorAll('.feature-item');
  items.forEach((item, i) => {
    /* stagger-in entrance via anime */
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        anime({ targets: item, opacity: [0, 1], translateY: [30, 0], duration: 600, delay: i * 80, easing: 'easeOutCubic' });
        obs.unobserve(item);
      });
    }, { threshold: 0.15 });
    obs.observe(item);
    item.style.opacity = '0'; // hide until animated in
  });
}

/* ── anime.js exchange card entrance ── */
function initExchangeAnimations() {
  const cards = document.querySelectorAll('.exchange-card');
  cards.forEach((card, i) => {
    card.style.opacity = '0';
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        anime({ targets: card, opacity: [0, 1], translateY: [40, 0], scale: [0.95, 1], duration: 700, delay: i * 120, easing: 'easeOutCubic' });
        obs.unobserve(card);
      });
    }, { threshold: 0.12 });
    obs.observe(card);
  });
}

/* ── anime.js stat items pulse on hover ── */
function initStatAnimations() {
  document.querySelectorAll('.stat-item').forEach(item => {
    item.addEventListener('mouseenter', () => {
      anime({ targets: item.querySelector('.stat-value'), scale: [1, 1.12, 1], duration: 500, easing: 'easeOutBack' });
    });
  });
}

/* ── anime.js: hero title entrance ── */
function animateHeroTitle() {
  anime({
    targets: '.hero-title-img',
    opacity: [0, 1],
    translateY: [30, 0],
    duration: 800,
    easing: 'easeOutCubic',
    delay: 200
  });
}

/* ── anime.js: nav button border glow pulse (continuous) ── */
function initNavGlowPulse() {
  const btn = document.querySelector('.nav-btn-solid');
  if (!btn) return;
  anime({
    targets: btn,
    boxShadow: [
      '0 0 0px rgba(255,255,255,0)',
      '0 0 18px rgba(255,255,255,0.35)',
      '0 0 0px rgba(255,255,255,0)',
    ],
    duration: 2800,
    loop: true,
    easing: 'easeInOutSine',
    delay: 1500,
  });
}

/* ═══════════════════════════════════════
   MAIN RENDER
   ═══════════════════════════════════════ */
export async function renderLandingPage() {
  /* auth redirect */
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('profiles').select('onboarding_complete, role').eq('id', user.id).single();
      if (profile?.role === 'admin') { router.navigate('/admin/dashboard'); return; }
      if (profile && !profile.onboarding_complete) { router.navigate('/onboarding'); return; }
      router.navigate('/dashboard'); return;
    }
  } catch { /* show landing */ }

  const app = document.getElementById('app');

  /* skeleton */
  app.innerHTML = `<div style="background:#000;min-height:100vh;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:18px;">
    <div class="landing-skeleton" style="width:290px;height:52px;border-radius:10px;"></div>
    <div class="landing-skeleton" style="width:360px;height:20px;border-radius:7px;"></div>
    <div class="landing-skeleton" style="width:250px;height:20px;border-radius:7px;"></div>
    <div style="display:flex;gap:12px;margin-top:10px;">
      <div class="landing-skeleton" style="width:136px;height:44px;border-radius:100px;"></div>
      <div class="landing-skeleton" style="width:116px;height:44px;border-radius:100px;"></div>
    </div></div>`;

  /* teacher cards */
  const teachers = [
    { init:'AK', name:'Dr. Ali Khan',       dept:'Computer Science', stars:5 },
    { init:'SR', name:'Prof. Sara Raza',    dept:'Mathematics',      stars:4 },
    { init:'MH', name:'Dr. M. Hussain',     dept:'Physics',          stars:5 },
    { init:'FQ', name:'Ms. Fatima Qureshi', dept:'Software Eng.',    stars:4 },
  ];

  app.innerHTML = `
<div class="landing-page" id="landing-root">

  <!-- NAV -->
  <nav class="landing-nav" id="landing-nav">
    <span class="nav-logo-text">Scholar Nexus</span>
    <div class="nav-actions">
      <button class="nav-btn nav-btn-outline" id="nav-signin-btn">Sign In</button>
      <button class="nav-btn nav-btn-solid"   id="nav-signup-btn">Sign Up</button>
    </div>
  </nav>

  <!-- HERO -->
  <section class="landing-hero" id="hero">
    <canvas id="landing-canvas"></canvas>
    <div class="hero-bg-gradient"></div>

    <!-- LEFT -->
    <div class="hero-content">
      <div class="hero-badge"><span class="hero-badge-dot"></span>Pakistan's Academic Platform</div>
      <img src="/ab1.svg" class="hero-title-img" alt="Scholar Nexus" draggable="false" />
      <div class="hero-subtitle-block">
        <p class="hero-subtitle">Welcome to Your Study<br>Exchange Universe</p>
        <p class="hero-tagline">Your global path to collaborative knowledge starts here.</p>
      </div>
      <div class="hero-actions">
        <button class="hero-btn-primary" id="hero-get-started-btn">
          Get Started
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="#000" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <button class="hero-btn-secondary" id="hero-learn-more-btn">
          Learn More
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 9l5 4 5-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>
    </div>

    <!-- RIGHT: ab2 as <img> with Native Glitch/Distortion -->
    <div class="hero-ab2-wrap" id="hero-unicorn-container">
      <div class="hero-ab2-glow"></div>
      <img
        class="hero-ab2-img"
        src="/ab2.svg"
        alt="Scholar Nexus Hero Visual"
        draggable="false"
        style="filter: url(#distort-filter) brightness(0.95) drop-shadow(-40px 0 80px rgba(0,0,0,0.9));"
      />
      <!-- Interactive SVG Distortion Filter -->
      <svg style="width:0;height:0;position:absolute;">
        <filter id="distort-filter" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.12 0.05" numOctaves="2" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="0" xChannelSelector="R" yChannelSelector="G" id="disp-map" />
        </filter>
      </svg>
    </div>

    <div class="hero-scroll-hint"><span class="scroll-line"></span>Scroll to explore</div>
  </section>

  <!-- QUOTE -->
  <div class="section-divider"></div>
  <section class="quote-section">
    <p class="quote-text reveal"><span id="quote-tw"></span><span class="typewriter-cursor"></span></p>
    <span class="quote-author reveal reveal-delay-1">— Scholar Nexus Philosophy</span>
  </section>
  <div class="section-divider"></div>

  <!-- FEATURES -->
  <section class="landing-section" id="features">
    <div class="section-label reveal">What We Offer</div>
    <h2 class="section-heading reveal reveal-delay-1">Everything a student needs,<br><em>in one place</em></h2>
    <p class="section-sub reveal reveal-delay-2">From sharing past papers to real-time idea rooms — Scholar Nexus is built by students, for students.</p>
    <div class="features-grid">
      ${[
        ['fa-cloud-arrow-up','Resource Sharing','Upload and access past papers, notes and assignments shared by students across all departments.'],
        ['fa-lightbulb','Idea Rooms','Collaborate in real-time with video, audio, screen-sharing and live chat. Study together, build together.'],
        ['fa-star','Rate Your Teachers','Give honest feedback based on real experience. Help others choose better learning paths and build transparency.'],
        ['fa-circle-question','Ask Questions','Post academic questions and get answers from peers who survived the same struggle — fast and real.'],
        ['fa-trophy','Points & Rewards','Earn points for every contribution. A fair learning exchange — the more you share, the more you gain.'],
        ['fa-clipboard-check','Assessment Requests','Request verified past papers from specific professors. Know exactly what to study — no guessing.'],
      ].map(([icon, title, desc]) => `
        <div class="feature-item">
          <div class="feature-icon"><i class="fa-solid ${icon}"></i></div>
          <div class="feature-title">${title}</div>
          <div class="feature-desc">${desc}</div>
        </div>`).join('')}
    </div>
    <div class="stats-row reveal reveal-delay-3">
      <div class="stat-item"><div class="stat-value" data-target="2400" data-suffix="+">0+</div><div class="stat-label">Resources Shared</div></div>
      <div class="stat-item"><div class="stat-value" data-target="850"  data-suffix="+">0+</div><div class="stat-label">Active Students</div></div>
      <div class="stat-item"><div class="stat-value" data-target="320"  data-suffix="+">0+</div><div class="stat-label">Teachers Rated</div></div>
      <div class="stat-item"><div class="stat-value" data-target="120"  data-suffix="+">0+</div><div class="stat-label">Idea Rooms Created</div></div>
    </div>
  </section>
  <div class="section-divider"></div>

  <!-- TEACHERS -->
  <section class="teacher-section" id="teachers">
    <div>
      <div class="section-label reveal">Faculty Feedback</div>
      <h2 class="section-heading reveal reveal-delay-1">Rate Your<br>Teachers</h2>
      <p class="section-sub reveal reveal-delay-2" style="margin-bottom:0;">
        Give feedback about teachers based on real experience.<br><br>
        <span style="color:rgba(255,255,255,.5)">✦</span> Help others choose better learning paths<br>
        <span style="color:rgba(255,255,255,.5)">✦</span> Build transparency in education<br>
        <span style="color:rgba(255,255,255,.5)">✦</span> Rate teaching style, clarity &amp; fairness<br><br>
        <em style="font-style:normal;color:rgba(255,255,255,.26);font-size:.84rem;">Your honest rating helps future students make smarter choices.</em>
      </p>
    </div>
    <div class="teacher-rating-preview reveal reveal-delay-2">
      <div style="font-size:.67rem;color:rgba(255,255,255,.26);letter-spacing:.12em;text-transform:uppercase;margin-bottom:16px;padding-bottom:13px;border-bottom:1px solid rgba(255,255,255,.05);">Top Rated Faculty</div>
      ${teachers.map((t,i) => `
        <div class="teacher-card-preview" style="animation-delay:${i*.12}s;">
          <div class="teacher-avatar-preview">${t.init}</div>
          <div class="teacher-info-preview">
            <div class="teacher-name-preview">${t.name}</div>
            <div class="teacher-dept-preview">${t.dept}</div>
          </div>
          <div class="teacher-stars">${'★'.repeat(t.stars)}${'☆'.repeat(5-t.stars)}</div>
        </div>`).join('')}
    </div>
  </section>
  <div class="section-divider"></div>

  <!-- EXCHANGE -->
  <section class="exchange-section" id="exchange">
    <div class="section-label reveal">Peer Learning</div>
    <h2 class="section-heading reveal reveal-delay-1">Learn from people who<br><em>already survived the same struggle</em></h2>
    <p class="section-sub reveal reveal-delay-2">It's a fair learning exchange system. You give, you get. Knowledge flows freely — no gatekeeping, no paywalls.</p>
    <div class="exchange-grid">
      ${[
        ['📚','Upload & Download Freely','Share notes, past papers and study material. Every upload earns you points toward your academic reputation.'],
        ['🧠','Q&A Between Students','Someone who aced that same course is just a question away — real answers from real experience.'],
        ['🎥','Collaborative Idea Rooms','Create or join Idea Rooms for group study. Real-time video, chat and screen sharing — your study group, upgraded.'],
        ['🔒','University Emails Only','Verified university email sign-up keeps the community trusted and safe. Only real students — no spam, no noise.'],
      ].map(([icon, title, desc]) => `
        <div class="exchange-card">
          <span class="exchange-card-icon">${icon}</span>
          <div class="exchange-card-title">${title}</div>
          <div class="exchange-card-desc">${desc}</div>
        </div>`).join('')}
    </div>
  </section>
  <div class="section-divider"></div>

  <!-- CTA -->
  <section class="cta-section">
    <h2 class="cta-heading reveal">Ready to connect<br>with your people?</h2>
    <p class="cta-sub reveal reveal-delay-1">Join thousands of students sharing knowledge, rating teachers and acing exams together.</p>
    <button class="cta-btn reveal reveal-delay-2" id="cta-get-started-btn">
      Get Started — It's Free
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3.5 9h11M10 5l4 4-4 4" stroke="#000" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
  </section>

  <!-- FOOTER -->
  <footer class="landing-footer">
    <span>© 2025 Scholar Nexus · All rights reserved</span>
    <div class="footer-links">
      <a href="#features">Features</a>
      <a href="#teachers">Ratings</a>
      <a href="#exchange">Exchange</a>
      <button class="nav-btn nav-btn-outline" id="footer-signin-btn" style="padding:6px 16px;font-size:.77rem;">Sign In</button>
    </div>
  </footer>
</div>`;

  /* ── Wire buttons ── */
  document.getElementById('nav-signin-btn')?.addEventListener('click', () => goTo('signin'));
  document.getElementById('nav-signup-btn')?.addEventListener('click', () => goTo('signup'));
  document.getElementById('hero-get-started-btn')?.addEventListener('click', () => goTo('signup'));
  document.getElementById('cta-get-started-btn')?.addEventListener('click', () => goTo('signup'));
  document.getElementById('footer-signin-btn')?.addEventListener('click', () => goTo('signin'));
  document.getElementById('hero-learn-more-btn')?.addEventListener('click', () => {
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
  });

  /* ── Nav scroll ── */
  const nav = document.getElementById('landing-nav');
  window.addEventListener('scroll', () => nav?.classList.toggle('scrolled', window.scrollY > 40), { passive: true });

  /* ── Canvas ── */
  initCanvas(document.getElementById('landing-canvas'));

  /* ── Scroll reveal ── */
  initScrollReveal();

  /* ── Counters ── */
  initCounters();

  /* ── Card glow ── */
  initCardGlow();

  /* ── Typewriter ── */
  const tw = document.getElementById('quote-tw');
  if (tw) typewriter(tw, [
    'Knowledge should flow between students, not stay locked in notebooks.',
    'Learn from people who already survived the same struggle.',
    'Build transparency in education — one rating at a time.',
    'Your notes could be the reason someone passes their exam.',
  ]);

  /* ── anime.js: hero title ── */
  animateHeroTitle();

  /* ── GSAP hero entrance (badge, subtitle, buttons, scroll-hint) ── */
  gsap.fromTo('.hero-badge',          { opacity:0, y:-10 }, { opacity:1, y:0, duration:.55, delay:.1, ease:'power3.out' });
  gsap.fromTo('.hero-subtitle-block', { opacity:0, y:26  }, { opacity:1, y:0, duration:.7,  delay:.4, ease:'power3.out' });
  gsap.fromTo('.hero-actions',        { opacity:0, y:20  }, { opacity:1, y:0, duration:.6,  delay:.6, ease:'power3.out' });
  gsap.fromTo('.hero-scroll-hint',    { opacity:0        }, { opacity:1,      duration:.8,  delay:1.2  });

  /* ab2 entrance */
  gsap.fromTo('.hero-ab2-wrap', { opacity:0, x:50 }, { opacity:1, x:0, duration:1.1, delay:.2, ease:'power3.out' });
  gsap.to('.hero-ab2-img', { y:-18, duration:6, repeat:-1, yoyo:true, ease:'sine.inOut', delay:1 });

  /* ── Interactive Native SVG Distortion ── */
  const imgWrap = document.getElementById('hero-unicorn-container');
  const dispMap = document.getElementById('disp-map');
  if (imgWrap && dispMap) {
    let targetScale = 0;
    let currentScale = 0;

    imgWrap.addEventListener('mousemove', (e) => {
      // Calculate speed of mouse to make it react to movement
      targetScale = 60; // Max distortion scale
    });
    imgWrap.addEventListener('mouseleave', () => {
      targetScale = 0;
    });

    const tickDisp = () => {
      currentScale += (targetScale - currentScale) * 0.1;
      // Only update DOM if there's a meaningful change
      if (Math.abs(targetScale - currentScale) > 0.1 || currentScale > 0.1) {
        dispMap.setAttribute('scale', currentScale.toString());
      }
      // Slowly decay target scale back to 0 if mouse stops moving (auto-rest)
      if (targetScale > 0) targetScale -= 1.5; 
      if (targetScale < 0) targetScale = 0;
      requestAnimationFrame(tickDisp);
    };
    tickDisp();
  }

  /* ── anime.js button animations ── */
  initButtonAnimations();

  /* ── anime.js feature card entrance & glows ── */
  initFeatureGlows();

  /* ── anime.js exchange card entrance ── */
  initExchangeAnimations();

  /* ── anime.js stat hover ── */
  initStatAnimations();

  /* ── anime.js nav glow pulse ── */
  initNavGlowPulse();

  /* ── anime.js: hero badge continuous subtle pulse ── */
  anime({
    targets: '.hero-badge',
    borderColor: ['rgba(255,255,255,.14)', 'rgba(255,255,255,.36)', 'rgba(255,255,255,.14)'],
    duration: 2800,
    loop: true,
    easing: 'easeInOutSine',
    delay: 1800,
  });
}
