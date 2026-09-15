// A text role owns its size, line height, face and tracking. Weight is the one thing a screen may change
// (`fontWeight` - the role resolves it to the right face). DESIGN.md › Typography.
const tokens = require('../tokens.json');
const { message, isThemeFile, numberOf } = require('../message');

const OWNED = ['fontSize', 'lineHeight', 'fontFamily', 'letterSpacing'];
const describe = (name, r) => `<${name}> (${r.size}/${r.line} ${r.face})`;

module.exports = {
  meta: { type: 'problem', schema: [], docs: { description: 'Text roles own their size, line height, face and tracking.' } },
  create(context) {
    if (isThemeFile(context.getFilename())) {
      return {};
    }
    return {
      JSXOpeningElement(node) {
        const role = node.name.type === 'JSXIdentifier' ? node.name.name : null;
        const r = role && tokens.roles[role];
        if (!r) {
          return;
        }
        for (const attr of node.attributes) {
          if (attr.type !== 'JSXAttribute' || !OWNED.includes(attr.name.name)) {
            continue;
          }
          const prop = attr.name.name;
          const value = numberOf(attr.value);
          const shown = value !== undefined ? `{${value}}` : '{…}';
          const what = `<${role} ${prop}=${shown}> restyles a text role. ${describe(role, r)} by design (src/theme/typography.ts).`;
          let fix;
          let otherwise;
          if (prop === 'fontSize' && value === r.size) {
            fix = `delete it - ${value} is already ${role}'s size.`;
          } else if (prop === 'fontSize' && typeof value === 'number') {
            const same = Object.entries(tokens.roles).filter(([, x]) => x.size === value && x.family === r.family);
            fix = same.length
              ? `use ${same.map(([n, x]) => describe(n, x)).join(' or ')}; keep a different weight with \`fontWeight\`.`
              : `no ${r.family} role is ${value}px.`;
            otherwise = same.length
              ? undefined
              : `if the design really uses ${value}px ${r.family}, that is a missing role - add it to \`type\` in src/theme/typography.ts and to DESIGN.md › Typography, then use it here. Not here.`;
          } else if (prop === 'fontFamily') {
            fix = `delete it and say the weight instead (\`fontWeight="600"\`) - ${role} picks the face for a weight itself (DESIGN.md › The Face-Per-Weight Rule). A different family means a different role.`;
          } else if (prop === 'lineHeight') {
            fix = `delete it - the role derives its line from its size, and the iOS ink fit depends on that (DESIGN.md › The Whole Ink Rule). For a tight single-line row pass \`dense\`.`;
          } else {
            fix = `delete it - tracking belongs to the role.`;
          }
          context.report({
            node: attr,
            message: message({
              what,
              fix,
              otherwise,
              why: 'one size per role is what keeps two screens from drifting apart (constitution V, DESIGN.md › Typography).',
            }),
          });
        }
      },
    };
  },
};
