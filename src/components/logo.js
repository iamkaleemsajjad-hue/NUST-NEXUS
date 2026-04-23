/**
 * SCHOLAR NEXUS Intertwined "SN" Monogram Logo
 * Recreated from brand reference — S swoosh woven through geometric N
 * Colors: gray/white for dark-theme prominence
 */
export function getLogoSVG(className = "", width = "100%", height = "100%", forceWhite = false) {
  // N color (gray tones on dark bg, or white when forced)
  const nDark  = forceWhite ? "#FFFFFF" : "#9CA3AF";
  const nLight = forceWhite ? "#F3F4F6" : "#D1D5DB";

  // S swoosh color (lighter/white for contrast)
  const sDark  = forceWhite ? "#FFFFFF" : "#E5E7EB";
  const sLight = forceWhite ? "#FFFFFF" : "#F9FAFB";

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 260" width="${width}" height="${height}" class="${className}" aria-label="Scholar Nexus Logo">
      <defs>
        <linearGradient id="nGrad1" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="${nLight}"/>
          <stop offset="100%" stop-color="${nDark}"/>
        </linearGradient>
        <linearGradient id="nGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="${nLight}"/>
          <stop offset="100%" stop-color="${nDark}"/>
        </linearGradient>
        <linearGradient id="sGrad" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="${sLight}"/>
          <stop offset="100%" stop-color="${sDark}"/>
        </linearGradient>
        <linearGradient id="sGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${sLight}"/>
          <stop offset="100%" stop-color="${sDark}"/>
        </linearGradient>
      </defs>

      <!-- ══════ N LETTER ══════ -->
      <!-- N: Left vertical leg -->
      <polygon points="20,30 60,30 60,230 20,230" fill="url(#nGrad1)" opacity="0.95"/>

      <!-- N: Right vertical leg -->
      <polygon points="180,30 220,30 220,230 180,230" fill="url(#nGrad1)" opacity="0.85"/>

      <!-- N: Diagonal stroke (behind S curve) -->
      <polygon points="20,30 60,30 220,230 180,230" fill="url(#nGrad2)" opacity="0.75"/>

      <!-- ══════ S SWOOSH (woven through N) ══════ -->
      <!-- S: Upper curve — from upper-right, sweeping left across the N -->
      <path d="
        M 230,55
        C 230,55 210,20 170,20
        C 130,20 105,55 80,80
        L 55,105
        C 35,125 20,110 20,110
        L 10,95
        C 10,95 25,140 65,120
        C 85,110 100,95 120,75
        C 140,55 160,35 185,35
        C 210,35 230,55 230,55
        Z
      " fill="url(#sGrad)" opacity="0.95"/>

      <!-- S: Lower curve — from lower-left, sweeping right across the N -->
      <path d="
        M 10,205
        C 10,205 30,240 70,240
        C 110,240 135,205 160,180
        L 185,155
        C 205,135 220,150 220,150
        L 230,165
        C 230,165 215,120 175,140
        C 155,150 140,165 120,185
        C 100,205 80,225 55,225
        C 30,225 10,205 10,205
        Z
      " fill="url(#sGrad2)" opacity="0.95"/>

      <!-- S: Arrow tip upper-right -->
      <polygon points="225,40 240,25 230,60" fill="${sLight}" opacity="0.9"/>

      <!-- S: Arrow tip lower-left -->
      <polygon points="15,220 0,235 10,200" fill="${sDark}" opacity="0.9"/>
    </svg>
  `;
}
