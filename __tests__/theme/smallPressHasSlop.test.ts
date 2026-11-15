// A press drawn under the target reaches it with slop (031 T050, the native audit).
//
// `noTypedHitSlop.test.ts` holds every slop to `touchSlop()`/`textSlop()`; it cannot see a press that
// has none. The audit found ten: download buttons, the remove-attachment ✕, the fiction reminder, the
// portal links, resend, the transfer's cancel - each drawn at 44 and reaching 44, under the 48 that
// `MIN_TARGET` sets. This reads every element in `src/` that takes an `onPress` and draws a literal
// `height` or `minHeight` (or `width`, when it sets one) under 48: it must say `hitSlop`.
//
// It cannot see a size that comes from a variable or the content; those are what the named-control
// tests and the walks are for.

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import ts from 'typescript';
import { MIN_TARGET } from '../../src/theme/touchTarget';

const ROOT = join(__dirname, '../..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      return sourceFiles(full);
    }
    return entry.endsWith('.tsx') ? [full] : [];
  });
}

function literal(attr: ts.JsxAttribute): number | null {
  const init = attr.initializer;
  if (init && ts.isJsxExpression(init) && init.expression && ts.isNumericLiteral(init.expression)) {
    return Number(init.expression.text);
  }
  return null;
}

function shortPresses(file: string): string[] {
  const text = readFileSync(file, 'utf8');
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const attrs = new Map<string, ts.JsxAttribute>();
      node.attributes.properties.forEach(p => {
        if (ts.isJsxAttribute(p)) {
          attrs.set(p.name.getText(source), p);
        }
      });
      const size = (name: string) => {
        const attr = attrs.get(name);
        return attr ? literal(attr) : null;
      };
      const tall = size('minHeight') ?? size('height');
      const wide = size('minWidth') ?? size('width');
      // A 0 is flexbox's "may shrink" (`minWidth={0}` beside a flex 1), not a size it is drawn at.
      const under = (n: number | null) => n != null && n > 0 && n < MIN_TARGET;
      const short = under(tall) || under(wide);
      if (attrs.has('onPress') && short && !attrs.has('hitSlop')) {
        const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
        found.push(`${relative(ROOT, file)}:${line + 1}`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

it('finds the presses it reads', () => {
  // The scan must see the shape it looks for, or an empty list below would prove nothing.
  const probe = join(ROOT, 'src/features/messages/screens/AttachmentRow.tsx');
  expect(readFileSync(probe, 'utf8')).toMatch(/width=\{44\}\s+height=\{44\}/);
});

it('gives every press drawn under 48 its slop', () => {
  expect(sourceFiles(join(ROOT, 'src')).flatMap(shortPresses)).toEqual([]);
});
