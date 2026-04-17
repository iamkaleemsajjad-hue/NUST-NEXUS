import { supabase } from '../utils/supabase.js';
import gsap from 'gsap';

/**
 * Check for unseen point rewards and show a congratulations popup.
 * Called from dashboard.js after page renders.
 */
export async function checkAndShowRewardPopup(userId) {
  if (!userId) return;

  const { data: rewards } = await supabase
    .from('point_rewards')
    .select('*')
    .eq('user_id', userId)
    .eq('seen', false)
    .order('created_at', { ascending: false });

  if (!rewards || rewards.length === 0) return;

  // Sum all unseen rewards
  const totalPoints = rewards.reduce((sum, r) => sum + (r.amount || 0), 0);
  const reasons = rewards
    .filter(r => r.reason)
    .map(r => r.reason)
    .slice(0, 3); // Show up to 3 reasons

  // Show popup
  showRewardPopup(totalPoints, reasons);

  // Mark all as seen
  const ids = rewards.map(r => r.id);
  await supabase
    .from('point_rewards')
    .update({ seen: true })
    .in('id', ids);
}

function showRewardPopup(totalPoints, reasons) {
  // Remove any existing popup
  document.getElementById('reward-popup-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'reward-popup-overlay';
  overlay.innerHTML = `
    <style>
      #reward-popup-overlay {
        position: fixed;
        inset: 0;
        z-index: 99999;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0,0,0,0.7);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
      }
      .reward-popup-box {
        background: linear-gradient(145deg, rgba(20,22,30,0.98), rgba(30,33,45,0.98));
        border: 1px solid rgba(255,204,0,0.25);
        border-radius: 24px;
        padding: 48px 40px 36px;
        text-align: center;
        max-width: 420px;
        width: 90%;
        position: relative;
        overflow: hidden;
        box-shadow: 0 24px 80px rgba(0,0,0,0.5), 0 0 60px rgba(255,204,0,0.08);
      }
      .reward-popup-box::before {
        content: '';
        position: absolute;
        top: -50%;
        left: -50%;
        width: 200%;
        height: 200%;
        background: radial-gradient(circle at center, rgba(255,204,0,0.06) 0%, transparent 60%);
        pointer-events: none;
      }
      .reward-emoji {
        font-size: 4rem;
        margin-bottom: 12px;
        display: block;
      }
      .reward-title {
        font-size: 1.4rem;
        font-weight: 700;
        color: #fff;
        margin-bottom: 8px;
      }
      .reward-points {
        font-size: 2.8rem;
        font-weight: 800;
        background: linear-gradient(135deg, #ffcc00, #ff9500);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        margin: 12px 0;
        line-height: 1.2;
      }
      .reward-reasons {
        color: rgba(255,255,255,0.6);
        font-size: 0.85rem;
        line-height: 1.6;
        margin-bottom: 24px;
      }
      .reward-dismiss-btn {
        background: linear-gradient(135deg, #ffcc00, #ff9500);
        color: #000;
        font-weight: 700;
        border: none;
        padding: 12px 36px;
        border-radius: 12px;
        font-size: 1rem;
        cursor: pointer;
        transition: transform 0.2s, box-shadow 0.2s;
      }
      .reward-dismiss-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(255,204,0,0.3);
      }
      /* Floating particles */
      .reward-particle {
        position: absolute;
        border-radius: 50%;
        pointer-events: none;
      }
    </style>
    <div class="reward-popup-box" id="reward-popup-box">
      <span class="reward-emoji" id="reward-emoji">🎉</span>
      <div class="reward-title">Congratulations!</div>
      <div style="color:rgba(255,255,255,0.7);font-size:0.9rem;">You've been rewarded</div>
      <div class="reward-points" id="reward-points-value">+${totalPoints} pts</div>
      ${reasons.length > 0 ? `
        <div class="reward-reasons">
          ${reasons.map(r => `<div>✨ ${r}</div>`).join('')}
        </div>
      ` : '<div style="height:12px;"></div>'}
      <button class="reward-dismiss-btn" id="reward-dismiss">Awesome!</button>
    </div>
  `;
  document.body.appendChild(overlay);

  // Create floating particles
  const box = document.getElementById('reward-popup-box');
  const colors = ['#ffcc00', '#ff9500', '#00ccff', '#00ff88', '#ff66cc'];
  for (let i = 0; i < 20; i++) {
    const p = document.createElement('div');
    p.className = 'reward-particle';
    const size = Math.random() * 8 + 4;
    p.style.width = size + 'px';
    p.style.height = size + 'px';
    p.style.background = colors[Math.floor(Math.random() * colors.length)];
    p.style.opacity = '0';
    p.style.left = Math.random() * 100 + '%';
    p.style.top = Math.random() * 100 + '%';
    box.appendChild(p);

    gsap.to(p, {
      opacity: Math.random() * 0.6 + 0.2,
      y: -(Math.random() * 120 + 40),
      x: (Math.random() - 0.5) * 80,
      duration: Math.random() * 2 + 1.5,
      delay: Math.random() * 0.5,
      ease: 'power2.out',
      repeat: -1,
      yoyo: true,
    });
  }

  // Entrance animation
  gsap.fromTo(overlay, { opacity: 0 }, { opacity: 1, duration: 0.3 });
  gsap.fromTo(box, 
    { scale: 0.6, opacity: 0, y: 30 }, 
    { scale: 1, opacity: 1, y: 0, duration: 0.6, ease: 'back.out(1.7)', delay: 0.1 }
  );

  // Emoji bounce
  gsap.fromTo('#reward-emoji', { scale: 0 }, { scale: 1, duration: 0.5, delay: 0.3, ease: 'elastic.out(1, 0.4)' });

  // Points count-up (0 → totalPoints)
  const pointsEl = document.getElementById('reward-points-value');
  const counter = { val: 0 };
  pointsEl.textContent = '+0 pts';
  gsap.to(counter, {
    val: totalPoints,
    duration: 1.2,
    delay: 0.5,
    ease: 'power2.out',
    onUpdate: () => {
      pointsEl.textContent = `+${Math.round(counter.val)} pts`;
    }
  });

  // Dismiss
  document.getElementById('reward-dismiss').addEventListener('click', () => {
    gsap.to(box, { scale: 0.8, opacity: 0, duration: 0.3, ease: 'power2.in' });
    gsap.to(overlay, {
      opacity: 0, duration: 0.3, delay: 0.1, onComplete: () => overlay.remove()
    });
  });
}
