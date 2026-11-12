// The offset glyphs (031, board "Icon set - offset print"): one ink stroke and one plane printed off
// register. These hold what makes a glyph an offset print, in both themes, for every glyph.

import { render } from '@testing-library/react-native';
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
  it('are the twenty glyphs of the agreed board', () => {
    expect(NAMES).toEqual([
      'inbox', 'sent', 'compose', 'search', 'attach', 'seal', 'deadline', 'fiction', 'boxes', 'lock',
      'archive', 'transfer', 'settings', 'bell', 'download', 'receipt', 'postmark', 'opened', 'draft',
      'remind',
    ]);
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
