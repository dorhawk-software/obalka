// No touch target is typed by hand.
//
// `theme/touchTarget.ts` exists so a control's touch area is DERIVED from what it draws: resize the
// switch and its target follows, type `hitSlop={10}` beside it and it does not. The audit of
// 2026-09-09 found that rule written down and adopted at five sites of twenty-seven; two of the
// twenty-two typed ones sat under the 48dp floor, found only by adding the numbers up. The sweep that
// fixed those still left five more (the help links on Welcome and the add-box form, both
// show-password toggles, the ⋯ box menu), because the named-control test beside this one checks the
// controls it knows about and nothing looked at the rest.
//
// So this looks at the rest: every file under `src/`, no allowlist. And it states the rule the way
// the module does - a slop comes FROM `touchSlop()` or `textSlop()` - instead of listing the shapes
// a typed number can take. A first version matched shapes with regexes and missed most of them:
// `wide ? 12 : touchSlop(…)`, `{ top: PAD }`, `SLOPS.menu`, `Platform.select({ ios: 8 })`, an
// imported constant. Reading the syntax tree, a value passes only if it IS one of those calls, or
// leads to one: a same-file binding, both branches of a conditional, an object that only spreads
// derived slops, or a prop forwarded from a parameter (the caller that sets it is scanned where it
// sets it). Everything else - a number, arithmetic, an import, another function - fails, and comments
// and strings never match because they are not syntax.

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import ts from 'typescript';

const ROOT = join(__dirname, '../..');
const SRC = join(ROOT, 'src');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      return sourceFiles(full);
    }
    return /\.[jt]sx?$/.test(entry) ? [full] : [];
  });
}

/** The functions a slop may come from - `theme/touchTarget.ts`. */
const DERIVE = new Set(['touchSlop', 'textSlop']);

function parse(fileName: string, text: string): ts.SourceFile {
  const kind = fileName.endsWith('.tsx')
    ? ts.ScriptKind.TSX
    : fileName.endsWith('.jsx')
      ? ts.ScriptKind.JSX
      : fileName.endsWith('.js')
        ? ts.ScriptKind.JS
        : ts.ScriptKind.TS;
  return ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, kind);
}

function textOf(name: ts.Node | undefined): string | undefined {
  return name && (ts.isIdentifier(name) || ts.isStringLiteral(name)) ? name.text : undefined;
}

/** Strip the wrappers that change a value's type but not the value. */
function unwrap(expr: ts.Expression): ts.Expression {
  let e = expr;
  while (
    ts.isParenthesizedExpression(e) ||
    ts.isAsExpression(e) ||
    ts.isSatisfiesExpression(e) ||
    ts.isNonNullExpression(e) ||
    ts.isTypeAssertionExpression(e)
  ) {
    e = e.expression;
  }
  return e;
}

/** Every place a `hitSlop` is SET, with the value it is set to (`undefined`: a bare JSX attribute). */
function slopSites(sf: ts.SourceFile): { at: ts.Node; value: ts.Expression | undefined }[] {
  const sites: { at: ts.Node; value: ts.Expression | undefined }[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxAttribute(node) && textOf(node.name) === 'hitSlop') {
      const init = node.initializer;
      sites.push({
        at: node,
        value: init === undefined ? undefined : ts.isJsxExpression(init) ? init.expression : init,
      });
    } else if (ts.isPropertyAssignment(node) && textOf(node.name) === 'hitSlop') {
      sites.push({ at: node, value: node.initializer });
    } else if (ts.isShorthandPropertyAssignment(node) && node.name.text === 'hitSlop') {
      sites.push({ at: node, value: node.name });
    } else if (
      // A default: `({ hitSlop = 10 })`, `function f(hitSlop = 10)`.
      (ts.isBindingElement(node) || ts.isParameter(node)) &&
      node.initializer &&
      textOf((ts.isBindingElement(node) && node.propertyName) || node.name) === 'hitSlop'
    ) {
      sites.push({ at: node, value: node.initializer });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return sites;
}

/** Whether a `hitSlop` value comes from `touchSlop()` / `textSlop()`. See the header for the rule. */
function derivation(sf: ts.SourceFile): (value: ts.Expression) => boolean {
  // Names are resolved within the file, by name. Where one name is declared more than once, every
  // declaration has to pass - a stricter reading than scope would give, never a looser one.
  const declarations = new Map<string, ts.Node[]>();
  const collect = (node: ts.Node) => {
    if (
      (ts.isVariableDeclaration(node) || ts.isParameter(node) || ts.isBindingElement(node)) &&
      ts.isIdentifier(node.name)
    ) {
      declarations.set(node.name.text, [...(declarations.get(node.name.text) ?? []), node]);
    }
    ts.forEachChild(node, collect);
  };
  collect(sf);

  const seen = new Set<ts.Node>();

  const fromDeclaration = (decl: ts.Node): boolean => {
    if (ts.isParameter(decl)) {
      // Forwarded from whoever calls this: that caller's own `hitSlop` is scanned where it is set.
      return decl.initializer === undefined || derived(decl.initializer);
    }
    if (ts.isVariableDeclaration(decl)) {
      return decl.initializer !== undefined && derived(decl.initializer);
    }
    if (ts.isBindingElement(decl)) {
      if (decl.initializer && !derived(decl.initializer)) {
        return false;
      }
      // Climb out of the pattern to what it destructures: `const { menu } = SLOPS` is SLOPS.
      let root: ts.Node = decl.parent.parent;
      while (ts.isBindingElement(root)) {
        root = root.parent.parent;
      }
      return fromDeclaration(root);
    }
    return false;
  };

  function derived(value: ts.Expression): boolean {
    const e = unwrap(value);
    if (seen.has(e)) {
      return false;
    }
    seen.add(e);
    try {
      if (ts.isCallExpression(e)) {
        const callee = unwrap(e.expression);
        const name = ts.isIdentifier(callee)
          ? callee.text
          : ts.isPropertyAccessExpression(callee)
            ? callee.name.text
            : undefined;
        return name !== undefined && DERIVE.has(name);
      }
      if (ts.isConditionalExpression(e)) {
        return derived(e.whenTrue) && derived(e.whenFalse);
      }
      // No slop at all types no number.
      if (e.kind === ts.SyntaxKind.NullKeyword || (ts.isIdentifier(e) && e.text === 'undefined')) {
        return true;
      }
      if (ts.isIdentifier(e)) {
        const decls = declarations.get(e.text) ?? [];
        return decls.length > 0 && decls.every(fromDeclaration);
      }
      if (ts.isPropertyAccessExpression(e) || ts.isElementAccessExpression(e)) {
        return derived(e.expression);
      }
      if (ts.isObjectLiteralExpression(e)) {
        return (
          e.properties.length > 0 &&
          e.properties.every(p => ts.isSpreadAssignment(p) && derived(p.expression))
        );
      }
      return false;
    } finally {
      seen.delete(e);
    }
  }

  return derived;
}

/** Every `hitSlop` in the source that is not derived, as `line  text`. */
function typedSlops(fileName: string, text: string): { line: number; text: string }[] {
  const sf = parse(fileName, text);
  const derived = derivation(sf);
  return slopSites(sf)
    .filter(site => site.value === undefined || !derived(site.value))
    .map(site => ({
      line: sf.getLineAndCharacterOfPosition(site.at.getStart(sf)).line + 1,
      text: site.at.getText(sf).replace(/\s+/g, ' '),
    }));
}

describe('hitSlop', () => {
  const files = sourceFiles(SRC);

  it('scans the whole app', () => {
    expect(files.length).toBeGreaterThan(50);
    // …and finds the slops it is there to judge (twenty-six on 2026-09-14), so a parser that saw
    // nothing could not pass.
    const sites = files.flatMap(f => slopSites(parse(f, readFileSync(f, 'utf8'))));
    expect(sites.length).toBeGreaterThan(20);
  });

  it('is never typed - derive it with touchSlop() or textSlop()', () => {
    const offenders = files.flatMap(f =>
      typedSlops(f, readFileSync(f, 'utf8')).map(o => `${relative(ROOT, f)}:${o.line}  ${o.text}`),
    );
    expect(offenders).toEqual([]);
  });

  it('would catch each shape a typed slop takes', () => {
    // The guard proven against the shapes it claims, so an edit cannot quietly blind it. Every one of
    // these below the first four got past the regex version of this test.
    const hits = (src: string) => typedSlops('snippet.tsx', src).length > 0;
    expect(hits('<Pressable hitSlop={8} />')).toBe(true);
    expect(hits('<XStack hitSlop={{ top: 6, bottom: 6 }} />')).toBe(true);
    expect(hits('<XStack\n  hitSlop={{\n    top: 6,\n    bottom: 6,\n  }}\n/>')).toBe(true);
    expect(hits('const p = { hitSlop: 12 };')).toBe(true);
    expect(hits('const SLOP = 10;\n<Pressable hitSlop={SLOP} />')).toBe(true);
    expect(hits('const PAD = 10;\n<X hitSlop={{ top: PAD, bottom: PAD }} />')).toBe(true);
    expect(hits('const SLOPS = { menu: 8 };\n<X hitSlop={SLOPS.menu} />')).toBe(true);
    expect(hits('const SLOPS = { menu: 8 };\nconst { menu } = SLOPS;\n<X hitSlop={menu} />')).toBe(
      true,
    );
    expect(hits('<X hitSlop={wide ? 12 : touchSlop({ width: 18 })} />')).toBe(true);
    expect(hits('<X hitSlop={Platform.select({ ios: 8, android: 10 })} />')).toBe(true);
    expect(hits("import { SLOP } from './slop';\n<X hitSlop={SLOP} />")).toBe(true);
    expect(hits('<X hitSlop={pad + 4} />')).toBe(true);
    expect(hits('<X hitSlop={{ ...touchSlop({ height: 18 }), left: 8 }} />')).toBe(true);
    expect(hits('const hitSlop = 10;\nconst p = { hitSlop };')).toBe(true);
    expect(hits('function Row({ hitSlop = 10 }) {\n  return <X hitSlop={hitSlop} />;\n}')).toBe(
      true,
    );
    expect(hits('<X hitSlop="10" />')).toBe(true);
    // …and leaves the derived ones, the forwarded ones and the prose alone.
    expect(hits('<XStack hitSlop={touchSlop({ width: 18, height: 18 })} />')).toBe(false);
    expect(hits("<XStack hitSlop={textSlop('label', { fontSize: 14 })} />")).toBe(false);
    expect(hits('const EYE_W = 40;\n<XStack hitSlop={touchSlop({ width: EYE_W })} />')).toBe(false);
    expect(hits('const slop = touchSlop({ width: 18 });\n<Pressable hitSlop={slop} />')).toBe(false);
    expect(hits('<X hitSlop={dense ? touchSlop({ height: 16 }) : undefined} />')).toBe(false);
    expect(hits('<X hitSlop={{ ...touchSlop({ height: 18 }) }} />')).toBe(false);
    expect(hits('function Row({ hitSlop }: P) {\n  return <X hitSlop={hitSlop} />;\n}')).toBe(false);
    expect(hits('function Row(props: P) {\n  return <X hitSlop={props.hitSlop} />;\n}')).toBe(false);
    expect(hits('type P = { hitSlop?: Insets };')).toBe(false);
    expect(hits('// Was `hitSlop={10}`, which put this at 38pt')).toBe(false);
    expect(hits('<X>{/* was hitSlop={6} */}</X>')).toBe(false);
    expect(hits("const note = 'hitSlop={10}';")).toBe(false);
  });

  it('reports an offender on the line it sits on', () => {
    const src = '/* one\n   two */\nconst a = 1;\n<X hitSlop={8} />';
    expect(typedSlops('snippet.tsx', src)).toEqual([{ line: 4, text: 'hitSlop={8}' }]);
  });
});
