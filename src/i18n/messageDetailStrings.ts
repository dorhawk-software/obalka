// The message detail's strings (a received or sent message, its delivery record, its attachments),
// in their own file since 2026-11-12: `strings.ts` is at its size limit, and a limit is met by
// splitting the file, never by trimming what it says. `strings.ts` spreads these into its tables.

/** Czech (primary). */
export const cs: Record<string, string> = {
  'detail.title': 'Zpráva',
  'detail.loading': 'Stahování zprávy…',
  'detail.noSubject': '(bez předmětu)',
  'detail.from': 'Odesílatel',
  'detail.to': 'Komu',
  // 031: the header names what this is; the envelope below says who it is from.
  'detail.header.received': 'Přijatá zpráva',
  // The words round the postmark struck on the envelope, at the moment it was delivered to the box.
  'detail.postmark.ring': 'DODÁNO · DATOVÁ SCHRÁNKA ·',
  'detail.attachments.count.one': '{n} příloha',
  'detail.attachments.count.few': '{n} přílohy',
  'detail.attachments.count.many': '{n} příloh',
  'detail.fikce.remind': 'Připomenout',
  'detail.delivered': 'Dodáno',
  'detail.accepted': 'Doručeno',
  'detail.deliveryStatus': 'Stav doručení',
  'detail.stateAsOf': 'Stav k {d}',
  'detail.attachments': 'Přílohy',
  'detail.attachments.none': 'Tato zpráva nemá žádné přílohy.',
  'detail.attachments.hint':
    'Přílohy zatím nejsou stažené. Stáhněte je pro zobrazení a uložení do offline archivu.',
  'detail.attachments.download': 'Stáhnout přílohy',
  'detail.attachments.containsAtts': 'Zpráva obsahuje přílohy',
  'detail.attachments.namesAfter':
    'Názvy a počet příloh uvidíte po stažení celé zprávy.',
  'detail.attachments.downloadFull': 'Stáhnout celou zprávu',
  // NOT "tím se zpráva považuje za doručenou" - that was wrong. Per §17 odst. 3 zákona 300/2008, as
  // stated in the Provozní řád ISDS, legal delivery is caused by fetching the received-message list;
  // by the time this button is visible it has already happened. See the FAQ entry `deliveredVsServed`.
  'detail.attachments.downloadFullNote':
    'Stáhne přílohy a uloží celou zprávu do offline archivu. Na právní doručení to nemá vliv. To nastalo už přihlášením ke schránce.',
  // Two states where that second clause is false. Fiction: the same screen says "doručeno fikcí ·
  // bez vašeho přihlášení" at the top, so "nastalo přihlášením" contradicts it. Sent: nothing has
  // been served to anyone by YOUR sign-in, and the message may still be sitting unread - the sent
  // rail can be showing "Adresát dosud nepřevzal · fikce za 4 dny" on the same scroll.
  'detail.attachments.downloadFullNote.fiction':
    'Stáhne přílohy a uloží celou zprávu do offline archivu. Na právní doručení to nemá vliv. To nastalo fikcí.',
  'detail.attachments.downloadFullNote.sent':
    'Stáhne přílohy a uloží celou zprávu do offline archivu. Na doručení adresátovi to nemá vliv.',
  'detail.attachments.partlySaved': 'Zpráva v archivu · některé přílohy chybí',
  'detail.attachments.downloading': 'Stahování…',
  'detail.attachments.redownload': 'Stáhnout znovu',
  'detail.attachments.someMissing':
    'Některé přílohy už nejsou uložené na zařízení.',
  'detail.attachments.unavailable.title': 'Příloha už není dostupná',
  'detail.attachments.unavailable.body':
    'Zpráva už není v ISDS k dispozici (po uplynutí lhůty byla odstraněna), takže přílohy nelze znovu stáhnout.',
  'detail.attachment.savedOffline': 'Uloženo offline',
  // 031: each saved file says it lies in the archive, and its download glyph saves a copy elsewhere.
  'detail.attachment.inArchive': 'v archivu',
  'detail.attachment.save': 'Stáhnout přílohu {name}',
  'detail.attachment.saveError': 'Přílohu se nepodařilo uložit.',
  'detail.attachment.missing': 'Soubor chybí na zařízení',
  'detail.attachment.corrupt': 'Přílohu se nepodařilo zpracovat (poškozená data)',
  'detail.attachment.open': 'Otevřít přílohu {name}',
  'detail.attachment.opening': 'Otevírání…',
  'detail.attachment.openError': 'Přílohu se nepodařilo otevřít.',
  'detail.attachment.noViewer':
    'V zařízení není aplikace, která by tento typ souboru otevřela.',
  'detail.attachments.vodzFailed':
    'Tuto velkoobjemovou zprávu (nad 20 MB) se teď nepodařilo stáhnout. Zkuste to znovu, nebo ji otevřete na datovka.gov.cz.',
  // ISDS answered, but not with the code it uses for a deleted message (004 research R8). So the copy
  // says it refused, not that the message is gone, and leaves the retry in place.
  'detail.attachments.refused':
    'ISDS zprávu teď nevydal. Zkuste to znovu později, nebo ji otevřete na datovka.gov.cz.',
  // A large-volume message whose enclosures stopped arriving part-way (constitution IV). The number is
  // what arrived, never a total - ISDS says how many there are only by answering past the last one - so
  // the rest is "další", not a count. The verb agrees with the number.
  'detail.attachments.incomplete.one': 'Stáhla se jen {n} příloha. Další se nepodařilo stáhnout.',
  'detail.attachments.incomplete.few': 'Stáhly se jen {n} přílohy. Další se nepodařilo stáhnout.',
  'detail.attachments.incomplete.many': 'Stáhlo se jen {n} příloh. Další se nepodařilo stáhnout.',
  'detail.attachments.downloadMissing': 'Stáhnout chybějící přílohy',
  'detail.attachments.missingFailed':
    'Chybějící přílohy se teď nepodařilo stáhnout. Zkuste to znovu, nebo zprávu otevřete na datovka.gov.cz.',
  // The signed original (004 amendment, 2026-09-14): the message as ISDS sealed it, kept as a .zfo
  // beside the attachments. "Originál" throughout, so the pronouns agree in every line below. Past 90
  // days the copy says "nejspíš": a message served by fiction is kept for years, and a date alone is
  // not ISDS saying no.
  'detail.original.heading': 'Originál zprávy',
  'detail.original.stored': 'Podepsaný originál',
  'detail.original.stored.note': 'Soubor ZFO s elektronickou pečetí',
  'detail.original.save': 'Stáhnout podepsaný originál',
  'detail.original.open': 'Otevřít nebo uložit podepsaný originál {name}',
  'detail.original.fetch': 'Stáhnout podepsaný originál (ZFO)',
  'detail.original.fetch.note': 'S pečetí ISDS. Stáhnout ho lze, dokud ISDS zprávu uchovává.',
  'detail.original.fetch.late': 'Od doručení uplynulo přes 90 dnů. ISDS zprávu nejspíš už smazal.',
  'detail.original.fetch.missing': 'Soubor chybí na zařízení. Lze ho stáhnout znovu.',
  'detail.original.fetch.missingLate':
    'Soubor chybí na zařízení. ISDS zprávu po 90 dnech nejspíš už smazal.',
  'detail.original.unavailable': 'Podepsaný originál už nelze získat',
  'detail.original.unavailable.note': 'Nebyl uložen a ISDS zprávu už nemá.',
  'detail.original.unavailable.missing': 'Soubor chybí na zařízení a ISDS zprávu už nemá.',
  'detail.original.fetchFailed': 'Podepsaný originál se nepodařilo stáhnout. Zkuste to znovu.',
  'detail.original.refused': 'ISDS podepsaný originál teď nevydal. Zkuste to znovu později.',
  'detail.original.writeFailed': 'Podepsaný originál se nepodařilo uložit do zařízení.',
  'detail.original.openError': 'Podepsaný originál se nepodařilo otevřít ani uložit.',
  'detail.error.load': 'Zprávu se nepodařilo stáhnout. Zkuste to znovu.',
  'detail.error.offline':
    'Tato zpráva ještě nebyla stažena a nyní ji nelze získat (jste offline nebo je potřeba se znovu přihlásit).',
  'detail.offline': 'Offline – zobrazeno z uloženého archivu.',
  // 017 - the received "Doručenka", a slip since 031. Each line states a fact about what ISDS did or
  // did not report, never an inference of ours. The notes under the steps are the board's (Message).
  'recv.head': 'Doručenka',
  'recv.head.fiction': 'Doručenka · fikcí',
  // Where the record comes from, printed in the slip's corner.
  'recv.head.source': 'ISDS',
  'recv.delivered.note': 'do schránky',
  'recv.delivered.note.fiction': 'do schránky, nikdo se nepřihlásil',
  'recv.accepted.note': 'přihlášením do schránky',
  'recv.merged': 'Dodáno a doručeno',
  'recv.merged.note': 'schránka byla zrovna přihlášená',
  // The design wrote this as "…stát čas nepředává". Changed after a device read-through: on a message
  // from Česká pošta, "stát" is read as the SENDER, and the sentence then looks false. The claim was
  // never about who wrote to you - it is about what the ISDS system reports, which is nothing.
  'recv.read.note': 'Přečteno, bez právního významu. ISDS čas přečtení neuvádí.',
  'recv.fiction.note': 'po deseti dnech, lhůty běží',
};

/** English, at parity. */
export const en: Record<string, string> = {
  'detail.title': 'Message',
  'detail.loading': 'Downloading message…',
  'detail.noSubject': '(no subject)',
  'detail.from': 'Sender',
  'detail.to': 'To',
  'detail.header.received': 'Received message',
  'detail.postmark.ring': 'DELIVERED · DATA BOX ·',
  'detail.attachments.count.one': '{n} attachment',
  'detail.attachments.count.other': '{n} attachments',
  'detail.fikce.remind': 'Remind me',
  'detail.delivered': 'Delivered',
  'detail.accepted': 'Accepted',
  'detail.deliveryStatus': 'Delivery status',
  'detail.stateAsOf': 'State as of {d}',
  'detail.attachments': 'Attachments',
  'detail.attachments.none': 'This message has no attachments.',
  'detail.attachments.hint':
    'Attachments aren’t downloaded yet. Download them to view and save to the offline archive.',
  'detail.attachments.download': 'Download attachments',
  'detail.attachments.containsAtts': 'This message has attachments',
  'detail.attachments.namesAfter':
    'You’ll see the attachment names and count after downloading the full message.',
  'detail.attachments.downloadFull': 'Download full message',
  'detail.attachments.downloadFullNote':
    'Downloads the attachments and saves the whole message to your offline archive. It does not affect legal delivery. That already happened when the box was signed in to.',
  'detail.attachments.downloadFullNote.fiction':
    'Downloads the attachments and saves the whole message to your offline archive. It does not affect legal delivery. That happened by fiction.',
  'detail.attachments.downloadFullNote.sent':
    'Downloads the attachments and saves the whole message to your offline archive. It does not affect delivery to the recipient.',
  'detail.attachments.partlySaved': 'Message in the archive · some attachments are missing',
  'detail.attachments.downloading': 'Downloading…',
  'detail.attachments.redownload': 'Download again',
  'detail.attachments.someMissing':
    'Some attachments are no longer stored on this device.',
  'detail.attachments.unavailable.title': 'Attachment no longer available',
  'detail.attachments.unavailable.body':
    'The message is no longer in ISDS (removed after its retention period), so the attachments can’t be downloaded again.',
  'detail.attachment.savedOffline': 'Saved offline',
  'detail.attachment.inArchive': 'in the archive',
  'detail.attachment.save': 'Download attachment {name}',
  'detail.attachment.saveError': 'The attachment could not be saved.',
  'detail.attachment.missing': 'File missing on this device',
  'detail.attachment.corrupt': 'Attachment could not be processed (corrupt data)',
  'detail.attachment.open': 'Open attachment {name}',
  'detail.attachment.opening': 'Opening…',
  'detail.attachment.openError': 'The attachment could not be opened.',
  'detail.attachment.noViewer':
    'There is no app on this device that can open this file type.',
  'detail.attachments.vodzFailed':
    'This large-volume message (over 20 MB) could not be downloaded right now. Please try again, or open it at datovka.gov.cz.',
  'detail.attachments.refused':
    'ISDS did not release the message just now. Please try again later, or open it at datovka.gov.cz.',
  'detail.attachments.incomplete.one':
    'Only {n} attachment was downloaded. More could not be downloaded.',
  'detail.attachments.incomplete.other':
    'Only {n} attachments were downloaded. More could not be downloaded.',
  'detail.attachments.downloadMissing': 'Download the missing attachments',
  'detail.attachments.missingFailed':
    'The missing attachments could not be downloaded right now. Please try again, or open the message at datovka.gov.cz.',
  'detail.original.heading': 'Original message',
  'detail.original.stored': 'Signed original',
  'detail.original.stored.note': 'A ZFO file with the electronic seal',
  'detail.original.save': 'Download the signed original',
  'detail.original.open': 'Open or save the signed original {name}',
  'detail.original.fetch': 'Download the signed original (ZFO)',
  'detail.original.fetch.note': 'Sealed by ISDS. It can be downloaded while ISDS keeps the message.',
  'detail.original.fetch.late': 'Over 90 days since delivery. ISDS has probably deleted the message.',
  'detail.original.fetch.missing': 'The file is missing on this device. It can be downloaded again.',
  'detail.original.fetch.missingLate':
    'The file is missing on this device. After 90 days ISDS has probably deleted the message.',
  'detail.original.unavailable': 'The signed original can no longer be obtained',
  'detail.original.unavailable.note': 'It was not saved, and ISDS no longer has the message.',
  'detail.original.unavailable.missing':
    'The file is missing on this device, and ISDS no longer has the message.',
  'detail.original.fetchFailed': 'The signed original could not be downloaded. Please try again.',
  'detail.original.refused': 'ISDS did not release the signed original just now. Please try again later.',
  'detail.original.writeFailed': 'The signed original could not be saved on this device.',
  'detail.original.openError': 'The signed original could not be opened or saved.',
  'detail.error.load': 'The message could not be downloaded. Please try again.',
  'detail.error.offline':
    'This message has not been downloaded yet and can’t be fetched now (you are offline or need to sign in again).',
  'detail.offline': 'Offline. Shown from the saved archive.',
  'recv.head': 'Delivery record',
  'recv.head.fiction': 'Delivery record · by fiction',
  'recv.head.source': 'ISDS',
  'recv.delivered.note': 'to the box',
  'recv.delivered.note.fiction': 'to the box; nobody signed in',
  'recv.accepted.note': 'when someone signed in to the box',
  'recv.merged': 'Delivered and accepted',
  'recv.merged.note': 'the box was signed in at the time',
  'recv.read.note':
    'Opened, no legal significance. ISDS does not report when.',
  'recv.fiction.note': 'after ten days; deadlines are running',
};
