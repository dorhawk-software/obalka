// Corner radii are DESIGN.md's fixed steps, or `concentric()` for a shape nested close inside another.
const tokens = require('../tokens.json');
const { message, isThemeFile, numberOf, propVisitors } = require('../message');

const RADIUS = /^border(TopLeft|TopRight|BottomLeft|BottomRight|TopStart|TopEnd|BottomStart|BottomEnd)?Radius$/;

module.exports = {
  meta: { type: 'problem', schema: [], docs: { description: 'Radii are design steps or concentric().' } },
  create(context) {
    // Screens only: a .ts file lays out no view (textToPdf sets a PDF page's margins in points).
    if (isThemeFile(context.getFilename()) || !context.getFilename().endsWith('.tsx')) {
      return {};
    }
    return propVisitors((prop, valueNode, node) => {
      if (!RADIUS.test(prop)) {
        return;
      }
      const value = numberOf(valueNode);
      if (value === undefined || value === 0 || tokens.radii.some(r => r.value === value)) {
        return;
      }
      const near = [...tokens.radii].sort((a, b) => Math.abs(a.value - value) - Math.abs(b.value - value)).slice(0, 2);
      context.report({
        node,
        message: message({
          what: `${prop}=${value} is not one of DESIGN.md's radius steps (${tokens.radii.map(r => r.value).join(' / ')}).`,
          fix: `use the step for what this is - ${near.map(r => `${r.value} (${r.use})`).join('; or ')}. If it sits close inside another rounded shape, it takes \`concentric(outer, gap)\` from src/theme/radius.ts instead.`,
          otherwise: 'if the design really has this radius, add it to DESIGN.md › Shapes with what it is for. Not here.',
          why: 'radii are fixed steps, not per-screen numbers (DESIGN.md › Shapes, The Concentric Rule).',
        }),
      });
    });
  },
};
