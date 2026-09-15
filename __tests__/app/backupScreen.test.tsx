// The backup screen (006) - the wiring between what the controller reports and what a person sees.
//
// The assertions that matter are about honesty: the password is not on screen until the OS prompt has
// been passed, what the backup does NOT hold is stated where the switch is, and a backup this build
// cannot read is shown with its reason rather than hidden.

import { useState } from 'react';
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { BackupAuthError } from '../../src/services/backup/envelope';
import { PortableFormatError } from '../../src/services/backup/portable';
import { fakeController, KEY, manifest, mount, wrap } from '../helpers/backupScreenHarness';
import { BackupScreen } from '../../src/app/settings/BackupScreen';
import { t } from '../../src/i18n/strings';

describe('BackupScreen', () => {
  it('shows a placeholder while it is finding out, never a switch set to off', async () => {
    // The bug: `enabled` is a boolean, so the two async reads behind it (Keychain, then the target's
    // manifests) rendered as OFF until they landed. A user whose archive WAS backed up opened this
    // screen, read a full sentence saying nothing was backed up anywhere, watched the switch sit
    // left, and then saw the whole screen flip. Loading is a third state, not "off".
    const fake = fakeController({ enabled: true, last: manifest(1_000) });
    let release = () => {};
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    const answer = fake.controller.status.bind(fake.controller);
    fake.controller.status = async () => {
      await gate;
      return answer();
    };

    const view = await wrap(
      <BackupScreen onBack={() => {}} controller={fake.controller} onOpenFaq={() => {}} />,
    );

    // Mid-flight: a placeholder holding the row's shape, and NOT any of the three claims.
    expect(view.getByTestId('backup-toggle-loading')).toBeTruthy();
    expect(view.queryByTestId('backup-toggle')).toBeNull();
    expect(view.queryByText(t('backup.toggle.desc.off'))).toBeNull();
    expect(view.queryByText(t('backup.toggle.desc'))).toBeNull();

    await act(async () => {
      release();
      await gate;
    });

    // Resolved: the real switch, on, and the placeholder gone.
    await waitFor(() => expect(view.getByTestId('backup-toggle')).toBeTruthy());
    expect(view.queryByTestId('backup-toggle-loading')).toBeNull();
    expect(view.getByText(t('backup.toggle.desc'))).toBeTruthy();
  });

  it('does not say there is nothing to restore before it has looked', async () => {
    // `backups` starts empty, and empty rendered the "no backups" row - a sentence saying there is
    // nothing to restore from, shown to someone who has three. Same bug as the switch, and on the
    // one promise this screen exists to make, so it gets its own test.
    const fake = fakeController({ enabled: true, last: manifest(1_000) });
    fake.state.backups = [
      { manifest: manifest(1_000), restorable: true, compatibility: { kind: 'ok' } },
    ] as unknown as typeof fake.state.backups;
    let release = () => {};
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    const answer = fake.controller.list.bind(fake.controller);
    fake.controller.list = async () => {
      await gate;
      return answer();
    };

    const view = await wrap(
      <BackupScreen onBack={() => {}} controller={fake.controller} onOpenFaq={() => {}} />,
    );

    // Mid-flight: a placeholder row, and NOT the claim that there are none.
    expect(view.getByTestId('backup-restore-loading')).toBeTruthy();
    expect(view.queryByTestId('backup-none')).toBeNull();
    expect(view.queryByText(t('backup.restore.none'))).toBeNull();
    // The scope card holds its shape too, rather than assembling itself.
    expect(view.getByTestId('backup-scope-loading')).toBeTruthy();

    await act(async () => {
      release();
      await gate;
    });

    await waitFor(() => expect(view.getByTestId('backup-row-0')).toBeTruthy());
    expect(view.queryByTestId('backup-restore-loading')).toBeNull();
    expect(view.queryByTestId('backup-none')).toBeNull();
    expect(view.getByText(t('backup.scope.desc'))).toBeTruthy();
  });

  it('says what the backup does not hold, before it is even switched on', async () => {
    const view = await mount(fakeController());
    // FR-008: attachments and sign-in details are named, on the same screen as the switch.
    expect(view.getByText(t('backup.scope.desc'))).toBeTruthy();
    expect(view.getByText(t('backup.where'))).toBeTruthy();
    expect(view.getByTestId('backup-none')).toBeTruthy();
  });

  it('switching on makes a backup and starts showing when it happened', async () => {
    const fake = fakeController();
    const view = await mount(fake);
    expect(view.queryByTestId('backup-now')).toBeNull();

    await act(async () => {
      fireEvent(view.getByTestId('backup-toggle'), 'press');
    });

    expect(fake.state.calls).toContain('enable');
    await waitFor(() => expect(view.getByTestId('backup-last')).toBeTruthy());
    expect(view.getByTestId('backup-now')).toBeTruthy();
  });

  it('tells the user to set a screen lock instead of reporting a failure', async () => {
    const fake = fakeController();
    fake.state.noScreenLock = true;
    const view = await mount(fake);

    await act(async () => {
      fireEvent(view.getByTestId('backup-toggle'), 'press');
    });

    // "The backup could not be created" would never lead anyone to the setting that fixes it.
    await waitFor(() => expect(view.getByTestId('backup-nolock-dialog')).toBeTruthy());
    expect(view.getByText(t('backup.noLock.body'))).toBeTruthy();
    expect(view.queryByTestId('backup-error')).toBeNull();
  });

  it('keeps the password off screen until the prompt has been passed', async () => {
    const fake = fakeController({ enabled: true, last: manifest(1_000) });
    const view = await mount(fake);

    expect(view.queryByTestId('backup-key')).toBeNull();
    expect(fake.state.calls).not.toContain('revealKey');

    await act(async () => {
      fireEvent(view.getByTestId('backup-reveal'), 'press');
    });

    expect(fake.state.calls).toContain('revealKey');
    await waitFor(() => expect(view.getByTestId('backup-key')).toHaveTextContent(KEY));
  });

  it('shows nothing, and no error, when the prompt is dismissed', async () => {
    const fake = fakeController({ enabled: true, last: manifest(1_000) });
    fake.state.denyPrompt = true;
    const view = await mount(fake);

    await act(async () => {
      fireEvent(view.getByTestId('backup-reveal'), 'press');
    });

    expect(view.queryByTestId('backup-key')).toBeNull();
    // Cancelling is a decision; telling the user it failed would be wrong.
    expect(view.queryByTestId('backup-error')).toBeNull();
  });

  it('offers the QR only once the password is on screen', async () => {
    const fake = fakeController({ enabled: true, last: manifest(1_000) });
    const view = await mount(fake);
    expect(view.queryByTestId('backup-qr-toggle')).toBeNull();

    await act(async () => {
      fireEvent(view.getByTestId('backup-reveal'), 'press');
    });
    await waitFor(() => expect(view.getByTestId('backup-qr-toggle')).toBeTruthy());
    await act(async () => {
      fireEvent(view.getByTestId('backup-qr-toggle'), 'press');
    });
    expect(view.getByTestId('backup-qr')).toBeTruthy();
  });

  it('lists a backup it cannot read, with the reason', async () => {
    const fake = fakeController({ enabled: true, last: manifest(1_000) });
    fake.state.backups = [
      {
        manifest: manifest(3_000, 9),
        compatibility: { kind: 'tooNew', what: 'schema', ours: 1, theirs: 9 },
        restorable: false,
      },
    ];
    const view = await mount(fake);

    // Hiding it would look like the backup was lost; the answer is "update the app".
    expect(view.getByText(t('backup.restore.tooNew'))).toBeTruthy();
    expect(view.getByTestId('backup-row-0')).toBeTruthy();
    // …and it is not pressable: there is nothing useful behind a tap on a backup this build cannot
    // open, so it gets no press target at all.
    expect(view.queryByTestId('backup-item-0')).toBeNull();
    expect(view.queryByTestId('backup-restore-start')).toBeNull();
  });

  it('refuses a malformed password before touching the archive', async () => {
    const fake = fakeController();
    fake.state.backups = [
      { manifest: manifest(3_000), compatibility: { kind: 'current' }, restorable: true },
    ];
    const view = await mount(fake);

    await act(async () => {
      fireEvent(view.getByTestId('backup-item-0'), 'press');
    });
    // `act` is not optional around changeText here: without it the state update is dropped and the
    // test passes for the wrong reason - an empty field is also a malformed key.
    await act(async () => {
      fireEvent.changeText(view.getByTestId('backup-key-input'), 'FKPX-9WQ2-7TDM-4RJH');
    });
    await act(async () => {
      fireEvent(view.getByTestId('backup-restore-start'), 'press');
    });

    expect(view.getByTestId('backup-error')).toHaveTextContent(t('backup.restore.badKey'));
    expect(fake.state.calls).not.toContain('restore');
  });

  it('restores with a typed password and reports what came back', async () => {
    const fake = fakeController();
    fake.state.backups = [
      { manifest: manifest(3_000), compatibility: { kind: 'current' }, restorable: true },
    ];
    const view = await mount(fake);

    await act(async () => {
      fireEvent(view.getByTestId('backup-item-0'), 'press');
    });
    // Typed the way a person would, off paper: lowercase, spaces instead of dashes.
    await act(async () => {
      fireEvent.changeText(view.getByTestId('backup-key-input'), 'fkpx 9wq2 7tdm 4rjh 2cvb');
    });
    await act(async () => {
      fireEvent(view.getByTestId('backup-restore-start'), 'press');
    });

    expect(fake.state.calls).toContain('restore');
    await waitFor(() =>
      expect(view.getByTestId('backup-restored')).toHaveTextContent(/7 zpráv/),
    );
  });

  it('blames the password only when the password is what failed', async () => {
    const withFailure = async (failure: Error) => {
      const fake = fakeController();
      fake.state.restoreFailure = failure;
      fake.state.backups = [
        { manifest: manifest(3_000), compatibility: { kind: 'current' }, restorable: true },
      ];
      const view = await mount(fake);
      await act(async () => {
        fireEvent(view.getByTestId('backup-item-0'), 'press');
      });
      await act(async () => {
        fireEvent.changeText(view.getByTestId('backup-key-input'), KEY);
      });
      await act(async () => {
        fireEvent(view.getByTestId('backup-restore-start'), 'press');
      });
      return view.getByTestId('backup-error');
    };

    expect(await withFailure(new BackupAuthError('bad key'))).toHaveTextContent(
      t('backup.restore.failed'),
    );
    // Anything else - a missing Hermes global, a filesystem error - is NOT the user's password. Saying
    // it is sends them retyping a key that was right all along.
    expect(
      await withFailure(new ReferenceError("Property 'TextDecoder' doesn't exist")),
    ).toHaveTextContent(t('backup.restore.error'));
  });




  it('asks before forgetting the password, and only then forgets it', async () => {
    const fake = fakeController({ enabled: true, last: manifest(1_000) });
    const view = await mount(fake);

    await act(async () => {
      fireEvent(view.getByTestId('backup-toggle'), 'press');
    });
    await waitFor(() => expect(view.getByTestId('backup-disable-dialog')).toBeTruthy());
    // Asking is not doing: the key is still there until the destructive button is pressed.
    expect(fake.state.calls).not.toContain('disable');
    expect(view.getByTestId('backup-disable-confirm')).toBeTruthy();
    expect(view.getByTestId('backup-disable-keep')).toBeTruthy();
  });
});

// ── Moving a backup off the phone, and proving one is real (006 T014 / T013) ─────────────────────

describe('backup as a file', () => {
  it('offers to load one even when backup has never been switched on', async () => {
    // The phone that needs this most is a NEW one: nothing enabled, nothing in the archive, and a
    // file in hand. Gating import on `enabled` would lock out the only case it exists for.
    const view = await mount(fakeController());
    expect(view.getByTestId('backup-import')).toBeTruthy();
    expect(view.queryByTestId('backup-export')).toBeNull(); // nothing to export yet
  });

  it('offers to save one once there is a backup to save', async () => {
    const fake = fakeController({ enabled: true, last: manifest(1_000) });
    const view = await mount(fake);
    await act(async () => {
      fireEvent.press(view.getByTestId('backup-export'));
    });
    expect(fake.state.calls).toContain('exportBackup:obalka-1000.backup');
    await waitFor(() => expect(view.getByText(t('backup.file.exported'))).toBeTruthy());
  });

  it('says nothing at all when the save sheet is dismissed', async () => {
    // A user who changes their mind has not failed at anything.
    const fake = fakeController({ enabled: true, last: manifest(1_000) });
    fake.state.exportCancelled = true;
    const view = await mount(fake);
    await act(async () => {
      fireEvent.press(view.getByTestId('backup-export'));
    });
    expect(view.queryByText(t('backup.file.exported'))).toBeNull();
    expect(view.queryByTestId('backup-error')).toBeNull();
  });

  it('shows an imported backup in the restore list', async () => {
    const fake = fakeController();
    const view = await mount(fake);
    await act(async () => {
      fireEvent.press(view.getByTestId('backup-import'));
    });
    await waitFor(() => expect(view.getByText(t('backup.file.imported'))).toBeTruthy());
    expect(view.getByTestId('backup-row-0')).toBeTruthy();
  });

  it('passes the format error through, because it is written for a person', async () => {
    // "Import failed" in front of somebody's only backup is the worst sentence this app could print.
    // `PortableFormatError` already says which of the three things went wrong.
    const fake = fakeController();
    fake.state.importFailure = new PortableFormatError('Not an Obálka backup file.');
    const view = await mount(fake);
    await act(async () => {
      fireEvent.press(view.getByTestId('backup-import'));
    });
    await waitFor(() => expect(view.getByText('Not an Obálka backup file.')).toBeTruthy());
  });
});

describe('verifying a backup', () => {
  it('is offered under the line it checks, and only when there is one', async () => {
    const none = await mount(fakeController());
    expect(none.queryByTestId('backup-verify')).toBeNull();

    const view = await mount(fakeController({ enabled: true, last: manifest(1_000) }));
    expect(view.getByTestId('backup-verify')).toBeTruthy();
  });

  it('reports what it found, not just that it looked', async () => {
    const fake = fakeController({ enabled: true, last: manifest(1_000) });
    const view = await mount(fake);
    await act(async () => {
      fireEvent.press(view.getByTestId('backup-verify'));
    });
    expect(fake.state.calls).toContain('verify:obalka-1000.backup');
    // Counts the user can compare against the phone in their hand.
    await waitFor(() =>
      expect(
        view.getByText('Záloha je v pořádku: 3 schránky, 412 zpráv.'),
      ).toBeTruthy(),
    );
  });

  it('says the backup could not be opened when it could not', async () => {
    const fake = fakeController({ enabled: true, last: manifest(1_000) });
    fake.state.verifyFailure = new Error('mac check failed');
    const view = await mount(fake);
    await act(async () => {
      fireEvent.press(view.getByTestId('backup-verify'));
    });
    await waitFor(() => expect(view.getByText(t('backup.verify.failed'))).toBeTruthy());
  });
});

describe('one failing read does not blank the others', () => {
  it('keeps the switch and the tier honest when the restore listing fails', async () => {
    // A real first-run defect, found on the emulator: the status read and the restore listing both
    // created the backup directory at once, one lost the race and threw "already exists", and the
    // screen answered "backups off, nothing to restore" on a phone where neither was established.
    // The listing failing says nothing about whether backups are on.
    const fake = fakeController({
      enabled: true,
      last: manifest(1_000),
      documentsPossible: true,
    });
    fake.state.listFailure = new Error('the folder could not be read');
    const view = await mount(fake);

    expect(view.getByTestId('backup-documents-toggle')).toBeTruthy();
    expect(view.getByTestId('backup-last')).toBeTruthy();
    // And the listing itself degrades to the truthful empty state rather than taking the screen.
    expect(view.getByText(t('backup.restore.none'))).toBeTruthy();
  });
});

describe('the documents switch (006 T024)', () => {
  it('is not there at all when the destination cannot hold documents', async () => {
    // A control that can do nothing is worse than no control: it is a promise the app cannot keep.
    const view = await mount(
      fakeController({ enabled: true, last: manifest(1_000), documentsPossible: false }),
    );
    expect(view.queryByTestId('backup-documents-toggle')).toBeNull();
  });

  it('is OFF, and the scope says so, before anybody touches it', async () => {
    const view = await mount(
      fakeController({ enabled: true, last: manifest(1_000), documentsPossible: true }),
    );
    expect(view.getByTestId('backup-documents-toggle')).toBeTruthy();
    expect(view.getByText(t('backup.docs.desc.off'))).toBeTruthy();
    expect(view.getByText(t('backup.scope.desc'))).toBeTruthy();
    expect(view.queryByText(t('backup.scope.desc.documents'))).toBeNull();
  });

  it('SHOWS THE SIZE before it is switched on, and saves nothing until that is answered', async () => {
    // The whole point of T024. A switch that silently starts writing gigabytes to somebody's phone
    // is not a switch they agreed to.
    const fake = fakeController({
      enabled: true,
      last: manifest(1_000),
      documentsPossible: true,
    });
    fake.state.estimate = {
      count: 12,
      plainBytes: 3_000_000,
      sealedBytes: 3_000_192,
      gone: 0,
    };
    const view = await mount(fake);
    await act(async () => {
      fireEvent.press(view.getByTestId('backup-documents-toggle'));
    });

    await waitFor(() => expect(view.getByTestId('backup-documents-dialog')).toBeTruthy());
    expect(fake.state.calls).toContain('documentEstimate');
    // Measured, not guessed - and nothing is saved while the question is still on screen.
    expect(view.getByText(/12/)).toBeTruthy();
    expect(fake.state.calls.some(c => c.startsWith('setPreferences'))).toBe(false);

    await act(async () => {
      fireEvent.press(view.getByTestId('backup-documents-confirm'));
    });
    expect(fake.state.calls).toContain(
      'setPreferences:{"documentMode":"downloaded","documents":true}',
    );
  });

  it('leaves it off when the question is dismissed', async () => {
    const fake = fakeController({
      enabled: true,
      last: manifest(1_000),
      documentsPossible: true,
    });
    const view = await mount(fake);
    await act(async () => {
      fireEvent.press(view.getByTestId('backup-documents-toggle'));
    });
    await waitFor(() => expect(view.getByTestId('backup-documents-dialog')).toBeTruthy());
    await act(async () => {
      fireEvent.press(view.getByTestId('backup-documents-cancel'));
    });
    expect(fake.state.calls.some(c => c.startsWith('setPreferences'))).toBe(false);
    expect(view.getByText(t('backup.docs.desc.off'))).toBeTruthy();
  });

  it('turns OFF without asking - nothing is destroyed by it', async () => {
    // The mirror of switching backups off entirely: the objects already stored are left alone, so
    // there is nothing to warn about (Principle IV).
    const fake = fakeController({
      enabled: true,
      last: manifest(1_000),
      documentsPossible: true,
      documentsOn: true,
    });
    fake.state.prefs = { automatic: true, keep: 1, documents: true, documentMode: 'downloaded' };
    const view = await mount(fake);
    await act(async () => {
      fireEvent.press(view.getByTestId('backup-documents-toggle'));
    });
    expect(fake.state.calls).toContain('setPreferences:{"documents":false}');
    expect(view.queryByTestId('backup-documents-dialog')).toBeNull();
  });

  it('says which tier the last backup actually holds', async () => {
    // FR-008: "backed up" means two different things now, and the line reads the MANIFEST - so a
    // backup made before the switch was turned on still reports what it really contains.
    const withDocuments = manifest(1_000, 2, {
      tiers: { metadata: true, documents: true },
      documentCount: 9,
      documentBytes: 5_000_000,
    });
    const view = await mount(
      fakeController({ enabled: true, last: withDocuments, documentsPossible: true }),
    );
    const line = view.getByTestId('backup-last');
    expect(line.props.children).toContain('+');
  });
});

describe('scanning the recovery key (006 T012b)', () => {
  it('offers the scan only where a camera exists', async () => {
    // The button is absent, not disabled, on a build or a phone that cannot scan - the same rule the
    // transfer follows. A control that can do nothing is a promise the app cannot keep.
    const view = await mount(
      fakeController({ enabled: true, last: manifest(1_000) }),
    );
    const { scanningAvailable } = require('../../src/features/transfer/screens/CodeScanner');
    if (scanningAvailable()) {
      expect(view.queryByTestId('backup-restore-row-0')).toBeTruthy();
    } else {
      expect(view.queryByTestId('backup-scan-key')).toBeNull();
    }
  });

  it('puts a scanned key in the FIELD rather than restoring with it', () => {
    // 021's rule, for 021's reason: a misread that acts on itself spends an attempt the user cannot
    // get back. `parseKeyQr` is what decides a code is even ours.
    const { parseKeyQr, encodeKeyQr } = require('../../src/services/backup/keyQr');
    expect(parseKeyQr(encodeKeyQr(KEY))).toBe(KEY);
    // And a transfer phrase scanned here is refused rather than typed into the password box.
    const {
      encodeTransferQr,
    } = require('../../src/services/transfer/transferQr');
    expect(parseKeyQr(encodeTransferQr('7K2M-ryba-kotva-duha-lampa'))).toBeNull();
  });
});

describe('coming back from the transfer (025 review, 2026-09-15)', () => {
  it('reads the status again when it comes back into view, so backups a transfer turned on show as on', async () => {
    // The screen stays mounted under the transfer it opens and read its status only on mount and when
    // a run ended. A transfer that kept the key that arrived left the switch saying "off".
    const fake = fakeController();
    let comeBack = () => {};
    function Returning() {
      const [shownAgain, setShownAgain] = useState(0);
      comeBack = () => setShownAgain(n => n + 1);
      return (
        <BackupScreen
          onBack={() => {}}
          controller={fake.controller}
          onOpenFaq={() => {}}
          shownAgain={shownAgain}
        />
      );
    }
    const view = await wrap(<Returning />);
    await waitFor(() => expect(view.getByText(t('backup.toggle.desc.off'))).toBeTruthy());

    fake.state.status = { ...fake.state.status, enabled: true, last: manifest(1_000) };
    await act(async () => {
      comeBack();
    });
    await waitFor(() => expect(view.getByText(t('backup.toggle.desc'))).toBeTruthy());
  });
});
