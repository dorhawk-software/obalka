// The iOS clipping model (`src/theme/inkClipping.ts`), the numbers it runs on, the role components
// that apply it, and the render-time audit that holds every rendered Text to it (2026-09-24).
//
// An iPhone cut the top off the attention count's "2": 44pt Bricolage on a 36pt line. Android and
// every test drew it whole. These tests pin the model to that observation and to React Native's own
// placement rules, pin the per-face numbers to the font files, and prove both audits fire.

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { Platform, StyleSheet, Text as RNText } from 'react-native';
import { render } from '@testing-library/react-native';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { Text } from '../../src/theme/ui';
import * as roles from '../../src/theme/Typography';
import { fonts, metricLeading, type as typeScale, type TextRole } from '../../src/theme/typography';
import {
  bundledInk,
  inkFor,
  inkLift,
  inkSafeLineHeight,
  iosBaseline,
  iosClips,
  iosInkOverflow,
  naturalLeading,
  safeLeading,
  systemInk,
} from '../../src/theme/inkClipping';
import { BUNDLED_FACES, measureInk, occupiedLine } from '../helpers/textClipping';
import { takeTextClipping } from '../helpers/textAudit';

const ROOT = join(__dirname, '../..');

describe('the per-face numbers', () => {
  it('cover every bundled font file, and nothing else', () => {
    const files = readdirSync(join(ROOT, 'assets/fonts')).map(f => f.replace(/\.ttf$/, ''));
    expect([...files].sort()).toEqual([...BUNDLED_FACES].sort());
    expect(Object.keys(bundledInk).sort()).toEqual([...BUNDLED_FACES].sort());
  });

  it.each(BUNDLED_FACES)('match %s as its file measures', face => {
    const measured = measureInk(face);
    const table = bundledInk[face as keyof typeof bundledInk];
    for (const key of ['ascender', 'descender', 'lineGap', 'inkTop', 'inkBottom'] as const) {
      expect([key, table[key]]).toEqual([key, Number(measured[key].toFixed(4))]);
    }
  });

  it('are the ones DESIGN.md quotes', () => {
    const design = readFileSync(join(ROOT, 'DESIGN.md'), 'utf8');
    for (const face of BUNDLED_FACES) {
      const ink = bundledInk[face as keyof typeof bundledInk];
      const row = design.split('\n').find(l => l.includes(`\`${face}\``));
      expect([face, row]).toEqual([face, expect.stringContaining(safeLeading(ink).toFixed(3))]);
    }
  });

  it('put the tallest Czech ink where the fonts do: Ů above Public Sans ascender, Č inside Bricolage', () => {
    expect(measureInk('PublicSans-Regular').topChar).toBe('Ů');
    expect(bundledInk['PublicSans-Regular'].inkTop).toBeGreaterThan(bundledInk['PublicSans-Regular'].ascender);
    expect(measureInk('BricolageGrotesque-ExtraBold').topChar).toBe('Č');
    expect(bundledInk['BricolageGrotesque-ExtraBold'].inkTop).toBeLessThan(
      bundledInk['BricolageGrotesque-ExtraBold'].ascender,
    );
  });
});

describe('the model', () => {
  const xbold = bundledInk['BricolageGrotesque-ExtraBold'];

  it('cuts the top off a 44pt "2" on a 36pt line, as the iPhone did', () => {
    const two = measureInk('BricolageGrotesque-ExtraBold', '2');
    const over = iosInkOverflow(two, 44, 36);
    // 0.677em of "2" above a baseline sat 36 - 0.27·44 down: some 5.6pt of it outside the line.
    expect(over.top).toBeCloseTo(0.677 * 44 - (36 - 0.27 * 44), 5);
    expect(over.top).toBeGreaterThan(5);
    expect(iosClips(xbold, 44, 36)).toBe(true);
  });

  it('centres the ink as Android and CSS do once the line reaches the font height', () => {
    // CustomLineHeightSpan.kt adds half the leading above the ascent: the baseline sits at
    // (L - (a + d)) / 2 + a. iOS agrees from H up (RCTApplyBaselineOffsetForRange), not below it.
    const android = (ratio: number) => (ratio - (xbold.ascender + xbold.descender)) / 2 + xbold.ascender;
    for (const ratio of [1.2, 1.25, 1.5, 2]) {
      expect(iosBaseline(xbold, ratio)).toBeCloseTo(android(ratio), 10);
    }
    // Below it, iOS sits the ink (H - r) / 2 higher - the 36pt line put the "2" 4.4pt up.
    expect(android(36 / 44) - iosBaseline(xbold, 36 / 44)).toBeCloseTo((1.2 - 36 / 44) / 2, 10);
  });

  it('finds the smallest whole line that fits, for every face and size the app sets', () => {
    for (const face of Object.keys(bundledInk)) {
      for (let fontSize = 10; fontSize <= 60; fontSize += 1) {
        const safe = inkSafeLineHeight(face, fontSize, 1);
        expect([face, fontSize, iosClips(bundledInk[face as keyof typeof bundledInk], fontSize, safe)]).toEqual([
          face,
          fontSize,
          false,
        ]);
        expect(iosClips(bundledInk[face as keyof typeof bundledInk], fontSize, safe - 1)).toBe(true);
      }
    }
  });

  it('keeps a line that already fits, and lifts one that does not', () => {
    expect(inkSafeLineHeight(fonts.bodyRegular, 15, 21)).toBe(21);
    expect(inkSafeLineHeight(fonts.displayXBold, 44, 36)).toBe(53);
  });

  it('lifts a role line by whole dp on each side: the smallest even step that fits', () => {
    // 53 is the smallest line for the attention count, 17 over its 36: 8.5 a side, 25.5px at 3x.
    expect(inkLift(fonts.displayXBold, 44, 36)).toBe(9);
    expect(inkLift(fonts.displayXBold, 17, 19)).toBe(1);
    expect(inkLift(fonts.bodySemiBold, 12, 14)).toBe(1);
    expect(inkLift(fonts.bodyBold, 13, 16)).toBe(1);
    expect(inkLift(fonts.bodyRegular, 15, 21)).toBe(0);
    expect(inkLift('Courier', 14, 10)).toBe(0);
    for (const face of Object.keys(bundledInk)) {
      const ink = bundledInk[face as keyof typeof bundledInk];
      for (let fontSize = 10; fontSize <= 60; fontSize += 1) {
        for (let line = Math.round(fontSize * 0.8); line <= Math.round(fontSize * 1.4); line += 1) {
          const lift = inkLift(face, fontSize, line);
          expect([face, fontSize, line, iosClips(ink, fontSize, line + 2 * lift)]).toEqual([face, fontSize, line, false]);
          if (lift > 0) {
            expect(iosClips(ink, fontSize, line + 2 * (lift - 1))).toBe(true);
          }
        }
      }
    }
  });

  it('takes the system font as needing its own height, 1.1933 of its size', () => {
    expect(naturalLeading(systemInk)).toBeCloseTo(20.287 / 17, 3);
    expect(safeLeading(systemInk)).toBeCloseTo(naturalLeading(systemInk), 10);
    expect(inkSafeLineHeight(undefined, 12, 14)).toBe(15);
    expect(inkSafeLineHeight('System', 16, 22)).toBe(22);
  });
});

function wrap(node: React.ReactElement) {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      {node}
    </TamaguiProvider>,
  );
}

const ROLE_NAMES = Object.keys(typeScale) as TextRole[];
const componentFor = (role: TextRole) =>
  (roles as Record<string, React.ComponentType<any>>)[role[0].toUpperCase() + role.slice(1)];

describe('the role components', () => {
  /** The line Typography.tsx derives: the role's own leading, or the face's metric one when dense. */
  const designLine = (role: TextRole, fontSize: number, dense: boolean) =>
    Math.round(
      fontSize *
        (dense
          ? metricLeading[typeScale[role].fontFamily.startsWith('Bricolage') ? 'display' : 'body']
          : typeScale[role].lineHeight / typeScale[role].fontSize),
    );

  it.each(ROLE_NAMES)('%s draws Ů whole at every size, and keeps its design line', async role => {
    const Role = componentFor(role);
    for (const dense of [false, true]) {
      for (let fontSize = 11; fontSize <= 48; fontSize += 1) {
        const view = await wrap(
          <Role fontSize={fontSize} dense={dense} testID="t">
            ŮČ
          </Role>,
        );
        const style = StyleSheet.flatten(view.getByTestId('t').props.style);
        expect([role, dense, fontSize, occupiedLine(style)]).toEqual([
          role,
          dense,
          fontSize,
          designLine(role, fontSize, dense),
        ]);
        await view.unmount();
      }
    }
    // The render-time audit watched every one of those.
    expect(takeTextClipping()).toEqual([]);
  });

  it('takes the room back from the margins a caller set, not over them', async () => {
    const view = await wrap(
      <roles.Display fontSize={44} lineHeight={36} marginTop={6} marginBottom={-2} testID="n">
        2
      </roles.Display>,
    );
    const style = StyleSheet.flatten(view.getByTestId('n').props.style);
    expect([style.lineHeight, style.marginTop, style.marginBottom]).toEqual([54, 6 - 9, -2 - 9]);
  });

  it('leaves the line alone when a margin is a token it cannot subtract from', async () => {
    const view = await wrap(
      <roles.Display fontSize={44} lineHeight={36} marginTop="$1" testID="n">
        2
      </roles.Display>,
    );
    expect(StyleSheet.flatten(view.getByTestId('n').props.style).lineHeight).toBe(36);
    // ... which the render-time audit then reports.
    expect(takeTextClipping()).toHaveLength(1);
  });
});

/** Renders under `os` as `Platform.OS`, restoring the suite's own afterwards. */
async function asPlatform<T>(os: 'ios' | 'android', run: () => Promise<T>): Promise<T> {
  const real = Platform.OS;
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true, writable: true });
  try {
    return await run();
  } finally {
    Object.defineProperty(Platform, 'OS', { value: real, configurable: true, writable: true });
  }
}

/** The vertical margins a style resolves to, with RN's precedence: the side, then the axis, then all. */
function verticalMargins(style: Record<string, unknown>): { top: number; bottom: number } {
  const n = (...vs: unknown[]) => {
    const v = vs.find(x => x != null);
    return typeof v === 'number' ? v : 0;
  };
  return {
    top: n(style.marginTop, style.marginVertical, style.margin),
    bottom: n(style.marginBottom, style.marginVertical, style.margin),
  };
}

describe('the role components on each platform', () => {
  // Every shape a screen hands a role: the attention header's count and title as the inbox sets them,
  // its subtitle, a date header, the snackbar's action, a badge, and margins by side, by axis and all
  // round. `line` is the design line the caller asked for, which Android must draw untouched.
  const CASES: ReadonlyArray<{
    readonly name: string;
    readonly role: TextRole;
    readonly props: Record<string, unknown>;
    readonly line: number;
  }> = [
    { name: 'the attention count, 44 on 36', role: 'display', props: { fontSize: 44, lineHeight: 36, letterSpacing: -2 }, line: 36 },
    { name: 'the attention title, 17 on 19', role: 'title', props: { fontSize: 17, lineHeight: 19, letterSpacing: -0.3 }, line: 19 },
    { name: 'the attention subtitle, dense 12', role: 'caption', props: { fontSize: 12, dense: true, fontWeight: '600', marginTop: 3 }, line: 14 },
    { name: 'a date header, dense 15', role: 'heading', props: { fontSize: 15, dense: true, letterSpacing: 0 }, line: 18 },
    { name: 'the snackbar action, dense 14', role: 'bodyStrong', props: { fontSize: 14, dense: true, paddingVertical: 2 }, line: 16 },
    { name: 'a row title, dense 14', role: 'value', props: { fontSize: 14, dense: true, marginBottom: 2 }, line: 16 },
    { name: 'a badge on its own line', role: 'badge', props: {}, line: 16 },
    { name: 'a label with margins by side', role: 'label', props: { fontSize: 12, dense: true, marginTop: 6, marginBottom: -2 }, line: 14 },
    { name: 'a caption with margins by axis', role: 'caption', props: { marginVertical: 4 }, line: 17 },
    { name: 'a title with margins all round', role: 'title', props: { margin: 5 }, line: 26 },
    { name: 'body text that already fits', role: 'body', props: { marginTop: 8 }, line: 21 },
    { name: 'the display title that already fits', role: 'display', props: {}, line: 31 },
  ];

  async function drawn(os: 'ios' | 'android', role: TextRole, props: Record<string, unknown>) {
    const Role = componentFor(role);
    return asPlatform(os, async () => {
      const view = await wrap(
        <Role {...props} testID="t">
          ŮČ2
        </Role>,
      );
      const style = StyleSheet.flatten(view.getByTestId('t').props.style) as Record<string, unknown>;
      await view.unmount();
      return style;
    });
  }

  /** The vertical margin keys a plain Text resolves from the same props: what the caller set, as set. */
  async function plainMargins(props: Record<string, unknown>) {
    const keys = ['margin', 'marginVertical', 'marginTop', 'marginBottom'] as const;
    return asPlatform('android', async () => {
      const view = await wrap(
        <Text {...Object.fromEntries(keys.filter(k => k in props).map(k => [k, props[k]]))} testID="p">
          ŮČ2
        </Text>,
      );
      const flat = StyleSheet.flatten(view.getByTestId('p').props.style) as Record<string, unknown>;
      await view.unmount();
      return Object.fromEntries(keys.map(k => [k, flat[k]]));
    });
  }

  it('on Android draws every one on exactly the line and margins the caller set', async () => {
    // One table, so a single row drawn otherwise names itself in the diff. The margins are compared
    // key by key with a plain Text given the same props: nothing added, so nothing for Android to
    // measure in its whole pixels differently from before, and nothing for Yoga to round.
    const expected = [];
    const actual = [];
    for (const { name, role, props, line } of CASES) {
      const style = await drawn('android', role, props);
      const plain = await plainMargins(props);
      expected.push({ name, lineHeight: line, ...plain });
      actual.push({
        name,
        lineHeight: style.lineHeight,
        ...Object.fromEntries(Object.keys(plain).map(k => [k, style[k]])),
      });
    }
    expect(actual).toEqual(expected);
  });

  it('on iOS draws every one whole, occupying the design line to the pixel at 2x and 3x', async () => {
    const expected = [];
    const actual = [];
    for (const { name, role, props, line } of CASES) {
      const style = await drawn('ios', role, props);
      const lineHeight = style.lineHeight as number;
      const own = verticalMargins(style);
      const caller = verticalMargins(props);
      const ink = inkFor(style.fontFamily as string);
      expected.push({ name, occupied: line, wholePixels: [true, true], clips: false });
      actual.push({
        name,
        // The line plus what the margins took back is the design's line, exactly...
        occupied: lineHeight + (own.top - caller.top) + (own.bottom - caller.bottom),
        // ...and every edge of it is a whole pixel on a 2x and a 3x iPhone, so Yoga rounds nothing.
        wholePixels: [2, 3].map(scale =>
          [lineHeight, own.top, own.bottom].every(v => Number.isInteger(v * scale)),
        ),
        clips: ink == null || iosClips(ink, style.fontSize as number, lineHeight),
      });
    }
    expect(actual).toEqual(expected);
  });

  /** The design line Typography.tsx derives for a role at a size, dense or not. */
  const derivedLine = (role: TextRole, fontSize: number, dense: boolean) =>
    Math.round(
      fontSize *
        (dense
          ? metricLeading[typeScale[role].fontFamily.startsWith('Bricolage') ? 'display' : 'body']
          : typeScale[role].lineHeight / typeScale[role].fontSize),
    );

  it.each(ROLE_NAMES)('%s lifts a line on iOS by whole dp on each side, never half of one', async role => {
    const fractional: string[] = [];
    for (const dense of [false, true]) {
      for (let fontSize = 11; fontSize <= 48; fontSize += 1) {
        const style = await drawn('ios', role, { fontSize, dense });
        const lift = ((style.lineHeight as number) - derivedLine(role, fontSize, dense)) / 2;
        const margins = [style.marginTop ?? 0, style.marginBottom ?? 0];
        if (!Number.isInteger(lift) || margins.some(m => m !== (lift === 0 ? 0 : -lift))) {
          fractional.push(`${dense ? 'dense ' : ''}${fontSize}: line ${style.lineHeight}, margins ${margins}`);
        }
      }
    }
    expect(fractional).toEqual([]);
    expect(takeTextClipping()).toEqual([]);
  });

  it.each(ROLE_NAMES)('%s never lifts a line on Android', async role => {
    const lifted: string[] = [];
    for (const dense of [false, true]) {
      for (let fontSize = 11; fontSize <= 48; fontSize += 1) {
        const style = await drawn('android', role, { fontSize, dense });
        if (
          style.lineHeight !== derivedLine(role, fontSize, dense) ||
          style.marginTop !== undefined ||
          style.marginBottom !== undefined
        ) {
          lifted.push(`${dense ? 'dense ' : ''}${fontSize}: line ${style.lineHeight}`);
        }
      }
    }
    expect(lifted).toEqual([]);
  });
});

describe('the render-time audit', () => {
  it('judges what iOS draws: the suite renders as iOS, and an Android render is not held to it', async () => {
    expect(Platform.OS).toBe('ios');
    const count = () => (
      <Text fontFamily={fonts.displayXBold} fontSize={44} lineHeight={36}>
        2
      </Text>
    );
    // The line the attention count had: iOS cuts its top, Android paints it whole.
    await asPlatform('ios', () => wrap(count()));
    expect(takeTextClipping()).toHaveLength(1);
    await asPlatform('android', () => wrap(count()));
    expect(takeTextClipping()).toEqual([]);
    // A role on Android draws the caller's line, and is not reported for it either.
    await asPlatform('android', () =>
      wrap(
        <roles.Display fontSize={44} lineHeight={36}>
          2
        </roles.Display>,
      ),
    );
    expect(takeTextClipping()).toEqual([]);
  });

  it('reports a Tamagui Text on a line short of its ink', async () => {
    await wrap(
      <Text fontFamily={fonts.bodyBold} fontSize={14} lineHeight={16} testID="planted">
        PRŮVODCE
      </Text>,
    );
    const found = takeTextClipping();
    expect(found).toHaveLength(1);
    expect(found[0]).toContain('testID "planted"');
    expect(found[0]).toContain('"PRŮVODCE"');
    expect(found[0]).toContain('PublicSans-Bold 14 on lineHeight 16');
  });

  it('reports a bundled face left on its own line', async () => {
    await wrap(<RNText style={{ fontFamily: fonts.bodyRegular, fontSize: 15 }}>Ů</RNText>);
    expect(takeTextClipping()).toHaveLength(1);
  });

  it('holds a nested Text to the line and face it inherits', async () => {
    await wrap(
      <RNText style={{ fontFamily: fonts.bodyRegular, fontSize: 15, lineHeight: 21 }}>
        fine <RNText style={{ fontSize: 20 }}>too big for 21</RNText>
      </RNText>,
    );
    const found = takeTextClipping();
    expect(found).toHaveLength(1);
    expect(found[0]).toContain('PublicSans-Regular 20 on lineHeight 21');
  });

  it('reports a role nested in another Text that had to lift its line', async () => {
    // Badge's 13/16 is lifted to 18 with -1 margins; a span has no margins to take it back with.
    await wrap(
      <roles.Body>
        Stav <roles.Badge>NOVÉ</roles.Badge>
      </roles.Body>,
    );
    const found = takeTextClipping();
    expect(found).toHaveLength(1);
    expect(found[0]).toContain('is a span inside another Text');
  });

  it('does not pass a Text that names no face: it is the system font', async () => {
    await wrap(<RNText style={{ fontSize: 14, lineHeight: 14 }}>Ž</RNText>);
    expect(takeTextClipping()).toHaveLength(1);
    await wrap(<RNText style={{ fontSize: 14, lineHeight: 17 }}>Ž</RNText>);
    expect(takeTextClipping()).toEqual([]);
  });

  it('does not pass a face nobody measured', async () => {
    await wrap(<RNText style={{ fontFamily: 'Courier', fontSize: 14 }}>x</RNText>);
    expect(takeTextClipping()[0]).toContain('neither a bundled face nor the system font');
  });
});

describe("Tamagui's own font scale (Paragraph, Button, H1-H6: the system font)", () => {
  /** Every size token of each config font whose own line is short of the system font's ink. */
  const clipping = () => {
    const found: string[] = [];
    for (const [name, font] of Object.entries(tamaguiConfig.fonts) as [string, any][]) {
      for (const [key, size] of Object.entries(font.size ?? {})) {
        const px = Number((size as any)?.val ?? size);
        const line = Number(font.lineHeight?.[key]?.val ?? font.lineHeight?.[key]);
        if (Number.isFinite(px) && Number.isFinite(line) && iosClips(systemInk, px, line)) {
          found.push(`${name} $${key}`);
        }
      }
    }
    return found;
  };
  const sources = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap(e =>
      e.isDirectory() ? sources(join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [join(dir, e.name)] : [],
    );
  const using = (pattern: RegExp) =>
    sources(join(ROOT, 'src')).filter(f => pattern.test(readFileSync(f, 'utf8')));

  it('draws what src/ reaches of it - the body font at its default size - whole', () => {
    expect(clipping()).not.toContain('body $true');
  });

  it('is short of the ink in its heading scale and large body sizes, which src/ never reaches', () => {
    // v5's heading lines run a few points over the size (17/20 by default): short of SF's 1.1933.
    expect(clipping()).toEqual(expect.arrayContaining(['heading $true', 'body $16']));
    expect(using(/<(H[1-6]|SizableText)\b/)).toEqual([]);
    expect(using(/\b(fontSize|size)=["{]\s*['"]?\$/)).toEqual([]);
  });
});
