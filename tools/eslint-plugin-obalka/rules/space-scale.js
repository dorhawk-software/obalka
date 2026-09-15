// Padding, margin and gap come from the spacing scale. DESIGN.md › Layout, src/theme/spacing.ts.
const tokens = require('../tokens.json');
const { message, isThemeFile, numberOf, propVisitors } = require('../message');

const SPACING = /^(padding|margin|gap|rowGap|columnGap)(Top|Bottom|Left|Right|Horizontal|Vertical|Start|End)?$/;
const steps = Object.entries(tokens.space).sort((a, b) => a[1] - b[1]);

module.exports = {
  meta: { type: 'problem', schema: [], docs: { description: 'Spacing values come from the spacing scale.' } },
  create(context) {
    if (isThemeFile(context.getFilename())) {
      return {};
    }
    return propVisitors((prop, valueNode, node) => {
      if (!SPACING.test(prop)) {
        return;
      }
      const value = numberOf(valueNode);
      if (value === undefined || value === 0 || steps.some(([, v]) => v === Math.abs(value))) {
        return;
      }
      const near = [...steps].sort((a, b) => Math.abs(a[1] - Math.abs(value)) - Math.abs(b[1] - Math.abs(value)) || b[1] - a[1]).slice(0, 2);
      context.report({
        node,
        message: message({
          what: `${prop}=${value} is not on the spacing scale (${steps.map(([, v]) => v).join(' / ')}).`,
          fix: `use ${near.map(([n, v]) => `${v} (space.${n})`).join(' or ')}.${Math.abs(value) === 1 ? ' A 1dp nudge is optical alignment, not spacing: fix the alignment (the role\'s line, `dense`, alignItems) instead.' : ''}`,
          otherwise: 'if the design really has this step, add it to DESIGN.md\'s `spacing:` and src/theme/spacing.ts (spacing.test.ts holds them together). Not here.',
          why: 'spacing comes only from the scale, so the same gap reads the same on every screen (constitution V).',
        }),
      });
    });
  },
};
