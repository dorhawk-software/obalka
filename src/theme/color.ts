// Colour arithmetic, kept in one palette file (spec 028): a screen asks for a translucent step of a theme
// colour by name, and the raw rgba() string is written only here.

/** A theme hex colour at `alpha` - a ripple, a tint. */
export function withAlpha(hex: string, alpha: number): string {
  const n = hex.replace('#', '');
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** An "r,g,b" triplet token (`theme.scrimRgb`) at `alpha`. */
export function rgbaOf(rgb: string, alpha: number): string {
  return `rgba(${rgb},${alpha})`;
}

/** Black at `alpha`: a darker step of whatever it is laid over (the merged list pill's monogram chip). */
export function shade(alpha: number): string {
  return `rgba(0,0,0,${alpha})`;
}
