// The backup screen as R10 draws it (031 I45, agreed 2026-11-12). Until 2026-11-15:
// - the switch's row carried its long description and the last backup on a row of its own;
// - "Ověřit zálohu" was a blue link row and "Zálohovat nyní" a filled ink bar;
// - an opened backup stacked a 44 Obnovit over a red Smazat link;
// - the file rows were blue links;
// - "downloaded only" was a gold pill.

import { act, fireEvent, waitFor, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { fakeController, manifest, mount } from '../helpers/backupScreenHarness';
import { lightTheme } from '../../src/theme/theme';
import { chipTone } from '../../src/theme/chipTone';
import { t } from '../../src/i18n/strings';

type Host = { props: Record<string, unknown>; children: (Host | string)[] };
const hidden = { includeHiddenElements: true };

const styleOf = (node: Host) => (StyleSheet.flatten(node.props.style as never) ?? {}) as Record<string, unknown>;

/** A button's face: the first view under the press that has a fill. */
function face(node: Host): Record<string, unknown> {
  const style = styleOf(node);
  if (style.backgroundColor != null) {
    return style;
  }
  for (const child of node.children) {
    if (typeof child !== 'string') {
      const found = face(child);
      if (Object.keys(found).length > 0) {
        return found;
      }
    }
  }
  return {};
}

const row = (m: ReturnType<typeof manifest>, held = false) => ({
  manifest: m,
  compatibility: { kind: 'current' as const },
  restorable: true,
  held,
});

const withBackups = (...rows: ReturnType<typeof row>[]) => {
  const fake = fakeController({ enabled: true, last: rows[0]?.manifest ?? null });
  fake.state.backups = rows;
  return fake;
};

describe('the backup card (R10)', () => {
  it('backs up and verifies from R6\'s sunken pair, 48 tall', async () => {
    const view = await mount(withBackups(row(manifest(1_000))));
    for (const id of ['backup-now', 'backup-verify']) {
      expect(face(view.getByTestId(id) as unknown as Host)).toMatchObject({
        backgroundColor: lightTheme.neutralFill,
        minHeight: 48,
      });
    }
  });

  it('dims the pair while a run goes on', async () => {
    const fake = withBackups(row(manifest(1_000)));
    const view = await mount(fake);
    await act(async () => {
      fake.state.setRun({ kind: 'backup', progress: { stage: 'reading', done: 1, total: 4, fraction: 0.25 } });
    });
    for (const id of ['backup-now', 'backup-verify']) {
      expect(face(view.getByTestId(id) as unknown as Host).opacity).toBe(0.55);
    }
  });

  it('lays the run over the description, so the slot keeps its height (constitution V)', async () => {
    const fake = withBackups(row(manifest(1_000)));
    const view = await mount(fake);
    await act(async () => {
      fake.state.setRun({ kind: 'backup', progress: { stage: 'reading', done: 1, total: 4, fraction: 0.25 } });
    });
    // The description is still there, unseen, holding the slot open.
    expect(view.getByText(t('backup.toggle.desc'), hidden)).toBeTruthy();
    const stage = view.getByTestId('backup-stage') as unknown as Host & { parent: Host & { parent: Host } };
    expect(styleOf(stage.parent.parent)).toMatchObject({ position: 'absolute', top: 0 });
  });
});

describe('the restore list (R10)', () => {
  it('gives a backup\'s size and version, its chip at the end, and a held one\'s reason in danger', async () => {
    const view = await mount(withBackups(row(manifest(5_000)), row(manifest(1_000), true)));
    await waitFor(() => expect(view.getByTestId('backup-row-0')).toBeTruthy());
    expect(view.getByTestId('backup-row-0')).toHaveTextContent(/verze/);
    expect(view.getByTestId('backup-held-1')).toHaveStyle({ color: lightTheme.danger });
  });

  it('draws a downloaded-only chip in the blue info tone, with the 8 corner', async () => {
    const m = manifest(1_000, 2, { tiers: { metadata: true, documents: true }, documentMode: 'downloaded' });
    const view = await mount(withBackups(row(m)));
    await waitFor(() => expect(view.getByTestId('backup-docs-0')).toBeTruthy());
    expect(styleOf(view.getByTestId('backup-docs-0') as unknown as Host)).toMatchObject({
      backgroundColor: lightTheme.blueSoft,
      borderTopLeftRadius: 8,
    });
  });

  it('opens a backup to Smazat and Obnovit side by side, 48 tall', async () => {
    const view = await mount(withBackups(row(manifest(1_000))));
    await act(async () => {
      fireEvent(view.getByTestId('backup-item-0'), 'press');
    });
    const remove = face(view.getByTestId('backup-delete-open') as unknown as Host);
    const restore = face(view.getByTestId('backup-restore-start') as unknown as Host);
    expect(remove).toMatchObject({ backgroundColor: lightTheme.neutralFill, minHeight: 48 });
    expect(restore).toMatchObject({ backgroundColor: lightTheme.text, minHeight: 48 });
    // The swipe behind the row says Smazat too, in white on red: this is the button's.
    expect(within(view.getByTestId('backup-delete-open')).getByText(t('backup.delete'), hidden)).toHaveStyle({
      color: lightTheme.danger,
    });
  });
});

describe('the backup as a file (R10)', () => {
  it('saves and loads from rows in ink, not blue links', async () => {
    const view = await mount(withBackups(row(manifest(1_000))));
    await waitFor(() => expect(view.getByTestId('backup-export')).toBeTruthy());
    for (const key of ['backup.file.export', 'backup.file.import']) {
      expect(view.getByText(t(key))).toHaveStyle({ color: lightTheme.text });
    }
  });
});

describe('a failure on the backup screen (R10)', () => {
  // Until 2026-11-15 it was a line of red words at the foot of the page.
  it('is the danger block the transfer uses: the soft danger tone, no outline', async () => {
    const fake = withBackups(row(manifest(1_000)));
    (fake.controller as unknown as Record<string, unknown>).deleteBackup = async () => {
      throw new Error('disk I/O error');
    };
    const view = await mount(fake);
    await act(async () => {
      fireEvent(view.getByTestId('backup-item-0'), 'press');
    });
    await act(async () => {
      fireEvent(view.getByTestId('backup-delete-open'), 'press');
    });
    await act(async () => {
      fireEvent.press(view.getByTestId('backup-delete-confirm'));
    });
    await waitFor(() => expect(view.getByTestId('backup-error')).toBeTruthy());
    const block = styleOf((view.getByTestId('backup-error') as unknown as { parent: Host }).parent);
    expect(block).toMatchObject({ backgroundColor: chipTone('dangerSoft', lightTheme).bg });
    expect(block.borderTopWidth ?? 0).toBe(0);
  });
});
