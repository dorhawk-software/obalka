// FAQ content (feature 012), bundled with the app and readable offline - there is no backend to fetch
// it from and there will not be one (Principle III).
//
// This lives here rather than in `src/i18n/strings.ts` on purpose. That file is a flat key -> string
// map, which suits labels and suits multi-paragraph prose badly; more importantly, a missing key there
// degrades to a runtime fallback. Here every locale must supply every `FaqId` (`Record<FaqId, FaqText>`),
// so an untranslated answer is a COMPILE error - which is what FR-006 actually asks for.
//
// Two standing rules for anything written here, both easy to violate and both caught in review:
//   * Constitution VI - describe only what ships TODAY. Not the roadmap, not the spec backlog. The
//     archive answer used to promise backup (feature 006, not built); it no longer does.
//   * FR-018 - every claim about how ISDS behaves is traceable to the Provozní řád ISDS or the
//     developer bulletins in docs/isds-ws-news/, never to recollection. The comments below cite where
//     the load-bearing ones come from.

import type { Locale } from '../i18n/strings';

export type FaqGroup = 'app' | 'isds';

export type FaqId =
  | 'addBox'
  | 'loginMethods'
  | 'reauth'
  | 'attachments'
  | 'archive'
  | 'attachmentScan'
  | 'diagnostics'
  | 'debugMode'
  | 'backupEncryption'
  | 'newPhone'
  | 'deliveredVsServed'
  | 'noBackgroundFetch'
  | 'fiction'
  | 'retention'
  | 'testEnv';

export interface FaqText {
  readonly question: string;
  /** Paragraphs, rendered in order. Kept as an array so the screen never has to split prose. */
  readonly answer: readonly string[];
}

/**
 * The answer that carries the delivery-state legend. It is the one whose subject the user can also
 * see in the app, so `FaqScreen` renders the actual marks beneath its prose (design 013 §1).
 */
export const FAQ_LEGEND_ID: FaqId = 'deliveredVsServed';

/** Which questions appear under which heading, and in what order. */
export const FAQ_ORDER: Readonly<Record<FaqGroup, readonly FaqId[]>> = {
  app: [
    'addBox',
    'loginMethods',
    'reauth',
    'attachments',
    'archive',
    'attachmentScan',
    'backupEncryption',
    'newPhone',
    'diagnostics',
    'debugMode',
  ],
  isds: [
    'deliveredVsServed',
    'noBackgroundFetch',
    'fiction',
    'retention',
    'testEnv',
  ],
};

const cs: Readonly<Record<FaqId, FaqText>> = {
  addBox: {
    question: 'Jak přidám nebo přepnu schránku?',
    answer: [
      'Klepněte na jméno schránky v záhlaví: v přepínači přepnete mezi schránkami a přes „Přidat schránku" přidáte další. Potřebujete přihlašovací údaje z portálu Datové schránky.',
      'Schránek můžete mít libovolný počet; každá má vlastní archiv i vlastní přihlášení.',
    ],
  },
  loginMethods: {
    question: 'Proč nejdou všechny způsoby přihlášení?',
    answer: [
      'Jméno a heslo, jméno a heslo se SMS kódem, nebo Mobilní klíč (přihlášení potvrdíte v aplikaci Mobilní klíč eGovernmentu).',
      'Identita občana, Bankovní identita ani mojeID v aplikaci nejsou. ISDS je aplikacím třetích stran nezpřístupňuje.',
    ],
  },
  reauth: {
    question: 'Proč se musím čas od času přihlásit znovu?',
    answer: [
      'Přihlášení platí omezenou dobu a údaje se mohou změnit na portálu, například zapnutím SMS kódu. Pak se u schránky objeví výzva k opětovnému přihlášení.',
      'Týká se jen té jedné schránky a způsob přihlášení můžete zvolit jiný než minule.',
    ],
  },
  attachments: {
    question: 'Kam se ukládají stažené přílohy?',
    answer: [
      'Zpráva se stahuje celá se všemi přílohami najednou, u velkých zpráv i desítky megabajtů; proto až na vaše klepnutí. Na právní doručení to vliv nemá, to nastalo dřív (viz „Jaký je rozdíl mezi Dodáno a Doručeno?").',
      'Soubory leží v soukromém úložišti aplikace, kam jiné aplikace nedosáhnou; chrání je šifrování telefonu, ne aplikace. Otevřete je i offline v systémové prohlížečce nebo sdílíte dál. Nikam je neodesíláme.',
    ],
  },
  archive: {
    question: 'Co přesně uchovává místní archiv?',
    answer: [
      'Archiv drží obálku každé zprávy (odesílatele, příjemce, předmět, časy dodání i doručení), všechny stažené přílohy a ke staženým zprávám i jejich podepsaný originál ve formátu ZFO; historii tak vidíte i poté, co ISDS obsah smaže.',
      'Zprávy jsou v šifrované databázi, klíč leží v zabezpečeném úložišti zařízení. Přílohy a originály leží v soukromém úložišti aplikace, chráněné šifrováním telefonu.',
    ],
  },
  // 010 US3. This answer is the DETAIL the Settings row deliberately does not carry: the library, the
  // words the scan keys on, and - most importantly - what it refuses to do. A user who is deciding
  // whether to let an app read their legal mail deserves the specifics in one place, and the toggle
  // beside a two-line summary is not that place.
  attachmentScan: {
    question: 'Jak funguje hledání termínu v příloze?',
    answer: [
      'Ve výchozím stavu vypnuto: aplikace obsah dokumentů nečte a knihovna na PDF se ani nenačte. Zapnutá se spustí jen po stisku „Stáhnout přílohy", nikdy na pozadí ani u zprávy, která už termín má.',
      'Čte jen textovou vrstvu PDF, knihovnou pdf.js přímo v telefonu; skeny bez textové vrstvy nepřečte, OCR nepoužívá. Prohlédne nejvýše čtyři přílohy a v každé 12 stran.',
      'Termín pozná podle slova bezprostředně před datem: do, nejpozději, ve lhůtě, lhůta, lhůta končí, termín, splatnost, splatnosti. Minulá data zahazuje, při dvou různých nenabídne nic. Nález je návrh, uloží se až stiskem „Uložit termín". Text dokumentu neopouští telefon a termín nepochází od datové schránky; ověřte si ho v dokumentu.',
    ],
  },
  // The answer that has to be exact, because it is the only place the app admits that ANYTHING leaves
  // the phone. Written as a list of what a report contains and a list of what it cannot - not as a
  // reassurance - since the whole value of the sentence is that it can be checked against the code.
  //
  // THREE FACTS HERE WERE NOT CHECKABLE FROM THIS REPO. All three are now verified (2026-09-11) -
  // and they are the kind that change, so each says how to re-check it:
  //   · the operating company. Sentry's own Terms of Service: "Functional Software, Inc. d/b/a
  //     Sentry", 45 Fremont Street, San Francisco. Re-check at sentry.io/terms;
  //   · SETTLED 2026-09-11: the project is in the EU region, and the DSN host proves it rather than
  //     promising - `ingest.de.sentry.io` (see `telemetry/dsn.ts`). A first attempt landed in a US
  //     org and was abandoned: the region is fixed when the ORGANISATION is created, not the
  //     project, and a US org cannot be migrated;
  //   · the retention period: 30 DAYS, because this project is on the free (Developer) plan.
  //     Sentry's docs give 30 days for Developer and 90 for Team/Business/Enterprise, and the
  //     period is fixed AT INGEST from the plan then in force - so upgrading would change it for
  //     new events only, and this sentence with it. The answer said 90 for a while, which was the
  //     paid figure and simply wrong here. Re-check at
  //     docs.sentry.io/security-legal-pii/security/data-retention-periods/ if the plan changes.
  // If any of them is wrong, this answer is wrong, and it is the answer people will judge the app's
  // honesty by.
  diagnostics: {
    question: 'Co se odesílá, když aplikace narazí na chybu?',
    answer: [
      'Technický popis chyby, nic jiného. Vypnete ji v Nastavení → Diagnostika.',
      'Odesílá se: kde chyba nastala, typ chyby, chybový kód datové schránky, HTTP kód, pořadí pokusu, verze aplikace a systému.',
      'Neodesílá se: obsah zpráv, předměty, jména odesílatelů ani příjemců, ID schránek, přihlašovací jméno, hesla, přílohy ani jejich názvy, text dokumentů a nic ze zálohy. Filtr propustí jen vyjmenované údaje a ostatní zahodí; zná ID a jména vašich schránek a odstraní je i z volného textu.',
      'Hlášení míří do služby Sentry (Functional Software, Inc.), projekt v evropském regionu, tedy servery v EU. Čte je vývojář této aplikace; nepředáváme je dál, neprodáváme ani nepoužíváme k reklamě. Sentry je po 30 dnech smaže. Vlastní server nemáme.',
    ],
  },
  // 006 FR-015 (user). The Settings screen says what the backup holds; this says how it is locked and
  // with what. Named algorithms rather than "military-grade encryption", because a claim nobody can
  // check is worth nothing - and because the honest part of this answer is the LOSS: no key, no way in,
  // by us or by anyone.
  // 023. Sits next to `diagnostics` because a user reading "what leaves the phone" is exactly the
  // person who should learn that the answer has two halves. The contrast is the content: one is
  // automatic and almost empty, the other is deliberate, readable and can hold their mail.
  debugMode: {
    question: 'K čemu je režim ladění?',
    answer: [
      'Hlášení o chybě je záměrně stručné, takže na některé chyby nestačí. Režim ladění zaznamená podrobný technický průběh a uloží ho jako soubor ZIP do telefonu.',
      'Nic se neodesílá samo. Soubor si můžete otevřít a přečíst, sdílíte ho vy a komu chcete; aplikace se nedozví, kam jste ho poslali. Smažete ho na téže obrazovce.',
      'Před spuštěním volíte, co se zaznamená. Bez obsahu zpráv: operace, časy, stavové kódy a chybová hlášení. Včetně komunikace s ISDS: navíc odeslaná a přijatá data, tedy i texty vašich zpráv.',
      'Hesla, přihlašovací údaje ani záložní klíč se nezaznamenávají nikdy, ani v podrobném režimu. Režim se sám vypne při restartu aplikace.',
    ],
  },
  backupEncryption: {
    question: 'Jak je záloha zašifrovaná?',
    answer: [
      'Záloha je jeden soubor, zašifrovaný v telefonu ještě před uložením. Nezašifrovaná se nikam neposílá, my k ní přístup nemáme a aplikace nemá server.',
      'Klíč se z hesla odvozuje funkcí Argon2id (64 MiB, 3 průchody), obsah šifruje XChaCha20-Poly1305 s ověřením celistvosti: po změně jediného bajtu otevření selže. Sůl a nonce jsou pro každou zálohu nové.',
      'Heslo je 20 náhodných znaků (100 bitů entropie), negenerujete ho vy a nikam se neposílá; leží v zabezpečeném úložišti a zobrazí se až po ověření otiskem, obličejem nebo kódem.',
      'Bez hesla zálohu neotevře nikdo, ani my. Záložní klíč ani obnova přes podporu neexistují. Uschovejte ho i mimo telefon; do druhého telefonu ho přenese QR kód.',
    ],
  },
  newPhone: {
    question: 'Jak přenesu archiv do nového telefonu?',
    answer: [
      'Záloha celého telefonu (iCloud, Google, počítač) ani přenos při nastavování nového telefonu data aplikace nepřenesou, a to schválně. Klíč k archivu telefon nikdy neopouští, takže taková kopie by se v novém telefonu stejně nedala otevřít, a přílohy by ležely v cizí záloze nešifrované.',
      'Použijte zálohu v aplikaci: v Nastavení → Záloha archivu zvolte „Uložit zálohu do souboru“. V novém telefonu na úvodní obrazovce zvolte „Obnovit z telefonu nebo zálohy“ a soubor načtěte. Budete potřebovat heslo k záloze.',
      'Archiv jde poslat i přímo z telefonu do telefonu, také mezi iPhonem a Androidem: ve starém telefonu Nastavení → Záloha archivu → Přenést do jiného telefonu, v novém „Obnovit z telefonu nebo zálohy“ → „Přijmout z jiného telefonu“. Heslo k záloze se přenese s ním.',
      'Do schránek se v novém telefonu přihlásíte znovu: přihlašovací údaje se nepřenášejí.',
    ],
  },
  deliveredVsServed: {
    question: 'Jaký je rozdíl mezi „Dodáno" a „Doručeno"?',
    answer: [
      'Dodáno = zpráva dorazila do schránky. Doručeno = nastalo právní doručení: přihlásil se někdo s přístupem, nebo uplynula lhůta a nastala fikce. Právní účinek je stejný; u fikce ale zprávu do té doby nikdo neviděl.',
      'Doručuje už přihlášení a načtení seznamu zpráv, ne otevření zprávy ani stažení příloh (§ 17 odst. 3 zákona č. 300/2008 Sb.). Obálka po otevření schránky synchronizuje, takže doručí i čekající zprávy.',
    ],
  },
  // The most-asked "missing feature" in the app, and the answer is a rule rather than a roadmap item,
  // so it belongs here permanently. Every claim is quoted from the Provozní řád ISDS of 26. 6. 2026
  // (docs/isds-provozni-rad-2026-06-26.md): delivery is caused "výhradně" by GetListOfReceivedMessages
  // (ch. 8), and §17 requires apps on a local station to sign in "pomocí manuálního příkazu uživatele"
  // - a rule about SIGNING IN, which is why it covers the sent side too, where nothing is delivered.
  // Constitution VI: this describes what ships, and says plainly what does not.
  noBackgroundFetch: {
    question: 'Proč mi aplikace sama nedá vědět, co je nového?',
    answer: [
      'Obálka se přihlásí, jen když ji otevřete nebo obnovíte seznam. Na pozadí nekontroluje nic.',
      'O nové zprávě se lze dozvědět jedině stažením seznamu došlých zpráv, a ten úkon je podle § 17 odst. 3 zákona č. 300/2008 Sb. sám o sobě doručením. Kontrola na pozadí by doručovala bez vašeho vědomí: rozeběhly by se lhůty a stát by zprávy uchoval 90 dnů místo nejméně tří let. Provozní řád ISDS navíc žádá, aby se aplikace v telefonu přihlašovaly „pomocí manuálního příkazu uživatele"; přihlášením je i dotaz na doručenku.',
      'O nové zprávě vás vyrozumí stát: e-mailem nebo SMS po zapnutí v Portálu datových schránek, případně v aplikaci Mobilní klíč eGovernmentu. Výjimkou je připomínka, kterou si sami nastavíte: to je budík v telefonu, žádné přihlášení.',
    ],
  },
  fiction: {
    question: 'Co je fikce doručení?',
    answer: [
      'Bez přihlášení se zpráva po 10 dnech od dodání považuje za doručenou, i když jste ji neotevřeli; od té chvíle běží všechny lhůty stejně, jako byste ji přečetli.',
      'Odpočet proto Obálka ukazuje u odeslaných zpráv: kolik dní zbývá, než zprávu doručí fikce adresátovi. U přijatých odpočet není, ty jsou vyzvednutím seznamu doručené. Zprávu doručenou fikcí uvidíte jako nepřečtenou, ale doručenou, se lhůtou běžící od toho dne.',
    ],
  },
  retention: {
    question: 'Proč zprávy po čase mizí ze systému?',
    answer: [
      'ISDS uchovává obsah zpráv 90 dnů od doručení, pak je ze svých serverů odstraní a přílohy už z něj nestáhnete.',
      'Obálka proto zprávy i přílohy ukládá do místního archivu. Co jste si nestáhli včas, už z ISDS nezískáte.',
    ],
  },
  testEnv: {
    question: 'Co je testovací prostředí?',
    answer: [
      'Stát vedle ostrého provozu provozuje testovací prostředí (datovka-test.gov.cz). Nic, co v něm odešlete nebo přijmete, nemá právní účinky.',
      'Testovací schránky mají v Obálce štítek „Testovací" a v detailu zprávy pruh přes celou šířku.',
    ],
  },
};

const en: Readonly<Record<FaqId, FaqText>> = {
  addBox: {
    question: 'How do I add or switch a box?',
    answer: [
      'Tap the box name in the header: the switcher moves between boxes and adds another with “Add box”. You need the credentials from the Data Boxes portal.',
      'You can hold any number of boxes; each has its own archive and its own sign-in.',
    ],
  },
  loginMethods: {
    question: 'Why aren’t all sign-in methods available?',
    answer: [
      'Username and password, username and password with an SMS code, or Mobile Key (you confirm the sign-in in the Mobilní klíč eGovernmentu app).',
      'Identita občana, Bank iD and mojeID are not in the app. ISDS does not expose them to third-party apps.',
    ],
  },
  reauth: {
    question: 'Why do I have to sign in again sometimes?',
    answer: [
      'A sign-in lasts a limited time, and credentials can change on the portal, for example by turning the SMS code on. The box then prompts you to sign in again.',
      'It concerns that one box only, and you can pick a different method than last time.',
    ],
  },
  attachments: {
    question: 'Where do downloaded attachments go?',
    answer: [
      'A message downloads whole, with every attachment at once: tens of megabytes for large ones, so only on your tap. This has no bearing on legal delivery, which happened earlier (see “What is the difference between Delivered to box and Served?”).',
      'Files sit in the app’s private storage, out of reach of other apps; they are protected by the phone’s encryption, not the app’s. They open offline in the system viewer or can be shared onward. We never send them anywhere.',
    ],
  },
  archive: {
    question: 'What exactly does the local archive keep?',
    answer: [
      'The archive holds each message envelope (sender, recipient, subject, delivery and acceptance times), every attachment you downloaded and, for the messages you downloaded, their signed original in ZFO format, so you still see the history after ISDS deletes the contents.',
      'Messages sit in an encrypted database whose key lives in the device’s secure storage. Attachments and originals sit in the app’s private storage, protected by the phone’s encryption.',
    ],
  },
  attachmentScan: {
    question: 'How does looking for a deadline in an attachment work?',
    answer: [
      'Off by default: the app does not read document contents and the PDF library is never loaded. Once on, it runs only after you press “Download attachments”, never in the background, never on a message that already has a deadline.',
      'It reads only a PDF’s text layer, with pdf.js running on your phone; scans without a text layer are not read, and there is no OCR. It opens at most four attachments and 12 pages of each.',
      'A date is a deadline only when one of these Czech words immediately precedes it: do, nejpozději, ve lhůtě, lhůta, lhůta končí, termín, splatnost, splatnosti. Past dates are discarded, and two different dates produce nothing. A find is a suggestion, saved only when you press “Save deadline”. The document text never leaves the phone, and the date does not come from the data box. Check it against the document.',
    ],
  },
  diagnostics: {
    question: 'What is sent when the app hits an error?',
    answer: [
      'A technical description of the error, nothing else. Turn it off in Settings → Diagnostics.',
      'Sent: where the error happened, the kind of error, the data box’s error code, the HTTP code, which attempt it was, the app and OS version.',
      'Never sent: message contents, subjects, sender or recipient names, box IDs, your login name, passwords, attachments or their filenames, document text, anything from your backup. A filter admits only the listed fields and discards the rest; it knows your boxes’ IDs and names and strips them from free text too.',
      'Reports go to Sentry (Functional Software, Inc.), on a project held in the European region, so they sit on servers in the EU. They are read by the developer of this app; we do not pass them on, sell them, or use them for advertising. Sentry deletes them after 30 days. We have no server of our own.',
    ],
  },
  debugMode: {
    question: 'What is debug mode for?',
    answer: [
      'An error report is deliberately brief, so it is not enough for some bugs. Debug mode records a detailed technical trail and saves it as a ZIP file on your phone.',
      'Nothing is sent by itself. You can open the file and read it, you share it with whoever you choose, and the app never learns where it went. You delete it from the same screen.',
      'You choose what gets recorded before you start. Without message contents: operations, timings, status codes and error messages. Including the ISDS traffic: also what was sent and received, so your message text is in it.',
      'Passwords, sign-in details and the recovery key are never recorded, not even in detailed mode. Debug mode switches itself off when the app restarts.',
    ],
  },
  backupEncryption: {
    question: 'How is the backup encrypted?',
    answer: [
      'A backup is a single file, encrypted on your phone before it is stored anywhere. It never leaves the device unencrypted, we cannot read it, and the app has no server.',
      'The key is derived from the password with Argon2id (64 MiB, 3 passes), and the contents are encrypted with XChaCha20-Poly1305, which authenticates them: change one byte and opening fails. Salt and nonce are new for every backup.',
      'The password is 20 random characters (100 bits of entropy); you do not choose it and it is never sent anywhere. It lives in the secure store and is shown only after your fingerprint, face or device code.',
      'Without the password nobody can open the backup, including us. There is no master key and no recovery through support. Keep a copy off the phone; a QR code moves it to another phone.',
    ],
  },
  newPhone: {
    question: 'How do I move the archive to a new phone?',
    answer: [
      'A whole-phone backup (iCloud, Google, a computer) and the copy made when setting up a new phone do not carry the app’s data, on purpose. The key to the archive never leaves the phone, so such a copy could not be opened on the new phone anyway, and the attachments would sit unencrypted in someone else’s backup.',
      'Use the app’s own backup: in Settings → Archive backup, choose “Save backup to a file”. On the new phone, choose “Restore from phone or backup” on the first screen and load the file. You will need the backup password.',
      'You can also send the archive straight from phone to phone, between an iPhone and an Android phone too: on the old phone, Settings → Archive backup → Move to another phone; on the new one, “Restore from phone or backup” → “Receive from another phone”. The backup password travels with it.',
      'You sign in to your boxes again on the new phone: sign-in details are not carried over.',
    ],
  },
  deliveredVsServed: {
    question: 'What is the difference between “Delivered to box” and “Served”?',
    answer: [
      'Delivered to box = the message reached your box. Served = legal delivery occurred: someone with access signed in, or the period elapsed and fiction took effect. The legal effect is the same; with fiction, nobody had seen the message by then.',
      'What serves a message is signing in and fetching the message list, not opening a message or downloading attachments (Section 17(3) of Act No. 300/2008 Coll.). Obálka syncs when you open a box, which serves any waiting messages.',
    ],
  },
  noBackgroundFetch: {
    question: 'Why does the app not tell me what is new on its own?',
    answer: [
      'Obálka signs in only when you open it or refresh the list. It checks nothing in the background.',
      'The only way to learn of a new message is to download the received-message list, and under Section 17(3) of Act No. 300/2008 Coll. that act is itself legal service. A background check would serve your mail without your knowledge: deadlines would start running, and the state would keep messages for 90 days instead of at least three years. The ISDS Operating Rules also require apps on a phone to sign in “on a manual command from the user”; a delivery-receipt query is a sign-in too.',
      'The state tells you a message arrived: by e-mail or SMS if you enable them in the Data Boxes portal, or in the Mobilní klíč eGovernmentu app. The exception is a reminder you set yourself: that is an alarm on your phone, with no sign-in.',
    ],
  },
  fiction: {
    question: 'What is delivery fiction?',
    answer: [
      'Without signing in, a message counts as served 10 days after delivery to the box, even if you never opened it; from that moment every deadline runs as if you had read it.',
      'Obálka shows the countdown on messages you sent: days remaining before fiction serves them to the recipient. Received messages have none. Fetching the list already serves them. A message served by fiction shows as unread but served, with the deadline running from that day.',
    ],
  },
  retention: {
    question: 'Why do messages disappear from the system after a while?',
    answer: [
      'ISDS keeps message contents for 90 days after service, then removes them from its servers, and the attachments can no longer be downloaded.',
      'Obálka therefore saves messages and attachments to the local archive. Whatever you did not download in time is gone from ISDS.',
    ],
  },
  testEnv: {
    question: 'What is the test environment?',
    answer: [
      'Alongside production the state runs a test environment (datovka-test.gov.cz). Nothing you send or receive there has any legal effect.',
      'Test boxes carry a “Test” tag in Obálka and a full-width band in message detail.',
    ],
  },
};

export const FAQ: Readonly<Record<Locale, Readonly<Record<FaqId, FaqText>>>> = {
  cs,
  en,
};

/**
 * Shown with the ISDS group only - that is the group making statements about how the law works, and
 * the design places it under that heading rather than at the top of the screen.
 */
export const FAQ_DISCLAIMER: Readonly<Record<Locale, string>> = {
  cs: 'Informativní přehled, nejde o právní poradenství. V případě pochybností se řiďte oficiálními zdroji a zněním zákona.',
  en: 'For information only, not legal advice. If in doubt, rely on official sources and the wording of the law.',
};
