// Three actions on the backup screen failed without a word (2026-09-24).
//
// Saving a backup preference - lowering the limit, whose deletes can fail, above all - deleting one
// backup, and switching backups off each went to the controller from a promise nothing caught. The
// rejection was unhandled (constitution II), and the screen stayed as if the action had worked: the
// new number on the picker over the old backups, the deleted row still listed, the switch still on.
// Each now says what did not happen, and reads the store again so the screen shows what is true.

import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { fakeController, manifest, mount } from '../helpers/backupScreenHarness';
import { t } from '../../src/i18n/strings';

const row = (createdAt: number) => ({
  manifest: manifest(createdAt),
  compatibility: { kind: 'current' as const },
  restorable: true,
});

/** A controller whose `name` rejects, as a store that will not write does. */
function failing(name: 'setPreferences' | 'deleteBackup' | 'disable') {
  const fake = fakeController({ enabled: true, last: manifest(5_000) });
  const controller = fake.controller as unknown as Record<string, unknown>;
  controller[name] = async (...args: unknown[]) => {
    fake.state.calls.push(`${name}:failed:${JSON.stringify(args[0] ?? null)}`);
    throw new Error('disk I/O error');
  };
  return fake;
}

/** Press a dialog's button. */
const pressInDialog = async (view: Awaited<ReturnType<typeof mount>>, testID: string) => {
  await act(async () => {
    fireEvent.press(view.getByTestId(testID));
  });
};

describe('a backup preference that will not save', () => {
  it('says the older backups were not deleted, and the switch goes back to what is stored', async () => {
    const fake = failing('setPreferences');
    fake.state.prefs = { automatic: true, keep: 3, documents: false, documentMode: 'downloaded' as const };
    const view = await mount(fake);
    await act(async () => {
      fireEvent(view.getByTestId('backup-advanced-toggle'), 'press');
    });
    expect(view.getByTestId('backup-keep-count')).toBeTruthy();

    // Down to one: nothing is over the line with no backups listed, so it saves without asking.
    await act(async () => {
      fireEvent(view.getByTestId('backup-keep-toggle'), 'press');
    });

    await waitFor(() => expect(view.getByText(t('backup.prune.failed'))).toBeTruthy());
    expect(fake.state.calls).toContain('setPreferences:failed:{"keep":1}');
    // Read again from the store, which still says three: the picker is back.
    await waitFor(() => expect(view.getByTestId('backup-keep-count')).toBeTruthy());
  });

  it('says a switch that will not save did not save', async () => {
    const fake = failing('setPreferences');
    const view = await mount(fake);
    await act(async () => {
      fireEvent(view.getByTestId('backup-advanced-toggle'), 'press');
    });
    await act(async () => {
      fireEvent(view.getByTestId('backup-auto-toggle'), 'press');
    });

    await waitFor(() => expect(view.getByText(t('backup.prefs.failed'))).toBeTruthy());
    // Still automatic, as stored - not the optimistic "off" the press drew.
    await waitFor(() => expect(view.getByText(t('backup.toggle.desc'))).toBeTruthy());
    expect(view.queryByText(t('backup.toggle.desc.manual'))).toBeNull();
  });
});

describe('a backup that will not delete', () => {
  it('says so, and keeps the row', async () => {
    const fake = failing('deleteBackup');
    fake.state.backups = [row(5_000)];
    const view = await mount(fake);
    await act(async () => {
      fireEvent(view.getByTestId('backup-item-0'), 'press');
    });
    await act(async () => {
      fireEvent(view.getByTestId('backup-delete-open'), 'press');
    });
    await waitFor(() => expect(view.getByTestId('backup-delete-dialog')).toBeTruthy());

    await pressInDialog(view, 'backup-delete-confirm');

    await waitFor(() =>
      expect(view.getByTestId('backup-error')).toHaveTextContent(t('backup.delete.failed')),
    );
    expect(view.queryByTestId('backup-notice')).toBeNull();
    expect(view.getByTestId('backup-row-0')).toBeTruthy();
  });
});

describe('backups that will not switch off', () => {
  it('says so, and the switch stays on', async () => {
    const fake = failing('disable');
    const view = await mount(fake);
    await act(async () => {
      fireEvent(view.getByTestId('backup-toggle'), 'press');
    });
    await waitFor(() => expect(view.getByTestId('backup-disable-dialog')).toBeTruthy());

    await pressInDialog(view, 'backup-disable-confirm');

    await waitFor(() =>
      expect(view.getByTestId('backup-error')).toHaveTextContent(t('backup.off.failed')),
    );
    expect(view.getByTestId('backup-now')).toBeTruthy();
  });
});
