// A fast double tap on the transfer screen (audit 2026-09-23).
//
// `mode` and `got` are state, and state lands a render late: a double tap delivers both presses before
// the screen re-renders. "Odeslat z tohoto telefonu" awaited a connection check before its mode
// changed, so nothing at all guarded that gap; "Přijmout" and a scanned code started a second
// receive; and a second tap on "Uložit do archivu" asked the controller to apply again, which refused
// it as busy - and the screen took that refusal as the end of the run and went back to idle while the
// first save was still writing. The taps are taken from ONE render (`doubleTap`), which is how the
// second finger arrives.

import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import { TransferScreen } from '../../src/app/settings/TransferScreen';
import type { TransferController } from '../../src/features/transfer/state/transferController';
import { TransferBusyError } from '../../src/services/transfer/transport';
import { BACKUP_SCHEMA_VERSION, type BackupManifest } from '../../src/services/backup/schema';
import { FORMAT_VERSION } from '../../src/services/backup/envelope';
import { doubleTap, pressHandlerOf } from '../helpers/doubleTap';

// The connection check is the await in front of every send; held open, it is the gap a second tap fell
// through. `mock`-prefixed so jest's hoisting lets the factory reference it.
const mockIsMetered = jest.fn(async (): Promise<boolean | null> => false);
jest.mock('../../src/services/transfer/connection', () => ({
  METERED_ASK_BYTES: 5 * 1024 * 1024,
  isMetered: () => mockIsMetered(),
}));

// The camera itself is `codeScanner.test.tsx`'s. Here the scanner only has to hand the screen codes.
let mockScanner: { onFound: (phrase: string) => void } | null = null;
jest.mock('../../src/features/transfer/screens/CodeScanner', () => ({
  scanningAvailable: () => true,
  TransferCodeScanner: (props: { onFound: (phrase: string) => void }) => {
    mockScanner = props;
    return null;
  },
}));

const PHRASE = '7K2M-ryba-kotva-duha-lampa';

const manifest = (): BackupManifest => ({
  formatVersion: FORMAT_VERSION,
  schemaVersion: BACKUP_SCHEMA_VERSION,
  appVersion: '1.4.0',
  createdAt: 1_757_000_000_000,
  tiers: { metadata: true, documents: false },
  sizeBytes: 2_400_000,
  archiveName: 'obalka-1.backup',
});

const received = {
  manifest: manifest(),
  compatibility: { kind: 'current' as const },
  restorable: true,
  recoveryKey: 'FKPX-9WQ2-7TDM-4RJH-2CVB',
  archive: new Uint8Array(4),
  documents: 0,
  dir: '/work/in/1',
};

/**
 * A controller that answers like the real one: a second `apply` while one is saving is refused as
 * busy, which is exactly the refusal the screen used to mistake for the end of the run.
 */
function fakeController() {
  const calls: string[] = [];
  let saving = false;
  let finishSave: () => void = () => {};
  const controller = {
    available: () => true,
    offer: jest.fn(async () => {
      calls.push('offer');
      return { phrase: PHRASE, sizeBytes: 1, contents: null, done: new Promise<void>(() => {}) };
    }),
    receive: jest.fn(async (phrase: string) => {
      calls.push(`receive:${phrase}`);
      return received;
    }),
    apply: jest.fn(() => {
      calls.push('apply');
      if (saving) {
        return Promise.reject(new TransferBusyError());
      }
      saving = true;
      return new Promise(resolve => {
        finishSave = () => {
          saving = false;
          resolve({
            accountsAdded: 1,
            accountsKept: 0,
            messagesAdded: 1,
            messagesMerged: 0,
            draftsRestored: 0,
            remindersRestored: 0,
            settingsRestored: 0,
            keysFailed: false,
          });
        };
      });
    }),
    dispose: jest.fn(async () => {
      calls.push('dispose');
    }),
    abandon: jest.fn(async () => {}),
    isApplying: () => saving,
    takeOutcome: () => null,
    subscribeOutcome: () => () => undefined,
    whenApplied: async () => null,
    keepScreenOn: () => {},
  };
  return {
    controller: controller as unknown as TransferController,
    fake: controller,
    calls,
    finishSave: () => act(async () => finishSave()),
  };
}

const mount = (controller: TransferController) =>
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <AppThemeProvider isDark={false}>
        <TransferScreen onBack={() => {}} controller={controller} backups={[manifest()]} />
      </AppThemeProvider>
    </TamaguiProvider>,
  );

/** Type the phrase and start the receive, stopping at the question about what arrived. */
async function arrive(view: Awaited<ReturnType<typeof mount>>) {
  await fireEvent.changeText(view.getByTestId('transfer-phrase-input'), PHRASE);
  await fireEvent.press(view.getByTestId('transfer-receive'));
  await waitFor(() => view.getByTestId('transfer-received-dialog'));
}

beforeEach(() => {
  mockIsMetered.mockReset();
  mockIsMetered.mockResolvedValue(false);
  mockScanner = null;
});

describe('a double tap on the transfer screen', () => {
  it('offers once when "Odeslat z tohoto telefonu" is tapped twice, across the connection check', async () => {
    const { controller, fake } = fakeController();
    let answer: (metered: boolean) => void = () => {};
    mockIsMetered.mockImplementation(
      () =>
        new Promise(resolve => {
          answer = resolve;
        }),
    );
    const view = await mount(controller);

    await doubleTap(view.getByTestId('transfer-send'));
    await act(async () => answer(false));

    await waitFor(() => view.getByTestId('transfer-phrase'));
    expect(fake.offer).toHaveBeenCalledTimes(1);
    // Not even asked twice: the second tap was refused before it reached the check.
    expect(mockIsMetered).toHaveBeenCalledTimes(1);
  });

  it('receives once when "Přijmout" is tapped twice', async () => {
    const { controller, fake } = fakeController();
    const view = await mount(controller);
    await fireEvent.changeText(view.getByTestId('transfer-phrase-input'), PHRASE);

    await doubleTap(view.getByTestId('transfer-receive'));

    await waitFor(() => view.getByTestId('transfer-received-dialog'));
    expect(fake.receive).toHaveBeenCalledTimes(1);
  });

  it('receives once when the scanner hands over a code twice', async () => {
    const { controller, fake } = fakeController();
    const view = await mount(controller);
    await fireEvent.press(view.getByTestId('transfer-scan'));
    expect(mockScanner).not.toBeNull();
    const onFound = mockScanner!.onFound;

    await act(async () => {
      onFound(PHRASE);
      onFound(PHRASE);
    });

    await waitFor(() => view.getByTestId('transfer-received-dialog'));
    expect(fake.receive).toHaveBeenCalledTimes(1);
  });

  it('saves once when "Uložit do archivu" is tapped twice, and keeps showing the save that is running', async () => {
    const { controller, fake, finishSave } = fakeController();
    const view = await mount(controller);
    await arrive(view);

    await doubleTap(view.getByTestId('transfer-received-confirm'));

    expect(fake.apply).toHaveBeenCalledTimes(1);
    // No "still being saved" error for the second tap, and no return to idle under the running save.
    expect(view.queryByTestId('transfer-error')).toBeNull();
    expect(view.getByTestId('transfer-applying-note')).toBeTruthy();
    expect(view.queryByTestId('transfer-send')).toBeNull();

    await finishSave();
    await waitFor(() => view.getByTestId('transfer-done'));
    expect(view.queryByTestId('transfer-error')).toBeNull();
  });

  it('takes only the first answer when "Uložit do archivu" and "Zrušit" land in the same frame', async () => {
    const { controller, fake, finishSave } = fakeController();
    const view = await mount(controller);
    await arrive(view);
    // Both handlers taken from the same render, as two fingers in one frame would find them.
    const handlers = [
      pressHandlerOf(view.getByTestId('transfer-received-confirm')),
      pressHandlerOf(view.getByTestId('transfer-received-cancel')),
    ];

    await act(async () => {
      handlers[0]();
      handlers[1]();
    });

    // Saved, and what is being saved was not also let go of underneath it.
    expect(fake.apply).toHaveBeenCalledTimes(1);
    expect(fake.dispose).not.toHaveBeenCalled();
    expect(view.getByTestId('transfer-applying-note')).toBeTruthy();
    await finishSave();
  });

  it('can start again after a run ends - the guards hold only while it runs', async () => {
    const { controller, fake } = fakeController();
    const view = await mount(controller);
    await arrive(view);
    await fireEvent.press(view.getByTestId('transfer-received-cancel'));
    await waitFor(() => view.getByTestId('transfer-receive'));

    await arrive(view);
    expect(fake.receive).toHaveBeenCalledTimes(2);
    expect(fake.dispose).toHaveBeenCalledTimes(1);
  });
});
