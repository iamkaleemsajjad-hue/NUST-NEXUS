/**
 * Premium NEVIN NEXUS Logo as an SVG component
 * @param {string} className - Additional CSS classes
 * @param {string} width - SVG logic width
 * @param {string} height - SVG logic height
 * @returns {string} Raw SVG HTML
 */
export function getLogoSVG(className = "", width = "100%", height = "100%", forceWhite = false) {
  // Vuetify origami style for an "N"
  // It's basically 3 folded shapes (left leg, diagonal ribbon, right leg) with distinct shadows.
  
  const c1 = forceWhite ? "#FFFFFF" : "#E0E0E0"; 
  const c2 = forceWhite ? "#F5F5F5" : "#9E9E9E";
  
  const c3 = forceWhite ? "#FFFFFF" : "#FFFFFF"; // Diagonal popping out
  const c4 = forceWhite ? "#E0E0E0" : "#BDBDBD";
  
  const c5 = forceWhite ? "#BDBDBD" : "#757575";
  const c6 = forceWhite ? "#9E9E9E" : "#424242";

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="${width}" height="${height}" class="${className}">
      <defs>
        <!-- Gradients to simulate folded paper/origami -->
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
        
        <!-- Drop shadow for the overlap -->
        <filter id="origamiShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="4" dy="6" stdDeviation="5" flood-color="#000000" flood-opacity="0.4" />
        </filter>
        <filter id="origamiBaseShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.2" />
        </filter>
      </defs>

      <!-- Right Leg (Back) -->
      <polygon points="75,20 95,30 95,100 75,90" fill="url(#origamiRight)" filter="url(#origamiBaseShadow)" />
      
      <!-- Left Leg (Middle) -->
      <polygon points="25,20 45,30 45,100 25,90" fill="url(#origamiLeft)" filter="url(#origamiBaseShadow)" />

      <!-- Diagonal Ribbon (Front, overlapping both legs) -->
      <polygon points="25,20 45,30 95,100 75,90" fill="url(#origamiDiag)" filter="url(#origamiShadow)" />

      <!-- Fold highlights to emphasize geometry -->
      <polygon points="25,20 45,30 45,32 25,22" fill="#FFFFFF" opacity="0.6" />
      <polygon points="75,20 95,30 95,32 75,22" fill="#FFFFFF" opacity="0.2" />
    </svg>
  `;
}
