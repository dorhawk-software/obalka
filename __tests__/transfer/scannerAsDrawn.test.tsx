// The code scanner as board R13 draws it (031 I51, agreed 2026-11-12): the picture dimmed around the
// envelope's window - 260 across, the 24 corner, a white edge - and under it a sheet with the hint in
// ink and Zrušit. Without the camera (declined, still being asked, or none on the phone) the same
// sheet holds the camera glyph in a well, the sentence, and Zrušit, over the dark ground.
//
// Until 2026-11-15 the hint was set in `surfaceAlt` on the dark ground: #221E18 on black in the dark
// theme, which nobody could read (R13's note on its dark phone).

import { fireEvent, render, within } from '@testing-library/react-native';
import { StyleSheet, type StyleProp, type TextStyle } from 'react-native';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import { darkTheme, lightTheme } from '../../src/theme/theme';
import { type as typeScale } from '../../src/theme/typeScale';
import { TransferCodeScanner } from '../../src/features/transfer/screens/CodeScanner';
import { t } from '../../src/i18n/strings';

jest.mock('../../src/services/telemetry/telemetry', () => ({
  reportFailure: jest.fn(),
}));

// What the stand-in camera answers: whether it may be used, and whether the phone has one.
let mockAllowed = true;
let mockDevice: { id: string } | null = { id: 'back' };

jest.mock('react-native-vision-camera', () => ({
  useCameraPermission: () => ({ hasPermission: mockAllowed, requestPermission: async () => mockAllowed }),
  useCameraDevice: () => mockDevice,
  Camera: () => null,
  isScannedCode: () => true,
  useObjectOutput: () => ({ kind: 'object-output' }),
  useFrameOutput: () => ({ kind: 'frame-output' }),
}));
jest.mock('react-native-nitro-zxing', () => ({
  useBarcodeScanner: () => ({ scanCodes: () => [] }),
}));
jest.mock('react-native-vision-camera-worklets', () => ({ provider: {} }));

const styleOf = (node: { props: Record<string, unknown> }) =>
  (StyleSheet.flatten(node.props.style as StyleProp<TextStyle>) ?? {}) as Record<string, unknown>;

const mount = async (dark = false, onCancel = () => {}) =>
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme={dark ? 'dark' : 'light'}>
      <AppThemeProvider isDark={dark}>
        <TransferCodeScanner onFound={() => {}} onCancel={onCancel} />
      </AppThemeProvider>
    </TamaguiProvider>,
  );

beforeEach(() => {
  mockAllowed = true;
  mockDevice = { id: 'back' };
});

describe('aiming, as R13 draws it', () => {
  it('cuts the envelope s window out of the dimmed picture: 260 across, the 24 corner', async () => {
    const view = await mount();
    const edge = styleOf(view.getByTestId('transfer-scanner-window', { includeHiddenElements: true }));
    expect([edge.width, edge.height, edge.borderTopLeftRadius, edge.borderTopWidth]).toEqual([260, 260, 24, 2]);
    expect(view.getByTestId('transfer-scanner-dim', { includeHiddenElements: true })).toBeTruthy();
  });

  it.each([
    ['light', false, lightTheme],
    ['dark', true, darkTheme],
  ] as const)('says where to aim in ink on the sheet, in %s', async (_name, dark, theme) => {
    const view = await mount(dark);
    const sheet = view.getByTestId('transfer-scanner-sheet');
    expect(styleOf(sheet).backgroundColor).toBe(theme.surfaceAlt);
    const hint = within(sheet).getByText(t('transfer.scan.hint'));
    expect([styleOf(hint).fontFamily, styleOf(hint).color]).toEqual([typeScale.smallStrong.fontFamily, theme.text]);
  });

  it('closes with Zrušit, the neutral button with its cross', async () => {
    const onCancel = jest.fn();
    const view = await mount(false, onCancel);
    await fireEvent.press(within(view.getByTestId('transfer-scanner-sheet')).getByTestId('transfer-scanner-close'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe('without the camera, as R13 draws it', () => {
  it.each([
    [
      'declined, or still being asked',
      (): void => {
        mockAllowed = false;
      },
      'transfer.scan.denied',
    ],
    [
      'none on the phone',
      (): void => {
        mockDevice = null;
      },
      'transfer.scan.noCamera',
    ],
  ] as const)('%s: the camera in a well over the sentence, and no window', async (_name, arrange, key) => {
    arrange();
    const view = await mount();
    const sheet = view.getByTestId('transfer-scanner-sheet');
    const well = within(sheet).getByTestId('transfer-scanner-well', { includeHiddenElements: true });
    expect([styleOf(well).width, styleOf(well).height, styleOf(well).borderTopLeftRadius]).toEqual([56, 56, 16]);
    expect(styleOf(within(sheet).getByText(t(key))).fontFamily).toBe(typeScale.smallStrong.fontFamily);
    expect(view.queryByTestId('transfer-scanner-window', { includeHiddenElements: true })).toBeNull();
  });
});
