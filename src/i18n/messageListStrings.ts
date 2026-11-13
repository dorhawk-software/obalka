// The inbox list's strings (the message list, its rows, its states and its freshness line), in their
// own file since 2026-11-12: `strings.ts` had reached its size limit, and a limit is met by splitting
// the file, never by trimming what it says. `strings.ts` spreads these into its tables, so `t()` and
// the locale tests see one table per language as before.

/** Czech (primary). */
export const cs: Record<string, string> = {
  'messages.title': 'Přijaté zprávy',
  'messages.empty': 'Ve schránce nic není',
  'messages.empty.hint': 'Obálka se podívá pokaždé, když ji otevřete.',
  'messages.segment.received': 'Přijaté',
  'messages.segment.sent': 'Odeslané',
  'messages.segment.sent.news.one': 'Odeslané, u {n} zprávy se změnil stav doručení',
  'messages.segment.sent.news.few': 'Odeslané, u {n} zpráv se změnil stav doručení',
  'messages.segment.sent.news.many': 'Odeslané, u {n} zpráv se změnil stav doručení',
  'messages.sent.empty': 'Žádné odeslané zprávy',
  'messages.sent.empty.hint': 'Zprávy, které odešlete, najdete tady.',
  'messages.section.today': 'Dnes',
  'messages.section.yesterday': 'Včera',
  'messages.section.thisWeek': 'Tento týden',
  'messages.section.thisMonth': 'Tento měsíc',
  'messages.month.0': 'Leden',
  'messages.month.1': 'Únor',
  'messages.month.2': 'Březen',
  'messages.month.3': 'Duben',
  'messages.month.4': 'Květen',
  'messages.month.5': 'Červen',
  'messages.month.6': 'Červenec',
  'messages.month.7': 'Srpen',
  'messages.month.8': 'Září',
  'messages.month.9': 'Říjen',
  'messages.month.10': 'Listopad',
  'messages.month.11': 'Prosinec',
  'messages.drafts': 'Rozepsané koncepty ({n})',
  'messages.loading': 'Načítání zpráv…',
  'messages.noSubject': '(bez předmětu)',
  'messages.unread': 'Nová',
  // A row is announced as ONE sentence (see `state/rowLabel.ts`); these are the two facts a glance
  // reads from an icon - the arrow that means "sent to", the pill that names the box a hit came from.
  'messages.row.to': 'Komu: {name}',
  'messages.row.inBox': 'Ve schránce {name}',
  'messages.attachment': 'Příloha',
  'messages.attachment.saved': 'Příloha uložena',
  'messages.offline': 'Offline – zobrazeny uložené zprávy.',
  // The same banner for a sync that failed for any OTHER reason. "Offline" is a claim about the
  // user's network, and the app was making it after a server fault or an expired session too.
  'messages.stale': 'Zprávy se nepodařilo aktualizovat – zobrazeny uložené.',
  'messages.retry': 'Zkusit znovu',
  'messages.reauth': 'Platnost přihlášení vypršela. Přihlaste se prosím znovu.',
  // Password boxes have no session to expire - see `features/accounts/state/reauthCopy.ts`.
  'messages.reauth.credentials':
    'ISDS heslo odmítlo - změnilo se, nebo vypršelo. Přihlaste se prosím znovu.',
  'messages.reauth.passwordExpired':
    'Platnost hesla vypršela. Změňte ho v portálu ISDS a přihlaste se novým heslem.',
  'messages.error.load': 'Zprávy se nepodařilo načíst. Zkuste to znovu.',
  'messages.error.loadTitle': 'Zprávy se nepodařilo načíst',
  'messages.error.loadSub': 'Zkontrolujte připojení a zkuste to znovu.',
  'messages.error.network':
    'Nejste připojeni k internetu. Zkontrolujte připojení a zkuste to znovu.',
  'messages.error.timeout': 'Spojení vypršelo. Zkuste to prosím znovu.',
  // The saved password or session could not be read just now - a Keychain failure, not a refusal
  // (001 T028). Never worded as signed out: nothing is wrong with the sign-in itself.
  'messages.error.credentials':
    'Uložené přihlašovací údaje se teď nepodařilo načíst. Zkuste to znovu.',
  // How fresh the list is. The app syncs only when the user asks it to, so this is the one thing
  // that tells them what their own last action bought them.
  'messages.synced.now': 'Naposledy před chvílí',
  'messages.synced.min.one': 'Naposledy před {n} minutou',
  'messages.synced.min.few': 'Naposledy před {n} minutami',
  'messages.synced.min.many': 'Naposledy před {n} minutami',
  // "v 9:05", "ve 14:02": Czech says "ve" before dvě, tři, čtyři, dvanáct to čtrnáct and dvacet+.
  'messages.synced.at': 'Naposledy dnes v {d}',
  'messages.synced.at.ve': 'Naposledy dnes ve {d}',
  'messages.synced.on': 'Naposledy {d}',
  'messages.synced.never': 'Zatím neaktualizováno',
};

/** English, at parity. */
export const en: Record<string, string> = {
  'messages.title': 'Received messages',
  'messages.empty': 'Nothing in this box',
  'messages.empty.hint': 'Obálka checks every time you open it.',
  'messages.segment.received': 'Received',
  'messages.segment.sent': 'Sent',
  'messages.segment.sent.news.one': 'Sent, {n} message changed delivery state',
  'messages.segment.sent.news.other': 'Sent, {n} messages changed delivery state',
  'messages.sent.empty': 'No sent messages',
  'messages.sent.empty.hint': 'Messages you send will appear here.',
  'messages.section.today': 'Today',
  'messages.section.yesterday': 'Yesterday',
  'messages.section.thisWeek': 'This week',
  'messages.section.thisMonth': 'This month',
  'messages.month.0': 'January',
  'messages.month.1': 'February',
  'messages.month.2': 'March',
  'messages.month.3': 'April',
  'messages.month.4': 'May',
  'messages.month.5': 'June',
  'messages.month.6': 'July',
  'messages.month.7': 'August',
  'messages.month.8': 'September',
  'messages.month.9': 'October',
  'messages.month.10': 'November',
  'messages.month.11': 'December',
  'messages.drafts': 'Drafts ({n})',
  'messages.loading': 'Loading messages…',
  'messages.noSubject': '(no subject)',
  'messages.unread': 'New',
  'messages.row.to': 'To: {name}',
  'messages.row.inBox': 'In box {name}',
  'messages.attachment': 'Attachment',
  'messages.attachment.saved': 'Attachment saved',
  'messages.offline': 'Offline. Showing saved messages.',
  'messages.stale': 'Could not refresh. Showing saved messages.',
  'messages.retry': 'Try again',
  'messages.reauth': 'Your sign-in has expired. Please sign in again.',
  'messages.reauth.credentials':
    'ISDS refused the password - it was changed or has expired. Please sign in again.',
  'messages.reauth.passwordExpired':
    'Your password has expired. Change it in the ISDS portal, then sign in with the new one.',
  'messages.error.load': 'Messages could not be loaded. Please try again.',
  'messages.error.loadTitle': 'Couldn’t load messages',
  'messages.error.loadSub': 'Check your connection and try again.',
  'messages.error.network':
    'You are offline. Check your connection and try again.',
  'messages.error.timeout': 'The connection timed out. Please try again.',
  // See the Czech block.
  'messages.error.credentials':
    'Your saved sign-in details could not be read just now. Please try again.',
  'messages.synced.now': 'Last checked a moment ago',
  'messages.synced.min.one': 'Last checked {n} minute ago',
  'messages.synced.min.other': 'Last checked {n} minutes ago',
  'messages.synced.at': 'Last checked today at {d}',
  'messages.synced.at.ve': 'Last checked today at {d}',
  'messages.synced.on': 'Last checked {d}',
  'messages.synced.never': 'Not yet updated',
};
