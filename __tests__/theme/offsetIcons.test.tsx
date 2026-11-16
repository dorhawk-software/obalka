// The offset glyphs (031, board "Icon set - offset print"): one ink stroke and one plane printed off
// register. These hold what makes a glyph an offset print, in both themes, for every glyph.

import { render } from '@testing-library/react-native';
import { readFileSync } from 'fs';
import { join } from 'path';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import { darkTheme, lightTheme } from '../../src/theme/theme';
import { OFFSET_GLYPHS, OffsetIcon, type OffsetGlyphName } from '../../src/theme/offsetIcons';
import { offsetPrint } from '../../src/theme/print';

const NAMES = Object.keys(OFFSET_GLYPHS) as OffsetGlyphName[];
const INK = '#123456';

// react-native-svg hands a colour to the native view as { type: 0, payload: 0xAARRGGBB }.
function native(hex: string) {
  return { type: 0, payload: (0xff000000 + parseInt(hex.slice(1), 16)) >>> 0 };
}

/** The same, for a colour at an alpha: 0xAA in the top byte. */
function withAlpha(hex: string, alpha: number) {
  const a = Math.round(alpha * 255);
  return { type: 0, payload: ((a << 24) >>> 0) + parseInt(hex.slice(1), 16) };
}

function hasFill(n: Node, hex: string) {
  return JSON.stringify(n.props.fill) === JSON.stringify(native(hex));
}

type Node = { type: string; props: Record<string, unknown>; children: Node[] | null };

function nodes(root: Node | Node[] | null): Node[] {
  const out: Node[] = [];
  const walk = (n: Node | string) => {
    if (typeof n === 'string') {
      return;
    }
    out.push(n);
    (n.children ?? []).forEach(walk);
  };
  (Array.isArray(root) ? root : root ? [root] : []).forEach(walk);
  return out;
}

async function draw(name: OffsetGlyphName, isDark: boolean, plane?: 'blue' | 'gold') {
  const view = await render(
    <AppThemeProvider isDark={isDark}>
      <OffsetIcon name={name} size={24} color={INK} plane={plane} />
    </AppThemeProvider>,
  );
  return nodes(view.toJSON() as Node);
}

describe('the offset glyphs', () => {
  it('are the agreed board\'s twenty-one glyphs and the six the buttons took (T050.7)', () => {
    expect(NAMES).toEqual([
      'inbox', 'sent', 'compose', 'search', 'attach', 'seal', 'deadline', 'fiction', 'boxes', 'lock',
      'archive', 'transfer', 'settings', 'bell', 'download', 'receipt', 'postmark', 'opened', 'draft',
      'remind', 'bug', 'bin', 'restore', 'retry', 'share', 'key', 'save',
    ]);
  });

  it('give the error-report row the bug, so the bell keeps one meaning', () => {
    // The bell led "Posílat hlášení o chybách" as well as the notifications question and the SMS
    // notice, and read as notifications; the owner's answer 12 (2026-11-15) drew a bug for it.
    const src = readFileSync(join(__dirname, '../../src/app/settings/SettingsScreen.tsx'), 'utf8');
    const row = src.slice(src.indexOf("t('settings.diagnostics')"), src.indexOf('telemetry-toggle'));
    expect(row).toContain('<Well name="bug" />');
  });

  describe.each([
    ['light', false, lightTheme],
    ['dark', true, darkTheme],
  ] as const)('%s', (_label, isDark, theme) => {
    it.each(NAMES)('%s prints its plane in the theme\'s plane colour, off register', async name => {
      const all = await draw(name, isDark);
      const planeGroup = all.find(n => n.props.matrix !== undefined && hasFill(n, theme.iconPlane));
      expect(planeGroup).toBeDefined();
      // react-native-svg turns the translate into a matrix: [1, 0, 0, 1, dx, dy].
      const off = offsetPrint.planeOffset;
      expect(planeGroup?.props.matrix).toEqual([1, 0, 0, 1, off, off]);
    });

    it.each(NAMES)('%s draws its ink in the caller\'s colour at the offset-print stroke', async name => {
      const all = await draw(name, isDark);
      const ink = all.find(n => JSON.stringify(n.props.stroke) === JSON.stringify(native(INK)));
      expect(ink?.props.strokeWidth).toBe(offsetPrint.stroke);
      // The native enums: 1 is round, for both the cap and the join.
      expect(ink?.props.strokeLinecap).toBe(1);
      expect(ink?.props.strokeLinejoin).toBe(1);
      // fill="none" reaches the native view as no brush at all.
      expect(ink?.props.fill).toBeNull();
    });

    // A glyph keeps one ink (practices 1.6.3; the owner, 2026-11-16: the red bin on its blue plane
    // "doesn't play very well"). A coloured ink takes a faint tint of itself; a neutral or a blue keeps
    // the family's plane.
    it('prints a red ink\'s plane in its own red, faint', async () => {
      const view = await render(
        <AppThemeProvider isDark={isDark}>
          <OffsetIcon name="bin" size={24} color={theme.danger} />
        </AppThemeProvider>,
      );
      const all = nodes(view.toJSON() as Node);
      const tint = withAlpha(theme.danger, theme.iconPlaneTint);
      expect(all.some(n => JSON.stringify(n.props.fill) === JSON.stringify(tint))).toBe(true);
      expect(all.some(n => hasFill(n, theme.iconPlane))).toBe(false);
    });

    it.each([
      ['the ink', theme.text],
      ['the link blue', theme.blue],
    ])('keeps the family\'s blue plane under %s', async (_what, ink) => {
      const view = await render(
        <AppThemeProvider isDark={isDark}>
          <OffsetIcon name="bin" size={24} color={ink} />
        </AppThemeProvider>,
      );
      expect(nodes(view.toJSON() as Node).some(n => hasFill(n, theme.iconPlane))).toBe(true);
    });

    it('takes the gold plane under a glyph that sits on gold', async () => {
      const all = await draw('fiction', isDark, 'gold');
      expect(all.some(n => hasFill(n, theme.iconPlaneGold))).toBe(true);
      expect(all.some(n => hasFill(n, theme.iconPlane))).toBe(false);
    });
  });

  it('is hidden from assistive technology: the words beside it say the thing', async () => {
    const all = await draw('inbox', false);
    expect(all[0].props.accessibilityElementsHidden).toBe(true);
    expect(all[0].props.importantForAccessibility).toBe('no-hide-descendants');
  });

  it('draws the plane before the ink, so the ink prints over it', () => {
    for (const name of NAMES) {
      const glyph = OFFSET_GLYPHS[name];
      expect(glyph.plane.length).toBeGreaterThan(0);
      expect(glyph.ink.length).toBeGreaterThan(0);
    }
  });
});
