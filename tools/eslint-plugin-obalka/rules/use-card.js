// The bordered card is a component: src/theme/Card.tsx. DESIGN.md › Components › Cards.
const { message, isThemeFile } = require('../message');

const text = (src, attr) => (attr && attr.value ? src.slice(attr.value.range[0], attr.value.range[1]) : null);

module.exports = {
  meta: { type: 'problem', schema: [], docs: { description: 'Use <Card> instead of drawing one.' } },
  create(context) {
    if (isThemeFile(context.getFilename())) {
      return {};
    }
    const src = context.getSourceCode().getText();
    return {
      JSXOpeningElement(node) {
        const name = node.name.type === 'JSXIdentifier' ? node.name.name : null;
        if (name !== 'XStack' && name !== 'YStack') {
          return;
        }
        const a = {};
        for (const attr of node.attributes) {
          if (attr.type === 'JSXAttribute') {
            a[attr.name.name] = attr;
          }
        }
        if (text(src, a.borderRadius) === '{14}' && text(src, a.borderWidth) === '{1}' && text(src, a.backgroundColor) === '{theme.surface}' && text(src, a.borderColor) === '{theme.border}') {
          context.report({
            node,
            message: message({
              what: `<${name}> with a 14 radius, a 1dp border and the surface colour draws a card by hand.`,
              fix: `use <Card> from src/theme/Card.tsx and keep only the layout props (padding, gap${name === 'XStack' ? ', flexDirection="row"' : ''}).`,
              otherwise: 'if this card genuinely differs (another tone, a selected state), give Card that variant - one place, not here.',
              why: 'two hand-drawn cards are two places for "what a card looks like" to drift (constitution V).',
            }),
          });
        }
      },
    };
  },
};
