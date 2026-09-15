// Keeping backups is not free: every one is a whole copy of the archive (006 FR-018).
//
// So the screen has to make three things true - the simple case needs no decisions, the advanced
// ones are reachable without cluttering it, and a backup can be got rid of. These tests hold the
// screen to that.

import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { fakeController, manifest, mount } from '../helpers/backupScreenHarness';
import {
  deleteDialogActions,
  disableDialogActions,
  pruneBody,
  pruneDialogActions,
} from '../../src/app/settings/BackupScreen';
import { t } from '../../src/i18n/strings';

const enabled = () => fakeController({ enabled: true, last: manifest(1_000) });

describe('the advanced options', () => {
  it('are folded away until asked for', async () => {
    const view = await mount(enabled());

    // The default screen is: a switch, a status line, a button. Nothing to decide.
    expect(view.getByTestId('backup-advanced-toggle')).toBeTruthy();
    expect(view.queryByTestId('backup-auto-toggle')).toBeNull();
    expect(view.queryByTestId('backup-keep-toggle')).toBeNull();

    await act(async () => {
      fireEvent(view.getByTestId('backup-advanced-toggle'), 'press');
    });

    expect(view.getByTestId('backup-auto-toggle')).toBeTruthy();
    expect(view.getByTestId('backup-keep-toggle')).toBeTruthy();
  });

  it('hides the how-many picker until keeping more than one is on', async () => {
    const fake = enabled();
    const view = await mount(fake);
    await act(async () => {
      fireEvent(view.getByTestId('backup-advanced-toggle'), 'press');
    });

    // One backup is the default, so there is no number to choose yet.
    expect(view.queryByTestId('backup-keep-count')).toBeNull();

    await act(async () => {
      fireEvent(view.getByTestId('backup-keep-toggle'), 'press');
    });

    // Turning it on picks a sensible "more than one" rather than asking for a number first.
    expect(fake.state.calls).toContain('setPreferences:{"keep":3}');
    await waitFor(() => expect(view.getByTestId('backup-keep-count')).toBeTruthy());
  });

  it('turning it back off returns to keeping exactly one', async () => {
    const fake = enabled();
    fake.state.prefs = { automatic: true, keep: 3, documents: false, documentMode: 'downloaded' as const };
    const view = await mount(fake);
    await act(async () => {
      fireEvent(view.getByTestId('backup-advanced-toggle'), 'press');
    });
    await act(async () => {
      fireEvent(view.getByTestId('backup-keep-toggle'), 'press');
    });

    expect(fake.state.calls).toContain('setPreferences:{"keep":1}');
  });

  it('lets automatic backups be switched off', async () => {
    const fake = enabled();
    const view = await mount(fake);
    await act(async () => {
      fireEvent(view.getByTestId('backup-advanced-toggle'), 'press');
    });
    await act(async () => {
      fireEvent(view.getByTestId('backup-auto-toggle'), 'press');
    });

    expect(fake.state.calls).toContain('setPreferences:{"automatic":false}');
  });
});

describe('what the switch claims', () => {
  it('promises nothing at all before backups are switched on', async () => {
    // The state a new user meets first: the switch is off (no passphrase), while `automatic`
    // defaults to true. Both auditors landed on this one - the screen was opening with "the archive
    // backs itself up after every refresh" above an off switch, and a line pointing at a "back up
    // now" button that this screen does not render while disabled.
    const view = await mount(fakeController());

    expect(view.getByText(t('backup.toggle.desc.off'))).toBeTruthy();
    expect(view.queryByText(t('backup.toggle.desc'))).toBeNull();
    expect(view.queryByText(t('backup.toggle.desc.manual'))).toBeNull();
    expect(view.queryByText(t('backup.auto'))).toBeNull();
    expect(view.queryByText(t('backup.auto.off'))).toBeNull();
    // …and the sentence that was pointing at it is gone precisely because the button is.
    expect(view.queryByTestId('backup-now')).toBeNull();

    // What DOES stay is the scope: what a backup holds is what someone deciding to switch it on
    // needs to read (FR-008).
    expect(view.getByText(t('backup.scope.desc'))).toBeTruthy();
    expect(view.getByText(t('backup.where'))).toBeTruthy();
  });

  it('stops promising automatic backups once they are turned off', async () => {
    const fake = enabled();
    const view = await mount(fake);

    expect(view.getByText(t('backup.toggle.desc'))).toBeTruthy();

    await act(async () => {
      fireEvent(view.getByTestId('backup-advanced-toggle'), 'press');
    });
    await act(async () => {
      fireEvent(view.getByTestId('backup-auto-toggle'), 'press');
    });

    // Reported by the user: the top of the screen went on saying "the archive backs itself up after
    // every refresh" with automatic backups switched off two rows below. A description that survives
    // the state it describes is not a description.
    await waitFor(() =>
      expect(view.getByText(t('backup.toggle.desc.manual'))).toBeTruthy(),
    );
    expect(view.queryByText(t('backup.toggle.desc'))).toBeNull();
    expect(view.getByText(t('backup.auto.off'))).toBeTruthy();
    expect(view.queryByText(t('backup.auto'))).toBeNull();
  });
});

// Lowering the limit deletes immediately - that is the point of the setting, and the reason it has
// to ask. Reported: "a modal must be displayed informing the user that X backups will be deleted
// immediately if they confirm this action, otherwise they can keep the current settings."
describe('lowering how many backups are kept', () => {
  const withBackups = (n: number, keep: number) => {
    const fake = enabled();
    fake.state.prefs = { automatic: true, keep, documents: false, documentMode: 'downloaded' as const };
    fake.state.backups = Array.from({ length: n }, (_, i) => ({
      manifest: manifest(1_000 + i),
      compatibility: { kind: 'current' as const },
      restorable: true,
    }));
    return fake;
  };

  const openAdvanced = async (fake: ReturnType<typeof fakeController>) => {
    const view = await mount(fake);
    await act(async () => {
      fireEvent(view.getByTestId('backup-advanced-toggle'), 'press');
    });
    return view;
  };

  it('asks before deleting, and says how many will go', async () => {
    const fake = withBackups(5, 5);
    const view = await openAdvanced(fake);

    await act(async () => {
      // Each segment is its own pressable: `<testID>-<key>`.
      fireEvent.press(view.getByTestId('backup-keep-count-2'));
    });

    await waitFor(() => expect(view.getByTestId('backup-prune-dialog')).toBeTruthy());
    // Five backups, keeping two: three go. The number has to be in the sentence - "some backups will
    // be deleted" is not a thing a person can weigh.
    expect(view.getByText(pruneBody(3, 2))).toBeTruthy();
    // …and nothing has happened yet.
    expect(fake.state.calls.filter(c => c.startsWith('setPreferences'))).toEqual([]);
  });

  it('cancelling keeps the setting as well as the backups', async () => {
    // The setting must not stick either: an unconfirmed limit would delete on the next backup
    // instead, which is the same surprise moved later.
    const calls: string[] = [];
    const actions = pruneDialogActions({
      close: () => calls.push('close'),
      confirm: () => calls.push('confirm'),
    });

    expect(actions.map(a => a.tone ?? 'neutral')).toEqual(['neutral', 'danger']);
    actions[0].onPress();
    expect(calls).toEqual(['close']);
  });

  it('applies the new limit once confirmed', async () => {
    const calls: string[] = [];
    const actions = pruneDialogActions({
      close: () => calls.push('close'),
      confirm: () => calls.push('confirm'),
    });
    actions[1].onPress();
    expect(calls).toEqual(['confirm']);
  });

  it('does not ask when nothing would be deleted', async () => {
    // Two backups, dropping the limit from five to three: nothing is over the line, so there is
    // nothing to warn about and a dialog would just be noise.
    const fake = withBackups(2, 5);
    const view = await openAdvanced(fake);

    await act(async () => {
      fireEvent.press(view.getByTestId('backup-keep-count-3'));
    });

    expect(view.queryByTestId('backup-prune-dialog')).toBeNull();
    expect(fake.state.calls).toContain('setPreferences:{"keep":3}');
  });

  it('asks when the switch itself drops the limit to one', async () => {
    // Turning "keep more than one" OFF deletes exactly as much as picking "1" would.
    const fake = withBackups(4, 3);
    const view = await openAdvanced(fake);

    await act(async () => {
      fireEvent(view.getByTestId('backup-keep-toggle'), 'press');
    });

    await waitFor(() => expect(view.getByTestId('backup-prune-dialog')).toBeTruthy());
    expect(view.getByText(pruneBody(3, 1))).toBeTruthy();
    expect(fake.state.calls.filter(c => c.startsWith('setPreferences'))).toEqual([]);
  });

  it('counts both numbers the way Czech counts them', () => {
    // Seen on the device before this was split into two counted phrases: "3 starší zálohy se smaže",
    // where the verb agreed with nothing. Czech switches form at 2–4 and again at 5+, for the verb
    // and for the adjective independently.
    expect(pruneBody(1, 1)).toBe(
      'Hned se smaže 1 nejstarší záloha, kterou už nepůjde obnovit; zůstane jen ta nejnovější.',
    );
    expect(pruneBody(3, 2)).toBe(
      'Hned se smažou 3 nejstarší zálohy, které už nepůjde obnovit; zůstanou 2 nejnovější.',
    );
    expect(pruneBody(7, 5)).toBe(
      'Hned se smaže 7 nejstarších záloh, které už nepůjde obnovit; zůstane 5 nejnovějších.',
    );
  });

  it('raising the limit never asks', async () => {
    const fake = withBackups(3, 2);
    const view = await openAdvanced(fake);

    await act(async () => {
      fireEvent.press(view.getByTestId('backup-keep-count-5'));
    });

    expect(view.queryByTestId('backup-prune-dialog')).toBeNull();
    expect(fake.state.calls).toContain('setPreferences:{"keep":5}');
  });
});

describe('deleting one backup', () => {
  it('offers a swipe action on every backup, readable or not', async () => {
    const fake = enabled();
    fake.state.backups = [
      { manifest: manifest(3_000), compatibility: { kind: 'current' }, restorable: true },
      {
        manifest: manifest(2_000, 9),
        compatibility: { kind: 'tooNew', what: 'schema', ours: 1, theirs: 9 },
        restorable: false,
      },
    ];
    const view = await mount(fake);

    // Including the one this build cannot read - that is the one most likely to be taking up space
    // for nothing.
    expect(view.getByTestId('backup-delete-0')).toBeTruthy();
    expect(view.getByTestId('backup-delete-1')).toBeTruthy();
  });

  it('asks first, and deletes the one that was chosen', () => {
    const calls: string[] = [];
    const actions = deleteDialogActions({
      close: () => calls.push('close'),
      remove: () => calls.push('remove'),
    });

    expect(actions.map(a => a.tone ?? 'neutral')).toEqual(['neutral', 'danger']);
    expect(actions[1].label).toBe(t('backup.delete'));
    actions[0].onPress();
    expect(calls).toEqual(['close']); // cancel deletes nothing
    actions[1].onPress();
    expect(calls).toEqual(['close', 'remove']);
  });

  it('uses the same two-button shape as turning backups off', () => {
    // Consistency is not decoration here: both dialogs destroy something, and a user who learns one
    // has learnt the other.
    const shape = (actions: ReturnType<typeof deleteDialogActions>) =>
      actions.map(a => a.tone ?? 'neutral');
    expect(shape(deleteDialogActions({ close: () => {}, remove: () => {} }))).toEqual(
      shape(disableDialogActions({ close: () => {}, disable: () => {} })),
    );
  });
});
