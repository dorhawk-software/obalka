// The settings screen's strings that have left `strings.ts` (010, 026, 031): the deadline scan's row
// and automatic downloads with their question. Split out on 2026-11-16, when the Wi-Fi row learnt to
// say why it is dimmed (T050.2) and `strings.ts` was at its size limit again - met by splitting the
// file, never by trimming what it says. `strings.ts` spreads these into its tables.

/** Czech (primary). */
export const cs: Record<string, string> = {
  // 010 US3 - the scan toggle. Two lines: what it does, and the one guarantee that decides whether
  // someone wants it at all. Everything else - the library, the words it keys on, the page caps, what
  // it refuses to do - is a tap away in the FAQ, because a row long enough to be complete is a row
  // nobody reads.
  'settings.scan': 'Termíny v přílohách',
  'settings.scan.title': 'Hledat termín v příloze',
  // Two states, and neither sentence over-promises: the scan HLEDÁ (looks for) a deadline rather
  // than finding one - it reads only a PDF's text layer, only cue words, and says nothing when two
  // dates disagree. "Najde" was a promise the feature does not make even when it is switched on.
  'settings.scan.desc':
    'Po stažení přílohy v ní telefon hledá lhůtu a může ji nabídnout jako připomínku. Vše zůstává v telefonu.',
  'settings.scan.desc.off':
    'Vypnuto: obsah příloh se nečte. Po zapnutí bude telefon ve stažené příloze hledat lhůtu. Vše zůstává v telefonu.',
  'settings.scan.how': 'Jak to funguje',
  // Automatické stahování příloh (026 US4). Co to NEdělá je stejně důležité jako co dělá: nedoručuje
  // (doručuje jen načtení seznamu) a neoznačuje jako přečtené (to dělá jen otevření zprávy).
  'settings.attachments': 'Přílohy',
  'settings.autoDownload.title': 'Stahovat přílohy automaticky',
  'settings.autoDownload.desc.off': 'Vypnuto: přílohy se stáhnou, až o ně požádáte.',
  'settings.autoDownload.desc.new':
    'U nových zpráv při aktualizaci schránky. Zpráva zůstane nepřečtená, dokud ji neotevřete.',
  'settings.autoDownload.desc.all':
    'Při aktualizaci schránky, i u zpráv, které už v telefonu jsou. Zpráva zůstane nepřečtená, dokud ji neotevřete.',
  'settings.autoDownload.wifi': 'Jen na Wi-Fi',
  'settings.autoDownload.wifi.desc': 'Na mobilních datech se nic automaticky nestahuje.',
  // The row is dimmed while automatic downloads are off, and says why (T050.2).
  'settings.autoDownload.wifi.off': 'Platí, když se přílohy stahují automaticky.',
  'settings.autoDownload.ask.title': 'Stahovat přílohy automaticky?',
  'settings.autoDownload.ask.new': 'Jen nové zprávy',
  'settings.autoDownload.ask.new.desc': 'Zprávy, které přijdou od teď',
  'settings.autoDownload.ask.all': 'I zprávy, které už v telefonu jsou',
  'settings.autoDownload.ask.all.desc': 'Chybějící přílohy se doplní při příští aktualizaci',
  'settings.autoDownload.ask.body':
    'Přílohy přijatých i odeslaných zpráv, které v telefonu chybí, se stáhnou při příští aktualizaci schránky, kterou spustíte, ne hned po zapnutí: Provozní řád ISDS dovoluje aplikaci v telefonu připojit se ke schránce jen na váš pokyn. Zprávu to nedoručí ani neoznačí jako přečtenou: doručená je už tím, že se objevila v seznamu. Přílohy zabírají místo v telefonu a každá se stahuje jen jednou.',
  'settings.autoDownload.ask.confirm': 'Zapnout',
  'settings.autoDownload.ask.keep': 'Nechat vypnuté',
};

/** English. */
export const en: Record<string, string> = {
  'settings.scan': 'Deadlines in attachments',
  'settings.scan.title': 'Look for a deadline in an attachment',
  'settings.scan.desc':
    'After you download an attachment, your phone looks for a deadline in it and may offer it as a reminder. Everything stays on the phone.',
  'settings.scan.desc.off':
    'Off: attachment contents are not read. Once on, your phone will look for a deadline in a downloaded attachment. Everything stays on the phone.',
  'settings.scan.how': 'How it works',
  'settings.attachments': 'Documents',
  'settings.autoDownload.title': 'Download documents automatically',
  'settings.autoDownload.desc.off': 'Off: documents are downloaded when you ask for them.',
  'settings.autoDownload.desc.new':
    'For new messages, when you refresh the box. A message stays unread until you open it.',
  'settings.autoDownload.desc.all':
    'When you refresh the box, also for messages already on the phone. A message stays unread until you open it.',
  'settings.autoDownload.wifi': 'Wi-Fi only',
  'settings.autoDownload.wifi.desc': 'Nothing is downloaded automatically on mobile data.',
  'settings.autoDownload.wifi.off': 'Applies when documents download automatically.',
  'settings.autoDownload.ask.title': 'Download documents automatically?',
  'settings.autoDownload.ask.new': 'New messages only',
  'settings.autoDownload.ask.new.desc': 'Messages that arrive from now on',
  'settings.autoDownload.ask.all': 'Also messages already on the phone',
  'settings.autoDownload.ask.all.desc': 'Missing documents are fetched on the next refresh',
  'settings.autoDownload.ask.body':
    'The documents of received and sent messages that are not on the phone are downloaded at the next box refresh you start, not as soon as this is on: the ISDS Operating Rules let an app on a phone contact a box only when you ask it to. This does not deliver a message or mark it read: listing it already delivered it. Documents take up space on the phone, and each is downloaded only once.',
  'settings.autoDownload.ask.confirm': 'Turn on',
  'settings.autoDownload.ask.keep': 'Keep it off',
};
