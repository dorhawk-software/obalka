// The transfer's run and its ends as board R8 draws them (031 I46.4-I46.5): the stage beside the bytes
// over one bar, and the end as a screen of its own - the archive's stack of envelopes, what came back
// as the title, what is still to do under it, the route last, and the way on. A failure is R10's
// danger block at the top of the half it happened in, where the eye already is.

import { act, fireEvent, waitFor, within } from '@testing-library/react-native';
import { t } from '../../src/i18n/strings';
import { formatBytes } from '../../src/i18n/typeset';
import { wentText } from '../../src/app/settings/transferWords';
import { fake, mount, receiveAndConfirm, startReceiving } from '../helpers/transferScreenHarness';

describe('a run, as R8 draws it', () => {
  it('heads a receive with its own half, and sets the bytes beside the stage', async () => {
    const { controller, state } = fake();
    state.receiveHangs = true;
    state.receiveQuiet = true;
    const view = await mount(controller);
    await startReceiving(view);
    await act(async () => {
      state.progress[0]({ stage: 'transferring', sent: 2_700_000, total: 4_400_000, relayed: false });
    });
    const run = view.getByTestId('transfer-run');
    expect(within(run).getByText(t('transfer.receive'))).toBeTruthy();
    expect(view.getByTestId('transfer-stage').props.children).toBe(t('transfer.stage.transferring'));
    expect(view.getByTestId('transfer-bytes').props.children).toBe(
      t('backup.progress.count', { done: formatBytes(2_700_000), total: formatBytes(4_400_000) }),
    );
  });

  it('counts no bytes before any are moving', async () => {
    const { controller, state } = fake();
    state.receiveHangs = true;
    state.receiveQuiet = true;
    const view = await mount(controller);
    await startReceiving(view);
    expect(view.queryByTestId('transfer-bytes')).toBeNull();
  });

  it('heads an offer with the sending half', async () => {
    const { controller } = fake();
    const view = await mount(controller);
    await act(async () => {
      fireEvent.press(view.getByTestId('transfer-send'));
    });
    await waitFor(() => expect(view.getByTestId('transfer-phrase')).toBeTruthy());
    expect(within(view.getByTestId('transfer-run')).getByText(t('transfer'))).toBeTruthy();
  });
});

describe('the end, as R8 draws it', () => {
  it('is a screen of its own: the archive, what came back, what is left to do, the route', async () => {
    const { controller } = fake();
    const view = await mount(controller);
    await receiveAndConfirm(view);
    await waitFor(() => expect(view.getByTestId('transfer-done')).toBeTruthy());
    expect(view.getByTestId('envelopePose-archive', { includeHiddenElements: true })).toBeTruthy();
    expect(view.getByTestId('transfer-done').props.children).toMatch(/^Obnoveno: /);
    expect(view.getByTestId('transfer-done-body').props.children).toBe(t('transfer.done.signIn'));
    expect(view.getByTestId('transfer-done-route').props.children).toBe(wentText(true));
    // The form is not under it: the end is the whole screen until the way on is taken.
    expect(view.queryByTestId('transfer-receive')).toBeNull();
  });

  it('goes back to the form on "Pokračovat" when the shell has no way on', async () => {
    const { controller } = fake();
    const view = await mount(controller);
    await receiveAndConfirm(view);
    await waitFor(() => expect(view.getByTestId('transfer-continue')).toBeTruthy());
    await act(async () => {
      fireEvent.press(view.getByTestId('transfer-continue'));
    });
    expect(view.queryByTestId('transfer-done')).toBeNull();
    expect(view.getByTestId('transfer-receive')).toBeTruthy();
  });

  it('tells the sending phone in the same shape: sent, then what the other phone still needs', async () => {
    let finish: () => void = () => undefined;
    const { controller } = fake({
      async offer() {
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
    await waitFor(() => expect(view.getByTestId('transfer-done')).toBeTruthy());
    expect(view.getByTestId('transfer-done').props.children).toBe(t('transfer.sent.title'));
    expect(view.getByTestId('transfer-done-body').props.children).toBe(t('transfer.sent.body'));
  });
});

describe('a failure, as R10 draws it', () => {
  it('is a danger block at the top of the receiving half', async () => {
    const { controller } = fake();
    const view = await mount(controller);
    await act(async () => {
      fireEvent.changeText(view.getByTestId('transfer-phrase-input'), 'nesmysl');
    });
    await act(async () => {
      fireEvent.press(view.getByTestId('transfer-receive'));
    });
    const block = view.getByTestId('transfer-error-receiving');
    expect(within(block).getByTestId('transfer-error').props.children).toBe(t('transfer.error.typo'));
    expect(view.queryByTestId('transfer-error-sending')).toBeNull();
  });
});
