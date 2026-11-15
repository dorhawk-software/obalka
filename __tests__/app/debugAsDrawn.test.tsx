// The Debug screen as board R13 draws it (031 I47, agreed 2026-11-12): the intro in body text, the
// level's notes as meta lines under its sheet of choices, the start as the filled button; while
// recording, one card holding the dot and the counter, the hint, the stop and the discard, with the
// choices dimmed above it; the saved notice as a tinted strip under the start; and the saved files
// as rows of a name, its size and two halves - Sdílet filled, Smazat neutral in the danger ink. With
// nothing saved, a line of muted text and no card.

import { Dimensions, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { fireEvent, render, waitFor, within } from '@testing-library/react-native';
import RNBlobUtil from 'react-native-blob-util';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import { lightTheme } from '../../src/theme/theme';
import { chipTone } from '../../src/theme/chipTone';
import { type as typeScale } from '../../src/theme/typeScale';
import { t } from '../../src/i18n/strings';
import { DebugScreen } from '../../src/app/settings/DebugScreen';
import { cancelDebug } from '../../src/services/debug/debugController';
import { bundleDir } from '../../src/services/debug/debugBundle';
import { deleteAllBundles } from '../../src/services/debug/debugStore';

/** The boards' `strip`: 44 tall at the least, whatever it says. */
const STRIP_ROW = 44;

const mount = async () => {
  const view = await render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <AppThemeProvider isDark={false}>
        <DebugScreen onBack={() => {}} />
      </AppThemeProvider>
    </TamaguiProvider>,
  );
  await waitFor(() => expect(view.queryByTestId('debug-saved-loading')).toBeNull());
  return view;
};

const styleOf = (element: { props: Record<string, unknown> }) =>
  (StyleSheet.flatten(element.props.style as StyleProp<ViewStyle>) ?? {}) as Record<string, unknown>;

/** The type role a Text is drawn in, by its size, line and face. */
const roleOf = (element: { props: Record<string, unknown> }) => {
  const style = styleOf(element);
  return { fontSize: style.fontSize, lineHeight: style.lineHeight, fontFamily: style.fontFamily };
};
const role = (name: keyof typeof typeScale) => ({
  fontSize: typeScale[name].fontSize,
  lineHeight: typeScale[name].lineHeight,
  fontFamily: typeScale[name].fontFamily,
});

afterEach(async () => {
  cancelDebug();
  await deleteAllBundles();
});

describe('at rest, as R13 draws it', () => {
  it('says what the mode is in body text, and the level s notes as meta lines', async () => {
    const view = await mount();
    expect(roleOf(view.getByTestId('debug-intro'))).toEqual(role('small'));
    expect(styleOf(view.getByTestId('debug-intro')).color).toBe(lightTheme.bodyText);
    expect(roleOf(view.getByTestId('debug-level-desc'))).toEqual(role('meta'));
    expect(roleOf(view.getByTestId('debug-creds'))).toEqual(role('meta'));
  });

  it('holds no room for a notice before there is one', async () => {
    const view = await mount();
    expect(view.queryByTestId('debug-notice', { includeHiddenElements: true })).toBeNull();
  });

  it('says there is nothing saved as a line of text, not as a card row', async () => {
    const view = await mount();
    const empty = view.getByTestId('debug-empty');
    expect(roleOf(empty)).toEqual(role('small'));
    expect(empty).toHaveTextContent(t('debug.saved.empty'));
  });
});

describe('recording, as R13 draws it', () => {
  it('gathers the counter, the hint, the stop and the discard in one card, and dims the choices', async () => {
    const view = await mount();
    expect(styleOf(view.getByTestId('debug-levels')).opacity ?? 1).toBe(1);
    await fireEvent.press(view.getByTestId('debug-toggle'));
    await waitFor(() => view.getByTestId('debug-status'));
    const card = view.getByTestId('debug-recording');
    expect(within(card).getByTestId('debug-status')).toBeTruthy();
    expect(within(card).getByTestId('debug-toggle')).toHaveProp('accessibilityLabel', t('debug.stop'));
    expect(within(card).getByTestId('debug-discard')).toBeTruthy();
    expect(styleOf(view.getByTestId('debug-levels')).opacity).toBe(0.55);
  });

  it('says the count in the strong small text, the dot held to its first line', async () => {
    const { fontScale } = Dimensions.get('window');
    const view = await mount();
    await fireEvent.press(view.getByTestId('debug-toggle'));
    await waitFor(() => view.getByTestId('debug-status'));
    expect(roleOf(view.getByTestId('debug-status'))).toEqual(role('smallStrong'));
    expect(roleOf(view.getByTestId('debug-status-reserve', { includeHiddenElements: true }))).toEqual(
      role('smallStrong'),
    );
    expect(styleOf(view.getByTestId('debug-status-dot')).minHeight).toBe(
      typeScale.smallStrong.lineHeight * fontScale,
    );
  });
});

describe('after a save, as R13 draws it', () => {
  it('says what was saved in the blue strip, a finger tall or two lines at the reader s size', async () => {
    const { fontScale } = Dimensions.get('window');
    const view = await mount();
    await fireEvent.press(view.getByTestId('debug-toggle'));
    await fireEvent.press(view.getByTestId('debug-toggle'));
    await waitFor(() => expect(view.getByTestId('debug-notice')).toHaveTextContent(/obalka-debug-/));
    const strip = view.getByTestId('debug-notice-strip');
    expect(styleOf(strip).backgroundColor).toBe(lightTheme.blueSoft);
    expect(styleOf(strip).minHeight).toBe(Math.max(STRIP_ROW, 2 * typeScale.label.lineHeight * fontScale));
    expect(roleOf(view.getByTestId('debug-notice'))).toEqual(role('label'));
    expect(view.getByTestId('debug-notice').props.numberOfLines).toBe(2);
  });

  it('gives each file its name, its size, and Sdílet beside Smazat in the danger ink', async () => {
    const name = 'obalka-debug-2026-11-12-0930-standard.zip';
    await (RNBlobUtil.fs.writeFile as jest.Mock)(`${bundleDir()}/${name}`, 'UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA==', 'base64');
    const view = await mount();
    expect(roleOf(view.getByTestId('debug-name-0'))).toEqual(role('label'));
    expect(roleOf(view.getByTestId('debug-size-0'))).toEqual(role('meta'));
    expect(view.getByTestId('debug-share-0')).toHaveProp('accessibilityLabel', `${t('debug.share')}, ${name}`);
    const del = within(view.getByTestId('debug-delete-0')).getByText(t('debug.delete'), {
      includeHiddenElements: true,
    });
    expect(styleOf(del).color).toBe(lightTheme.danger);
    expect(roleOf(del)).toEqual(role('smallStrong'));
  });

  // Walked 2026-11-15 (031 I131): the question was the bare file name, broken mid-word on two lines,
  // over a body that said only "Smazat". It now asks the way the backup's delete does.
  it('asks before deleting as the backup does: the question, the file under it, what goes', async () => {
    const name = 'obalka-debug-2026-11-12-0930-standard.zip';
    await (RNBlobUtil.fs.writeFile as jest.Mock)(`${bundleDir()}/${name}`, 'UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA==', 'base64');
    const view = await mount();
    await fireEvent.press(view.getByTestId('debug-delete-0'));
    const dialog = view.getByTestId('debug-delete-dialog');
    expect(within(dialog).getByRole('header')).toHaveTextContent(t('debug.delete.title'));
    expect(within(dialog).getByText(name)).toBeTruthy();
    expect(within(dialog).getByText(t('debug.delete.body'))).toBeTruthy();
  });

  it('says a failure in the danger tone, in the same strip', async () => {
    (RNBlobUtil.fs.unlink as jest.Mock).mockRejectedValueOnce(new Error('EACCES'));
    const name = 'obalka-debug-2026-11-12-0930-standard.zip';
    await (RNBlobUtil.fs.writeFile as jest.Mock)(`${bundleDir()}/${name}`, 'UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA==', 'base64');
    const view = await mount();
    await fireEvent.press(view.getByTestId('debug-delete-0'));
    await fireEvent.press(view.getByTestId('debug-delete-confirm'));
    await waitFor(() => expect(view.getByTestId('debug-notice')).toHaveTextContent(t('debug.deleteError')));
    expect(styleOf(view.getByTestId('debug-notice-strip')).backgroundColor).toBe(
      chipTone('dangerSoft', lightTheme).bg,
    );
  });
});
