// The compose screen's strings (`send.*`): the recipient, the subject and body, attachments, the paid
// send, and every refusal and error on the way. In their own file since 2026-11-13: `strings.ts` was
// at its size limit when the Czech typesetting (031 I82) went into `t()`, and a limit is met by
// splitting the file, never by trimming what it says. `strings.ts` spreads these into its tables;
// the sent result's own `send.sent.*` strings are in `sentResultStrings.ts`.

/** Czech (primary). */
export const cs: Record<string, string> = {
  'send.title': 'Nová zpráva',
  'send.drafts': 'Rozepsané koncepty',
  'send.draft.empty': '(bez příjemce)',
  'send.draft.saved': 'Koncept uložen',
  'send.draft.discard': 'Zahodit',
  'send.draft.discarded': 'Koncept zahozen',
  'send.recipient': 'Příjemce',
  'send.recipient.search': 'Hledat příjemce (název nebo ID schránky)',
  'send.recipient.search.short': 'Jméno nebo ID schránky',
  'send.recipient.searching': 'Vyhledávám…',
  'send.recipient.none': 'Žádný příjemce nenalezen',
  'send.recipient.hint':
    'Začněte zadáním příjemce: jeho jméno nebo ID schránky. Po výběru doplníte předmět, text zprávy a případně přílohy.',
  'send.recipient.change': 'Změnit příjemce',
  'send.cost.free': 'Zdarma',
  'send.cost.paid.badge': 'Placená',
  'send.cost.free.note': 'Zpráva úřadu (OVM) je zdarma.',
  'send.cost.paid': 'Přibližně {czk} Kč',
  // 020 - the box's PDZ credit, shown on the sender card. The shortfall line is a CAUTION, not a
  // verdict: the price is approximate and the balance is only as fresh as the last refresh.
  'send.credit.balance': 'Zbývá {amount}',
  'send.credit.shortNote': 'Kredit schránky na tuto zprávu nemusí stačit.',
  'send.cost.paid.note':
    'Poštovní datová zpráva (PDZ) je zpoplatněná a hradí se z kreditu schránky. Cena je přibližná.',
  // The sender (027 US1, US2). Asked first when composing from "Vše", because search, credit and the
  // send itself go through the sender's box.
  'send.from': 'Od',
  'send.from.credit': 'kredit {amount}',
  'send.from.creditLabel': 'Kredit',
  'send.from.change': 'Změnit odesílatele',
  'send.from.pick': 'Vyberte schránku, ze které posíláte',
  'send.from.sheet': 'Odeslat ze schránky',
  'send.from.signIn': 'Nejdřív se do schránky znovu přihlaste',
  'send.from.first': 'Nejdřív vyberte odesílatele',
  'send.subject': 'Předmět',
  'send.subject.placeholder': 'Předmět zprávy',
  'send.body': 'Text zprávy',
  'send.body.placeholder': 'Napište zprávu…',
  'send.body.hint': 'Z textu vytvoříme přílohu „Textová zpráva.pdf".',
  'send.attachments': 'Přílohy',
  'send.attachments.add': 'Přidat přílohu',
  'send.attachments.remove': 'Odebrat přílohu',
  // 005 T006 - picked files stream in with progress and a way to stop. Every sentence here speaks in
  // sizes, never in a count of files, so none of them has a number to agree with.
  'send.attachments.readingStart': 'Načítání…',
  'send.attachments.reading': 'Načítání {read} z {total}',
  'send.attachments.cancel': 'Zrušit načítání',
  // Refused before a byte is read. No advice to remove an attachment: there may not be one yet.
  'send.attachments.tooLarge':
    'S tímto výběrem by zpráva měla {size}, datová zpráva ale smí mít nejvýš {limit}. Nic jsme nepřidali, vyberte prosím menší soubory.',
  'send.send': 'Odeslat',
  'send.sending': 'Odesílání…',
  'send.confirm.title': 'Odeslat placenou zprávu?',
  'send.confirm.body':
    'Jde o poštovní datovou zprávu (PDZ). Z kreditu schránky se strhne přibližně {czk} Kč.',
  'send.confirm.send': 'Odeslat za ~{czk} Kč',
  'send.blocked.recipientRejectsPdz':
    'Tato schránka nepřijímá poštovní datové zprávy.',
  'send.blocked.insufficientCredit': 'Nedostatek kreditu pro odeslání.',
  'send.blocked.pdzDisabled':
    'Tato schránka nemůže odesílat poštovní datové zprávy (PDZ).',
  'send.blocked.tooLarge':
    'Zpráva je příliš velká. Odešlete ji prosím přes webový portál.',
  'send.confirm.balance': 'Kredit schránky: {czk} Kč',
  'send.buyCredit': 'Koupit kredit',
  'send.reauth': 'Platnost přihlášení vypršela. Přihlaste se prosím znovu.',
  'send.reauth.credentials':
    'ISDS heslo odmítlo - změnilo se, nebo vypršelo. Přihlaste se prosím znovu.',
  'send.reauth.passwordExpired':
    'Platnost hesla vypršela. Změňte ho v portálu ISDS a přihlaste se novým heslem.',
  'send.error.attach': 'Přílohu se nepodařilo načíst.',
  'send.next.note': 'Příloha a odeslání budou doplněny v dalším kroku.',
  'send.error.search': 'Příjemce se nepodařilo vyhledat. Zkuste to znovu.',
  'send.error.network':
    'Jste offline. Zkontrolujte připojení a zkuste to znovu.',
  'send.error.timeout': 'Spojení vypršelo. Zkuste to prosím znovu.',
  // See messages.error.credentials.
  'send.error.credentials':
    'Uložené přihlašovací údaje se teď nepodařilo načíst. Zkuste to znovu.',
  'send.error.send': 'Zprávu se nepodařilo odeslat. Zkuste to znovu.',
  'send.error.pdf': 'Z textu se nepodařilo vytvořit PDF. Zkuste to znovu.',
  'send.error.noDocument':
    'Přidejte alespoň jeden dokument nebo napište text zprávy.',
  'send.dbType.OVM': 'Úřad (OVM)',
  'send.dbType.FO': 'Fyzická osoba',
  'send.dbType.PFO': 'Podnikající fyzická osoba',
  'send.dbType.PO': 'Právnická osoba',
};

/** English. */
export const en: Record<string, string> = {
  'send.title': 'New message',
  'send.drafts': 'Saved drafts',
  'send.draft.empty': '(no recipient)',
  'send.draft.saved': 'Draft saved',
  'send.draft.discard': 'Discard',
  'send.draft.discarded': 'Draft discarded',
  'send.recipient': 'Recipient',
  'send.recipient.search': 'Search recipient (name or box ID)',
  'send.recipient.search.short': 'Name or box ID',
  'send.recipient.searching': 'Searching…',
  'send.recipient.none': 'No recipient found',
  'send.recipient.hint':
    'Start by choosing a recipient: their name or data-box ID. Once you pick them, you’ll add a subject, message text, and any attachments.',
  'send.recipient.change': 'Change recipient',
  'send.cost.free': 'Free',
  'send.cost.paid.badge': 'Paid',
  'send.cost.free.note': 'A message to a public authority (OVM) is free.',
  'send.cost.paid': 'Approx. {czk} CZK',
  'send.credit.balance': '{amount} left',
  'send.credit.shortNote': "The box's credit may not cover this message.",
  'send.cost.paid.note':
    'A Postal Data Message (PDZ) is paid from the box credit. The price is approximate.',
  'send.from': 'From',
  'send.from.credit': '{amount} credit',
  'send.from.creditLabel': 'Credit',
  'send.from.change': 'Change sender',
  'send.from.pick': 'Choose the box you are sending from',
  'send.from.sheet': 'Send from',
  'send.from.signIn': 'Sign in to this box again first',
  'send.from.first': 'Choose the sender first',
  'send.subject': 'Subject',
  'send.subject.placeholder': 'Message subject',
  'send.body': 'Message text',
  'send.body.placeholder': 'Write a message…',
  'send.body.hint':
    'We’ll turn the text into a “Textová zpráva.pdf” attachment.',
  'send.attachments': 'Attachments',
  'send.attachments.add': 'Add attachment',
  'send.attachments.remove': 'Remove attachment',
  'send.attachments.readingStart': 'Loading…',
  'send.attachments.reading': 'Loading {read} of {total}',
  'send.attachments.cancel': 'Cancel loading',
  'send.attachments.tooLarge':
    'With this selection the message would be {size}, but a data message can be at most {limit}. Nothing was added; please choose smaller files.',
  'send.send': 'Send',
  'send.sending': 'Sending…',
  'send.confirm.title': 'Send a paid message?',
  'send.confirm.body':
    'This is a Postal Data Message (PDZ). About {czk} CZK will be deducted from the box credit.',
  'send.confirm.send': 'Send for ~{czk} CZK',
  'send.blocked.recipientRejectsPdz':
    'This box does not accept Postal Data Messages.',
  'send.blocked.insufficientCredit': 'Insufficient credit to send.',
  'send.blocked.pdzDisabled':
    'This box cannot send Postal Data Messages (PDZ).',
  'send.blocked.tooLarge':
    'The message is too large. Please send it via the web portal.',
  'send.confirm.balance': 'Box credit: {czk} CZK',
  'send.buyCredit': 'Buy credit',
  'send.reauth': 'Your sign-in has expired. Please sign in again.',
  'send.reauth.credentials':
    'ISDS refused the password - it was changed or has expired. Please sign in again.',
  'send.reauth.passwordExpired':
    'Your password has expired. Change it in the ISDS portal, then sign in with the new one.',
  'send.error.attach': 'The attachment could not be loaded.',
  'send.next.note': 'Attachments and sending come in the next step.',
  'send.error.search': 'Could not search recipients. Please try again.',
  'send.error.network': 'You are offline. Check your connection and try again.',
  'send.error.timeout': 'The connection timed out. Please try again.',
  // See the Czech block.
  'send.error.credentials':
    'Your saved sign-in details could not be read just now. Please try again.',
  'send.error.send': 'The message could not be sent. Please try again.',
  'send.error.pdf': 'Couldn’t create a PDF from the text. Please try again.',
  'send.error.noDocument': 'Add at least one document or write a message.',
  'send.dbType.OVM': 'Authority (OVM)',
  'send.dbType.FO': 'Individual',
  'send.dbType.PFO': 'Self-employed',
  'send.dbType.PO': 'Legal entity',
};
