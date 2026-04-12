/**
 * Premium NUST NEXUS Logo as an SVG component
 * @param {string} className - Additional CSS classes
 * @param {string} width - SVG logic width
 * @param {string} height - SVG logic height
 * @returns {string} Raw SVG HTML
 */
export function getLogoSVG(className = "", width = "100%", height = "100%", forceWhite = false, darkerRight = false) {
  const pillarColor = forceWhite ? "#FFFFFF" : (darkerRight ? "#056683" : "#087C9F");
  const leftPillarColor = forceWhite ? "#E8ECEE" : "#2C3E50";
  const stopColor1 = forceWhite ? "#FFFFFF" : "#087C9F";
  const stopColor2 = forceWhite ? "#C1E0F8" : "#C1E0F8";

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="${width}" height="${height}" class="${className}">
      <defs>
        <!-- Gradient for the diagonal ribbon -->
        <linearGradient id="nustNexusGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${stopColor1}" />
          <stop offset="100%" stop-color="${stopColor2}" />
        </linearGradient>
        
        <!-- Subtle drop shadow to give the ribbon depth -->
        <filter id="nustShadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="2" dy="4" stdDeviation="3" flood-color="#2C3E50" flood-opacity="0.3" />
        </filter>
      </defs>
      
      <!-- Right Pillar -->
      <polygon points="75,25 95,25 95,95 75,95" fill="${pillarColor}" />
      
      <!-- Diagonal Ribbon (Gradient, crosses over the right pillar slightly with shadow) -->
      <polygon points="25,25 45,25 95,95 75,95" fill="url(#nustNexusGrad)" filter="url(#nustShadow)" />
      
      <!-- Left Pillar -->
      <polygon points="25,25 45,25 45,95 25,95" fill="${leftPillarColor}" />
    </svg>
  `;
}
