// No text on a line too short for its ink, as far as the source says (2026-09-24).
//
// Android paints a glyph past its line box; iOS clips it. The attention count was set at 44pt on a
// 36pt line, which looked right on every Android screen and cut the top off the "2" on an iPhone -
// found only on a device, because nothing here renders iOS text. `src/theme/inkClipping.ts` has the
// model and the per-face numbers; this is the static half of the audit, reading every file under
// `src/` as syntax: literal `fontSize` / `lineHeight` / `fontFamily` on a JSX element in any order
// with anything between them, and the same keys in any object literal (a `style`, a StyleSheet).
// The render-time half (jest.setup.js, `__tests__/helpers/textAudit.tsx`) checks every Text a test
// draws, after the role components and Tamagui have resolved theirs.
//
// The role components (`Display` … `Badge`) take any design line: on iOS they draw on one the ink
// fits and take the extra back with margins, which only works while those margins are numbers.
// Anything else that sets a line - a Tamagui `Text`, a style object - has to be tall enough itself, on
// iOS: a line that branches on the platform is read as its iOS branch. A bundled face on NO line gets
// its own height, which Public Sans's Ů outgrows, so that is held too.

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import ts from 'typescript';
import { fonts } from '../../src/theme/typography';
import { inkFor, inkSafeLineHeight, iosClips, naturalLeading } from '../../src/theme/inkClipping';

const ROOT = join(__dirname, '../..');
const SRC = join(ROOT, 'src');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      return full.endsWith('/generated') ? [] : sourceFiles(full);
    }
    return /\.tsx?$/.test(entry) ? [full] : [];
  });
}

/** The role components, read from Typography.tsx so a new role is covered by being declared. */
const ROLES = new Set(
  [
    ...readFileSync(join(SRC, 'theme/Typography.tsx'), 'utf8').matchAll(
      /export const (\w+) = roleComponent\(/g,
    ),
  ].map(m => m[1]),
);

/** The type scale's own entries are design lines the role components make safe (inkClipping.test). */
const SCALE_FILE = join(SRC, 'theme/typography.ts');

const MARGINS = ['margin', 'marginVertical', 'marginTop', 'marginBottom'];

/** A value the source computes: only the render-time audit can see it. */
const COMPUTED = Symbol('computed');

type Value = number | string | undefined | typeof COMPUTED;

/** Whether `e` is `Platform.OS`. */
function isPlatformOS(e: ts.Expression): boolean {
  return (
    ts.isPropertyAccessExpression(e) &&
    ts.isIdentifier(e.expression) &&
    e.expression.text === 'Platform' &&
    e.name.text === 'OS'
  );
}

/** What `Platform.OS === 'ios'` and its kin come to on iOS; null for any other condition. */
function onIos(condition: ts.Expression): boolean | null {
  if (!ts.isBinaryExpression(condition)) {
    return null;
  }
  const op = condition.operatorToken.kind;
  const equal = op === ts.SyntaxKind.EqualsEqualsEqualsToken || op === ts.SyntaxKind.EqualsEqualsToken;
  const unequal =
    op === ts.SyntaxKind.ExclamationEqualsEqualsToken || op === ts.SyntaxKind.ExclamationEqualsToken;
  const [os, other] = isPlatformOS(condition.left)
    ? [condition.left, condition.right]
    : [condition.right, condition.left];
  if ((!equal && !unequal) || !isPlatformOS(os) || !ts.isStringLiteral(other)) {
    return null;
  }
  return (other.text === 'ios') === equal;
}

/**
 * A literal number, a string, `fonts.x`; COMPUTED for anything else. A value that branches on the
 * platform - `Platform.OS === 'ios' ? a : b`, `Platform.select({ ios: a, … })` - is its iOS branch,
 * stated rather than guessed: iOS is the platform that clips, and the one this audit models.
 */
function valueOf(expr: ts.Expression | undefined): Value {
  if (expr == null) {
    return undefined;
  }
  let e = expr;
  while (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isSatisfiesExpression(e)) {
    e = e.expression;
  }
  if (ts.isConditionalExpression(e)) {
    const ios = onIos(e.condition);
    return ios == null ? COMPUTED : valueOf(ios ? e.whenTrue : e.whenFalse);
  }
  if (
    ts.isCallExpression(e) &&
    ts.isPropertyAccessExpression(e.expression) &&
    ts.isIdentifier(e.expression.expression) &&
    e.expression.expression.text === 'Platform' &&
    e.expression.name.text === 'select' &&
    e.arguments.length === 1 &&
    ts.isObjectLiteralExpression(e.arguments[0])
  ) {
    const branches = e.arguments[0].properties;
    const branch = (key: string) =>
      branches.find(
        (p): p is ts.PropertyAssignment =>
          ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === key,
      );
    const chosen = branch('ios') ?? branch('native') ?? branch('default');
    return chosen ? valueOf(chosen.initializer) : COMPUTED;
  }
  if (ts.isNumericLiteral(e)) {
    return Number(e.text);
  }
  if (ts.isPrefixUnaryExpression(e) && e.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(e.operand)) {
    return -Number(e.operand.text);
  }
  if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) {
    return e.text;
  }
  if (ts.isPropertyAccessExpression(e) && ts.isIdentifier(e.expression) && e.expression.text === 'fonts') {
    return (fonts as Record<string, string>)[e.name.text] ?? COMPUTED;
  }
  return COMPUTED;
}

interface Site {
  readonly what: string;
  readonly props: ReadonlyMap<string, Value>;
  /** A spread or a `style` is present, so what the Text finally gets is not all written here. */
  readonly open: boolean;
}

/** Why this site's text clips on iOS, or null. */
function judge(site: Site, role: boolean): string | null {
  const p = site.props;
  if (role) {
    const bad = MARGINS.filter(m => typeof p.get(m) === 'string');
    return bad.length > 0
      ? `sets ${bad.join(', ')} as a token, which the role cannot take its ink's room back from`
      : null;
  }
  const fontSize = p.get('fontSize');
  const lineHeight = p.get('lineHeight');
  const family = p.get('fontFamily');
  if (typeof fontSize !== 'number' || family === COMPUTED || lineHeight === COMPUTED) {
    return null; // computed - the render-time audit sees the value
  }
  const ink = inkFor(family as string | undefined);
  if (ink == null) {
    return `is set in "${family}", which is neither a bundled face nor the system font`;
  }
  if (typeof lineHeight === 'number') {
    return iosClips(ink, fontSize, lineHeight)
      ? `fontSize ${fontSize} on lineHeight ${lineHeight} in ${family ?? 'the system font'} clips on ` +
          `iOS; it needs ${inkSafeLineHeight(family as string | undefined, fontSize, lineHeight)} ` +
          '(or a role component, which takes the extra back)'
      : null;
  }
  // No line at all: the font's own height, unless a spread or style may still bring one.
  if (family != null && !site.open && iosClips(ink, fontSize, fontSize * naturalLeading(ink))) {
    return (
      `fontSize ${fontSize} in ${family} with no lineHeight gets the font's own line, which clips ` +
      'on iOS; use a role component (dense for the design\'s tight line)'
    );
  }
  return null;
}

/** Every text-styling site in one source, judged. */
function scan(fileName: string, text: string): string[] {
  const sf = ts.createSourceFile(
    fileName,
    text,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const found: string[] = [];
  const report = (node: ts.Node, what: string, why: string) => {
    const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
    found.push(`${relative(ROOT, fileName)}:${line} ${what}: ${why}`);
  };
  const visit = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(sf);
      const props = new Map<string, Value>();
      let open = false;
      for (const attr of node.attributes.properties) {
        if (ts.isJsxSpreadAttribute(attr)) {
          open = true;
          continue;
        }
        const name = attr.name.getText(sf);
        if (name === 'style') {
          open = true;
        }
        const init = attr.initializer;
        props.set(
          name,
          init == null ? COMPUTED : ts.isJsxExpression(init) ? valueOf(init.expression) : valueOf(init),
        );
      }
      const texty = ['fontSize', 'lineHeight', 'fontFamily'].some(k => props.has(k));
      const role = ROLES.has(tag);
      if (texty || role) {
        const why = judge({ what: tag, props, open }, role);
        if (why) {
          report(node, `<${tag}>`, why);
        }
      }
    }
    if (ts.isObjectLiteralExpression(node) && fileName !== SCALE_FILE) {
      const props = new Map<string, Value>();
      let open = false;
      for (const prop of node.properties) {
        if (ts.isPropertyAssignment(prop) && prop.name && !ts.isComputedPropertyName(prop.name)) {
          props.set(prop.name.getText(sf), valueOf(prop.initializer));
        } else if (ts.isShorthandPropertyAssignment(prop)) {
          props.set(prop.name.text, COMPUTED);
        } else {
          open = true;
        }
      }
      // A style object states a line; one that sets only a size may be merged into anything.
      if (props.has('lineHeight') && props.has('fontSize')) {
        const why = judge({ what: 'style', props, open }, false);
        if (why) {
          report(node, 'style object', why);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

describe('the static audit', () => {
  it('finds no line too short for its ink anywhere under src/', () => {
    const found = sourceFiles(SRC).flatMap(file => scan(file, readFileSync(file, 'utf8')));
    expect(found).toEqual([]);
  });

  it('knows every role component', () => {
    expect([...ROLES].sort()).toEqual(
      ['Badge', 'Body', 'BodyStrong', 'Caption', 'Display', 'Heading', 'Label', 'Title', 'Value'],
    );
  });

  // The planted cases: each shape a clipping line can take in the source, and the ones that are fine.
  const planted = (source: string) => scan(join(SRC, 'planted.tsx'), source);

  it('catches the attention count as it was - in either order, with props between', () => {
    expect(planted('<Text fontSize={44} lineHeight={36} fontFamily={fonts.displayXBold} />')).toHaveLength(1);
    expect(
      planted(`<Text
        lineHeight={36}
        color={theme.gold}
        // a comment between
        fontFamily="BricolageGrotesque-ExtraBold"
        fontSize={44}
      >2</Text>`),
    ).toHaveLength(1);
  });

  it('holds a line that is taller than the font but still short of its ink', () => {
    // 16 on 14px Public Sans is the dense row's line: taller than 14, and still cuts Ů on iOS.
    expect(planted('<Text fontFamily={fonts.bodyBold} fontSize={14} lineHeight={16} />')).toHaveLength(1);
    expect(planted('<Text fontFamily={fonts.bodyBold} fontSize={14} lineHeight={18} />')).toEqual([]);
  });

  it('holds style objects, StyleSheet entries included', () => {
    expect(planted('const s = { fontFamily: fonts.bodyMedium, lineHeight: 14, fontSize: 12 };')).toHaveLength(1);
    expect(planted('StyleSheet.create({ t: { fontSize: 20, lineHeight: 18 } });')).toHaveLength(1);
    expect(planted('const s = { fontSize: 20, lineHeight: 24 };')).toEqual([]);
  });

  it('holds a bundled face left on its own line, but not one a style may still set', () => {
    expect(planted('<Text fontFamily={fonts.bodyBold} fontSize={14}>Ů</Text>')).toHaveLength(1);
    expect(planted('<Text fontFamily={fonts.bodyBold} fontSize={14} style={s}>Ů</Text>')).toEqual([]);
  });

  it('lets a role component take any design line, but not a margin it cannot subtract from', () => {
    expect(planted('<Display fontSize={44} lineHeight={36} marginTop={-2}>2</Display>')).toEqual([]);
    expect(planted('<Badge marginVertical="$1">NOVÉ</Badge>')).toHaveLength(1);
  });

  it('reads a line that branches on the platform as its iOS branch', () => {
    // The "i" hint's line: 15 on iOS, where 14 would cut the system font; 14 on Android, the design's.
    expect(planted("<Text fontSize={12} lineHeight={Platform.OS === 'ios' ? 15 : 14} />")).toEqual([]);
    expect(planted("<Text fontSize={12} lineHeight={Platform.OS === 'ios' ? 14 : 15} />")).toHaveLength(1);
    expect(planted("<Text fontSize={12} lineHeight={Platform.OS !== 'android' ? 14 : 15} />")).toHaveLength(1);
    expect(planted("<Text fontSize={12} lineHeight={'android' === Platform.OS ? 15 : 14} />")).toHaveLength(1);
    expect(planted('<Text fontSize={12} lineHeight={Platform.select({ ios: 14, default: 15 })} />')).toHaveLength(1);
    expect(planted('<Text fontSize={12} lineHeight={Platform.select({ android: 15, default: 14 })} />')).toHaveLength(1);
    expect(planted('<Text fontSize={12} lineHeight={Platform.select({ ios: 15, android: 14 })} />')).toEqual([]);
  });

  it('leaves computed values to the render-time audit', () => {
    expect(planted('<Text fontSize={size} lineHeight={size - 2} />')).toEqual([]);
  });
});
