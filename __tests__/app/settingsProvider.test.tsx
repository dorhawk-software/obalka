// The attachment-scan setting (010 US3).
//
// The default is the point. This toggle governs whether the app reads the CONTENTS of legal mail, so
// Principle III's answer is opt-in: until someone asks, no document text is processed and the parser
// is never even loaded. A test that only checked "it round-trips" would miss the requirement.

import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import {
  SettingsProvider,
  useSettings,
} from '../../src/app/settings/SettingsProvider';
import { APP_LOCK_KEY } from '../../src/app/settings/settingsKeys';
import * as reporting from '../../src/services/telemetry/telemetry';

const mockStore = new Map<string, string>();
/** The setting whose write fails, and how. */
const mockRefused = { key: null as string | null, error: new Error('database is locked') };

jest.mock('../../src/features/accounts/deps', () => ({
  settingsStore: {
    getSetting: async (k: string) => mockStore.get(k) ?? null,
    setSetting: async (k: string, v: string) => {
      if (k === mockRefused.key) {
        throw mockRefused.error;
      }
      mockStore.set(k, v);
    },
  },
  appLock: { isAvailable: async () => false },
}));

function Probe() {
  const { scanAttachments, ready } = useSettings();
  return (
    <Text testID="state">{`${ready ? 'ready' : 'loading'}:${scanAttachments}`}</Text>
  );
}

const mount = () =>
  render(
    <SettingsProvider>
      <Probe />
    </SettingsProvider>,
  );

beforeEach(() => {
  mockStore.clear();
  mockRefused.key = null;
});

describe('scanAttachments', () => {
  it('is OFF when nothing has been stored', async () => {
    const view = await mount();
    await waitFor(() =>
      expect(view.getByTestId('state')).toHaveTextContent('ready:false'),
    );
  });

  it('is ON only for an explicit "1"', async () => {
    mockStore.set('scanAttachments', '1');
    const view = await mount();
    await waitFor(() =>
      expect(view.getByTestId('state')).toHaveTextContent('ready:true'),
    );
  });

  // Including values a future version might write. "We are not sure what this means" must never
  // resolve to "read the user's mail".
  it.each(['0', 'true', 'yes', ''])(
    'treats the stored value %p as OFF',
    async v => {
      mockStore.set('scanAttachments', v);
      const view = await mount();
      await waitFor(() =>
        expect(view.getByTestId('state')).toHaveTextContent('ready:false'),
      );
    },
  );
});

// The tri-state, which is what makes "asked and declined" different from "never asked".
function TelemetryProbe() {
  const { telemetry, ready } = useSettings();
  return (
    <Text testID="telem">{`${ready ? 'ready' : 'loading'}:${String(telemetry)}`}</Text>
  );
}

const mountTelemetry = () =>
  render(
    <SettingsProvider>
      <TelemetryProbe />
    </SettingsProvider>,
  );

describe('telemetry consent state', () => {
  it('starts UNANSWERED when nothing has been stored', async () => {
    // `null` is not a decline - the user has not been offered the question yet. It used to default
    // to `true`, which transmitted before anyone had been asked; see TELEMETRY_DEFAULT for why that
    // is an ePrivacy problem rather than a GDPR one.
    const view = await mountTelemetry();
    await waitFor(() =>
      expect(view.getByTestId('telem')).toHaveTextContent('ready:null'),
    );
  });

  it.each([
    ['1', 'true'],
    ['0', 'false'],
  ])('reads a stored answer %s as %s', async (stored, expected) => {
    mockStore.set('telemetry', stored);
    const view = await mountTelemetry();
    await waitFor(() =>
      expect(view.getByTestId('telem')).toHaveTextContent(`ready:${expected}`),
    );
  });

  it.each(['true', 'yes', ''])(
    'treats %p as still unanswered rather than as consent',
    async stored => {
      // A value this version does not recognise must not be read as "they said yes".
      mockStore.set('telemetry', stored);
      const view = await mountTelemetry();
      await waitFor(() =>
        expect(view.getByTestId('telem')).toHaveTextContent('ready:null'),
      );
    },
  );
});

// The app-lock switch mirrors what the vault did (001 T028, T037). Nobody waits for its write: removing
// the last box calls it after the vault has already switched the lock off, and a write that failed
// there was an unhandled rejection.
function LockProbe() {
  const { appLock, ready, setAppLock } = useSettings();
  return (
    <Text testID="lock" onPress={() => setAppLock(false)}>
      {`${ready ? 'ready' : 'loading'}:${appLock}`}
    </Text>
  );
}

describe('the app-lock switch', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reports a write that failed, and keeps showing what the vault did', async () => {
    const reported = jest.spyOn(reporting, 'reportFailure').mockImplementation(() => {});
    mockStore.set(APP_LOCK_KEY, '1');
    const view = await render(
      <SettingsProvider>
        <LockProbe />
      </SettingsProvider>,
    );
    await waitFor(() => expect(view.getByTestId('lock')).toHaveTextContent('ready:true'));

    mockRefused.key = APP_LOCK_KEY;
    await act(async () => {
      fireEvent.press(view.getByTestId('lock'));
    });
    await waitFor(() =>
      expect(reported).toHaveBeenCalledWith('settings.write', mockRefused.error, {
        stage: 'persist',
      }),
    );
    expect(view.getByTestId('lock')).toHaveTextContent('ready:false');
  });
});
