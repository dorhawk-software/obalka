// Layered "depth" shadows - the technique from CodePen LEGRBzp ("Depth"): each level combines an
// INSET top highlight (light hitting the top edge), a tight dark CONTACT shadow, and a soft AMBIENT
// shadow, scaling up per level. Works in light (dark shadows read) and dark (the top highlight reads).
//
// Uses the CSS `boxShadow` string, supported by React Native 0.76+ on the New Architecture (multiple
// shadows + inset). Apply via a component's `style` prop, e.g. style={{ boxShadow: depth.md }}.

export const depth = {
  sm:
    'inset 0px 1px 2px rgba(255,255,255,0.18), ' +
    '0px 1px 2px rgba(0,0,0,0.18), 0px 2px 4px rgba(0,0,0,0.08)',
  md:
    'inset 0px 1px 2px rgba(255,255,255,0.30), ' +
    '0px 2px 4px rgba(0,0,0,0.18), 0px 4px 8px rgba(0,0,0,0.08)',
  lg:
    'inset 0px 1px 2px rgba(255,255,255,0.45), ' +
    '0px 4px 6px rgba(0,0,0,0.18), 0px 6px 10px rgba(0,0,0,0.08)',
};
