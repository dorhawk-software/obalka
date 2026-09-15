// The transfer screen (025 T015-T017).
//
// What is worth testing here is not the layout but the promises the screen makes, because each of
// them is a thing the app would otherwise get to be quietly wrong about: where the mail went, whether
// anything was written, which of three failures just happened, and that a transfer stops - and says
// so - when nobody is watching it any more.

import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import {
  TransferScreen,
  countList,
  routeKey,
  routeReserveText,
  routeText,
} from '../../src/app/settings/TransferScreen';
import type { TransferController } from '../../src/features/transfer/state/transferController';
import {
  PhraseRefusedError,
  TransferBusyError,
  TransferFailedError,
  TransferUnavailableError,
} from '../../src/services/transfer/transport';
import { BACKUP_SCHEMA_VERSION, type BackupManifest } from '../../src/services/backup/schema';
import { FORMAT_VERSION } from '../../src/services/backup/envelope';
import { STRINGS_FOR_TEST, t } from '../../src/i18n/strings';

const manifest = (over: Partial<BackupManifest> = {}): BackupManifest => ({
  formatVersion: FORMAT_VERSION,
  schemaVersion: BACKUP_SCHEMA_VERSION,
  appVersion: '1.4.0',
  createdAt: 1_757_000_000_000,
  tiers: { metadata: true, documents: false },
  sizeBytes: 2_400_000,
  archiveName: 'obalka-1.backup',
  ...over,
});

type Signal = { cancelled: boolean };
type OnProgress = (p: unknown) => void;

function fake(over: Partial<Record<string, unknown>> = {}) {
  const calls: string[] = [];
  /** The stop flag and the progress callback each run was handed, in the order the runs started. */
  const signals: Signal[] = [];
  const progress: OnProgress[] = [];
  const state = {
    calls,
    signals,
    progress,
    available: true,
    offerFails: null as Error | null,
    receiveFails: null as Error | null,
    /** A receive that stays in flight until the test settles it, as a real one does. */
    receiveHangs: false,
    /** A receive that reports no progress at all. */
    receiveQuiet: false,
    /** A save into the archive that stays in flight until the test settles it. */
    applyHangs: false,
    settleApply: null as null | { resolve: (v: unknown) => void },
    /** A save the screen did not start is already running when it opens. */
    applying: false,
    /** Settles `whenApplied` with how the save ended. */
    applied: null as null | ((outcome?: unknown) => void),
    /** How a save ended that no screen has said yet - what `takeOutcome` hands out, once. */
    unseen: null as unknown,
    /** How many times the screen took the outcome. */
    taken: 0,
    /** What the screen asked of the display, in order. */
    screenOn: [] as boolean[],
    applyOptions: [] as unknown[],
    settle: null as null | {
      resolve: (v: unknown) => void;
      reject: (e: Error) => void;
    },
    contents: null as null | { boxes: number; messages: number; documents: number | null },
    received: {
      manifest: manifest(),
      compatibility: { kind: 'current' as const },
      restorable: true,
      recoveryKey: 'FKPX-9WQ2-7TDM-4RJH-2CVB',
      archive: new Uint8Array(4),
      documents: 0,
      dir: '/work/in',
    },
    applyReport: {
      accountsAdded: 1,
      accountsKept: 0,
      messagesAdded: 3,
      messagesMerged: 0,
      draftsRestored: 0,
      remindersRestored: 0,
      settingsRestored: 0,
    } as Record<string, unknown>,
  };
  const controller = {
    available: () => state.available,
    async offer(m: BackupManifest, onProgress: OnProgress, signal: Signal) {
      calls.push(`offer:${m.archiveName}`);
      signals.push(signal);
      progress.push(onProgress);
      if (state.offerFails) {
        throw state.offerFails;
      }
      onProgress?.({ stage: 'connecting', sent: 0, total: 0, relayed: null });
      return {
        phrase: '7K2M-ryba-kotva-duha-lampa',
        sizeBytes: 2_400_100,
        contents: state.contents,
        done: new Promise<void>(() => {}),
      };
    },
    async receive(phrase: string, onProgress: OnProgress, signal: Signal) {
      calls.push(`receive:${phrase}`);
      signals.push(signal);
      progress.push(onProgress);
      if (state.receiveFails) {
        throw state.receiveFails;
      }
      if (!state.receiveQuiet) {
        onProgress?.({ stage: 'transferring', sent: 1, total: 2, relayed: true });
      }
      if (state.receiveHangs) {
        return new Promise((resolve, reject) => {
          state.settle = { resolve, reject };
        });
      }
      return state.received;
    },
    async abandon() {
      calls.push('abandon');
    },
    async apply(_received: unknown, _key: string, options: unknown) {
      calls.push('apply');
      state.applyOptions.push(options);
      if (state.applyHangs) {
        return new Promise(resolve => {
          state.settleApply = { resolve };
        });
      }
      return state.applyReport;
    },
    isApplying: () => state.applying,
    takeOutcome() {
      state.taken += 1;
      const outcome = state.unseen;
      state.unseen = null;
      return outcome;
    },
    subscribeOutcome: () => () => undefined,
    whenApplied: () =>
      new Promise<unknown>(resolve => {
        state.applied = resolve;
      }),
    keepScreenOn(on: boolean) {
      state.screenOn.push(on);
    },
    async dispose() {
      calls.push('dispose');
    },
    ...over,
  } as unknown as TransferController;
  return { controller, state };
}

const mount = (
  controller: TransferController,
  newest: BackupManifest | null = manifest(),
) =>
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <AppThemeProvider isDark={false}>
        <TransferScreen onBack={() => {}} controller={controller} backups={newest ? [newest] : []} />
      </AppThemeProvider>
    </TamaguiProvider>,
  );

describe('saying where the mail went (FR-007)', () => {
  it('has THREE answers, not two', () => {
    // The device run is why. The flag said "relayed" while the bytes went straight to a private
    // address, so "not known yet" has to be sayable - a boolean cannot express it.
    expect(routeKey(null)).toBe('transfer.route.unknown');
    expect(routeKey(false)).toBe('transfer.route.direct');
    expect(routeKey(true)).toBe('transfer.route.relayed');
  });

  it('says what a relay can and cannot see, rather than just naming it', () => {
    // A user told "this went through a relay" and nothing else has been given a worry, not an answer.
    const relayed = routeText(true);
    expect(relayed).toMatch(/velikost|size/i);
    expect(relayed).toMatch(/zašifrovan|encrypted/i);
  });

  it('shows the route WHILE the transfer is happening', async () => {
    const { controller } = fake();
    const view = await mount(controller);
    await act(async () => {
      fireEvent.press(view.getByTestId('transfer-send'));
    });
    await waitFor(() => expect(view.getByTestId('transfer-route')).toBeTruthy());
  });
});

describe('a route line that does not move what is under it (constitution V)', () => {
  it('holds the height of the longest sentence from the first frame, and hides it from readers', async () => {
    // The route is known only part-way through, and the relayed sentence is several lines where
    // "working it out" is one - the cancel row used to jump down the moment it arrived.
    const { controller, state } = fake();
    state.receiveHangs = true;
    state.receiveQuiet = true;
    const view = await mount(controller);
    await startReceiving(view);
    await waitFor(() =>
      expect(view.getByTestId('transfer-route').props.children).toBe(routeText(null)),
    );
    const reserve = () =>
      view.getByTestId('transfer-route-reserve', { includeHiddenElements: true });
    expect(reserve().props.children).toBe(routeText(true));
    expect(reserve().props.importantForAccessibility).toBe('no-hide-descendants');
    expect(reserve().props.accessibilityElementsHidden).toBe(true);

    await act(async () => {
      state.progress[0]({ stage: 'transferring', sent: 1, total: 2, relayed: true });
    });
    expect(view.getByTestId('transfer-route').props.children).toBe(routeText(true));
    expect(reserve().props.children).toBe(routeText(true));
  });

  it('reserves for the longest route sentence in both languages', () => {
    // Measured by length, so it holds only while the relayed sentence is the longest - pinned here
    // so a rewording of either locale says so rather than quietly reserving too little.
    for (const locale of ['cs', 'en'] as const) {
      const sentences = [
        'transfer.route.unknown',
        'transfer.route.direct',
        'transfer.route.relayed',
      ].map(key => STRINGS_FOR_TEST[locale][key]);
      expect(Math.max(...sentences.map(s => s.length))).toBe(sentences[2].length);
    }
    expect(routeReserveText()).toBe(routeText(true));
  });
});

describe('the sending side', () => {
  it('shows the phrase and the size once the offer is up', async () => {
    const { controller } = fake();
    const view = await mount(controller);
    await act(async () => {
      fireEvent.press(view.getByTestId('transfer-send'));
    });
    // The phrase renders word by word so it can wrap between words rather than through one, so the
    // WHOLE phrase lives on the accessibility label - which is also what a screen reader gets.
    await waitFor(() =>
      expect(view.getByTestId('transfer-phrase').props.accessibilityLabel).toBe(
        '7K2M-ryba-kotva-duha-lampa',
      ),
    );
    for (const part of ['7K2M', 'ryba', 'kotva', 'duha', 'lampa']) {
      expect(view.getByText(part)).toBeTruthy();
    }
  });

  it('offers to make a backup when there is none, instead of a send that cannot work (026 US3)', async () => {
    const { controller, state } = fake();
    const onOpenBackup = jest.fn();
    const view = await render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <AppThemeProvider isDark={false}>
          <TransferScreen onBack={() => {}} controller={controller} backups={[]} onOpenBackup={onOpenBackup} />
        </AppThemeProvider>
      </TamaguiProvider>,
    );
    expect(view.queryByTestId('transfer-send')).toBeNull();
    expect(view.getByText(t('transfer.pick.none.title'))).toBeTruthy();
    await act(async () => {
      fireEvent.press(view.getByTestId('transfer-create-backup'));
    });
    expect(onOpenBackup).toHaveBeenCalled();
    expect(state.calls).toEqual([]);
  });
});

describe('choosing which backup goes (026 US3)', () => {
  const older = manifest({ createdAt: 1_000, archiveName: 'obalka-1000.backup' });
  const newer = manifest({
    createdAt: 5_000,
    archiveName: 'obalka-5000.backup',
    tiers: { metadata: true, documents: true },
    documentMode: 'all',
    documentsMissing: 3,
  });
  const mountBoth = (controller: TransferController) =>
    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <AppThemeProvider isDark={false}>
          <TransferScreen onBack={() => {}} controller={controller} backups={[older, newer]} />
        </AppThemeProvider>
      </TamaguiProvider>,
    );

  it('lists every backup with what it holds, the newest chosen', async () => {
    const { controller } = fake();
    const view = await mountBoth(controller);
    expect(view.getByTestId(`transfer-backup-${newer.archiveName}`).props.accessibilityState).toEqual({
      selected: true,
    });
    expect(view.getByText(t('backup.docs.chip.all'))).toBeTruthy();
    expect(view.getByText(t('backup.docs.chip.none'))).toBeTruthy();
    expect(view.getByText(new RegExp(t('backup.docs.missing.few', { n: 3 })))).toBeTruthy();
  });

  it('sends the one chosen, and says which it is under the phrase', async () => {
    const { controller, state } = fake();
    const view = await mountBoth(controller);
    await act(async () => {
      fireEvent.press(view.getByTestId(`transfer-backup-${older.archiveName}`));
    });
    await act(async () => {
      fireEvent.press(view.getByTestId('transfer-send'));
    });
    await waitFor(() => expect(state.calls).toContain(`offer:${older.archiveName}`));
    await waitFor(() => expect(view.getByTestId('transfer-which')).toBeTruthy());
    expect(view.getByTestId('transfer-which').props.children).toContain(t('backup.docs.chip.none'));
  });
});

describe('the receiving side', () => {
  it('WRITES NOTHING until the arrival is confirmed (FR-004)', async () => {
    const { controller, state } = fake();
    const view = await mount(controller);
    await act(async () => {
      fireEvent.changeText(
        view.getByTestId('transfer-phrase-input'),
        '7K2M-ryba-kotva-duha-lampa',
      );
    });
    await act(async () => {
      fireEvent.press(view.getByTestId('transfer-receive'));
    });
    await waitFor(() => expect(view.getByTestId('transfer-received-dialog')).toBeTruthy());

    // Fetched, and that is all. `apply` is the only call that touches the archive.
    expect(state.calls).toContain('receive:7K2M-ryba-kotva-duha-lampa');
    expect(state.calls).not.toContain('apply');

    await act(async () => {
      fireEvent.press(view.getByTestId('transfer-received-confirm'));
    });
    expect(state.calls).toContain('apply');
  });

  it('names the date and the size in the question, so it is answerable', async () => {
    const { controller } = fake();
    const view = await mount(controller);
    await act(async () => {
      fireEvent.changeText(
        view.getByTestId('transfer-phrase-input'),
        '7K2M-ryba-kotva-duha-lampa',
      );
    });
    await act(async () => {
      fireEvent.press(view.getByTestId('transfer-receive'));
    });
    await waitFor(() => expect(view.getByTestId('transfer-received-dialog')).toBeTruthy());
    expect(view.getByText(/2,3 MB/)).toBeTruthy();
  });

  it('writes nothing when the arrival is dismissed', async () => {
    const { controller, state } = fake();
    const view = await mount(controller);
    await act(async () => {
      fireEvent.changeText(
        view.getByTestId('transfer-phrase-input'),
        '7K2M-ryba-kotva-duha-lampa',
      );
    });
    await act(async () => {
      fireEvent.press(view.getByTestId('transfer-receive'));
    });
    await waitFor(() => expect(view.getByTestId('transfer-received-dialog')).toBeTruthy());
    await act(async () => {
      fireEvent.press(view.getByTestId('transfer-received-cancel'));
    });
    expect(state.calls).not.toContain('apply');
    // And it lets go of what arrived - the documents are on disk, not in memory.
    expect(state.calls).toContain('dispose');
  });

  it('offers no way to apply a backup it already said it cannot read', async () => {
    const { controller, state } = fake();
    state.received = {
      ...state.received,
      restorable: false,
      compatibility: { kind: 'tooNew' } as never,
    };
    const view = await mount(controller);
    await act(async () => {
      fireEvent.changeText(
        view.getByTestId('transfer-phrase-input'),
        '7K2M-ryba-kotva-duha-lampa',
      );
    });
    await act(async () => {
      fireEvent.press(view.getByTestId('transfer-receive'));
    });
    await waitFor(() => expect(view.getByTestId('transfer-received-dialog')).toBeTruthy());
    expect(view.queryByTestId('transfer-received-confirm')).toBeNull();
    expect(view.getByText(t('transfer.got.tooNew'))).toBeTruthy();
  });

  it('says the boxes still need signing in to, where somebody thinks it is finished', async () => {
    // FR-011. The credentials never travelled and never have; this is the moment that matters.
    const { controller } = fake();
    const view = await mount(controller);
    await act(async () => {
      fireEvent.changeText(
        view.getByTestId('transfer-phrase-input'),
        '7K2M-ryba-kotva-duha-lampa',
      );
    });
    await act(async () => {
      fireEvent.press(view.getByTestId('transfer-receive'));
    });
    await waitFor(() => expect(view.getByTestId('transfer-received-dialog')).toBeTruthy());
    await act(async () => {
      fireEvent.press(view.getByTestId('transfer-received-confirm'));
    });
    await waitFor(() =>
      expect(view.getByTestId('transfer-done').props.children).toContain(
        t('transfer.done.signIn'),
      ),
    );
  });
});

describe('telling the three failures apart (FR-006)', () => {
  it('reads a mistyped phrase as a mistyped phrase, without leaving the phone', async () => {
    // PAKE gives one guess per attempt, so this is the failure a person actually meets - and a
    // phrase that is not even the right SHAPE should never have cost a handshake.
    const { controller, state } = fake();
    const view = await mount(controller);
    await act(async () => {
      fireEvent.changeText(view.getByTestId('transfer-phrase-input'), 'nonsense');
    });
    await act(async () => {
      fireEvent.press(view.getByTestId('transfer-receive'));
    });
    expect(view.getByTestId('transfer-error').props.children).toBe(
      t('transfer.error.phrase'),
    );
    expect(state.calls).toEqual([]);
  });

  it('reads a refused phrase differently from a broken transfer', async () => {
    const { controller, state } = fake();
    state.receiveFails = new PhraseRefusedError();
    const view = await mount(controller);
    await act(async () => {
      fireEvent.changeText(
        view.getByTestId('transfer-phrase-input'),
        '7K2M-ryba-kotva-duha-lampa',
      );
    });
    await act(async () => {
      fireEvent.press(view.getByTestId('transfer-receive'));
    });
    await waitFor(() =>
      expect(view.getByTestId('transfer-error').props.children).toBe(
        t('transfer.error.phrase'),
      ),
    );
  });

  it('reads a broken transfer as a broken transfer', async () => {
    const { controller, state } = fake();
    state.receiveFails = new TransferFailedError('the other phone went away');
    const view = await mount(controller);
    await act(async () => {
      fireEvent.changeText(
        view.getByTestId('transfer-phrase-input'),
        '7K2M-ryba-kotva-duha-lampa',
      );
    });
    await act(async () => {
      fireEvent.press(view.getByTestId('transfer-receive'));
    });
    await waitFor(() =>
      expect(view.getByTestId('transfer-error').props.children).toBe(
        t('transfer.error.failed'),
      ),
    );
  });

  it('reads a build that cannot transfer as exactly that', async () => {
    const { controller, state } = fake();
    state.receiveFails = new TransferUnavailableError();
    const view = await mount(controller);
    await act(async () => {
      fireEvent.changeText(
        view.getByTestId('transfer-phrase-input'),
        '7K2M-ryba-kotva-duha-lampa',
      );
    });
    await act(async () => {
      fireEvent.press(view.getByTestId('transfer-receive'));
    });
    await waitFor(() =>
      expect(view.getByTestId('transfer-error').props.children).toBe(
        t('transfer.unavailable'),
      ),
    );
  });
});

describe('a build without the native module (FR-013)', () => {
  it('hides the feature instead of offering something that cannot work', async () => {
    const { controller, state } = fake();
    state.available = false;
    const view = await mount(controller);
    expect(view.queryByTestId('transfer-send')).toBeNull();
    expect(view.queryByTestId('transfer-receive')).toBeNull();
    expect(view.getByText(t('transfer.unavailable'))).toBeTruthy();
  });
});

/** Type the phrase and start receiving, the way a person does. */
async function startReceiving(view: Awaited<ReturnType<typeof mount>>) {
  await act(async () => {
    fireEvent.changeText(view.getByTestId('transfer-phrase-input'), '7K2M-ryba-kotva-duha-lampa');
  });
  await act(async () => {
    fireEvent.press(view.getByTestId('transfer-receive'));
  });
}

/**
 * AppState driven by the test: the listeners the screen holds, and a way to move the app.
 *
 * The property is swapped and put back rather than spied on. The preset's `addEventListener` is
 * already a `jest.fn`, so `spyOn` hands back that same function and `mockRestore` strips its
 * implementation - leaving every later suite a subscription of `undefined`.
 */
function drivenAppState() {
  const listeners = new Set<(next: string) => void>();
  const holder = AppState as unknown as { addEventListener: unknown };
  const original = holder.addEventListener;
  holder.addEventListener = (_type: string, listener: (next: string) => void) => {
    listeners.add(listener);
    return { remove: () => listeners.delete(listener) };
  };
  return {
    listeners,
    move: async (next: string) => {
      await act(async () => {
        for (const listener of [...listeners]) {
          listener(next);
        }
      });
    },
    restore: () => {
      holder.addEventListener = original;
    },
  };
}

describe('only while somebody is watching (FR-014, T021)', () => {
  let app: ReturnType<typeof drivenAppState>;
  beforeEach(() => {
    app = drivenAppState();
  });
  afterEach(() => app.restore());

  it('stops an offer when the app goes to the background, and says why on return', async () => {
    const { controller, state } = fake();
    const view = await mount(controller);
    await act(async () => {
      fireEvent.press(view.getByTestId('transfer-send'));
    });
    await waitFor(() => expect(view.getByTestId('transfer-phrase')).toBeTruthy());

    // iOS's "still on screen, interrupted" - a pulled-down notification centre is not leaving.
    await app.move('inactive');
    expect(state.calls).not.toContain('abandon');
    expect(view.getByTestId('transfer-phrase')).toBeTruthy();

    await app.move('background');
    expect(state.signals[0].cancelled).toBe(true);
    // Through the cancel path, which is what sweeps the staged archive and recovery key.
    expect(state.calls).toContain('abandon');
    expect(view.queryByTestId('transfer-phrase')).toBeNull();
    expect(view.getByTestId('transfer-send')).toBeTruthy();
    expect(view.getByTestId('transfer-error').props.children).toBe(
      t('transfer.stopped.background'),
    );
  });

  it('stops a receive the same way, and the stop arriving late is not reported as a failure', async () => {
    const { controller, state } = fake();
    state.receiveHangs = true;
    const view = await mount(controller);
    await startReceiving(view);
    await waitFor(() => expect(view.getByTestId('transfer-route')).toBeTruthy());

    await app.move('background');
    expect(state.signals[0].cancelled).toBe(true);
    expect(state.calls).toContain('abandon');

    // The native side notices the stop and gives up. That is the stop arriving, not a broken
    // transfer, and "could not be completed" must not replace the sentence that says why.
    await act(async () => {
      state.settle?.reject(new TransferFailedError('context canceled'));
    });
    expect(view.getByTestId('transfer-error').props.children).toBe(
      t('transfer.stopped.background'),
    );
  });

  it('lets go of what arrived when a stopped receive finishes anyway', async () => {
    // The real controller refuses such a receive itself. A screen that relied on that alone would
    // leave the archive and its recovery key on disk the day a controller did not.
    const { controller, state } = fake();
    state.receiveHangs = true;
    const view = await mount(controller);
    await startReceiving(view);
    await waitFor(() => expect(view.getByTestId('transfer-route')).toBeTruthy());
    await app.move('background');

    await act(async () => {
      state.settle?.resolve(state.received);
    });
    expect(state.calls).toContain('dispose');
    expect(view.queryByTestId('transfer-received-dialog')).toBeNull();
  });

  it('counts the screen going off as leaving, and says so', () => {
    // Android pauses the app when the display times out, exactly as when the user switches away, so
    // a long transfer nobody touches stops too. Telling somebody who never left the app only that
    // they left it would send them looking for something they did not do.
    expect(STRINGS_FOR_TEST.cs['transfer.stopped.background']).toMatch(/displej/);
    expect(STRINGS_FOR_TEST.en['transfer.stopped.background']).toMatch(/screen/);
  });

  it('lets nothing from a stopped run leak into the next one', async () => {
    const { controller, state } = fake();
    state.receiveHangs = true;
    const view = await mount(controller);
    await startReceiving(view);
    await waitFor(() => expect(view.getByTestId('transfer-route')).toBeTruthy());
    await app.move('background');

    // A progress event still on its way from the stopped run...
    await act(async () => {
      state.progress[0]({ stage: 'transferring', sent: 2, total: 2, relayed: true });
    });
    // ...and a new run that has not reported a route yet.
    state.receiveQuiet = true;
    await startReceiving(view);
    await waitFor(() =>
      expect(view.getByTestId('transfer-route').props.children).toBe(routeText(null)),
    );
  });

  it('listens only while bytes are moving - not while the arrival waits for an answer', async () => {
    const { controller, state } = fake();
    state.receiveHangs = true;
    const view = await mount(controller);
    const idle = app.listeners.size;
    await startReceiving(view);
    await waitFor(() => expect(view.getByTestId('transfer-route')).toBeTruthy());
    expect(app.listeners.size).toBe(idle + 1);

    await act(async () => {
      state.settle?.resolve(state.received);
    });
    await waitFor(() => expect(view.getByTestId('transfer-received-dialog')).toBeTruthy());
    expect(app.listeners.size).toBe(idle);

    // Nothing is on the network while the question is open, so there is nothing to stop.
    await app.move('background');
    expect(state.calls).not.toContain('abandon');
    expect(view.getByTestId('transfer-received-dialog')).toBeTruthy();
  });

  it('stops a transfer when the screen is left mid-run, too', async () => {
    // Unmounted, the screen would never hear the app go to the background, and the native side
    // would carry on with nobody watching.
    const { controller, state } = fake();
    const view = await mount(controller);
    await act(async () => {
      fireEvent.press(view.getByTestId('transfer-send'));
    });
    await waitFor(() => expect(view.getByTestId('transfer-phrase')).toBeTruthy());

    await view.unmount();
    expect(state.signals[0].cancelled).toBe(true);
    expect(state.calls).toContain('abandon');
  });

  it('stops a run that starts while the app is already on its way out', async () => {
    // No change event is coming in that case, so waiting for one would let it run in the background.
    const holder = AppState as unknown as { currentState: unknown };
    const before = holder.currentState;
    holder.currentState = 'background';
    try {
      const { controller, state } = fake();
      state.receiveHangs = true;
      const view = await mount(controller);
      await startReceiving(view);
      await waitFor(() =>
        expect(view.getByTestId('transfer-error').props.children).toBe(
          t('transfer.stopped.background'),
        ),
      );
      expect(state.signals[0].cancelled).toBe(true);
    } finally {
      holder.currentState = before;
    }
  });

  it('drops the late failure of a run the user cancelled', async () => {
    // The same flaw, reached by the button: the stop arrived from the native side as an error, and
    // the screen reported "could not be completed" for a transfer the user had just stopped.
    const { controller, state } = fake();
    state.receiveHangs = true;
    const view = await mount(controller);
    await startReceiving(view);
    await waitFor(() => expect(view.getByTestId('transfer-cancel')).toBeTruthy());

    await act(async () => {
      fireEvent.press(view.getByTestId('transfer-cancel'));
    });
    await act(async () => {
      state.settle?.reject(new TransferFailedError('context canceled'));
    });
    expect(view.queryByTestId('transfer-error')).toBeNull();
    expect(view.getByTestId('transfer-receive')).toBeTruthy();
  });
});

/** Receive, then say yes to what arrived. */
async function receiveAndConfirm(view: Awaited<ReturnType<typeof mount>>) {
  await startReceiving(view);
  await waitFor(() => expect(view.getByTestId('transfer-received-dialog')).toBeTruthy());
  await act(async () => {
    fireEvent.press(view.getByTestId('transfer-received-confirm'));
  });
}

describe('saving what arrived (025 review, 2026-09-15)', () => {
  it('offers no cancel while it saves, and no new transfer either, until the save is done', async () => {
    // The cancel row stayed during the save. Pressing it put the screen back to idle while the save
    // went on, and a receive started then swept the directory the save was still reading.
    const { controller, state } = fake();
    state.applyHangs = true;
    const view = await mount(controller);
    await receiveAndConfirm(view);

    expect(view.queryByTestId('transfer-cancel')).toBeNull();
    expect(view.queryByTestId('transfer-receive')).toBeNull();
    expect(view.queryByTestId('transfer-send')).toBeNull();
    expect(view.getByText(t('transfer.stage.applying'))).toBeTruthy();
    // The place the route is stated says instead why there is nothing to press.
    expect(view.getByTestId('transfer-applying-note').props.children).toBe(
      t('transfer.applying.note'),
    );

    await act(async () => {
      state.settleApply?.resolve(state.applyReport);
    });
    expect(view.getByTestId('transfer-done')).toBeTruthy();
    expect(view.getByTestId('transfer-receive')).toBeTruthy();
  });

  it('hands the save the backup screen s prompt title, so keeping the password asks in our words', async () => {
    const { controller, state } = fake();
    const view = await mount(controller);
    await receiveAndConfirm(view);
    expect(state.applyOptions[0]).toMatchObject({ promptTitle: t('backup.prompt.enable') });
  });

  it('says when the backup password that arrived could not be kept', async () => {
    const { controller, state } = fake();
    state.applyReport = { ...state.applyReport, keysFailed: true };
    const view = await mount(controller);
    await receiveAndConfirm(view);
    await waitFor(() => expect(view.getByTestId('transfer-done')).toBeTruthy());
    expect(view.getByTestId('transfer-done').props.children).toContain(
      t('transfer.done.keyNotSaved'),
    );
  });

  it('shows a save still running from an earlier visit instead of offering a new transfer', async () => {
    // The screen was left during a save and opened again. A receive offered now would sweep the
    // files that save is still reading.
    const { controller, state } = fake();
    state.applying = true;
    const view = await mount(controller);
    expect(view.queryByTestId('transfer-receive')).toBeNull();
    expect(view.queryByTestId('transfer-cancel')).toBeNull();
    expect(view.getByText(t('transfer.stage.applying'))).toBeTruthy();

    state.applying = false;
    await act(async () => {
      state.applied?.();
    });
    expect(view.getByTestId('transfer-receive')).toBeTruthy();
  });

  it('says how a save it found running ended, as the screen that started it would have', async () => {
    // It went quietly back to the buttons, so whoever had left during the save and come back could not
    // tell whether their mail had arrived.
    const { controller, state } = fake();
    state.applying = true;
    const view = await mount(controller);
    await act(async () => {
      state.applied?.({ ok: true, applied: { ...state.applyReport, keysFailed: true } });
    });
    expect(view.getByTestId('transfer-done').props.children).toContain(
      t('transfer.done.keyNotSaved'),
    );
    expect(view.getByTestId('transfer-receive')).toBeTruthy();

    const failing = fake();
    failing.state.applying = true;
    const again = await mount(failing.controller);
    await act(async () => {
      failing.state.applied?.({ ok: false, error: new TransferFailedError('the disk is full') });
    });
    expect(again.getByTestId('transfer-error').props.children).toBe(t('transfer.error.failed'));
  });

  it('says a transfer refused because a save is still running is exactly that', async () => {
    const { controller, state } = fake();
    state.receiveFails = new TransferBusyError();
    const view = await mount(controller);
    await startReceiving(view);
    await waitFor(() =>
      expect(view.getByTestId('transfer-error').props.children).toBe(t('transfer.error.busy')),
    );
  });
});

describe('keeping the display on while a transfer is live (FR-014, 2026-09-15)', () => {
  // Android pauses the app when the display times out and the screen stops a paused transfer, so any
  // transfer longer than the timeout used to stop by itself.
  it('keeps it on for an offer, and lets it go when the offer is cancelled', async () => {
    const { controller, state } = fake();
    const view = await mount(controller);
    await act(async () => {
      fireEvent.press(view.getByTestId('transfer-send'));
    });
    await waitFor(() => expect(view.getByTestId('transfer-phrase')).toBeTruthy());
    expect(state.screenOn).toEqual([true]);

    await act(async () => {
      fireEvent.press(view.getByTestId('transfer-cancel'));
    });
    expect(state.screenOn).toEqual([true, false]);
  });

  it('keeps it on through a receive and the save, but not while the question waits', async () => {
    const { controller, state } = fake();
    state.receiveHangs = true;
    state.applyHangs = true;
    const view = await mount(controller);
    await startReceiving(view);
    await waitFor(() => expect(view.getByTestId('transfer-route')).toBeTruthy());
    expect(state.screenOn).toEqual([true]);

    await act(async () => {
      state.settle?.resolve(state.received);
    });
    await waitFor(() => expect(view.getByTestId('transfer-received-dialog')).toBeTruthy());
    expect(state.screenOn).toEqual([true, false]);

    await act(async () => {
      fireEvent.press(view.getByTestId('transfer-received-confirm'));
    });
    expect(state.screenOn).toEqual([true, false, true]);

    await act(async () => {
      state.settleApply?.resolve(state.applyReport);
    });
    expect(state.screenOn).toEqual([true, false, true, false]);
  });

  it('lets it go when a transfer fails, and when the screen is left mid-run', async () => {
    const { controller, state } = fake();
    state.receiveHangs = true;
    const view = await mount(controller);
    await startReceiving(view);
    await waitFor(() => expect(view.getByTestId('transfer-route')).toBeTruthy());
    await act(async () => {
      state.settle?.reject(new TransferFailedError('the other phone went away'));
    });
    expect(state.screenOn).toEqual([true, false]);

    await startReceiving(view);
    await waitFor(() => expect(state.screenOn).toEqual([true, false, true]));
    await view.unmount();
    expect(state.screenOn).toEqual([true, false, true, false]);
  });
});

describe('counts both phones can be read against (US1 scenarios 1 and 3)', () => {
  it('agrees in number for every count it lists', () => {
    expect(countList(1, 1, 1)).toBe('1 schránka, 1 zpráva, 1 příloha');
    expect(countList(3, 2, 4)).toBe('3 schránky, 2 zprávy, 4 přílohy');
    expect(countList(5, 19, 0)).toBe('5 schránek, 19 zpráv, 0 příloh');
    // A count the manifest cannot give is left out, never shown as zero.
    expect(countList(2, 7, null)).toBe('2 schránky, 7 zpráv');
  });

  it('shows what is about to go as counts and a size, before anything moves', async () => {
    const { controller, state } = fake();
    state.contents = { boxes: 3, messages: 19, documents: 9 };
    const view = await mount(controller);
    await act(async () => {
      fireEvent.press(view.getByTestId('transfer-send'));
    });
    await waitFor(() => expect(view.getByTestId('transfer-contents')).toBeTruthy());
    expect(view.getByTestId('transfer-contents').props.children).toBe(
      t('transfer.phrase.contents', {
        what: '3 schránky, 19 zpráv, 9 příloh',
        size: '2,3 MB',
      }),
    );
    await view.unmount();

    // A phone whose archive could not be counted still states the size, and claims no counts.
    const uncounted = fake();
    const again = await mount(uncounted.controller);
    await act(async () => {
      fireEvent.press(again.getByTestId('transfer-send'));
    });
    await waitFor(() => expect(again.getByTestId('transfer-contents')).toBeTruthy());
    expect(again.getByTestId('transfer-contents').props.children).toBe(
      t('transfer.phrase.size', { size: '2,3 MB' }),
    );
  });

  it('reports documents with the boxes and messages, and says how many did not land', async () => {
    const { controller, state } = fake();
    state.applyReport = {
      ...state.applyReport,
      documents: { restored: 9, missing: 1, failed: 0, orphaned: 0, bytes: 0 },
    };
    const view = await mount(controller);
    await startReceiving(view);
    await waitFor(() => expect(view.getByTestId('transfer-received-dialog')).toBeTruthy());
    await act(async () => {
      fireEvent.press(view.getByTestId('transfer-received-confirm'));
    });
    await waitFor(() => expect(view.getByTestId('transfer-done')).toBeTruthy());
    expect(view.getByTestId('transfer-done').props.children).toBe(
      [
        t('transfer.done', { what: '1 schránka, 3 zprávy, 9 příloh' }),
        '1 přílohu se nepodařilo obnovit.',
        t('transfer.done.signIn'),
      ].join(' '),
    );
  });
});

describe('naming the relay (US3 scenario 2)', () => {
  it('names the relay hosts while the transfer is relayed', async () => {
    const { controller, state } = fake();
    state.receiveHangs = true;
    const view = await mount(controller);
    await startReceiving(view);
    await waitFor(() =>
      expect(view.getByTestId('transfer-route').props.children).toContain('croc.schollz.com'),
    );
    expect(view.getByTestId('transfer-route').props.children).toContain('croc6.schollz.com');
  });
});

describe('spending mobile data (FR-008, T018)', () => {
  const netinfo = '@react-native-community/netinfo';
  afterEach(() => {
    jest.resetModules();
    jest.unmock(netinfo);
  });

  const withConnection = (state: unknown) =>
    jest.doMock(netinfo, () => ({ fetch: async () => state }), { virtual: true });

  it('asks before a LARGE transfer on a metered connection', async () => {
    const { isMetered, METERED_ASK_BYTES } = require('../../src/services/transfer/connection');
    expect(METERED_ASK_BYTES).toBe(5 * 1024 * 1024);
    expect(typeof isMetered).toBe('function');
    // The size comes from the manifest - archive plus documents - so the question is answerable
    // before anything is staged, which is what makes asking BEFORE the send possible at all.
    const m = manifest({ sizeBytes: 14_988, documentBytes: 7_187_132 });
    expect(m.sizeBytes + (m.documentBytes ?? 0)).toBeGreaterThan(METERED_ASK_BYTES);
  });

  it('treats "not known" as neither metered nor free', async () => {
    // A build without NetInfo must not put a confirmation in front of every transfer, and must not
    // silently decide the connection is free either. Hence three values, not a boolean.
    withConnection(undefined);
    const { isMetered } = require('../../src/services/transfer/connection');
    await expect(isMetered()).resolves.toBeNull();
  });

  it('believes the platform over the connection type', async () => {
    // `isConnectionExpensive` knows about metered Wi-Fi, which a type check would call free.
    withConnection({ type: 'wifi', details: { isConnectionExpensive: true } });
    const { isMetered } = require('../../src/services/transfer/connection');
    await expect(isMetered()).resolves.toBe(true);
  });

  it('falls back to the connection type when the platform will not say', async () => {
    withConnection({ type: 'cellular', details: {} });
    const { isMetered } = require('../../src/services/transfer/connection');
    await expect(isMetered()).resolves.toBe(true);
    jest.resetModules();
    withConnection({ type: 'wifi', details: {} });
    const again = require('../../src/services/transfer/connection');
    await expect(again.isMetered()).resolves.toBe(false);
  });
});

