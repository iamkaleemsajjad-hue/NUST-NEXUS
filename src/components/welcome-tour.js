import { supabase } from '../utils/supabase.js';
import gsap from 'gsap';

const TOUR_SLIDES = [
  {
    emoji: '🎓',
    title: 'Welcome to NEVIN NEXUS!',
    description: 'Your all-in-one academic resource hub. Share notes, find resources, ask questions, and earn points — all within your NUST community.',
  },
  {
    emoji: '📤',
    title: 'Upload & Share',
    description: 'Upload assignments, lab reports, quizzes, lecture slides, and semester projects. Each upload earns you reward points — projects earn even more!',
  },
  {
    emoji: '📥',
    title: 'Browse & Download',
    description: 'Find resources uploaded by fellow students. Downloads cost a small amount of points, so keep earning by uploading and contributing!',
  },
  {
    emoji: '❓',
    title: 'Ask Questions',
    description: 'Got stuck? Post questions tagged by subject. The community answers, upvotes the best ones, and top answers earn bonus points.',
  },
  {
    emoji: '📝',
    title: 'Request Assessments',
    description: 'Need specific past papers or assignments? Submit a request and fellow students can fulfill it — earning extra points in the process.',
  },
  {
    emoji: '👨‍🏫',
    title: 'Rate Teachers',
    description: 'Rate your teachers anonymously on teaching quality, grading, and more. Help others choose the best courses.',
  },
  {
    emoji: '💡',
    title: 'Project Ideas',
    description: 'Share and discover semester project ideas. Unique ideas earn points, and you can rate others\' ideas too.',
  },
  {
    emoji: '🔒',
    title: 'Privacy & Safety',
    description: 'Your identity is protected. Teacher ratings are anonymous, and all content is moderated. We take your privacy seriously.',
  },
  {
    emoji: '🏆',
    title: 'Points System',
    description: 'Earn points by uploading, answering questions, and contributing. Spend them to download resources. The more you give, the more you get!',
  },
];

/**
 * Show the welcome tour for first-time users.
 * Calls the secure RPC to award bonus points on completion.
 */
export async function showWelcomeTour(userId) {
  if (!userId) return;

  // Check if already seen
  const { data: profile } = await supabase
    .from('profiles')
    .select('welcome_tour_seen')
    .eq('id', userId)
    .single();

  if (profile?.welcome_tour_seen) return;

  return new Promise((resolve) => {
    let currentSlide = 0;

    const overlay = document.createElement('div');
    overlay.id = 'welcome-tour-overlay';
    overlay.innerHTML = `
      <style>
        #welcome-tour-overlay {
          position: fixed;
          inset: 0;
          z-index: 99998;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0,0,0,0.85);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }
        .tour-box {
          background: linear-gradient(160deg, rgba(20,22,30,0.98), rgba(28,31,42,0.98));
          border: 1px solid rgba(0,204,255,0.15);
          border-radius: 24px;
          padding: 48px 40px 32px;
          text-align: center;
          max-width: 480px;
          width: 92%;
          position: relative;
          box-shadow: 0 24px 80px rgba(0,0,0,0.5), 0 0 40px rgba(0,204,255,0.06);
        }
        .tour-emoji {
          font-size: 3.5rem;
          display: block;
          margin-bottom: 16px;
        }
        .tour-title {
          font-size: 1.3rem;
          font-weight: 700;
          color: #fff;
          margin-bottom: 12px;
        }
        .tour-desc {
          color: rgba(255,255,255,0.65);
          font-size: 0.9rem;
          line-height: 1.7;
          margin-bottom: 32px;
          min-height: 60px;
        }
        .tour-dots {
          display: flex;
          justify-content: center;
          gap: 8px;
          margin-bottom: 28px;
        }
        .tour-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: rgba(255,255,255,0.15);
          transition: all 0.3s;
        }
        .tour-dot.active {
          background: var(--primary, #00ccff);
          width: 24px;
          border-radius: 4px;
        }
        .tour-nav {
          display: flex;
          gap: 12px;
          justify-content: center;
        }
        .tour-btn {
          padding: 10px 28px;
          border-radius: 10px;
          border: none;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .tour-btn:hover { transform: translateY(-2px); }
        .tour-btn-back {
          background: rgba(255,255,255,0.08);
          color: rgba(255,255,255,0.7);
          border: 1px solid rgba(255,255,255,0.1);
        }
        .tour-btn-next {
          background: linear-gradient(135deg, #00ccff, #0088ff);
          color: #fff;
          box-shadow: 0 4px 16px rgba(0,204,255,0.2);
        }
        .tour-btn-finish {
          background: linear-gradient(135deg, #00ff88, #00cc66);
          color: #000;
          box-shadow: 0 4px 16px rgba(0,255,136,0.2);
        }
        .tour-progress {
          position: absolute;
          top: 0;
          left: 0;
          height: 3px;
          background: linear-gradient(90deg, #00ccff, #00ff88);
          border-radius: 24px 0 0 0;
          transition: width 0.4s ease;
        }
        .tour-skip {
          position: absolute;
          top: 16px;
          right: 20px;
          background: none;
          border: none;
          color: rgba(255,255,255,0.35);
          font-size: 0.78rem;
          cursor: pointer;
          transition: color 0.2s;
        }
        .tour-skip:hover { color: rgba(255,255,255,0.6); }
      </style>
      <div class="tour-box" id="tour-box">
        <div class="tour-progress" id="tour-progress"></div>
        <button class="tour-skip" id="tour-skip">Skip tour</button>
        <span class="tour-emoji" id="tour-emoji"></span>
        <div class="tour-title" id="tour-title"></div>
        <div class="tour-desc" id="tour-desc"></div>
        <div class="tour-dots" id="tour-dots">
          ${TOUR_SLIDES.map((_, i) => `<div class="tour-dot ${i === 0 ? 'active' : ''}" data-i="${i}"></div>`).join('')}
        </div>
        <div class="tour-nav" id="tour-nav"></div>
      </div>
    `;
    document.body.appendChild(overlay);

    function renderSlide(animate = true) {
      const slide = TOUR_SLIDES[currentSlide];
      const isLast = currentSlide === TOUR_SLIDES.length - 1;
      const isFirst = currentSlide === 0;

      document.getElementById('tour-emoji').textContent = slide.emoji;
      document.getElementById('tour-title').textContent = slide.title;
      document.getElementById('tour-desc').textContent = slide.description;
      document.getElementById('tour-progress').style.width = `${((currentSlide + 1) / TOUR_SLIDES.length) * 100}%`;

      // Update dots
      document.querySelectorAll('.tour-dot').forEach((dot, i) => {
        dot.classList.toggle('active', i === currentSlide);
      });

      // Navigation buttons
      const nav = document.getElementById('tour-nav');
      nav.innerHTML = `
        ${!isFirst ? '<button class="tour-btn tour-btn-back" id="tour-back"><i class="fa-solid fa-arrow-left"></i> Back</button>' : ''}
        ${isLast
          ? '<button class="tour-btn tour-btn-finish" id="tour-finish"><i class="fa-solid fa-rocket"></i> Get Started!</button>'
          : '<button class="tour-btn tour-btn-next" id="tour-next">Next <i class="fa-solid fa-arrow-right"></i></button>'
        }
      `;

      document.getElementById('tour-back')?.addEventListener('click', () => {
        currentSlide--;
        renderSlide();
      });
      document.getElementById('tour-next')?.addEventListener('click', () => {
        currentSlide++;
        renderSlide();
      });
      document.getElementById('tour-finish')?.addEventListener('click', () => completeTour());

      if (animate) {
        gsap.fromTo('#tour-emoji', { scale: 0.5, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(1.5)' });
        gsap.fromTo('#tour-title', { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, delay: 0.1 });
        gsap.fromTo('#tour-desc', { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, delay: 0.15 });
      }
    }

    async function completeTour() {
      // Award bonus via secure RPC
      try {
        await supabase.rpc('complete_welcome_tour', { p_user_id: userId });
      } catch (e) {
        console.warn('complete_welcome_tour RPC failed:', e);
      }

      // Animate out
      gsap.to('#tour-box', { scale: 0.8, opacity: 0, duration: 0.3, ease: 'power2.in' });
      gsap.to(overlay, {
        opacity: 0, duration: 0.3, delay: 0.1,
        onComplete: () => {
          overlay.remove();
          resolve();
        }
      });
    }

    // Skip tour also completes it (awards points too)
    document.getElementById('tour-skip')?.addEventListener('click', () => completeTour());

    // Entrance
    gsap.fromTo(overlay, { opacity: 0 }, { opacity: 1, duration: 0.3 });
    gsap.fromTo('#tour-box', { scale: 0.7, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(1.4)', delay: 0.1 });

    renderSlide(true);
  });
}
