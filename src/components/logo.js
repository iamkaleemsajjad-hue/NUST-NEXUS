/**
 * Premium SCHOLAR NEXUS "SN" Monogram Logo as an SVG component
 * Uses origami/folded-paper style matching the existing N design
 * @param {string} className - Additional CSS classes
 * @param {string} width - SVG logic width
 * @param {string} height - SVG logic height
 * @returns {string} Raw SVG HTML
 */
export function getLogoSVG(className = "", width = "100%", height = "100%", forceWhite = false) {
  // Origami folded-paper palette
  const c1 = forceWhite ? "#FFFFFF" : "#E0E0E0"; 
  const c2 = forceWhite ? "#F5F5F5" : "#9E9E9E";
  
  const c3 = forceWhite ? "#FFFFFF" : "#FFFFFF"; // Diagonal popping out
  const c4 = forceWhite ? "#E0E0E0" : "#BDBDBD";
  
  const c5 = forceWhite ? "#BDBDBD" : "#757575";
  const c6 = forceWhite ? "#9E9E9E" : "#424242";

  // Accent color for the S
  const s1 = forceWhite ? "#FFFFFF" : "#B0BEC5";
  const s2 = forceWhite ? "#E0E0E0" : "#78909C";
  const s3 = forceWhite ? "#F5F5F5" : "#CFD8DC";
  const s4 = forceWhite ? "#BDBDBD" : "#607D8B";

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 120" width="${width}" height="${height}" class="${className}">
      <defs>
        <!-- N gradients -->
        <linearGradient id="origamiLeft" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="${c1}" />
          <stop offset="100%" stop-color="${c2}" />
        </linearGradient>
        <linearGradient id="origamiDiag" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${c3}" />
          <stop offset="100%" stop-color="${c4}" />
        </linearGradient>
        <linearGradient id="origamiRight" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="${c5}" />
          <stop offset="100%" stop-color="${c6}" />
        </linearGradient>

        <!-- S gradients -->
        <linearGradient id="origamiS1" x1="0%" y1="0%" x2="100%" y2="50%">
          <stop offset="0%" stop-color="${s3}" />
          <stop offset="100%" stop-color="${s1}" />
        </linearGradient>
        <linearGradient id="origamiS2" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="${s4}" />
          <stop offset="100%" stop-color="${s2}" />
        </linearGradient>
        <linearGradient id="origamiS3" x1="0%" y1="50%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${s1}" />
          <stop offset="100%" stop-color="${s3}" />
        </linearGradient>
        
        <!-- Drop shadows -->
        <filter id="origamiShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="4" dy="6" stdDeviation="5" flood-color="#000000" flood-opacity="0.4" />
        </filter>
        <filter id="origamiBaseShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.2" />
        </filter>
        <filter id="origamiLightShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="2" dy="3" stdDeviation="3" flood-color="#000000" flood-opacity="0.25" />
        </filter>
      </defs>

      <!-- ═══════ "S" Letter (left side) ═══════ -->
      <!-- S is built with 3 angular folded segments: top bar, diagonal middle, bottom bar -->

      <!-- S — Top horizontal fold (going right) -->
      <polygon points="15,20 85,20 80,30 20,30" fill="url(#origamiS1)" filter="url(#origamiBaseShadow)" />
      
      <!-- S — Left vertical fold (top half) -->
      <polygon points="15,20 20,30 20,55 15,50" fill="url(#origamiS2)" filter="url(#origamiLightShadow)" />

      <!-- S — Middle diagonal fold (connects left-top to right-bottom) -->
      <polygon points="15,50 20,55 85,70 80,63" fill="url(#origamiS3)" filter="url(#origamiShadow)" />

      <!-- S — Right vertical fold (bottom half) -->
      <polygon points="80,63 85,70 85,100 80,90" fill="url(#origamiS2)" filter="url(#origamiLightShadow)" />

      <!-- S — Bottom horizontal fold (going left) -->
      <polygon points="15,100 85,100 80,90 20,90" fill="url(#origamiS1)" filter="url(#origamiBaseShadow)" />

      <!-- S — Fold highlights -->
      <polygon points="15,20 85,20 85,22 15,22" fill="#FFFFFF" opacity="0.5" />
      <polygon points="15,50 20,55 20,57 15,52" fill="#FFFFFF" opacity="0.3" />

      <!-- ═══════ "N" Letter (right side, offset +100) ═══════ -->
      <!-- Right Leg (Back) -->
      <polygon points="175,20 195,30 195,100 175,90" fill="url(#origamiRight)" filter="url(#origamiBaseShadow)" />
      
      <!-- Left Leg (Middle) -->
      <polygon points="125,20 145,30 145,100 125,90" fill="url(#origamiLeft)" filter="url(#origamiBaseShadow)" />

      <!-- Diagonal Ribbon (Front, overlapping both legs) -->
      <polygon points="125,20 145,30 195,100 175,90" fill="url(#origamiDiag)" filter="url(#origamiShadow)" />

      <!-- N — Fold highlights -->
      <polygon points="125,20 145,30 145,32 125,22" fill="#FFFFFF" opacity="0.6" />
      <polygon points="175,20 195,30 195,32 175,22" fill="#FFFFFF" opacity="0.2" />
    </svg>
  `;
}
