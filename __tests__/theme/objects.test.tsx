// The printed objects (031, T022): each one as the agreed canvas draws it - the holes where the canvas's
// mask cuts them, the colours from the theme in both appearances, hidden from assistive technology
// where the words beside them say the thing.

import { fireEvent, render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { processColor, StyleSheet, Text } from 'react-native';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import { objectFilter, objectShadow } from '../../src/theme/depth';
import { AirmailStrip, airmailBands } from '../../src/theme/objects/AirmailStrip';
import { Envelope, EnvelopeTile } from '../../src/theme/objects/Envelope';
import { paperPath, slipHoles, stampHoles } from '../../src/theme/objects/perforation';
import { Postmark } from '../../src/theme/objects/Postmark';
import { SecurityTint } from '../../src/theme/objects/SecurityTint';
import { Slip } from '../../src/theme/objects/Slip';
import { Stamp } from '../../src/theme/objects/Stamp';
import { Window, gradientLine } from '../../src/theme/objects/Window';
import { perforation, securityTint } from '../../src/theme/print';
import { darkTheme, lightTheme } from '../../src/theme/theme';

type Node = { type: string; props: Record<string, unknown>; children: (Node | string)[] | null };

function nodes(root: unknown): Node[] {
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

// react-native-svg hands a colour to the native view as { type: 0, payload: <processed colour> }.
const brush = (color: string) => JSON.stringify({ type: 0, payload: processColor(color) });
const filled = (all: Node[], color: string) => all.filter(n => JSON.stringify(n.props.fill) === brush(color));
const stroked = (all: Node[], color: string) => all.filter(n => JSON.stringify(n.props.stroke) === brush(color));
const style = (n: Node) => (StyleSheet.flatten(n.props.style as never) ?? {}) as Record<string, unknown>;

/** Renders in a theme and, like the device, lays the root out at `size`. */
async function draw(ui: ReactElement, isDark: boolean, size = { width: 240, height: 96 }) {
  const view = await render(<AppThemeProvider isDark={isDark}>{ui}</AppThemeProvider>);
  const root = nodes(view.toJSON())[0];
  if (root.props.onLayout && view.root) {
    await fireEvent(view.root, 'layout', { nativeEvent: { layout: { x: 0, y: 0, ...size } } });
  }
  return { view, all: () => nodes(view.toJSON()) };
}

describe('the perforations, as the canvas cuts them', () => {
  // The stamp on board Main: a 112 x 80 frame in 12 of paper, so the paper is 136 x 104.
  const holes = stampHoles(136, 104, perforation.stamp);

  it('cut every edge of a stamp, a hole at each corner', () => {
    const r = perforation.stamp.radius;
    expect(holes.some(h => Math.abs(h.cx) < r && Math.abs(h.cy) < r)).toBe(true);
    expect(holes.some(h => Math.abs(h.cx - 136) < r && Math.abs(h.cy - 104) < r)).toBe(true);
    for (const edge of [(h: { cy: number }) => h.cy < r, (h: { cy: number }) => h.cy > 104 - r]) {
      expect(holes.filter(edge).length).toBe(12);
    }
  });

  it('fit a whole number of holes along each side, as `round` stretches them', () => {
    const top = holes.filter(h => h.cy < 1).map(h => h.cx);
    const step = top[1] - top[0];
    expect(step).toBeCloseTo(136 / 11, 5);
    expect(step).toBeGreaterThan(2 * perforation.stamp.radius);
    // The mask sits at -pitch / 2 and `round` stretches only the tiles, so the first hole lies half the
    // stretch past the corner, not on it.
    expect(top[0]).toBeCloseTo(-perforation.stamp.pitch / 2 + step / 2, 5);
  });

  it('keep the inner ring the agreed board shows, where the grid reaches into the margin', () => {
    // The canvas's 12 of paper equals the pitch, so the grid's second row cuts half-holes beside the
    // frame. That is the agreed drawing (board Main, rendered at 3x on 2026-11-12), kept one to one.
    expect(holes.some(h => h.cx > 6 && h.cx < 20 && h.cy > 6 && h.cy < 20)).toBe(true);
  });

  it('never cut the printed frame: every hole reaches into the margin', () => {
    const { inset, radius } = perforation.stamp;
    for (const h of holes) {
      const inside =
        h.cx - radius >= inset && h.cx + radius <= 136 - inset && h.cy - radius >= inset && h.cy + radius <= 104 - inset;
      expect(inside).toBe(false);
    }
  });

  it('tear a slip along its top: one row on the edge, the first half a pitch in', () => {
    const row = slipHoles(200, perforation.slip);
    expect(row.every(h => h.cy === 0)).toBe(true);
    expect(row[0].cx).toBe(perforation.slip.pitch / 2);
    expect(row[1].cx - row[0].cx).toBe(perforation.slip.pitch);
    expect(row[row.length - 1].cx - perforation.slip.radius).toBeLessThan(200);
    expect(row.length).toBe(15);
  });

  it('draw the paper and its holes as one path, rounding a slip\'s bottom corners', () => {
    const d = paperPath(200, 90, slipHoles(200, perforation.slip), perforation.slip.corner);
    expect(d.startsWith('M0 0H200V76A14 14 0 0 1 186 90H14A14 14 0 0 1 0 76Z')).toBe(true);
    expect(d.match(/Z/g)).toHaveLength(1 + 15);
  });
});

describe.each([
  ['light', false, lightTheme],
  ['dark', true, darkTheme],
] as const)('%s', (_label, isDark, theme) => {
  describe('the stamp', () => {
    it('is stamp paper with a stamp-frame rule, its shadow a filter that follows the holes', async () => {
      const { all } = await draw(
        <Stamp kind="stamp" shadow="stamp">
          <Text>0 Kč</Text>
        </Stamp>,
        isDark,
        { width: 136, height: 104 },
      );
      const root = all()[0];
      expect(style(root).filter).toBe(objectFilter(theme.name, 'stamp'));
      expect(style(root).padding).toBe(perforation.stamp.inset);
      const paper = filled(all(), theme.stampPaper);
      expect(paper.length).toBe(2);
      expect(paper[0].props.fillRule).toBe(0); // evenodd
      expect(all().some(n => style(n).borderColor === theme.stampFrame)).toBe(true);
    });

    it('in the flap\'s gold is the compose button: a flap-frame rule, the gold glow', async () => {
      const { all } = await draw(
        <Stamp kind="fab" paper="flap" shadow="stampFab">
          <Text>Napsat</Text>
        </Stamp>,
        isDark,
        { width: 140, height: 60 },
      );
      expect(style(all()[0]).filter).toBe(objectFilter(theme.name, 'stampFab'));
      expect(filled(all(), theme.flap).length).toBe(2);
      expect(all().some(n => style(n).borderColor === theme.flapFrame)).toBe(true);
    });

    it('stuck on an envelope casts no shadow of its own', async () => {
      const { all } = await draw(
        <Stamp kind="stampSmall">
          <Text>0 Kč</Text>
        </Stamp>,
        isDark,
      );
      expect(style(all()[0]).filter).toBeUndefined();
    });
  });

  describe('the slip', () => {
    it('is the surface, with its 1 pt border edge drawn as the same shape one point lower', async () => {
      const { all } = await draw(
        <Slip>
          <Text>Doručenka</Text>
        </Slip>,
        isDark,
        { width: 200, height: 90 },
      );
      expect(filled(all(), theme.surface).length).toBe(1);
      const edge = filled(all(), theme.border);
      expect(edge.length).toBe(1);
      const lowered = all().find(n => JSON.stringify(n.props.matrix) === JSON.stringify([1, 0, 0, 1, 0, 1]));
      expect(lowered).toBeDefined();
      expect(style(all()[0]).filter).toBe(objectFilter(theme.name, 'slip'));
    });
  });

  describe('the window', () => {
    it('is window paper with an inset shade, and its film under the words', async () => {
      const { all } = await draw(
        <Window>
          <Text>Ondřej Dvořák</Text>
        </Window>,
        isDark,
        { width: 200, height: 76 },
      );
      const root = all()[0];
      expect(style(root).backgroundColor).toBe(theme.window);
      expect(style(root).boxShadow).toBe(objectShadow(theme.name, 'window'));
      expect(all().some(n => n.type === 'RNSVGFeGaussianBlur')).toBe(true);
      expect(filled(all(), theme.windowGlint).length).toBe(1);
      // The film comes first, so the words print over it.
      const kids = (root.children ?? []).filter((c): c is Node => typeof c !== 'string');
      expect(kids[0].type).toBe('RNSVGSvgView');
    });

    it(isDark ? 'keeps the film to its margins at night' : 'lets the film cover it by day', async () => {
      const { all } = await draw(
        <Window>
          <Text>Ondřej Dvořák</Text>
        </Window>,
        isDark,
        { width: 200, height: 76 },
      );
      expect(all().some(n => n.type === 'RNSVGMask')).toBe(isDark);
    });
  });

  describe('the security tint', () => {
    it('prints the envelope\'s chevrons at the theme\'s strength', async () => {
      const { all } = await draw(<SecurityTint />, isDark);
      expect(stroked(all(), theme.envelope).length).toBe(1);
      const print = all().find(n => n.type === 'RNSVGRect' && n.props.opacity !== undefined);
      expect(print?.props.opacity).toBe(securityTint.opacity[theme.name]);
      expect(all().some(n => n.type === 'RNSVGMask')).toBe(false);
    });

    it('fades towards the middle behind the lock', async () => {
      const { all } = await draw(<SecurityTint vignette />, isDark);
      expect(all().some(n => n.type === 'RNSVGMask')).toBe(true);
    });
  });

  describe('the postmark', () => {
    it('sets the words round the ring and the date in the middle, in the envelope\'s soft ink', async () => {
      const { view, all } = await draw(
        <Postmark ring="DODÁNO · DATOVÁ SCHRÁNKA ·" line1="19.08." line2="11:24" />,
        isDark,
      );
      expect(JSON.stringify(view.toJSON())).toContain('DODÁNO · DATOVÁ SCHRÁNKA ·');
      expect(JSON.stringify(view.toJSON())).toContain('19.08.');
      expect(stroked(all(), theme.envelopeInkSoft).length).toBe(1);
      expect(all()[0].props.height).toBe(87);
    });
  });

  describe('the envelope', () => {
    it('is the envelope\'s blue with its two folds and its shadow', async () => {
      const { all } = await draw(
        <Envelope>
          <Text>Magistrát</Text>
        </Envelope>,
        isDark,
      );
      const root = all()[0];
      expect(style(root).backgroundColor).toBe(theme.envelope);
      expect(style(root).boxShadow).toBe(objectShadow(theme.name, 'envelope'));
      expect(stroked(all(), theme.envelopeCrease).length).toBe(1);
    });

    it('as a tile is sealed with the gold flap while unread', async () => {
      const { view, all } = await draw(<EnvelopeTile name="Magistrát Hlavní" color="#1F7A57" sealed />, isDark);
      expect(filled(all(), theme.flap).length).toBe(1);
      expect(stroked(all(), theme.envelopeFold).length).toBe(0);
      expect(JSON.stringify(view.toJSON())).toContain('MH');
      expect(all()[0].props.accessibilityElementsHidden).toBe(true);
    });

    it('as a box\'s 40 pt tile is the same drawing, scaled', async () => {
      const { all } = await draw(<EnvelopeTile name="Ůřad Dvořák" color="#2563A6" size={40} />, isDark);
      expect(all()[0].props.style).toMatchObject({ width: 40, height: 40 });
      expect(stroked(all(), theme.envelopeFold).length).toBe(1);
    });

    it('as a tile shows its fold once read', async () => {
      const { all } = await draw(<EnvelopeTile name="Magistrát Hlavní" color="#1F7A57" />, isDark);
      expect(filled(all(), theme.flap).length).toBe(0);
      expect(stroked(all(), theme.envelopeFold).length).toBe(1);
    });
  });

  describe('the airmail strip', () => {
    it('stripes blue and gold over paper, with the label on the surface', async () => {
      const { all } = await draw(
        <AirmailStrip>
          <Text>Testovací prostředí</Text>
        </AirmailStrip>,
        isDark,
        { width: 390, height: 40 },
      );
      expect(filled(all(), theme.envelope).length).toBeGreaterThan(5);
      expect(filled(all(), theme.flap).length).toBeGreaterThan(5);
      expect(filled(all(), theme.stampPaper).length).toBe(1);
      expect(all().some(n => style(n).backgroundColor === theme.surface)).toBe(true);
    });
  });

  it('hides every drawing from assistive technology', async () => {
    const drawings = [
      <Stamp key="s" kind="stamp"><Text>x</Text></Stamp>,
      <Slip key="l"><Text>x</Text></Slip>,
      <Window key="w"><Text>x</Text></Window>,
      <SecurityTint key="t" />,
      <Postmark key="p" ring="x" line1="x" line2="x" />,
      <Envelope key="e"><Text>x</Text></Envelope>,
      <AirmailStrip key="a"><Text>x</Text></AirmailStrip>,
    ];
    for (const ui of drawings) {
      const { all } = await draw(ui, isDark);
      for (const svg of all().filter(n => n.type === 'RNSVGSvgView')) {
        expect(svg.props.accessibilityElementsHidden).toBe(true);
        expect(svg.props.importantForAccessibility).toBe('no-hide-descendants');
      }
    }
  });
});

describe('the airmail stripes', () => {
  it('start blue at the top-left corner and run at 135 degrees, 28 to a repeat', () => {
    const bands = airmailBands(390, 40);
    expect(bands[0]).toEqual({ d: `M0 0H${9 * Math.SQRT2}L${9 * Math.SQRT2 - 40} 40H-40Z`, stripe: 0 });
    expect(bands[1].stripe).toBe(2);
    expect(bands[2].d.startsWith(`M${28 * Math.SQRT2} 0`)).toBe(true);
  });

  it('cover the strip to its far corner', () => {
    const bands = airmailBands(390, 40);
    const last = bands[bands.length - 1].d;
    const start = Number(/^M([\d.]+) 0/.exec(last)?.[1]);
    expect(start + 28 * Math.SQRT2).toBeGreaterThan(390 + 40);
  });
});

describe('the glint\'s gradient line', () => {
  it('runs as CSS lays it: 90 degrees left to right, 180 top to bottom', () => {
    const across = gradientLine(90, 200, 76);
    expect(across.x1).toBeCloseTo(0, 6);
    expect(across.y1).toBeCloseTo(38, 6);
    expect(across.x2).toBeCloseTo(200, 6);
    const down = gradientLine(180, 200, 76);
    expect(down.y1).toBeCloseTo(0, 6);
    expect(down.y2).toBeCloseTo(76, 6);
  });

  it('puts the corners on the first and last stop at 112 degrees', () => {
    const l = gradientLine(112, 200, 76);
    const dx = l.x2 - l.x1;
    const dy = l.y2 - l.y1;
    const along = (x: number, y: number) => ((x - l.x1) * dx + (y - l.y1) * dy) / (dx * dx + dy * dy);
    expect(along(0, 0)).toBeCloseTo(0, 6);
    expect(along(200, 76)).toBeCloseTo(1, 6);
  });
});
