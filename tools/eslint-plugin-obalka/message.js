// The one shape every obalka/* message has (spec 028, "the message contract").

/**
 * @param {{ what: string, fix: string, otherwise?: string, why: string }} parts
 *   what      - the element and prop as written, and what the system says it should be
 *   fix       - the concrete replacement, taken from the system
 *   otherwise - where the system itself grows when nothing fits ("not here")
 *   why       - one line naming the rule in DESIGN.md or the constitution
 */
function message({ what, fix, otherwise, why }) {
  return [what, `  Fix: ${fix}`, otherwise ? `  If nothing fits: ${otherwise}` : null, `  Why: ${why}`]
    .filter(Boolean)
    .join('\n');
}

/** Files the system is defined in, where raw values are the point. */
function isThemeFile(filename) {
  return /[\\/]src[\\/]theme[\\/]/.test(filename);
}

/** A numeric literal behind a JSX attribute or an object property, else undefined. */
function numberOf(valueNode) {
  if (!valueNode) {
    return undefined;
  }
  const node = valueNode.type === 'JSXExpressionContainer' ? valueNode.expression : valueNode;
  if (node.type === 'Literal' && typeof node.value === 'number') {
    return node.value;
  }
  if (node.type === 'UnaryExpression' && node.operator === '-' && node.argument.type === 'Literal' && typeof node.argument.value === 'number') {
    return -node.argument.value;
  }
  return undefined;
}

/**
 * Visits every `prop={value}` on a JSX element and every `prop: value` in an object literal (a style),
 * calling `check(propName, valueNode, reportNode)`.
 */
function propVisitors(check) {
  return {
    JSXAttribute(node) {
      if (node.name.type === 'JSXIdentifier') {
        check(node.name.name, node.value, node);
      }
    },
    Property(node) {
      if (node.key && node.key.type === 'Identifier' && node.parent && node.parent.type === 'ObjectExpression') {
        check(node.key.name, node.value, node);
      }
    },
  };
}

module.exports = { message, isThemeFile, numberOf, propVisitors };
