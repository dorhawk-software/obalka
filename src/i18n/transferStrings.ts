// The transfer's strings that have left `strings.ts` (025, 031): the last word on each phone (US1,
// FR-007, FR-011, T027) and, since R10, the row that leads to receiving and the refusal of an empty
// Přijmout. Split out on 2026-11-13, when the end became a screen of its own (I46.5) - `strings.ts`
// was at its size limit, which is met by splitting the file, never by trimming what it says.
// `strings.ts` spreads these into its tables.

/** Czech (primary). */
export const cs: Record<string, string> = {
  // R10: the row on the sending screen that opens the receiving one.
  'transfer.receive.row': 'Zadejte heslo, které ukazuje druhý telefon.',
  // Přijmout pressed with nothing in the field: what is missing, for the shake and a screen reader.
  'transfer.needPhrase': 'Nejdřív zadejte heslo z druhého telefonu.',
  // US1. Schránky, zprávy a přílohy ve stejném pořadí, v jakém je ukázal telefon, který odesílal.
  'transfer.done': 'Obnoveno: {what}.',
  // Přílohy, které záloha jmenuje a které se nepodařilo zapsat - spočítané a řečené, ne tiše vynechané.
  'transfer.done.missing.one': '1 přílohu se nepodařilo obnovit.',
  'transfer.done.missing.few': '{n} přílohy se nepodařilo obnovit.',
  'transfer.done.missing.many': '{n} příloh se nepodařilo obnovit.',
  // FR-011. Přihlašovací údaje se nepřenášejí a nikdy se nepřenášely; po obnovení se do schránek
  // přihlásíte znovu. Řečeno tady, protože tady je člověk, který si myslí, že je hotovo.
  'transfer.done.signIn': 'Do schránek se ještě budete muset přihlásit.',
  // Poslední slovo ODESÍLAJÍCÍHO telefonu (025 T027). Dřív tu stálo jen "Do schránek se ještě budete
  // muset přihlásit", věta pro druhý telefon - že se něco odeslalo, neřeklo nic.
  'transfer.sent.title': 'Odesláno.',
  'transfer.sent.body': 'Na druhém telefonu se do schránek ještě budete muset přihlásit.',
  // FR-007 i po konci: malý archiv přejde za vteřinu a věta o cestě během přenosu jen probleskne.
  'transfer.route.went.direct': 'Přenos šel přímo mezi telefony.',
  'transfer.route.went.relayed':
    'Přenos šel přes veřejný přenosový server {host}. Ten viděl velikost a čas, obsah ne - byl zašifrovaný.',
  // Archiv je uložený, jen heslo k záloze, které přišlo s ním, se uložit nepodařilo (třeba odmítnutá
  // výzva k zámku obrazovky). Řečeno, jinak by člověk věřil, že nový telefon zálohuje.
  'transfer.done.keyNotSaved':
    'Heslo k záloze se do tohoto telefonu nepodařilo uložit. Zkontrolujte to na obrazovce Záloha archivu.',
};

/** English. */
export const en: Record<string, string> = {
  'transfer.receive.row': 'Type the password the other phone is showing.',
  'transfer.needPhrase': 'Type the password from the other phone first.',
  'transfer.done': 'Restored {what}.',
  'transfer.done.missing.one': '1 document could not be restored.',
  'transfer.done.missing.other': '{n} documents could not be restored.',
  'transfer.done.signIn': 'You still need to sign in to the data boxes.',
  'transfer.sent.title': 'Sent.',
  'transfer.sent.body': 'On the other phone you still need to sign in to the data boxes.',
  'transfer.route.went.direct': 'The transfer went straight between the phones.',
  'transfer.route.went.relayed':
    'The transfer went through the public relay {host}. It saw the size and the timing, not the contents - those were encrypted.',
  'transfer.done.keyNotSaved':
    'The backup password could not be saved on this phone. Check it on the Archive backup screen.',
};
