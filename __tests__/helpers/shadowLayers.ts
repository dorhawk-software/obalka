// A CSS box-shadow string as its layers, for the guard that shadows fall away from the light
// (practices, "Depth and texture from a concept"; 031 T050.9).

export interface ShadowLayer {
  readonly inset: boolean;
  readonly x: number;
  readonly y: number;
  readonly blur: number;
}

export function shadowLayers(shadow: string): ShadowLayer[] {
  // Commas inside rgba(...) are not layer breaks.
  const layers = shadow.split(/,(?![^(]*\))/).map(s => s.trim()).filter(Boolean);
  return layers.map(layer => {
    const inset = /^inset\b/.test(layer);
    const nums = (layer.replace(/rgba?\([^)]*\)/g, '').match(/-?\d+(\.\d+)?px/g) ?? []).map(parseFloat);
    return { inset, x: nums[0] ?? 0, y: nums[1] ?? 0, blur: nums[2] ?? 0 };
  });
}

/** The layers that throw their shade toward the light: an outer shadow whose drop is less than a
 * quarter of its blur, check-ui's own measure. */
export function towardTheLight(shadow: string | undefined): ShadowLayer[] {
  return shadow ? shadowLayers(shadow).filter(l => !l.inset && l.blur > 0 && l.y < l.blur / 4) : [];
}
