// Numbers in Czech sentences (2026-09-09).
//
// Reported from a device screenshot: "3 starší zálohy se smaže" - the verb agreeing with nothing.
// Czech changes form three times (1, 2–4, 5+) and the words around a number change WITH it: the
// noun, the verb, the adjective, the quantifier. Interpolating `{n}` into one fixed sentence gets
// two of those three cases wrong, and the wrong case is invisible to anyone reading the code in
// English.
//
// The rule this file enforces: any counted phrase must go through `plural()`, and the forms must
// actually differ from one another.

import { plural, STRINGS_FOR_TEST, t } from '../../src/i18n/strings';
import {
  pruneBody,
  restoredText,
  stageText,
  verifyText,
} from '../../src/app/settings/BackupScreen';

/** Families where the count is part of the sentence, not just a number appended to a label. */
const COUNTED = [
  'box.messages',
  'search.count',
  'status.fikce.in',
  'crossBox.due.in',
  'crossBox.lastKnown',
  'backup.count.messages',
  'backup.count.boxes',
  'transfer.count.documents',
  'transfer.done.missing',
  'backup.restored.someMissing',
  'backup.prune.deleted',
  'backup.prune.kept',
  'backup.prune.held',
  'licences.count',
  'licences.groupCount',
  'licences.showAll',
  'debug.recording.entries',
  'detail.attachments.incomplete',
];

describe('counted phrases', () => {
  it.each(COUNTED)('%s has all three Czech forms, and they differ', family => {
    const forms = ['one', 'few', 'many'].map(
      form => STRINGS_FOR_TEST.cs[`${family}.${form}`],
    );
    for (const form of forms) {
      expect(form).toEqual(expect.any(String));
    }
    // Three identical forms would mean the family exists but says the same thing for 1, 3 and 7 -
    // the defect wearing a plural costume.
    expect(new Set(forms).size).toBeGreaterThan(1);
  });

  it.each(COUNTED)('%s has both English forms', family => {
    for (const form of ['one', 'other']) {
      expect(STRINGS_FOR_TEST.en[`${family}.${form}`]).toEqual(expect.any(String));
    }
  });

  it('picks the form Czech actually uses', () => {
    expect(plural(1)).toBe('one');
    expect(plural(2)).toBe('few');
    expect(plural(4)).toBe('few');
    expect(plural(5)).toBe('many');
    expect(plural(0)).toBe('many'); // "0 komponent"
  });

  it('agrees in the sentence that started this', () => {
    // Both numbers in one sentence, each governing different words.
    expect(pruneBody(3, 2)).toContain('smažou 3 nejstarší zálohy');
    expect(pruneBody(7, 5)).toContain('smaže 7 nejstarších záloh');
    expect(pruneBody(1, 1)).toContain('smaže 1 nejstarší záloha');
    // And the held backups that stay beside them (2026-09-15), with a verb of their own.
    expect(pruneBody(1, 1, 1)).toContain(' Záloha s přílohami, které se nepodařilo obnovit, zůstane také.');
    expect(pruneBody(1, 1, 3)).toContain(' 3 zálohy s přílohami, které se nepodařilo obnovit, zůstanou také.');
    expect(pruneBody(1, 1, 5)).toContain(' 5 záloh s přílohami, které se nepodařilo obnovit, zůstane také.');
    expect(pruneBody(3, 2)).not.toContain('také');
  });

  it('agrees in the sentence a restore ends with (2026-09-15)', () => {
    // "1 příloh se nepodařilo obnovit." was the one form of it, whatever the count.
    const restoredWith = (missing: number, failed: number, held = false, orphaned = 0) =>
      restoredText({
        accountsAdded: 1,
        accountsKept: 0,
        messagesAdded: 2,
        messagesMerged: 0,
        draftsRestored: 0,
        remindersRestored: 0,
        settingsRestored: 0,
        documents: { restored: 4, missing, orphaned, failed, bytes: 0 },
        keysFailed: false,
        held,
      });
    expect(restoredWith(1, 0)).toBe('Obnoveno: 2 zprávy, 1 schránka, 4 soubory. 1 přílohu se nepodařilo obnovit.');
    expect(restoredWith(2, 1)).toContain(' 3 přílohy se nepodařilo obnovit.');
    expect(restoredWith(0, 7)).toContain(' 7 příloh se nepodařilo obnovit.');
    expect(restoredWith(0, 0)).toBe('Obnoveno: 2 zprávy, 1 schránka, 4 soubory.');
    // Why the backup it came from now stays, after the count and without one of its own (2026-09-15).
    expect(restoredWith(1, 0, true)).toBe(
      'Obnoveno: 2 zprávy, 1 schránka, 4 soubory. 1 přílohu se nepodařilo obnovit. ' +
        t('backup.restored.held'),
    );
    // And the ones left with no message to belong to, which were not written either, counted with the
    // rest as the transfer counts them (2026-09-15, review).
    expect(restoredWith(1, 0, true, 1)).toContain(' 2 přílohy se nepodařilo obnovit.');
  });

  it('agrees in the sentence a verify ends with (2026-09-24)', () => {
    // One fixed sentence with bare numbers read "1 schránky, 1 zpráv" for a backup of one box.
    expect(verifyText({ accounts: 1, messages: 1 })).toBe('Záloha je v pořádku: 1 schránka, 1 zpráva.');
    expect(verifyText({ accounts: 3, messages: 4 })).toBe('Záloha je v pořádku: 3 schránky, 4 zprávy.');
    expect(verifyText({ accounts: 5, messages: 19 })).toBe(
      'Záloha je v pořádku: 5 schránek, 19 zpráv.',
    );
  });

  it('never leaves a bare {n} in a rendered phrase', () => {
    for (const family of COUNTED) {
      for (const n of [1, 3, 7]) {
        const text = t(`${family}.${plural(n)}`, { n });
        expect({ family, n, text }).toEqual({
          family,
          n,
          text: expect.not.stringContaining('{'),
        });
      }
    }
  });
});

describe('the progress line of a restore (2026-09-24)', () => {
  // A restore writes its documents back in the stage a backup reads them in, and the line under it
  // said "Zálohuji přílohy".
  const at = (kind: 'backup' | 'restore' | 'verify', stage: 'documents' | 'restoring') => ({
    kind,
    progress: { stage, done: 1, total: 4, fraction: 0.5 },
  });

  it('says a restore is restoring its documents, and a backup that it is backing them up', () => {
    expect(stageText(at('restore', 'documents'))).toBe('Obnovuji přílohy');
    expect(stageText(at('backup', 'documents'))).toBe('Zálohuji přílohy');
    expect(stageText(at('restore', 'restoring'))).toBe(t('backup.stage.restoring'));
  });
});
