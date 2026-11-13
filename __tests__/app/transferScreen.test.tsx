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
import { TransferScreen } from '../../src/app/settings/TransferScreen';
import {
  countList,
  errorText,
  routeKey,
  routeText,
  wentText,
} from '../../src/app/settings/transferWords';
import type { TransferController } from '../../src/features/transfer/state/transferController';
import {
  PhraseRefusedError,
  TransferBusyError,
  TransferFailedError,
  TransferNoAnswerError,
  TransferOfferExpiredError,
  TransferUnavailableError,
} from '../../src/services/transfer/transport';
import type { BackupManifest } from '../../src/services/backup/schema';
import { STRINGS_FOR_TEST, t } from '../../src/i18n/strings';
import {
  drivenAppState,
  fake,
  manifest,
  mount,
  receiveAndConfirm,
  startReceiving,
  type OnProgress,
} from '../helpers/transferScreenHarness';

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
  it('sits last, after the cancel link, so its growing moves nothing', async () => {
    // The route is known only part-way through, and the relayed sentence is several lines where
    // "working it out" is one. Inside the card it moved the cancel row under a thumb; the fix was a
    // reserved height, which read as an empty line under the short sentence (025 T027). Since 031 R6
    // the steady "keep it open" line sits above the cancel link, as the board draws it; it never grows.
    const { controller, state } = fake();
    state.receiveHangs = true;
    state.receiveQuiet = true;
    const view = await mount(controller);
    await startReceiving(view);
    await waitFor(() =>
      expect(view.getByTestId('transfer-route').props.children).toBe(routeText(null)),
    );
    expect(view.queryByTestId('transfer-route-reserve', { includeHiddenElements: true })).toBeNull();
    const ids = collectTestIds(view.toJSON());
    expect(ids.indexOf('transfer-keep-open')).toBeLessThan(ids.indexOf('transfer-cancel'));
    expect(ids.indexOf('transfer-cancel')).toBeLessThan(ids.indexOf('transfer-route'));
    expect(ids[ids.length - 1]).toBe('transfer-route');

    await act(async () => {
      state.progress[0]({ stage: 'transferring', sent: 1, total: 2, relayed: true });
    });
    expect(view.getByTestId('transfer-route').props.children).toBe(routeText(true));
  });

  it('says to keep the app open while a run is up (FR-014, 025 T027)', async () => {
    const { controller, state } = fake();
    state.receiveHangs = true;
    const view = await mount(controller);
    await startReceiving(view);
    await waitFor(() =>
      expect(view.getByTestId('transfer-keep-open').props.children).toBe(t('transfer.keepOpen')),
    );
  });
});

describe('a wait that reads as a wait (025 T027)', () => {
  it('moves while nothing can be counted, and stops once the bar counts', async () => {
    const { controller, state } = fake();
    state.receiveHangs = true;
    state.receiveQuiet = true;
    const view = await mount(controller);
    await startReceiving(view);
    await waitFor(() => expect(view.getByTestId('transfer-waiting')).toBeTruthy());
    await act(async () => {
      state.progress[0]({ stage: 'transferring', sent: 1, total: 2, relayed: true });
    });
    expect(view.queryByTestId('transfer-waiting')).toBeNull();
  });

  it('stops waiting once it has arrived, and keeps the route it took under the question', async () => {
    const { controller, state } = fake();
    state.receiveHangs = true;
    state.receiveQuiet = true;
    const view = await mount(controller);
    await startReceiving(view);
    await act(async () => {
      state.progress[0]({ stage: 'transferring', sent: 1, total: 2, relayed: true });
    });
    await act(async () => {
      state.settle?.resolve(state.received);
    });
    await waitFor(() => expect(view.getByTestId('transfer-received-dialog')).toBeTruthy());
    expect(view.queryByTestId('transfer-waiting')).toBeNull();
    expect(view.getByTestId('transfer-stage').props.children).toBe(t('transfer.stage.received'));
    expect(view.getByTestId('transfer-progress')).toBeTruthy();
    expect(view.getByTestId('transfer-route').props.children).toBe(routeText(true));
  });

  it('says a receive is connecting, not getting ready to send', async () => {
    const { controller, state } = fake();
    state.receiveHangs = true;
    state.receiveQuiet = true;
    const view = await mount(controller);
    await startReceiving(view);
    await waitFor(() =>
      expect(view.getByTestId('transfer-stage').props.children).toBe(
        t('transfer.stage.connecting'),
      ),
    );
  });
});

/** Every testID in render order, depth first - the order they are drawn down the screen. */
function collectTestIds(node: unknown): string[] {
  if (node == null || typeof node !== 'object') {
    return [];
  }
  if (Array.isArray(node)) {
    return node.flatMap(collectTestIds);
  }
  const n = node as { props?: { testID?: string }; children?: unknown };
  const own = n.props?.testID ? [n.props.testID] : [];
  return [...own, ...collectTestIds(n.children ?? null)];
}

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
    // Each dash set tight against the word before it, as it is typed - with space around the dashes
    // nobody could tell whether the spaces were part of it (025 T027) - and the hint says the rest.
    for (const part of ['7K2M-', 'ryba-', 'kotva-', 'duha-', 'lampa']) {
      expect(view.getByText(part)).toBeTruthy();
    }
    expect(view.getByTestId('transfer-phrase-hint').props.children).toBe(t('transfer.phrase.hint'));
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
    // The chip's words, as text after the size (031 R10).
    expect(view.getByText(new RegExp(` · ${t('backup.docs.chip.all')} · `))).toBeTruthy();
    expect(view.getByText(new RegExp(` · ${t('backup.docs.chip.none')}$`))).toBeTruthy();
    expect(view.getByText(new RegExp(t('backup.docs.missing.few', { n: 3 }).replace(/\u00A0/g, ' ')))).toBeTruthy();
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
      expect(view.getByTestId('transfer-done-body').props.children).toContain(
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
    expect(view.getByTestId('transfer-error').props.children).toBe(t('transfer.error.typo'));
    expect(state.calls).toEqual([]);
  });

  it('names the word that cannot be in a phrase, and does not ask for a new one (T027)', async () => {
    const { controller, state } = fake();
    const view = await mount(controller);
    await act(async () => {
      fireEvent.changeText(view.getByTestId('transfer-phrase-input'), 'F4HY cuk prsten melodie placka');
    });
    await act(async () => {
      fireEvent.press(view.getByTestId('transfer-receive'));
    });
    expect(view.getByTestId('transfer-error').props.children).toBe(
      t('transfer.error.typo.word', { word: 'cuk' }),
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

    // Nothing is on the network while the question is open, so there is nothing to stop. The question
    // waits, hidden - an RN Modal would draw over the lock screen (2026-11-12) - and is back on return.
    await app.move('background');
    expect(state.calls).not.toContain('abandon');
    expect(state.calls).not.toContain('dispose');
    expect(view.queryByTestId('transfer-received-dialog')).toBeNull();
    await app.move('active');
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
    // The end is the whole screen (031 R8); the way on leads back to the form.
    await act(async () => {
      fireEvent.press(view.getByTestId('transfer-continue'));
    });
    expect(view.getByTestId('transfer-receive')).toBeTruthy();
  });

  it('asks for the screen lock in words about the password that arrived, not about setting one (T027)', async () => {
    const { controller, state } = fake();
    const view = await mount(controller);
    await receiveAndConfirm(view);
    expect(state.applyOptions[0]).toMatchObject({ promptTitle: t('transfer.prompt.keepKey') });
    expect(t('transfer.prompt.keepKey')).not.toBe(t('backup.prompt.enable'));
  });

  it('says when the backup password that arrived could not be kept', async () => {
    const { controller, state } = fake();
    state.applyReport = { ...state.applyReport, keysFailed: true };
    const view = await mount(controller);
    await receiveAndConfirm(view);
    await waitFor(() => expect(view.getByTestId('transfer-done')).toBeTruthy());
    expect(view.getByTestId('transfer-done-body').props.children).toContain(
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
    expect(view.getByTestId('transfer-done-body').props.children).toContain(
      t('transfer.done.keyNotSaved'),
    );
    await act(async () => {
      fireEvent.press(view.getByTestId('transfer-continue'));
    });
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
        size: '2,3\u00A0MB',
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
      t('transfer.phrase.size', { size: '2,3\u00A0MB' }),
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
      t('transfer.done', { what: '1 schránka, 3 zprávy, 9 příloh' }),
    );
    expect(view.getByTestId('transfer-done-body').props.children).toBe(
      ['1 přílohu se nepodařilo obnovit.', t('transfer.done.signIn')].join(' '),
    );
    // The fake's receive reports a relayed route; the last word repeats it, as its own paragraph,
    // because it says something else than what was restored (025 T027).
    expect(view.getByTestId('transfer-done-route').props.children).toBe(wentText(true));
  });
});

describe('the last word on each phone (025 T027)', () => {
  it('leaves the route paragraph out when the route was never known', async () => {
    const { controller, state } = fake();
    state.receiveQuiet = true;
    const view = await mount(controller);
    await receiveAndConfirm(view);
    await waitFor(() => expect(view.getByTestId('transfer-done')).toBeTruthy());
    expect(view.queryByTestId('transfer-done-route')).toBeNull();
  });

  it('tells the sending phone that it went, and which way', async () => {
    let finish: () => void = () => undefined;
    const { controller } = fake({
      async offer(_m: BackupManifest, onProgress: OnProgress) {
        onProgress({ stage: 'transferring', sent: 1, total: 2, relayed: false });
        return {
          phrase: '7K2M-ryba-kotva-duha-lampa',
          sizeBytes: 10,
          contents: null,
          done: new Promise<void>(resolve => {
            finish = resolve;
          }),
        };
      },
    });
    const view = await mount(controller);
    await act(async () => {
      fireEvent.press(view.getByTestId('transfer-send'));
    });
    await waitFor(() => expect(view.getByTestId('transfer-phrase')).toBeTruthy());
    await act(async () => {
      finish();
    });
    await waitFor(() =>
      expect(view.getByTestId('transfer-done').props.children).toBe(t('transfer.sent.title')),
    );
    expect(view.getByTestId('transfer-done-body').props.children).toBe(t('transfer.sent.body'));
    expect(view.getByTestId('transfer-done-route').props.children).toBe(wentText(false));
  });

  it('says nothing about a route that never became known', () => {
    expect(wentText(null)).toBeNull();
    expect(wentText(true)).toContain('croc.schollz.com');
  });

  it('tells the sender that a phrase was refused on the OTHER phone', () => {
    // "Ask the other phone for a fresh one" sent the person showing the phrase looking for another.
    expect(errorText(new PhraseRefusedError(), 'sending')).toBe(
      t('transfer.error.phrase.sender'),
    );
    expect(errorText(new PhraseRefusedError(), 'receiving')).toBe(t('transfer.error.phrase'));
  });

  it('says a silent other phone and an expired offer in their own words', () => {
    expect(errorText(new TransferNoAnswerError())).toBe(t('transfer.error.noAnswer'));
    expect(errorText(new TransferOfferExpiredError(), 'sending')).toBe(
      t('transfer.error.expired'),
    );
  });

  it('shows the no-answer sentence when the receive gives up', async () => {
    const { controller, state } = fake();
    state.receiveFails = new TransferNoAnswerError();
    const view = await mount(controller);
    await startReceiving(view);
    await waitFor(() =>
      expect(view.getByTestId('transfer-error').props.children).toBe(
        t('transfer.error.noAnswer'),
      ),
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

