// The sent result's strings (board "Sent - the stamp is cancelled", 031): the envelope that went, its
// postmark and stamp, the delivery record still to fill in, and the two ways on. In their own file since
// 2026-11-12: `strings.ts` is at its size limit, and a limit is met by splitting the file, never by
// trimming what it says. `strings.ts` spreads these into its tables.

/** Czech (primary). */
export const cs: Record<string, string> = {
  'send.sent': 'Zpráva odeslána',
  'send.sent.reconciled':
    'Tato zpráva už byla odeslána při předchozím pokusu. Znovu jsme ji neodesílali ani neúčtovali.',
  // Czech says "ve" before 2-4, 12-14 and 20-23 o'clock and "v" before the rest (as `messages.synced.at`).
  'send.sent.body': 'ISDS ji přijalo {date} v {time}. Až ji adresát otevře, doručenka se doplní sama.',
  'send.sent.body.ve': 'ISDS ji přijalo {date} ve {time}. Až ji adresát otevře, doručenka se doplní sama.',
  // The words round the postmark struck on the envelope that went.
  'send.sent.postmark.ring': 'ODESLÁNO · DATOVÁ SCHRÁNKA ·',
  'send.sent.stamp.free': '0 Kč',
  'send.sent.stamp.paid': '~{czk} Kč',
  'send.sent.record.id': 'ID {id}',
  'send.sent.step.sent': 'Odesláno',
  'send.sent.step.sent.note': 'ISDS zprávu přijalo',
  'send.sent.step.delivered': 'Dodáno',
  'send.sent.step.delivered.note': 'do schránky adresáta',
  'send.sent.step.accepted': 'Doručeno',
  'send.sent.step.accepted.note': 'až ji adresát otevře',
  'send.sent.step.accepted.done': 'adresát se přihlásil',
  'send.sent.step.fiction': 'Doručeno fikcí',
  'send.sent.step.fiction.note': 'po deseti dnech bez přihlášení',
  'send.sent.notYet': 'zatím ne',
  'send.sent.open': 'Ukázat v Odeslaných',
  'send.done': 'Hotovo',
};

/** English. */
export const en: Record<string, string> = {
  'send.sent': 'Message sent',
  'send.sent.reconciled':
    'This message was already sent on a previous attempt. We did not re-send or charge again.',
  'send.sent.body':
    'ISDS accepted it on {date} at {time}. Once the recipient opens it, the delivery record fills in by itself.',
  'send.sent.body.ve':
    'ISDS accepted it on {date} at {time}. Once the recipient opens it, the delivery record fills in by itself.',
  'send.sent.postmark.ring': 'SENT · DATA BOX ·',
  'send.sent.stamp.free': '0 CZK',
  'send.sent.stamp.paid': '~{czk} CZK',
  'send.sent.record.id': 'ID {id}',
  'send.sent.step.sent': 'Sent',
  'send.sent.step.sent.note': 'ISDS accepted the message',
  'send.sent.step.delivered': 'Delivered',
  'send.sent.step.delivered.note': 'to the recipient’s box',
  'send.sent.step.accepted': 'Accepted',
  'send.sent.step.accepted.note': 'once the recipient opens it',
  'send.sent.step.accepted.done': 'the recipient signed in',
  'send.sent.step.fiction': 'Accepted by fiction',
  'send.sent.step.fiction.note': 'after ten days without signing in',
  'send.sent.notYet': 'not yet',
  'send.sent.open': 'Show in Sent',
  'send.done': 'Done',
};
