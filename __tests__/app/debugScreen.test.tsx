// The consent surface. Everything safety-critical about this feature is proved in
// `__tests__/services/debug*`; what is left is the part a user actually sees, and the property that
// matters here is that the screen never describes a bundle it is not about to make.
//
// The level description drove one real decision: it is rendered from the CURRENT selection rather
// than written once, because a screen that says "no message contents" above a control set to
// "including the ISDS traffic" would be collecting somebody's mail under a sentence promising it
// did not.

import { readFileSync } from 'fs';
import { join } from 'path';
import {
  AccessibilityInfo,
  Dimensions,
  Platform,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import RNBlobUtil from 'react-native-blob-util';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import { type as typeScale } from '../../src/theme/typography';
import { t } from '../../src/i18n/strings';
import {
  DebugScreen,
  recordingCounterReserve,
} from '../../src/app/settings/DebugScreen';
import { cancelDebug } from '../../src/services/debug/debugController';
import { isDebugRecording } from '../../src/services/debug/debugLog';
import { bundleDir } from '../../src/services/debug/debugBundle';
import { deleteAllBundles, LIST_TIMEOUT_MS } from '../../src/services/debug/debugStore';

type View = Awaited<ReturnType<typeof render>>;

/**
 * The Debug screen, once it has read the saved files. It reads them as it opens, and a test that looked
 * before that read answered would be looking at a screen about to change under it - which is also what
 * left React's act() warnings behind every test here until 2026-09-15. `settled: false` looks straight
 * away, for the tests about that first moment.
 */
const mount = async ({ settled = true }: { readonly settled?: boolean } = {}) => {
  const view = await render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <AppThemeProvider isDark={false}>
        <DebugScreen onBack={() => {}} />
      </AppThemeProvider>
    </TamaguiProvider>,
  );
  await waitFor(() => view.getByTestId('debug-toggle'));
  if (settled) {
    await waitFor(() => expect(view.queryByTestId('debug-saved-loading')).toBeNull());
  }
  return view;
};

const fs = RNBlobUtil.fs as unknown as {
  writeFile: jest.Mock;
  unlink: jest.Mock;
  stat: jest.Mock;
  ls: jest.Mock;
};
/** The in-memory folder's own answers, put back after a test changes them. */
const statFile = fs.stat.getMockImplementation() as (path: string) => Promise<{ size: number }>;
const listDir = fs.ls.getMockImplementation() as (dir: string) => Promise<string[]>;

const saveFile = (name: string) =>
  fs.writeFile(`${bundleDir()}/${name}`, 'UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA==', 'base64');

afterEach(() => {
  cancelDebug();
  fs.stat.mockImplementation(statFile);
  fs.ls.mockImplementation(listDir);
});

type JsonNode = {
  type: string;
  props: Record<string, unknown>;
  children: (JsonNode | string)[] | null;
};

function elementChildren(node: JsonNode): JsonNode[] {
  return (node.children ?? []).filter((c): c is JsonNode => typeof c !== 'string');
}

function findTestID(nodes: JsonNode[], testID: string): JsonNode | undefined {
  for (const node of nodes) {
    if (node.props.testID === testID) {
      return node;
    }
    const found = findTestID(elementChildren(node), testID);
    if (found) {
      return found;
    }
  }
  return undefined;
}

const styleOf = (element: { props: Record<string, unknown> }) =>
  (StyleSheet.flatten(element.props.style as StyleProp<ViewStyle>) ?? {}) as Record<string, unknown>;

/**
 * Everything in the controls above the saved files that decides where those files sit: each element,
 * the style it is laid out with and how many lines it may take. Not the words, which are meant to
 * change, and not `transform`, where the press dip animates without taking any space.
 */
function controlsLayout(view: View): unknown {
  const json = view.toJSON() as JsonNode | JsonNode[] | null;
  const roots = json == null ? [] : ([] as JsonNode[]).concat(json);
  const shape = (node: JsonNode): unknown => ({
    type: node.type,
    style: Object.fromEntries(
      Object.entries(StyleSheet.flatten(node.props.style as StyleProp<ViewStyle>) ?? {}).filter(
        ([key]) => key !== 'transform',
      ),
    ),
    numberOfLines: node.props.numberOfLines,
    children: elementChildren(node).map(shape),
  });
  const controls = findTestID(roots, 'debug-controls');
  expect(controls).toBeDefined();
  return shape(controls as JsonNode);
}

/**
 * Holds the next native write open until `release` lets it land, and then stores the file as usual. A
 * trail this short is zipped and encoded in a turn or two, so without holding the write the whole save
 * could end inside a single press, and the moment a test is about - the save still running - would
 * never be on screen to look at.
 */
function holdNextWrite(): { writeFile: jest.Mock; release: () => Promise<void> } {
  const writeFile = RNBlobUtil.fs.writeFile as jest.Mock;
  writeFile.mockClear();
  const storeFile = writeFile.getMockImplementation() as (...args: unknown[]) => Promise<void>;
  let land: () => void = () => {};
  writeFile.mockImplementationOnce(async (...args: unknown[]) => {
    await new Promise<void>(resolve => {
      land = resolve;
    });
    await storeFile(...args);
  });
  // Let go inside act(): the save it releases ends by updating the screen.
  return { writeFile, release: () => act(async () => land()) };
}

describe('before recording', () => {
  it('opens on the level that carries no message content', async () => {
    // The default is a decision, not an accident: someone who taps through without reading must end
    // up with the bundle that cannot contain their mail.
    const view = await mount();
    expect(view.getByTestId('debug-level-desc')).toHaveTextContent(
      t('debug.level.standard.desc'),
    );
    expect(isDebugRecording()).toBe(false);
  });

  it('states the credential guarantee whichever level is chosen', async () => {
    const view = await mount();
    expect(view.getByText(t('debug.creds'))).toBeTruthy();
  });

  it('offers to start, not to stop', async () => {
    const view = await mount();
    expect(view.getByTestId('debug-toggle')).toHaveTextContent(t('debug.start'));
  });

  it('says there are no bundles rather than showing an empty list', async () => {
    const view = await mount();
    expect(view.getByTestId('debug-empty')).toHaveTextContent(t('debug.saved.empty'));
  });
});

describe('while recording', () => {
  it('says so, and offers to stop or throw it away', async () => {
    const view = await mount();
    await fireEvent.press(view.getByTestId('debug-toggle'));
    await waitFor(() => view.getByTestId('debug-status'));
    expect(isDebugRecording()).toBe(true);
    expect(view.getByTestId('debug-toggle')).toHaveTextContent(t('debug.stop'));
    expect(view.getByTestId('debug-discard')).toBeTruthy();
  });

  it('discarding stops it and leaves nothing behind', async () => {
    const view = await mount();
    await fireEvent.press(view.getByTestId('debug-toggle'));
    await waitFor(() => expect(isDebugRecording()).toBe(true));
    await fireEvent.press(view.getByTestId('debug-discard'));
    await waitFor(() => expect(isDebugRecording()).toBe(false));
    expect(view.getByTestId('debug-toggle')).toHaveTextContent(t('debug.start'));
  });

  it('says it is saving while the bundle is written, and a second press does not write it twice', async () => {
    // Writing a bundle no longer holds the JS thread (Principle I), so this screen answers presses
    // while the archive is built - which is exactly when a second "Ukončit a uložit" or a "Zahodit"
    // would otherwise land.
    const hold = holdNextWrite();
    const view = await mount();
    await fireEvent.press(view.getByTestId('debug-toggle'));
    expect(isDebugRecording()).toBe(true);

    // Kept, not awaited: an awaited press stays open until the save it started has finished, and that
    // save is held until this test lets it go. Awaiting it here would wait for itself.
    const stopPress = fireEvent.press(view.getByTestId('debug-toggle'));
    try {
      await waitFor(() => expect(hold.writeFile).toHaveBeenCalledTimes(1));
      await waitFor(() =>
        expect(view.getByTestId('debug-toggle')).toHaveTextContent(t('debug.saving')),
      );
      // Swallowed while the save runs: no second file.
      await fireEvent.press(view.getByTestId('debug-toggle'));
      expect(hold.writeFile).toHaveBeenCalledTimes(1);
      expect(view.getByTestId('debug-toggle')).toBeBusy();
      // And nothing left to discard. The recorder stopped at the press and what it held is being
      // written, so the recording's controls went with it then, not when the save ends (2026-09-15).
      // They used to stay, disabled, over a recording that had already stopped.
      expect(isDebugRecording()).toBe(false);
      expect(view.queryByTestId('debug-discard')).toBeNull();
      expect(view.queryByTestId('debug-status')).toBeNull();

      await hold.release();
      await stopPress;
      await waitFor(() =>
        expect(view.getByTestId('debug-notice')).toHaveTextContent(/obalka-debug-/),
      );
      expect(hold.writeFile).toHaveBeenCalledTimes(1);
      expect(view.getByTestId('debug-toggle')).toHaveTextContent(t('debug.start'));
    } finally {
      // Whatever failed above, the save is let go, or it would still be running in the next test.
      await hold.release();
      await stopPress;
    }
  });

  it('follows a save still being written when the screen is opened again during it', async () => {
    // Leaving the screen mid-save is ordinary once the save no longer freezes the app. The screen
    // opened next used to offer "Spustit záznam" over the running save, never said how it ended, and
    // listed no file until it was opened yet again.
    await deleteAllBundles();
    const hold = holdNextWrite();
    const first = await mount();
    await fireEvent.press(first.getByTestId('debug-toggle'));
    const stopPress = fireEvent.press(first.getByTestId('debug-toggle'));
    try {
      await waitFor(() => expect(hold.writeFile).toHaveBeenCalledTimes(1));
      await first.unmount();

      const again = await mount();
      expect(again.getByTestId('debug-toggle')).toHaveTextContent(t('debug.saving'));
      expect(again.getByTestId('debug-toggle')).toBeBusy();
      expect(again.getByTestId('debug-empty')).toBeTruthy();

      await hold.release();
      await stopPress;
      await waitFor(() =>
        expect(again.getByTestId('debug-notice')).toHaveTextContent(/obalka-debug-/),
      );
      expect(again.getByTestId('debug-toggle')).toHaveTextContent(t('debug.start'));
      expect(again.getByTestId('debug-toggle')).not.toBeBusy();
      await waitFor(() => expect(again.queryByTestId('debug-empty')).toBeNull());
    } finally {
      await hold.release();
      await stopPress;
    }
  });

  it('counts entries in the form Czech uses for that number', async () => {
    // "2 záznamů" was the one fixed form for every number. Starting records two entries: the start
    // itself and the app version.
    const view = await mount();
    await fireEvent.press(view.getByTestId('debug-toggle'));
    await waitFor(() =>
      expect(view.getByTestId('debug-status')).toHaveTextContent(/· 2 záznamy ·/),
    );
  });
});

// Constitution V. The counter's words grow while it records, and at a larger text size a longer counter
// took a second line part-way through a recording, moving the hint, the discard button and everything
// under them (found 2026-09-15). `debugCounterReserve.test.ts` measures that the reserve is never
// shorter than a counter; these check the screen draws the counter over it.
describe('the recording counter', () => {
  it('lays its growing words over room held by the longest counter, taking none of its own', async () => {
    const view = await mount();
    await fireEvent.press(view.getByTestId('debug-toggle'));
    await waitFor(() => view.getByTestId('debug-status'));

    const reserve = view.getByTestId('debug-status-reserve', { includeHiddenElements: true });
    expect(reserve).toHaveTextContent(recordingCounterReserve());
    // In the flow, so it is what decides the row's height, but not drawn and not read out.
    expect(styleOf(reserve).position).toBeUndefined();
    expect(styleOf(reserve).opacity).toBe(0);
    expect(view.queryByTestId('debug-status-reserve')).toBeNull();

    const live = view.getByTestId('debug-status');
    expect(live).toHaveTextContent(/· 2 záznamy ·/);
    expect(styleOf(live)).toEqual(
      expect.objectContaining({ position: 'absolute', top: 0, left: 0, right: 0 }),
    );
  });

  it('breaks the room and the counter into lines the way the measurement does, on Android too', async () => {
    // The reserve is proved never to take fewer lines than a counter for a breaker that fills each line
    // while the next word fits. Android's default breaker balances whole paragraphs instead, so without
    // naming the greedy one the proof would hold for iOS alone.
    const view = await mount();
    await fireEvent.press(view.getByTestId('debug-toggle'));
    await waitFor(() => view.getByTestId('debug-status'));

    for (const text of [
      view.getByTestId('debug-status-reserve', { includeHiddenElements: true }),
      view.getByTestId('debug-status'),
    ]) {
      expect(text).toHaveProp('textBreakStrategy', 'simple');
      expect(text).toHaveProp('lineBreakStrategyIOS', 'none');
    }
  });

  it('keeps the dot beside the first line at a large text size, however many lines the room takes', async () => {
    // Jest's window reports a font scale of 2 - twice the default text size.
    const { fontScale } = Dimensions.get('window');
    expect(fontScale).toBe(2);
    const view = await mount();
    await fireEvent.press(view.getByTestId('debug-toggle'));
    await waitFor(() => view.getByTestId('debug-status'));

    expect(styleOf(view.getByTestId('debug-status-row')).alignItems).toBe('flex-start');
    expect(styleOf(view.getByTestId('debug-status-dot')).minHeight).toBe(
      typeScale.caption.lineHeight * fontScale,
    );
  });
});

// Constitution V. A save ends long after the press that started it, at a moment nobody picks, and the
// saved files sit right under the notice that reports it - a finger may be on its way to one of them.
// Until 2026-09-15 the notice was drawn only once there was something to say, so it pushed the list
// down when it came; on the screen where stop was pressed the recording controls went at that same
// moment and pulled it up further than the notice pushed it down.
describe('when a save ends', () => {
  it('moves nothing above the saved files', async () => {
    const hold = holdNextWrite();
    const view = await mount();
    await fireEvent.press(view.getByTestId('debug-toggle'));
    const stopPress = fireEvent.press(view.getByTestId('debug-toggle'));
    try {
      await waitFor(() => expect(hold.writeFile).toHaveBeenCalledTimes(1));
      await waitFor(() =>
        expect(view.getByTestId('debug-toggle')).toHaveTextContent(t('debug.saving')),
      );
      const whileSaving = controlsLayout(view);

      await hold.release();
      await stopPress;
      await waitFor(() =>
        expect(view.getByTestId('debug-notice')).toHaveTextContent(/obalka-debug-/),
      );
      expect(controlsLayout(view)).toEqual(whileSaving);
    } finally {
      // Whatever failed above, the save is let go, or it would still be running in the next test.
      await hold.release();
      await stopPress;
    }
  });

  it('moves nothing on a Debug screen opened again while the save is still being written', async () => {
    const hold = holdNextWrite();
    const first = await mount();
    await fireEvent.press(first.getByTestId('debug-toggle'));
    const stopPress = fireEvent.press(first.getByTestId('debug-toggle'));
    try {
      await waitFor(() => expect(hold.writeFile).toHaveBeenCalledTimes(1));
      await first.unmount();

      const again = await mount();
      expect(again.getByTestId('debug-toggle')).toHaveTextContent(t('debug.saving'));
      const whileSaving = controlsLayout(again);

      await hold.release();
      await stopPress;
      await waitFor(() =>
        expect(again.getByTestId('debug-notice')).toHaveTextContent(/obalka-debug-/),
      );
      expect(controlsLayout(again)).toEqual(whileSaving);
    } finally {
      await hold.release();
      await stopPress;
    }
  });

  it('holds the notice s two lines at the reader s text size before there is anything to say', async () => {
    // RN scales a caption's line height with the system text size and a minHeight in dp does not
    // scale, so the reserve follows the font scale - which Jest's window reports as 2.
    const { fontScale } = Dimensions.get('window');
    expect(fontScale).not.toBe(1);
    const view = await mount();
    const notice = view.getByTestId('debug-notice', { includeHiddenElements: true });
    expect(styleOf(notice).minHeight).toBe(2 * typeScale.caption.lineHeight * fontScale);
    expect(notice.props.numberOfLines).toBe(2);
    // Held, but with nothing to read, so nothing for a screen reader to land on.
    expect(view.queryByTestId('debug-notice')).toBeNull();
  });

  it('adds the new file after the saved files, so none of them moves', async () => {
    // The list was newest first, so a finished save put its file in the first row and pushed every file
    // already listed down a whole row - the same jump the notice made, a row taller, at the same moment.
    await deleteAllBundles();
    const olderName = 'obalka-debug-2026-09-14-0900-standard.zip';
    const older = `${bundleDir()}/${olderName}`;
    await saveFile(olderName);
    // The in-memory files carry no modification time; the one already there is a day older.
    fs.stat.mockImplementation(async (path: string) => ({
      ...(await statFile(path)),
      lastModified: Date.parse(path === older ? '2026-09-14T09:00:00' : '2026-09-15T10:30:00'),
    }));
    try {
      const view = await mount();
      expect(view.getByTestId('debug-share-0')).toHaveProp(
        'accessibilityLabel',
        `${t('debug.share')}, ${olderName}`,
      );
      await fireEvent.press(view.getByTestId('debug-toggle'));
      await fireEvent.press(view.getByTestId('debug-toggle'));
      await waitFor(() => expect(view.getByTestId('debug-share-1')).toBeTruthy());

      expect(view.getByTestId('debug-share-0')).toHaveProp(
        'accessibilityLabel',
        `${t('debug.share')}, ${olderName}`,
      );
      const newer = view.getByTestId('debug-share-1').props.accessibilityLabel as string;
      expect(newer).toMatch(/obalka-debug-.*\.zip$/);
      expect(newer).not.toContain(olderName);
    } finally {
      await deleteAllBundles();
    }
  });
});

// Constitution II. The saved files are read from a folder, and a read can fail or answer late. Until
// 2026-09-15 every failure was shown as "Zatím tu nic není." - over files that were there - and a file
// whose size could not be read was left out of the list.
describe('the saved files', () => {
  const name = 'obalka-debug-2026-09-14-0900-standard.zip';

  beforeEach(async () => {
    await deleteAllBundles();
    await saveFile(name);
  });

  afterEach(async () => {
    await deleteAllBundles();
  });

  it('are not called empty before the folder has been read', async () => {
    let answer: (names: string[]) => void = () => {};
    fs.ls.mockImplementationOnce(
      () =>
        new Promise<string[]>(resolve => {
          answer = resolve;
        }),
    );
    const view = await mount({ settled: false });
    await waitFor(() => expect(view.getByTestId('debug-saved-loading')).toBeTruthy());
    expect(view.queryByTestId('debug-empty')).toBeNull();

    await act(async () => answer(await listDir(bundleDir())));
    await waitFor(() => expect(view.getByTestId('debug-share-0')).toBeTruthy());
    expect(view.queryByTestId('debug-saved-loading')).toBeNull();
  });

  it('say they could not be read, not that there are none, and are read again when asked', async () => {
    fs.ls.mockRejectedValueOnce(new Error('EACCES'));
    const view = await mount();
    expect(view.getByTestId('debug-saved-failed')).toHaveTextContent(t('debug.saved.error'), {
      exact: false,
    });
    expect(view.queryByTestId('debug-empty')).toBeNull();

    await fireEvent.press(view.getByTestId('debug-saved-retry'));
    await waitFor(() =>
      expect(view.getByTestId('debug-share-0')).toHaveProp(
        'accessibilityLabel',
        `${t('debug.share')}, ${name}`,
      ),
    );
    expect(view.queryByTestId('debug-saved-failed')).toBeNull();
  });

  it('list a file whose size could not be read, still to be shared or deleted', async () => {
    fs.stat.mockImplementation(async (path: string) => {
      if (path.endsWith(name)) {
        throw new Error('EACCES');
      }
      return statFile(path);
    });
    const view = await mount();
    expect(view.getByTestId('debug-size-0')).toHaveTextContent(t('debug.saved.sizeUnknown'));
    expect(view.getByTestId('debug-share-0')).toHaveProp(
      'accessibilityLabel',
      `${t('debug.share')}, ${name}`,
    );
    expect(view.getByTestId('debug-delete-0')).toBeTruthy();
  });

  it('say a file could not be deleted, and go on listing it', async () => {
    // The row used to stay where it was after "Smazat" without a word, as if the tap had missed.
    fs.unlink.mockRejectedValueOnce(new Error('EACCES'));
    const view = await mount();
    await fireEvent.press(view.getByTestId('debug-delete-0'));
    await fireEvent.press(view.getByTestId('debug-delete-confirm'));

    await waitFor(() =>
      expect(view.getByTestId('debug-notice')).toHaveTextContent(t('debug.deleteError')),
    );
    expect(view.getByTestId('debug-share-0')).toHaveProp(
      'accessibilityLabel',
      `${t('debug.share')}, ${name}`,
    );
  });

  it('keep the file a save just wrote when an older read of the folder answers after it', async () => {
    // The read the screen opens with is still out when a save ends and reads the folder again. The
    // older answer, arriving last, must not put the list back to what it was before the save.
    let answerOpening: (names: string[]) => void = () => {};
    fs.ls.mockImplementationOnce(
      () =>
        new Promise<string[]>(resolve => {
          answerOpening = resolve;
        }),
    );
    const view = await mount({ settled: false });
    await waitFor(() => expect(view.getByTestId('debug-saved-loading')).toBeTruthy());

    await fireEvent.press(view.getByTestId('debug-toggle'));
    await fireEvent.press(view.getByTestId('debug-toggle'));
    await waitFor(() => expect(view.getByTestId('debug-share-1')).toBeTruthy());

    await act(async () => answerOpening([name]));
    expect(view.getByTestId('debug-share-1')).toBeTruthy();
    expect(view.queryByTestId('debug-empty')).toBeNull();
  });

  it('say so in new words, heard by a screen reader, each time reading them again fails again', async () => {
    // A retry that failed again put back the very words it had replaced: nothing on the screen changed
    // and nothing was said, so "Zkusit znovu" looked like a press that had missed (2026-09-15).
    expect(Platform.OS).toBe('ios');
    // Queued, so it never cuts off a notice VoiceOver is still reading - see 'a screen reader' below.
    const spoken = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibilityWithOptions')
      .mockImplementation(() => {});
    spoken.mockClear();
    fs.ls.mockRejectedValueOnce(new Error('EACCES')).mockRejectedValueOnce(new Error('EACCES'));
    try {
      const view = await mount();
      // The words are read from the row the failure has always been drawn in, so what is checked is
      // what it says, whatever holds the words inside it.
      const row = () => view.getByTestId('debug-saved-failed');
      expect(row()).toHaveTextContent(t('debug.saved.error'), { exact: false });
      expect(spoken).toHaveBeenLastCalledWith(t('debug.saved.error'), { queue: true });

      await fireEvent.press(view.getByTestId('debug-saved-retry'));
      const second = t('debug.saved.errorAgain', { n: 2 });
      expect(second).not.toEqual(t('debug.saved.error'));
      await waitFor(() => expect(row()).toHaveTextContent(second, { exact: false }));
      expect(spoken).toHaveBeenLastCalledWith(second, { queue: true });

      fs.ls.mockRejectedValueOnce(new Error('EACCES'));
      await fireEvent.press(view.getByTestId('debug-saved-retry'));
      const third = t('debug.saved.errorAgain', { n: 3 });
      await waitFor(() => expect(row()).toHaveTextContent(third, { exact: false }));
      expect(spoken).toHaveBeenLastCalledWith(third, { queue: true });
      expect(spoken).toHaveBeenCalledTimes(3);
    } finally {
      spoken.mockRestore();
    }
  });

  it('change their words in a live region on Android, and leave the reading to TalkBack', async () => {
    // TalkBack reads a live region whenever its words change, so the Android row has to be one - from
    // before the first failure - and nothing may announce the same words a second time.
    const platform = Platform as { OS: string };
    const os = platform.OS;
    platform.OS = 'android';
    const spoken = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    const queued = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibilityWithOptions')
      .mockImplementation(() => {});
    spoken.mockClear();
    queued.mockClear();
    fs.ls.mockRejectedValueOnce(new Error('EACCES')).mockRejectedValueOnce(new Error('EACCES'));
    try {
      const view = await mount();
      const row = () => view.getByTestId('debug-saved-failed');
      expect(row()).toHaveTextContent(t('debug.saved.error'), { exact: false });

      await fireEvent.press(view.getByTestId('debug-saved-retry'));
      const second = t('debug.saved.errorAgain', { n: 2 });
      await waitFor(() => expect(row()).toHaveTextContent(second, { exact: false }));

      const status = view.getByTestId('debug-saved-status');
      expect(status).toHaveTextContent(second);
      expect(status).toHaveProp('accessibilityLiveRegion', 'polite');
      expect(status.props.importantForAccessibility).toBeUndefined();
      expect(spoken).not.toHaveBeenCalled();
      expect(queued).not.toHaveBeenCalled();
    } finally {
      spoken.mockRestore();
      queued.mockRestore();
      platform.OS = os;
    }
  });

  it('stop waiting for a folder that never answers, and say they could not be read', async () => {
    // A read that never answered left this row blank for as long as the screen stayed open.
    jest.useFakeTimers();
    try {
      fs.ls.mockImplementationOnce(() => new Promise<string[]>(() => {}));
      const view = await mount({ settled: false });
      await waitFor(() => expect(view.getByTestId('debug-saved-loading')).toBeTruthy());
      // Blank while it waits, and already the live region its words will arrive in: TalkBack reads new
      // words in a view it knows, not a view that has just appeared.
      expect(view.getByTestId('debug-saved-status', { includeHiddenElements: true })).toHaveProp(
        'accessibilityLiveRegion',
        'polite',
      );
      expect(view.queryByTestId('debug-saved-retry')).toBeNull();

      await act(async () => {
        await jest.advanceTimersByTimeAsync(LIST_TIMEOUT_MS);
      });
      await waitFor(() =>
        expect(view.getByTestId('debug-saved-status')).toHaveTextContent(t('debug.saved.error')),
      );
      expect(view.queryByTestId('debug-empty')).toBeNull();

      // And the folder is read again when asked - this time it answers.
      await fireEvent.press(view.getByTestId('debug-saved-retry'));
      await waitFor(() => expect(view.getByTestId('debug-share-0')).toBeTruthy());
    } finally {
      jest.useRealTimers();
    }
  });

  it('show a read still running after "Zkusit znovu" as busy, and let it go when the read ends', async () => {
    // Disabled and nothing more, a retry waiting on a slow folder looked like a press that had not
    // landed - for as long as `LIST_TIMEOUT_MS`, now that a read is waited on that long.
    fs.ls.mockRejectedValueOnce(new Error('EACCES'));
    const view = await mount();
    let fail: (error: Error) => void = () => {};
    fs.ls.mockImplementationOnce(
      () =>
        new Promise<string[]>((_answer, reject) => {
          fail = reject;
        }),
    );
    const press = fireEvent.press(view.getByTestId('debug-saved-retry'));
    try {
      await waitFor(() =>
        expect(
          view.getByTestId('debug-saved-retry-busy', { includeHiddenElements: true }),
        ).toBeTruthy(),
      );
      expect(view.getByTestId('debug-saved-retry')).toBeBusy();
      // The label stays under the spinner, holding the button's width.
      const label = () => view.getByText(t('debug.saved.retry'), { includeHiddenElements: true });
      expect(styleOf(label()).opacity).toBe(0);

      await act(async () => fail(new Error('EACCES')));
      await press;
      await waitFor(() =>
        expect(view.getByTestId('debug-saved-status')).toHaveTextContent(
          t('debug.saved.errorAgain', { n: 2 }),
        ),
      );
      expect(
        view.queryByTestId('debug-saved-retry-busy', { includeHiddenElements: true }),
      ).toBeNull();
      expect(view.getByTestId('debug-saved-retry')).not.toBeBusy();
      expect(styleOf(label()).opacity).toBe(1);
    } finally {
      fail(new Error('released'));
      await press;
    }
  });

  it('stay busy while a newer read of the folder is out, not only the one "Zkusit znovu" began', async () => {
    // A save that ends while "Zkusit znovu" is reading reads the folder again. The retry's own read,
    // answering first, handed the button back idle with the newer read still out (review, 2026-09-15).
    fs.ls.mockRejectedValueOnce(new Error('EACCES'));
    const view = await mount();
    const answers: ((error: Error) => void)[] = [];
    const held = () =>
      new Promise<string[]>((_answer, reject) => {
        answers.push(reject);
      });
    fs.ls.mockImplementationOnce(held).mockImplementationOnce(held);
    const busy = () =>
      view.queryByTestId('debug-saved-retry-busy', { includeHiddenElements: true });
    // The stop press is answered when the save it starts has ended, and that save ends by reading the
    // folder: held below, so it is not waited on until that read is let go.
    let stop: Promise<unknown> = Promise.resolve();
    try {
      await fireEvent.press(view.getByTestId('debug-saved-retry'));
      await waitFor(() => expect(busy()).not.toBeNull());

      // A recording saved while the retry reads: the end of the save reads the folder again.
      await fireEvent.press(view.getByTestId('debug-toggle'));
      stop = fireEvent.press(view.getByTestId('debug-toggle'));
      await waitFor(() => expect(answers).toHaveLength(2));

      await act(async () => answers[0](new Error('EACCES')));
      expect(busy()).not.toBeNull();
      expect(view.getByTestId('debug-saved-retry')).toBeBusy();

      await act(async () => answers[1](new Error('EACCES')));
      await stop;
      await waitFor(() => expect(busy()).toBeNull());
      expect(view.getByTestId('debug-saved-retry')).not.toBeBusy();
      expect(view.getByTestId('debug-saved-failed')).toHaveTextContent(
        t('debug.saved.errorAgain', { n: 2 }),
        { exact: false },
      );
    } finally {
      for (const release of answers) {
        release(new Error('released'));
      }
      await stop;
    }
  });
});

// A notice arrives when nobody is looking for it. A screen reader user has to be told, and told once.
describe('a screen reader', () => {
  /**
   * React Native's jest preset already mocks `announceForAccessibility`, and spying on a mock hands back
   * that same mock with every call earlier tests made on it, so the history starts empty here.
   */
  const announce = () => {
    const spy = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => {});
    spy.mockClear();
    return spy;
  };

  it('hears on iOS that a save ended, once, and nothing when the notice is cleared', async () => {
    expect(Platform.OS).toBe('ios');
    const spoken = announce();
    try {
      const view = await mount();
      await fireEvent.press(view.getByTestId('debug-toggle'));
      expect(spoken).not.toHaveBeenCalled();

      await fireEvent.press(view.getByTestId('debug-toggle'));
      await waitFor(() =>
        expect(view.getByTestId('debug-notice')).toHaveTextContent(/obalka-debug-/),
      );
      expect(spoken).toHaveBeenCalledTimes(1);
      expect(spoken).toHaveBeenCalledWith(expect.stringMatching(/^Uloženo: obalka-debug-.*\.zip$/));

      // Starting again clears the notice, which is not news.
      await fireEvent.press(view.getByTestId('debug-toggle'));
      expect(spoken).toHaveBeenCalledTimes(1);
    } finally {
      spoken.mockRestore();
    }
  });

  it('hears on iOS that a save ended, and then that the folder could not be read, not one over the other', async () => {
    // The folder is read again straight after the notice about a save is announced, and on iOS an
    // announcement cuts off the one before it. A read that failed then was heard over the notice, and
    // the person never learnt that the file had been saved (review, 2026-09-15).
    expect(Platform.OS).toBe('ios');
    const spoken = announce();
    const queued = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibilityWithOptions')
      .mockImplementation(() => {});
    queued.mockClear();
    try {
      const view = await mount();
      await fireEvent.press(view.getByTestId('debug-toggle'));
      fs.ls.mockRejectedValueOnce(new Error('EACCES'));
      await fireEvent.press(view.getByTestId('debug-toggle'));
      await waitFor(() =>
        expect(view.getByTestId('debug-saved-failed')).toHaveTextContent(t('debug.saved.error'), {
          exact: false,
        }),
      );
      expect(view.getByTestId('debug-notice')).toHaveTextContent(/obalka-debug-/);

      expect(spoken).toHaveBeenCalledTimes(1);
      expect(spoken).toHaveBeenCalledWith(expect.stringMatching(/^Uloženo: obalka-debug-.*\.zip$/));
      expect(queued).toHaveBeenCalledTimes(1);
      expect(queued).toHaveBeenCalledWith(t('debug.saved.error'), { queue: true });
      // After the notice, and waiting for it to be read.
      expect(queued.mock.invocationCallOrder[0]).toBeGreaterThan(spoken.mock.invocationCallOrder[0]);
    } finally {
      spoken.mockRestore();
      queued.mockRestore();
    }
  });

  it('is left to the live region on Android, so TalkBack does not read the notice twice', async () => {
    const platform = Platform as { OS: string };
    const os = platform.OS;
    platform.OS = 'android';
    const spoken = announce();
    try {
      const view = await mount();
      const empty = view.getByTestId('debug-notice', { includeHiddenElements: true });
      expect(empty).toHaveProp('accessibilityLiveRegion', 'polite');
      // Kept in Android's accessibility tree while empty, so there is a node to read when words arrive.
      expect(empty.props.importantForAccessibility).toBeUndefined();

      await fireEvent.press(view.getByTestId('debug-toggle'));
      await fireEvent.press(view.getByTestId('debug-toggle'));
      await waitFor(() =>
        expect(view.getByTestId('debug-notice')).toHaveTextContent(/obalka-debug-/),
      );
      expect(view.getByTestId('debug-notice')).toHaveProp('accessibilityLiveRegion', 'polite');
      expect(spoken).not.toHaveBeenCalled();
    } finally {
      spoken.mockRestore();
      platform.OS = os;
    }
  });
});

describe('on DESIGN.md s scales', () => {
  const DESIGN = readFileSync(join(__dirname, '../../DESIGN.md'), 'utf8');
  const SOURCE = readFileSync(join(__dirname, '../../src/app/settings/DebugScreen.tsx'), 'utf8');

  it('names every spacing on the Debug screen from the scale and draws every note at the Caption step', () => {
    // Typed numbers are how a 9 gap, 20 and 22 margins and 12pt captions got onto this screen beside
    // the 8, 14 and 18 around them: each looked close enough. Spacing now comes from `space`.
    const typedSpacing = [...SOURCE.matchAll(/\b(gap|margin\w*|padding\w*)=\{(\d+)\}/g)].map(
      m => `${m[1]}={${m[2]}}`,
    );
    expect(typedSpacing).toEqual([]);

    // Every type size the screen names is a step of DESIGN.md's hierarchy.
    const steps = [...DESIGN.matchAll(/\((?:Bricolage|Public Sans)[^,)]*, (\d+)\/\d+/g)].map(m =>
      Number(m[1]),
    );
    expect(steps).toContain(typeScale.caption.fontSize);
    const offScale = [...SOURCE.matchAll(/fontSize=\{(\d+)\}/g)]
      .map(m => Number(m[1]))
      .filter(size => !steps.includes(size));
    expect(offScale).toEqual([]);

    // And a caption is the Caption role as DESIGN.md states it, not a size of its own.
    const resizedCaptions = [...SOURCE.matchAll(/<Caption\b[^>]*>/g)]
      .map(m => m[0])
      .filter(tag => /\b(fontSize|lineHeight)=/.test(tag));
    expect(resizedCaptions).toEqual([]);
  });
});
