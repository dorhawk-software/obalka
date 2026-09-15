// The language picked on Welcome, and what took it back (2026-09-24).
//
// Reported on the emulator: first launch after `pm clear`, Welcome switched to English, the restore
// screen opened - and it was Czech, and so was Welcome on the way back. After a normal restart the same
// steps kept English.
//
// The language lives twice: as the SettingsProvider's state, and in the i18n module every `t()` reads.
// The provider used to copy its state into the module ON EVERY RENDER, and a provider started from its
// initial state - Czech - before any read. So a provider rendering from the start put Czech back under
// a screen that went on showing English (Welcome re-renders only when the provider's value changes,
// the screens opened next read the module), and its load could not give the choice back: on a first
// launch the choice's write had not reached the table yet, or had failed without a word. After a
// restart the table already said English, which is why only the first launch showed it. And a load
// still out when a language was picked applied what it had read over the pick.
//
// The first four cases fail on the provider as it was; the last two pin that a stored language is
// still what a launch opens in.

import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { useState } from 'react';
import { Text } from 'react-native';
import {
  SettingsProvider,
  useLocale,
  useSettings,
} from '../../src/app/settings/SettingsProvider';
import { STRINGS_FOR_TEST, setActiveLocale, t } from '../../src/i18n/strings';
import * as reporting from '../../src/services/telemetry/telemetry';

const { cs, en } = STRINGS_FOR_TEST;

/** The settings table. A key in `mockHeld` answers only when the test lets it. */
const mockStore = new Map<string, string>();
const mockHeld = new Map<string, { release: () => void; fail: (e: Error) => void }>();
/** Keys whose next write or read is held until released. */
const mockHold = { write: new Set<string>(), read: new Set<string>() };

jest.mock('../../src/features/accounts/deps', () => ({
  settingsStore: {
    getSetting: (k: string) => {
      // What the table holds when the read is made - a read answered late still answers from then.
      const value = mockStore.get(k) ?? null;
      if (!mockHold.read.has(k)) {
        return Promise.resolve(value);
      }
      return new Promise((resolve, reject) => {
        mockHeld.set(`read:${k}`, { release: () => resolve(value), fail: reject });
      });
    },
    setSetting: (k: string, v: string) => {
      if (!mockHold.write.has(k)) {
        mockStore.set(k, v);
        return Promise.resolve();
      }
      return new Promise<void>((resolve, reject) => {
        mockHeld.set(`write:${k}`, {
          release: () => {
            mockStore.set(k, v);
            resolve();
          },
          fail: reject,
        });
      });
    },
  },
  appLock: { isAvailable: async () => false },
}));

/** A screen: its words, read when it renders, the way every screen reads them. */
function Words({ testID }: { readonly testID: string }) {
  useLocale();
  return <Text testID={testID}>{t('welcome.tagline')}</Text>;
}

/**
 * The app: a way to pick English, the screen on show, a screen opened later (the restore one), and a
 * second provider that can be started beside it.
 */
function App() {
  const { ready, setLocale } = useSettings();
  const [opened, setOpened] = useState(false);
  const [another, setAnother] = useState(false);
  return (
    <>
      <Text testID="state">{ready ? 'ready' : 'loading'}</Text>
      <Text testID="pickEnglish" onPress={() => setLocale('en')}>
        English
      </Text>
      <Text testID="open" onPress={() => setOpened(true)}>
        open
      </Text>
      <Text testID="startAnother" onPress={() => setAnother(true)}>
        another
      </Text>
      <Words testID="shown" />
      {opened ? <Words testID="opened" /> : null}
      {another ? (
        <SettingsProvider>
          <Text>another provider</Text>
        </SettingsProvider>
      ) : null}
    </>
  );
}

/** The root, which can mount its provider again (a new key), the way a restarted root does. */
function Root() {
  const [generation, setGeneration] = useState(0);
  return (
    <>
      <Text testID="remount" onPress={() => setGeneration(g => g + 1)}>
        remount
      </Text>
      <SettingsProvider key={generation}>
        <App />
      </SettingsProvider>
    </>
  );
}

const mount = () => render(<Root />);

type View = Awaited<ReturnType<typeof mount>>;

async function press(view: View, testID: string) {
  await act(async () => {
    fireEvent.press(view.getByTestId(testID));
  });
}

async function settle(key: string, how: 'release' | 'fail', error = new Error('x')) {
  await act(async () => {
    const held = mockHeld.get(key);
    mockHeld.delete(key);
    if (how === 'release') {
      held?.release();
    } else {
      held?.fail(error);
    }
  });
}

beforeEach(() => {
  mockStore.clear();
  mockHeld.clear();
  mockHold.write.clear();
  mockHold.read.clear();
});

afterEach(async () => {
  // Nothing may stay held into the next case: the provider's load waits for language writes.
  for (const key of [...mockHeld.keys()]) {
    await settle(key, 'release');
  }
  jest.restoreAllMocks();
  setActiveLocale('cs');
});

describe('the language picked on a first launch', () => {
  it('survives the app root mounting again before the choice has reached the table', async () => {
    // A first launch: the table is new, and the write is still on its way when the root mounts again.
    mockHold.write.add('locale');
    const view = await mount();
    await waitFor(() => expect(view.getByTestId('state')).toHaveTextContent('ready'));
    await press(view, 'pickEnglish');
    expect(view.getByTestId('shown')).toHaveTextContent(en['welcome.tagline']);

    await press(view, 'remount');
    expect(view.getByTestId('shown')).toHaveTextContent(en['welcome.tagline']);
    await settle('write:locale', 'release');
    await waitFor(() => expect(view.getByTestId('state')).toHaveTextContent('ready'));
    expect(view.getByTestId('shown')).toHaveTextContent(en['welcome.tagline']);
    expect(mockStore.get('locale')).toBe('en');
  });

  it('survives a write that failed, and the failure is reported', async () => {
    const reported = jest.spyOn(reporting, 'reportFailure').mockImplementation(() => {});
    const refused = new Error('database is locked');
    mockHold.write.add('locale');
    const view = await mount();
    await waitFor(() => expect(view.getByTestId('state')).toHaveTextContent('ready'));
    await press(view, 'pickEnglish');
    await settle('write:locale', 'fail', refused);
    expect(reported).toHaveBeenCalledWith('settings.write', refused, { stage: 'persist' });

    // For this run the language is what was picked, whatever the table managed to keep.
    await press(view, 'remount');
    await waitFor(() => expect(view.getByTestId('state')).toHaveTextContent('ready'));
    expect(view.getByTestId('shown')).toHaveTextContent(en['welcome.tagline']);
  });

  it('is not taken back by another provider rendering from its start', async () => {
    // First launch again: the choice has not reached the table when the other provider reads it.
    mockHold.write.add('locale');
    const app = await mount();
    await waitFor(() => expect(app.getByTestId('state')).toHaveTextContent('ready'));
    await press(app, 'pickEnglish');

    // A provider rendered from its initial state, while this one lives.
    await press(app, 'startAnother');

    // The screen on show kept English either way; the one opened next is what said Czech.
    expect(app.getByTestId('shown')).toHaveTextContent(en['welcome.tagline']);
    await press(app, 'open');
    expect(app.getByTestId('opened')).toHaveTextContent(en['welcome.tagline']);
  });

  it('is not overwritten by the settings read that was still out when it was picked', async () => {
    mockStore.set('locale', 'cs');
    mockHold.read.add('locale');
    const view = await mount();
    expect(view.getByTestId('state')).toHaveTextContent('loading');

    await press(view, 'pickEnglish');
    await settle('read:locale', 'release');
    await waitFor(() => expect(view.getByTestId('state')).toHaveTextContent('ready'));

    expect(view.getByTestId('shown')).toHaveTextContent(en['welcome.tagline']);
    await press(view, 'open');
    expect(view.getByTestId('opened')).toHaveTextContent(en['welcome.tagline']);
  });

  it('still opens in the language stored before, when nothing was picked', async () => {
    mockStore.set('locale', 'en');
    const view = await mount();
    await waitFor(() => expect(view.getByTestId('state')).toHaveTextContent('ready'));
    expect(view.getByTestId('shown')).toHaveTextContent(en['welcome.tagline']);
  });

  it('ignores a stored value that names no language in the list', async () => {
    mockStore.set('locale', 'klingon');
    const view = await mount();
    await waitFor(() => expect(view.getByTestId('state')).toHaveTextContent('ready'));
    expect(view.getByTestId('shown')).toHaveTextContent(cs['welcome.tagline']);
  });
});
