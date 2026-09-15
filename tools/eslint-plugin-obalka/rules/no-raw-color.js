// Colours come from the theme: a raw colour ignores one of the two appearances. Replaces
// scripts/check-no-raw-hex.sh, with the same exempt palette files.
const tokens = require('../tokens.json');
const { message } = require('../message');

const COLOR = /#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?(?:[0-9a-fA-F]{2})?\b|rgba?\(/;
const PALETTE_FILES = /src[\\/](theme[\\/](theme\.ts|ObalkaMark\.tsx|QrCode\.tsx|avatar\.ts|boxColor\.ts|chipTone\.ts|icons\.tsx|artwork\.tsx|depth\.ts)|services[\\/]notifications[\\/]notifeeNotifier\.ts)$/;

module.exports = {
  meta: { type: 'problem', schema: [], docs: { description: 'Colours come from theme tokens.' } },
  create(context) {
    if (PALETTE_FILES.test(context.getFilename())) {
      return {};
    }
    const check = (node, text) => {
      const m = COLOR.exec(text);
      if (!m) {
        return;
      }
      const hex = m[0].startsWith('#') ? m[0].toUpperCase() : null;
      const named = hex && tokens.palette[hex];
      context.report({
        node,
        message: message({
          what: `${JSON.stringify(text.length > 40 ? `${text.slice(0, 40)}…` : text)} is a raw colour.`,
          fix: named
            ? `use ${named.map(n => `theme.${n}`).join(' or ')} from useTheme() - the same colour, and it follows dark mode.`
            : 'use the theme token for what this colour means (src/theme/theme.ts, read with useTheme()). A translucent scrim or shade has a token or a helper there too (useScrim).',
          otherwise: 'add the colour as a token to both palettes in src/theme/theme.ts and to DESIGN.md › Colors. Not here.',
          why: 'a raw colour ignores one of the two themes, which is how dark mode rots (DESIGN.md › Colors).',
        }),
      });
    };
    return {
      Literal(node) {
        if (typeof node.value === 'string') {
          check(node, node.value);
        }
      },
      TemplateElement(node) {
        check(node, node.value.raw);
      },
    };
  },
};
