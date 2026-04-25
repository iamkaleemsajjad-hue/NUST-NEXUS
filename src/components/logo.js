/**
 * SCHOLAR NEXUS Logo
 * Returns an img tag referencing the official Scholar Nexus logo SVG
 * The new logo file is located at /Scholar Nexus logo.svg in public/
 */
export function getLogoSVG(className = "", width = "36", height = "36") {
  return `<img
    src="/Scholar Nexus logo.svg"
    class="${className}"
    width="${width}"
    height="${height}"
    alt="Scholar Nexus Logo"
    style="object-fit:contain;"
  />`;
}
