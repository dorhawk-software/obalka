// The transfer's strings that have left `strings.ts` (025, 031): the last word on each phone (US1,
// FR-007, FR-011, T027) and, since R10, the row that leads to receiving and the refusal of an empty
// Přijmout. Split out on 2026-11-13, when the end became a screen of its own (I46.5) - `strings.ts`
// was at its size limit, which is met by splitting the file, never by trimming what it says. The
// rest of the transfer's strings followed on 2026-11-16, when the dialogs' ways out got names of
// their own (T050.1) and `strings.ts` was at its limit again.
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
  // ── Přenos do jiného telefonu (025) ──────────────────────────────────────────────────────────
  'transfer': 'Přenést do jiného telefonu',
  'transfer.row.desc':
    'Zašifrovaný přenos archivu přímo mezi dvěma telefony. Heslo k záloze se přenese s ním.',
  'transfer.receive': 'Přijmout do tohoto telefonu',
  // Výběr hotové zálohy (026 US3): přenos nic nezálohuje, pošle zálohu, která už existuje.
  'transfer.pick': 'Co odeslat',
  'transfer.pick.note':
    'Odešle se vybraná záloha tak, jak je. Nic se znovu nezálohuje. Obsahuje přijaté i odeslané zprávy.',
  'transfer.pick.send': 'Odeslat vybranou zálohu',
  'transfer.pick.none.title': 'Zatím tu žádná záloha není',
  'transfer.pick.none.body':
    'Přenáší se vždy hotová záloha. Nejdřív ji vytvořte. V Záloze si vyberete i to, jestli má obsahovat přílohy.',
  'transfer.pick.create': 'Vytvořit zálohu',
  'transfer.phrase.which': 'Záloha z {when} · {what}',
  'transfer.error.gone': 'Vybraná záloha už v telefonu není. Vyberte jinou.',
  'transfer.receive.desc':
    'Zadejte heslo, které ukazuje druhý telefon. Než se cokoli uloží, uvidíte, co přišlo.',
  'transfer.phrase.title': 'Zadejte na druhém telefonu',
  'transfer.phrase.size': 'Přenese se {size}',
  // US1. Co odchází, spočítané, aby se to dalo porovnat s tím, co ohlásí druhý telefon. Bez slovesa:
  // "přenese se 3 schránky" by se shodovalo s ničím.
  'transfer.phrase.contents': 'K odeslání: {what}, celkem {size}.',
  'transfer.count.documents.one': '1 příloha',
  'transfer.count.documents.few': '{n} přílohy',
  'transfer.count.documents.many': '{n} příloh',
  'transfer.phrase.waiting': 'Čeká se na druhý telefon…',
  // Jak heslo opsat (025 T027): nebylo jasné, jestli se píšou pomlčky, a jestli s mezerami kolem.
  'transfer.phrase.hint':
    'Na oddělovačích ani velikosti písmen nezáleží: slova stačí oddělit mezerou.',
  // Přenos běží jen na očích (FR-014). Zamknutí telefonu nebo odchod z aplikace ho zastaví, a to žádná
  // aplikace zakázat nemůže - takže se to říká předem, ne až potom.
  'transfer.keepOpen': 'Nechte aplikaci otevřenou a telefon odemčený, dokud přenos neskončí.',
  'transfer.phrase.placeholder': 'Heslo z druhého telefonu',
  // FR-008. Velikost je vidět před přenosem vždy; tohle je navíc pro mobilní data, kde ji člověk
  // platí. Ptá se jen u přenosu, který stojí za zeptání - u samotných zpráv (kilobajty) ne.
  'transfer.metered.title': 'Jste na mobilních datech',
  'transfer.metered.body':
    'Přenos má {size}. Na mobilních datech to může něco stát. Pokračovat?',
  'transfer.metered.confirm': 'Přenést i tak',
  'transfer.metered.wait': 'Počkat na Wi-Fi',
  'transfer.scan': 'Načíst kód fotoaparátem',
  'transfer.scan.hint': 'Namiřte na kód na druhém telefonu',
  'transfer.scan.denied':
    'Bez přístupu k fotoaparátu kód načíst nejde. Heslo můžete zadat ručně - funguje to stejně.',
  'transfer.scan.noCamera':
    'Tento telefon nemá použitelný fotoaparát. Heslo zadejte ručně - funguje to stejně.',
  'transfer.start': 'Přijmout zálohu',
  'transfer.cancel': 'Zrušit přenos',
  // Před heslem, ne po něm. Chvíli to trvá (na archivu s přílohami desítky sekund) a druhý telefon
  // zatím nemá co zadat - říct v tu chvíli "čekám na druhý telefon" je nepravda.
  'transfer.stage.preparing': 'Příprava odeslání…',
  'transfer.stage.preparing.count': 'Příprava příloh: {done} z {total}',
  'transfer.stage.connecting': 'Navazování spojení…',
  'transfer.stage.received': 'Přijato',
  // Výzva systému k zámku obrazovky, když se ukládá heslo k záloze, které přišlo s přenosem.
  'transfer.prompt.keepKey': 'Převzít heslo k záloze z druhého telefonu',
  'transfer.stage.transferring': 'Přenos',
  'transfer.stage.finishing': 'Dokončování',
  // Ukládání toho, co přišlo, už není přenos: nic nejde po síti, jen se zapisuje do archivu. Zrušit ho
  // nejde - zprávy se uloží najednou a přílohy až po nich, takže zastavení v půlce by nechalo zprávy
  // bez příloh (FR-012). Věta pod pruhem říká proč, místo tlačítka, které by nic neudělalo.
  'transfer.stage.applying': 'Ukládání do archivu tohoto telefonu…',
  'transfer.applying.note':
    'Ukládání do archivu už nejde přerušit, aby v něm nic nezůstalo napůl. Nechte aplikaci otevřenou, dokud neskončí.',
  // FR-007. Kde přenos běží, řečeno v průběhu - a co o něm relay ví. Tři stavy, protože dokud není
  // spojení navázané, je jediná pravdivá odpověď "zatím nevím".
  'transfer.route.unknown': 'Zjišťuje se, kudy přenos půjde…',
  'transfer.route.direct': 'Přenos jde přímo mezi telefony. Nikam jinam se data nedostanou.',
  // Server jménem, ne popisem (US3): {host} a {host6} jsou výchozí servery crocu, viz TRANSFER_RELAY.
  'transfer.route.relayed':
    'Přímé spojení nešlo, přenos jde přes veřejný přenosový server {host} (v síti IPv6 {host6}). Ten vidí velikost a čas, obsah ne - je zašifrovaný ještě před odesláním.',
  'transfer.got.title': 'Přijato z druhého telefonu',
  'transfer.got.body': 'Záloha z {when}, {size}. Uložit do archivu tohoto telefonu?',
  'transfer.got.confirm': 'Uložit do archivu',
  'transfer.got.decline': 'Neukládat',
  'transfer.scanner.close': 'Zavřít fotoaparát',
  'transfer.got.tooNew':
    'Tuto zálohu vytvořila novější verze aplikace. Aktualizujte aplikaci a zkuste to znovu.',
  'transfer.got.unsupported': 'Tuto zálohu tato verze aplikace otevřít neumí.',
  // Jak dopadlo uložení přenosu, když při jeho konci nebyla otevřená obrazovka přenosu. Řekne to
  // obrazovka zálohy, jakmile je na očích - jinak by to neřekl nikdo.
  'transfer.outcome.title': 'Přenos z druhého telefonu',
  'transfer.error.phrase': 'Heslo nesouhlasí. Nechte si na druhém telefonu ukázat nové.',
  // Heslo se ani neodeslalo: překlep se opraví pohledem na druhý telefon, ne novým heslem.
  'transfer.error.typo': 'Takové heslo být nemůže. Porovnejte ho s druhým telefonem: na začátku 4 znaky, pak 4 slova.',
  'transfer.error.typo.word': 'Slovo „{word}“ v hesle být nemůže. Porovnejte ho s druhým telefonem.',
  'transfer.error.failed': 'Přenos se nepodařilo dokončit.',
  // 025 T027. Přijímající telefon neslyší nic: druhý telefon už heslo neukazuje, nebo se heslo liší.
  // Odesílající pozná špatné heslo sám a řekne to svou větou níž - tady se to rozeznat nedá.
  'transfer.error.noAnswer':
    'Druhý telefon neodpověděl. Zkontrolujte, že na něm heslo pořád svítí a že jste ho opsali přesně, a zkuste to znovu.',
  'transfer.error.expired':
    'Heslo vypršelo, nikdo ho do 10 minut nezadal. Chcete-li zálohu přenést, odešlete ji znovu.',
  // Špatné heslo, jak ho vidí ODESÍLAJÍCÍ: zadávalo se na druhém telefonu, tady se nic opravit nedá.
  'transfer.error.phrase.sender':
    'Na druhém telefonu bylo zadané jiné heslo, takže se nic neodeslalo. Odešlete zálohu znovu a nové heslo opište přesně.',
  // Předchozí přenos se pořád zapisuje do archivu (třeba po návratu na obrazovku) a nový by mu smazal
  // soubory, ze kterých čte. Proto se nový nespustí a tady se řekne, na co se čeká.
  'transfer.error.busy':
    'Předchozí přenos se ještě ukládá do archivu. Počkejte, až skončí, a pak to zkuste znovu.',
  // FR-014. Přenos na pozadí neběží; když aplikaci opustíte, zastaví se a tady se řekne proč. Zhasnutý
  // displej Android hlásí stejně jako odchod z aplikace, takže ho věta jmenuje - kdo aplikaci
  // neopustil, nesmí hledat, co udělal špatně.
  'transfer.stopped.background':
    'Přenos se zastavil, protože jste aplikaci opustili nebo zhasl displej - na pozadí neběží. Spusťte ho znovu s novým heslem a nechte aplikaci otevřenou a displej rozsvícený, dokud přenos neskončí.',
  'transfer.unavailable': 'Tato verze aplikace přenos mezi telefony neumí.',
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
  // ── Phone to phone (025) ────────────────────────────────────────────────────────────────────
  'transfer': 'Move to another phone',
  'transfer.row.desc':
    'An encrypted transfer straight between two phones. The backup password travels with it.',
  'transfer.receive': 'Receive on this phone',
  'transfer.pick': 'What to send',
  'transfer.pick.note':
    'The chosen backup is sent as it is. Nothing is backed up again. It holds received and sent messages.',
  'transfer.pick.send': 'Send the chosen backup',
  'transfer.pick.none.title': 'There is no backup here yet',
  'transfer.pick.none.body':
    'A transfer always sends a finished backup, so make one first. In Backup you also choose whether it includes documents.',
  'transfer.pick.create': 'Make a backup',
  'transfer.phrase.which': 'Backup from {when} · {what}',
  'transfer.error.gone': 'The chosen backup is no longer on this phone. Choose another one.',
  'transfer.receive.desc':
    'Type the password the other phone is showing. You see what arrived before anything is saved.',
  'transfer.phrase.title': 'Type this on the other phone',
  'transfer.phrase.size': '{size} to send',
  'transfer.phrase.contents': 'To send: {what}, {size} in total.',
  'transfer.count.documents.one': '1 document',
  'transfer.count.documents.other': '{n} documents',
  'transfer.phrase.waiting': 'Waiting for the other phone…',
  'transfer.phrase.hint': 'Separators and capitals do not matter: a space between the words is enough.',
  'transfer.keepOpen': 'Keep the app open and the phone unlocked until the transfer is done.',
  'transfer.phrase.placeholder': 'Password from the other phone',
  'transfer.metered.title': 'You are on mobile data',
  'transfer.metered.body':
    'The transfer is {size}. On mobile data that may cost you something. Continue?',
  'transfer.metered.confirm': 'Transfer anyway',
  'transfer.metered.wait': 'Wait for Wi-Fi',
  'transfer.scan': 'Scan the code with the camera',
  'transfer.scan.hint': 'Point at the code on the other phone',
  'transfer.scan.denied':
    'Without camera access the code cannot be scanned. You can type the password instead - it works just the same.',
  'transfer.scan.noCamera':
    'This phone has no usable camera. Type the password instead - it works just the same.',
  'transfer.start': 'Receive the backup',
  'transfer.cancel': 'Cancel the transfer',
  'transfer.stage.preparing': 'Getting ready to send…',
  'transfer.stage.preparing.count': 'Getting the documents ready: {done} of {total}',
  'transfer.stage.connecting': 'Connecting…',
  'transfer.stage.received': 'Received',
  'transfer.prompt.keepKey': 'Keep the backup password from the other phone',
  'transfer.stage.transferring': 'Transferring',
  'transfer.stage.finishing': 'Finishing',
  'transfer.stage.applying': 'Saving to this phone’s archive…',
  'transfer.applying.note':
    'Saving to the archive cannot be stopped part-way, so that nothing in it is left half done. Keep the app open until it finishes.',
  'transfer.route.unknown': 'Working out how the transfer will go…',
  'transfer.route.direct': 'The transfer is going straight between the phones. Nothing else sees it.',
  'transfer.route.relayed':
    'A direct connection was not possible, so the transfer is going through the public relay {host} ({host6} on IPv6). It can see the size and the timing, not the contents - those are encrypted before anything is sent.',
  'transfer.got.title': 'Received from the other phone',
  'transfer.got.body': 'A backup from {when}, {size}. Save it into this phone’s archive?',
  'transfer.got.confirm': 'Save to the archive',
  'transfer.got.decline': "Don't save",
  'transfer.scanner.close': 'Close the camera',
  'transfer.got.tooNew':
    'This backup was made by a newer version of the app. Update the app and try again.',
  'transfer.got.unsupported': 'This version of the app cannot open this backup.',
  'transfer.outcome.title': 'The transfer from the other phone',
  'transfer.error.phrase': 'That password does not match. Ask the other phone for a fresh one.',
  'transfer.error.typo': 'That cannot be the password. Compare it with the other phone: 4 characters, then 4 words.',
  'transfer.error.typo.word': 'The password cannot contain “{word}”. Compare it with the other phone.',
  'transfer.error.failed': 'The transfer could not be completed.',
  'transfer.error.noAnswer':
    'The other phone did not answer. Check that it is still showing the password and that you typed it exactly, then try again.',
  'transfer.error.expired':
    'The password expired: nobody entered it within 10 minutes. To transfer the backup, send it again.',
  'transfer.error.phrase.sender':
    'A different password was typed on the other phone, so nothing was sent. Send the backup again and copy the new password exactly.',
  'transfer.error.busy':
    'The previous transfer is still being saved to the archive. Wait until it finishes, then try again.',
  'transfer.stopped.background':
    'The transfer stopped because you left the app or the screen went off - it does not run in the background. Start it again with a fresh password and keep the app open and the screen on until it finishes.',
  'transfer.unavailable': 'This version of the app cannot transfer between phones.',
};
