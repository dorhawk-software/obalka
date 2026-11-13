// The recovery key and the transfer phrase as board R6 draws them (031, agreed 2026-11-12): a slip on
// the security tint, the code three parts and two, the QR on the board's plate with the logo in its
// own colours over the omitted modules, and the sunken neutral button under it.

import { render } from '@testing-library/react-native';
import { processColor, StyleSheet } from 'react-native';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import { darkTheme, lightTheme } from '../../src/theme/theme';
import { SecureSlip, SlipCode } from '../../src/theme/objects/SecureSlip';
import { QrCode } from '../../src/theme/QrCode';
import { NeutralButton } from '../../src/theme/NeutralButton';
import { encodeKeyQr, qrMatrix } from '../../src/services/backup/keyQr';

const KEY = 'H7QX-3MKD-9TVB-2PRN-6WCA';
const PHRASE = '4RJH-balada-beton-atlas-bizon';

const themed = (ui: React.ReactElement, isDark = false) =>
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme={isDark ? 'dark' : 'light'}>
      <AppThemeProvider isDark={isDark}>{ui}</AppThemeProvider>
    </TamaguiProvider>,
  );

/** A node's style, flattened; Tamagui writes a corner out per side. */
const flat = (node: { props: { style?: unknown } }) =>
  (StyleSheet.flatten(node.props.style as never) ?? {}) as Record<string, unknown>;

type Json = { type: string; props: Record<string, unknown>; children: (Json | string)[] | null };

/** Every node under `node` (itself included) that `match` accepts. */
function nodes(node: Json | Json[] | null, match: (n: Json) => boolean, out: Json[] = []): Json[] {
  if (!node) {
    return out;
  }
  for (const n of Array.isArray(node) ? node : [node]) {
    if (match(n)) {
      out.push(n);
    }
    (n.children ?? []).forEach(child => (typeof child === 'string' ? null : nodes(child, match, out)));
  }
  return out;
}

/** The rendered node with this testID. */
const byId = (root: Json, id: string) => nodes(root, n => n.props.testID === id)[0];

/** Every string under a node, line by line: one entry per line of the code. */
function lineTexts(node: Json): string[] {
  const text = (n: Json | string): string =>
    typeof n === 'string' ? n : (n.children ?? []).map(text).join('');
  return (node.children as Json[]).map(text);
}

describe('a slip on the tint', () => {
  it.each([
    ['light', false],
    ['dark', true],
  ] as const)('lies on the surface-alt panel with the 16 corner and the tint behind it, in %s', async (_, isDark) => {
    const view = await themed(
      <SecureSlip testID="panel">
        <SlipCode parts={KEY.split('-')} accessibilityLabel={KEY} />
      </SecureSlip>,
      isDark,
    );
    const panel = view.getByTestId('panel');
    expect(flat(panel)).toEqual(
      expect.objectContaining({
        borderTopLeftRadius: 16,
        backgroundColor: (isDark ? darkTheme : lightTheme).surfaceAlt,
        paddingTop: 18,
        paddingLeft: 14,
        paddingRight: 14,
        paddingBottom: 16,
      }),
    );
    // The tint's pattern is the first thing in the panel, under the slip.
    expect(JSON.stringify(view.toJSON())).toContain('"tint"');
  });
});

describe('the code on a slip', () => {
  it('sets the key three groups and two, reading as the key itself', async () => {
    const view = await themed(<SlipCode parts={KEY.split('-')} accessibilityLabel={KEY} testID="key" />);
    const key = view.getByTestId('key');
    expect(key.props.accessibilityLabel).toBe(KEY);
    expect(lineTexts(view.toJSON() as Json)).toEqual(['H7QX-3MKD-9TVB-', '2PRN-6WCA']);
    expect(key).toHaveTextContent(KEY);
  });

  it('sets the phrase the same way, its dashes in faint ink and the key s in ink', async () => {
    const view = await themed(
      <>
        <SlipCode parts={PHRASE.split('-')} faintDashes accessibilityLabel={PHRASE} testID="phrase" />
        <SlipCode parts={KEY.split('-')} accessibilityLabel={KEY} testID="key" />
      </>,
    );
    const root = view.toJSON() as unknown as Json[];
    const dashes = (id: string) =>
      nodes(nodes(root, n => n.props.testID === id)[0], n => n.children?.length === 1 && n.children[0] === '-').map(
        n => flat(n).color,
      );
    expect(new Set(dashes('phrase'))).toEqual(new Set([lightTheme.textFaint]));
    expect(dashes('phrase')).toHaveLength(4);
    expect(new Set(dashes('key'))).toEqual(new Set([lightTheme.text]));
  });
});

describe('the QR plate', () => {
  it('is ink on the board s paper with the 8 corner, the logo s tile exactly over the omitted modules', async () => {
    const size = 170;
    const view = await themed(<QrCode value={encodeKeyQr(KEY)} size={size} testID="qr" />);
    const plate = flat(view.getByTestId('qr'));
    expect(plate).toEqual(expect.objectContaining({ backgroundColor: '#FFFDF8', borderTopLeftRadius: 8 }));
    // The modules are the board's ink; the mark is the logo in its own blue and gold.
    // react-native-svg hands a colour to the native view as { type: 0, payload: <processed colour> }.
    const all = nodes(view.toJSON() as unknown as Json, () => true);
    const brush = (color: string) => JSON.stringify({ type: 0, payload: processColor(color) });
    for (const ink of ['#211B12', '#2563A6', '#FFC305']) {
      expect(all.some(n => JSON.stringify(n.props.fill) === brush(ink))).toBe(true);
    }
    // Its tile (142.2..883.5 of the logo's 1024) starts where the hole does and spans 7 modules.
    const modules = qrMatrix(encodeKeyQr(KEY)).length;
    const unit = size / (modules + 8);
    const holeAt = (Math.floor((modules - 7) / 2) + 4) * unit;
    const mark = flat(view.getByTestId('qr-mark'));
    const markSize = (7 * unit * 1024) / (883.5 - 142.2);
    expect(Number(mark.left) + (142.2 / 1024) * markSize).toBeCloseTo(holeAt, 6);
    expect(Number(mark.top) + (142.2 / 1024) * markSize).toBeCloseTo(holeAt, 6);
  });
});

describe('the neutral button', () => {
  it('is sunken tone with the 14 corner and an ink label, 48 in a pair and 52 alone', async () => {
    const view = await themed(
      <>
        <NeutralButton compact label="Skrýt heslo" onPress={() => {}} testID="pair" />
        <NeutralButton label="Zálohovat" onPress={() => {}} testID="alone" />
      </>,
    );
    const root = view.toJSON() as unknown as Json[];
    const face = (id: string) => flat(nodes(byId(root as never, id), n => flat(n).minHeight !== undefined)[0]);
    expect(face('pair')).toEqual(
      expect.objectContaining({ minHeight: 48, borderTopLeftRadius: 14, backgroundColor: lightTheme.surfaceSunken }),
    );
    expect(face('pair').borderTopWidth ?? 0).toBe(0);
    expect(face('alone').minHeight).toBe(52);
    const label = nodes(root as never, n => n.children?.[0] === 'Skrýt heslo')[0];
    expect(flat(label).color).toBe(lightTheme.text);
  });
});
