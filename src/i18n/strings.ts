// UI strings + a tiny resolver (Principle V). Czech-first with a full English mirror. The active
// locale is a module-level variable set by the SettingsProvider (and persisted); `t()` reads it, so
// changing language + remounting the tree re-localizes everything. Missing keys fall back cs → key.

import { cs as errorCs, en as errorEn } from './loginMessages';
import type { Locale } from '../app/settings/languages';

// The language list is `app/settings/languages.tsx`, and `Locale` is derived from it. Re-exported here
// because this is where every caller already looked for it.
export type { Locale };

const cs: Record<string, string> = {
  ...errorCs,
  'app.name': 'Obálka',
  // The launch screen when the accounts table will not read (constitution II). It used to keep its
  // spinner for good. Says what did not happen, and the retry is the whole way out.
  'app.loadFailed': 'Uložené schránky se nepodařilo načíst.',
  'app.loadFailed.retry': 'Zkusit znovu',
  // 022: "konečně" said nothing about this app - it said every other way of handling your state mail
  // had been a mess, which is not ours to claim. Reported by the user as "way too cocky".
  'welcome.tagline': 'Vaše státní pošta: přehledně, bezpečně a bez stresu.',
  // The second way in from Welcome (2026-09-24): a new phone whose owner already has the archive on
  // another phone, or in a backup file, must not have to add a box first to reach it. Two wordings,
  // because the phone-to-phone transfer exists only where its transport does (Android, for now).
  // Each fits ONE line of Welcome's secondary button (16/700, beside an 18dp icon) on a 360dp phone;
  // the longer "Obnovit z jiného telefonu nebo ze zálohy" wrapped, so it was cut to this.
  'welcome.restore': 'Obnovit z telefonu nebo zálohy',
  'welcome.restore.backupOnly': 'Obnovit ze zálohy',
  // The screen that opens from it: the backup screen showing only what a phone with no boxes can use.
  'restore.title': 'Obnovit archiv',
  'transfer.receiveFrom': 'Přijmout z jiného telefonu',
  'backup.file.desc.firstRun':
    'Máte zálohu uloženou jako soubor? Načtěte ji a obnovte ji ze seznamu níže.',
  'login.title': 'Přidat datovou schránku',
  'login.environment': 'Prostředí',
  'login.environment.helpA11y': 'Co znamená prostředí?',
  'login.environment.help.production':
    'připojí aplikaci k reálnému provozu ISDS (datovka.gov.cz): vaše skutečná datová ' +
    'schránka a zprávy.',
  'login.environment.help.czebox':
    'používá testovací prostředí czebox (datovka-test.gov.cz) s oddělenými testovacími schránkami ' +
    'a nepřistupuje k vašim ostrým datům.',
  'login.environment.help.recommend': 'Pro běžné použití zvolte',
  'login.env.production': 'Ostré',
  'login.env.czebox': 'Testovací',
  'login.loginName': 'Přihlašovací jméno',
  'login.password': 'Heslo',
  'login.password.show': 'Zobrazit heslo',
  'login.password.hide': 'Skrýt heslo',
  'login.alias': 'Název schránky (volitelné)',
  'login.alias.placeholder': 'Např. Moje osoba, DPFO…',
  'alias.title': 'Název schránky',
  // One sheet for the box's own name and its colour since 027 (decision 2B): naming boxes "Osobní",
  // "Živnost", "Firma" and colouring them apart are the two halves of telling them apart.
  'alias.renameTitle': 'Upravit schránku',
  'alias.name': 'Vlastní název',
  'alias.color': 'Barva',
  'alias.color.taken': 'Tečka = barvu už má jiná schránka. Vybrat ji jde, jen se pak budou hůř rozlišovat.',
  'alias.color.option': 'Barva {name}',
  'alias.color.option.taken': 'Barva {name}, už ji má jiná schránka',
  'boxColor.blue': 'modrá',
  'boxColor.teal': 'tyrkysová',
  'boxColor.purple': 'fialová',
  'boxColor.green': 'zelená',
  'boxColor.bronze': 'bronzová',
  'boxColor.rose': 'růžová',
  'boxColor.olive': 'olivová',
  'boxColor.rust': 'rezavá',
  'boxColor.plum': 'švestková',
  'boxColor.steel': 'ocelová',
  'alias.edit': 'Upravit název schránky',
  'alias.save': 'Uložit',
  'login.method': 'Způsob přihlášení',
  'login.method.password': 'Jméno a heslo',
  'login.method.otp_totp': 'Jméno, heslo a SMS kód',
  'login.method.mobile_key': 'Mobilní klíč',
  'login.method.choose': 'Jak se chcete přihlásit?',
  'login.method.chooseSub':
    'Vyberte způsob přihlášení, který vaše schránka podporuje.',
  'login.advanced': 'Pokročilé',
  'login.method.password.name': 'Heslo',
  'login.method.password.desc': 'Přihlašovací jméno a heslo.',
  'login.method.otp_totp.name': 'SMS kód',
  'login.method.otp_totp.desc': 'Heslo a jednorázový kód z SMS.',
  'login.method.mobile_key.name': 'Mobilní klíč',
  'login.method.mobile_key.desc':
    'Komunikační kód z portálu; přihlášení potvrdíte v aplikaci Mobilní klíč.',
  'login.commCode': 'Komunikační kód',
  'login.commCode.placeholder': 'Vygenerovaný kód z portálu (ne heslo)',
  'login.mobileKey.help':
    'Nejdřív v Klientském portálu (Nastavení → Možnosti přihlášení) aktivujte Mobilní klíč a vygenerujte komunikační kód. Po odeslání potvrďte přihlášení v aplikaci Mobilní klíč.',
  'login.mobileKey.title': 'Potvrďte přihlášení v aplikaci Mobilní klíč',
  'login.mobileKey.sending': 'Odesílání požadavku…',
  'login.mobileKey.approve':
    'Přepněte do aplikace Mobilní klíč a potvrďte přihlášení do datové schránky.',
  'login.mobileKey.expiryHint': 'Požadavek brzy vyprší.',
  'login.method.help':
    'Většina schránek používá jen jméno a heslo. SMS kód zvolte jen tehdy, máte‑li u schránky zapnuté dvoufázové ověření (OTP).',
  'login.submit': 'Přihlásit se',
  'login.cancel': 'Zrušit',
  'login.authenticating': 'Přihlašování…',
  'login.otp.notice.smsSent': 'Jednorázový kód jsme vám poslali v SMS.',
  // Shown while the request is still in flight - the code screen now opens before ISDS answers, so
  // it must not say the SMS is on its way until it is.
  'login.otp.notice.smsSending': 'Žádáme o jednorázový kód…',
  'login.otp.stillSending': 'Kód ještě odesíláme',
  'login.otp.verify': 'Ověření',
  'login.otp.smsTitle': 'Zadejte kód z SMS',
  'login.otp.code': 'Jednorázový kód',
  'login.otp.submit': 'Potvrdit kód',
  'login.otp.resend': 'Poslat SMS znovu',
  'login.retry': 'Zkusit znovu',
  'login.otpSuggest.title': 'Máte SMS kód?',
  'login.otpSuggest.sub':
    'Pokud vaše schránka vyžaduje i jednorázový kód z SMS, přihlaste se přes SMS kód.',
  'login.otpSuggest.btn': 'Přihlásit přes SMS kód',
  'login.loginName.placeholder': 'Uživatelské jméno',
  'login.creds.title': 'Přihlášení',
  'login.method.label.password': 'Přihlášení heslem',
  'login.method.label.otp_totp': 'Přihlášení přes SMS kód',
  'login.method.label.mobile_key': 'Přihlášení Mobilním klíčem',
  'login.otpSuggested.hint':
    'Přihlášení jménem a heslem se nezdařilo. Pokud máte u této schránky zapnuté přihlašování ' +
    'jednorázovým kódem z SMS, přihlaste se pomocí SMS kódu.',
  'login.otpSuggested.useSms': 'Přihlásit pomocí SMS kódu',
  'login.otpSuggested.checkPassword': 'Upravit jméno nebo heslo',
  'login.signedIn': 'Přihlášeno',
  'common.back': 'Zpět',
  'common.cancel': 'Zrušit',
  // Next to a destructive button, "Zrušit" is ambiguous - cancel WHAT, the action or the thing it
  // acts on? "Ponechat" names the outcome instead, which is what the box-removal dialog already did.
  'common.keep': 'Ponechat',
  'common.ok': 'Rozumím',
  'common.continue': 'Pokračovat',
  'common.optional': '(volitelné)',
  'common.undo': 'Vrátit zpět',
  'home.title': 'Schránky',
  'home.addBox': 'Přidat datovou schránku',
  'home.refreshAll': 'Obnovit všechny schránky',
  'home.settings': 'Nastavení',
  'home.menu': 'Nabídka',
  'box.testEnv': 'Testovací',
  'testEnv.banner': 'Testovací prostředí',
  'box.idLabel': 'ID schránky',
  'box.loginLabel': 'Přihlašovací jméno',
  'box.remove': 'Odebrat',
  'box.menu': 'Možnosti schránky',
  'box.rename': 'Upravit schránku',
  'box.removeTitle': 'Odebrat schránku?',
  // Names what actually goes. The old wording listed the box and the credentials and then reassured
  // about the ISDS mailbox - literally true, and read by a hurrying user as "my messages are safe".
  // What removal really deletes is the local archive (AppShell.handleRemove), which is the only copy
  // of anything ISDS has erased after 90 days.
  'box.removeMessage':
    'Z tohoto zařízení se odstraní schránka, uložené přihlašovací údaje ' +
    'i její místní archiv: stažené zprávy, přílohy a připomínky. ' +
    'Zprávy uložené v ISDS to nijak nezmění; ty starší než 90 dnů tam ale už nejsou.',
  'box.remove.delete': 'Smazat',
  'box.remove.keep': 'Ponechat',
  // A removal that did not finish (001 FR-007). The body says which of three things is true, because
  // each asks something different of the user: nothing happened, the box went but not all of it, or
  // the app cannot tell. Every one of them is fixed by trying again.
  'box.removeFailed.title': 'Odebrání schránky se nedokončilo',
  'box.removeFailed.kept':
    'Schránka v aplikaci zůstala i se všemi svými daty. Zkuste ji odebrat znovu.',
  // Closing it is not giving up: the app finishes the removal on its own when the dialog closes and at
  // the next launch (`resumeRemoval`), so the sentence says so rather than leave it to the button.
  'box.removeFailed.incomplete':
    'Schránka už v aplikaci není, ale část jejích dat se z tohoto zařízení nepodařilo smazat. ' +
    'Aplikace to zkusí znovu sama, nebo to zkuste hned.',
  'box.removeFailed.unknown':
    'Nepodařilo se zjistit, co ze schránky v tomto zařízení zůstalo. Zkuste to znovu.',
  'box.removeFailed.retry': 'Zkusit znovu',
  'box.removeFailed.close': 'Zavřít',
  // A new box name that would not save. The rename sheet has closed by then, so this says it did not
  // happen and offers the same name again.
  'box.aliasFailed.title': 'Nový název schránky se nepodařilo uložit',
  'box.aliasFailed.body': 'Schránka si zatím ponechala dosavadní název. Zkuste to znovu.',
  'box.aliasFailed.retry': 'Zkusit znovu',
  'box.aliasFailed.close': 'Zavřít',
  'box.passwordExpires': 'Platnost hesla do',
  'box.lastSynced': 'Obnoveno',
  'box.neverSynced': 'Zatím neobnoveno',
  'box.syncedJustNow': 'právě teď',
  'box.synced.minutes': 'před {n} min',
  'box.synced.hours': 'před {n} h',
  'box.messages.one': '{n} zpráva',
  'box.messages.few': '{n} zprávy',
  'box.messages.many': '{n} zpráv',
  'box.refreshing': 'Obnovování…',
  'box.credit': 'Kredit: {czk} Kč',
  'box.sync.failed': 'Synchronizace se nezdařila.',
  'box.sync.retry': 'Zkusit znovu',
  // 001 T041 - the password's own expiry, which is NOT the session's. The app cannot change an ISDS
  // password, so the copy points at the portal instead of offering a button it cannot honour.
  'pwd.expired': 'Platnost hesla vypršela.',
  'pwd.today': 'Platnost hesla končí dnes.',
  // `{d}` is `formatTermDate`, which is "11. 9." - the date ends the sentence itself. A period
  // here rendered "Platnost hesla končí 11. 9.." on the expiry strip.
  'pwd.soon': 'Platnost hesla končí {d}',
  'pwd.action': 'Změnit v portálu',
  'box.reauth.session': 'Platnost přihlášení vypršela.',
  'box.reauth.credentials': 'Přihlašovací údaje již nejsou platné.',
  // 001 FR-009: a password box refused AFTER its stored expiry date. Not "wrong credentials": that
  // password cannot work again, so retyping it is not the fix - a new one has to be set on the
  // portal first. Rendered through `reauthKey` (`features/accounts/state/reauthCopy.ts`), never
  // picked directly; the inbox strip shows it with a portal action beside the sign-in one.
  'box.reauth.passwordExpired':
    'Platnost hesla vypršela. Změňte ho v portálu ISDS a přihlaste se novým heslem.',
  'box.reauth.action': 'Přihlásit znovu',
  // On the box ROW in the switcher, where the question is "which of my boxes is not working" rather
  // than "what do I do about this one". Shorter than the inbox strip for that reason, and paired
  // with a mark on the avatar so a broken box is findable without reading every row.
  'box.sync.reauth': 'Přihlášení vypršelo',
  // The switcher row for a box whose password ran out (001 FR-009) - the fix starts on the portal,
  // not with signing in again.
  'box.sync.passwordExpired': 'Heslo vypršelo',
  'box.sync.error': 'Nepodařilo se načíst',
  // The unread count next to a box we cannot reach is the LAST known one, and saying so is the
  // difference between a number and a claim.
  'box.sync.stale': 'Poslední známý stav',

  // 023 option C. The card above the inbox that says what the boxes you are NOT looking at hold.
  // Deliberately not phrased as an alert: it demands nothing, it is a glance.
  // 024. The one-line form. "Jinde" rather than "V ostatních schránkách" because the whole point is
  // that it fits on one line beside the dots and the counts; the long phrase is still the a11y
  // heading of the switcher it opens.
  'crossBox.title': 'V ostatních schránkách',
  'crossBox.prefix': 'Jinde',
  // Counted since the rename to připomínka (2026-10-03): "{n} po termínu" read the same for any n.
  'crossBox.overdue.one': '{n} prošlá připomínka',
  'crossBox.overdue.few': '{n} prošlé připomínky',
  'crossBox.overdue.many': '{n} prošlých připomínek',
  // 024 FR-003. The nearest deadline still ahead, said relatively: the line is a glance, and a date
  // would make the reader do the subtraction. "zítra" rather than "za 1 den", which nobody says -
  // the .one form exists because every plural family must be complete, not because the line uses it.
  'crossBox.due.today': 'připomínka dnes',
  'crossBox.due.tomorrow': 'připomínka zítra',
  'crossBox.due.in.one': 'připomínka za {n} den',
  'crossBox.due.in.few': 'připomínka za {n} dny',
  'crossBox.due.in.many': 'připomínka za {n} dní',
  // 024 FR-004. Unread mail in a box we could not refresh is the LAST count we know. "naposledy"
  // puts that on the number itself, the same fact the switcher row states as "Poslední známý stav".
  'crossBox.lastKnown.one': 'naposledy {n} nepřečtená',
  'crossBox.lastKnown.few': 'naposledy {n} nepřečtené',
  'crossBox.lastKnown.many': 'naposledy {n} nepřečtených',
  'crossBox.unreachable.one': '{n} nenačtená',
  'crossBox.unreachable.few': '{n} nenačtené',
  'crossBox.unreachable.many': '{n} nenačtených',
  // A refresh of the other boxes is still out, so the numbers before this are about to change.
  'crossBox.refreshing': 'načítá se…',
  // 2026-09-15. The line shows whole clauses and counts the ones a narrow screen left out, so a cut
  // is never silent. A bare number after " · ", the same mark as the "+12" beside the dots. Words
  // cost a clause: on the phone this was reported from, " · +1 další" is about 30dp wider than
  // " · +1", and that was the difference between the line showing its second clause and not.
  'crossBox.notShown': '+{n}',

  // 024 cycle 2: the merged view. "Vše" is short because it sits in a list of box names and has to
  // read as a MODE rather than as another name - everything that makes it distinguishable from a
  // box is structural (see UnifiedRow), not lexical.
  'unified.title': 'Všechny schránky',
  'unified.subtitle.one': '{n} schránka',
  'unified.subtitle.few': '{n} schránky',
  'unified.subtitle.many': '{n} schránek',
  // The switcher entry's own sub-line. Says what the row IS, in a grammar no box can produce about
  // itself - which is one of the four things keeping it distinguishable from a box named the same.
  'unified.kind': 'Sloučený archiv',
  'unified.empty': 'Zatím žádné zprávy',
  'unified.empty.hint': 'Až se schránky načtou, uvidíte tu zprávy ze všech najednou.',
  'unified.missing.one': '{n} schránka se nenačetla',
  'unified.missing.few': '{n} schránky se nenačetly',
  'unified.missing.many': '{n} schránek se nenačetlo',
  'reauth.title': 'Přihlásit znovu',
  'reauth.intro':
    'Platnost přihlášení k této schránce vypršela. Přihlaste se prosím znovu.',
  'reauth.intro.credentials':
    'Přihlašovací údaje k této schránce už nejsou platné. Zadejte je prosím znovu. Heslo do ISDS se mění každých 90 dnů.',
  // 001 FR-009. Says what to do BEFORE this form can work - the app cannot change an ISDS password.
  // And says how the app knows: ISDS gives it no "expired" answer, so the expiry comes from the date
  // stored at the last sign-in, and the sentence claims no more than that.
  'reauth.intro.passwordExpired':
    'ISDS odmítá heslo k této schránce a podle data z posledního přihlášení mu už vypršela platnost. Nejdřív ho změňte v portálu ISDS, pak sem zadejte nové heslo.',
  'reauth.error': 'Přihlášení se nezdařilo. Zkontrolujte údaje a zkuste to znovu.',
  'reauth.expiredStrip': 'Platnost přihlášení vypršela',
  'reauth.submit': 'Přihlásit se',
  'messages.title': 'Přijaté zprávy',
  'messages.empty': 'Žádné přijaté zprávy.',
  'messages.empty.hint': 'Jakmile vám někdo pošle zprávu, objeví se tady.',
  'messages.segment.received': 'Přijaté',
  'messages.segment.sent': 'Odeslané',
  'messages.sent.empty': 'Žádné odeslané zprávy.',
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
    'Přihlašovací údaje již nejsou platné. Přihlaste se prosím znovu.',
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
  'messages.synced.now': 'Aktualizováno právě teď',
  'messages.synced.min.one': 'Aktualizováno před {n} minutou',
  'messages.synced.min.few': 'Aktualizováno před {n} minutami',
  'messages.synced.min.many': 'Aktualizováno před {n} minutami',
  'messages.synced.at': 'Aktualizováno v {d}',
  'messages.synced.on': 'Aktualizováno {d}',
  'messages.synced.never': 'Zatím neaktualizováno',
  'search.hint.title': 'Prohledat archiv',
  // Diagnostics. The wording is deliberately concrete about what leaves and what cannot: a vague
  // "pomáhá nám vylepšovat aplikaci" would be the kind of sentence this app does not write.
  'settings.diagnostics': 'DIAGNOSTIKA',
  'settings.telemetry.title': 'Posílat hlášení o chybách',
  'settings.telemetry.desc':
    'Zapnuto. Když aplikace narazí na chybu, odešleme technický popis: kde nastala, jaká to byla chyba a co na ni odpověděla datová schránka. Nikdy obsah zpráv, jména, ID schránek ani přílohy.',
  'settings.telemetry.desc.off':
    'Vypnuto. Neodesílá se nic. Po zapnutí budeme posílat technický popis chyby: nikdy obsah zpráv, jména, ID schránek ani přílohy.',

  // 023. Sits beside the error-report toggle because it is the same kind of decision - what this app
  // may do with your data - and a different answer to it. Error reports are automatic and stripped
  // to almost nothing; a debug bundle is a file you make on purpose, read if you want to, and hand
  // to somebody yourself. The copy has to carry that difference without a lecture.
  // The first-run consent card. Asked ONCE, before anything is transmitted.
  //
  // The wording is the settings description's, made into a question, plus the two lists the FAQ
  // already uses - because the thing that earns a yes here is being specific, and this app can
  // afford to be: `scrub.ts` is an allow-list, so "what is sent" really is a closed set.
  'consent.title': 'Smíme posílat hlášení o chybách?',
  'consent.intro':
    'Když aplikace narazí na chybu, může o ní odeslat technický popis. Bez něj se o chybě nedozvíme a neopravíme ji.',
  'consent.sends': 'Odesílá se: kde chyba nastala, jaká to byla chyba, chybový kód datové schránky, HTTP kód, verze aplikace a systému.',
  'consent.never': 'Neodesílá se nikdy: obsah zpráv, předměty, jména, ID schránek, přihlašovací údaje, přílohy ani text dokumentů.',
  'consent.where': 'Hlášení míří do služby Sentry na servery v EU. Čte je vývojář této aplikace.',
  'consent.change': 'Rozhodnutí kdykoli změníte v Nastavení.',
  'consent.yes': 'Odesílat hlášení',
  'consent.no': 'Neodesílat',
  'consent.more': 'Co přesně se odesílá?',

  'settings.debug': 'Režim ladění',
  'settings.debug.row.desc':
    'Zaznamená technický průběh do souboru v telefonu. Nic se nikam neodesílá; soubor sdílíte sami.',
  'debug.title': 'Režim ladění',
  'debug.intro':
    'Když hlášení o chybě nestačí, zaznamená aplikace podrobný technický průběh a uloží ho jako soubor ZIP do telefonu. Soubor si můžete otevřít a přečíst. Neodesílá se sám: sdílíte ho vy, komu chcete a kdy chcete.',
  'debug.level': 'Co se zaznamená',
  'debug.level.standard': 'Bez obsahu zpráv',
  'debug.level.standard.desc':
    'Operace, časy, stavové kódy a chybová hlášení. Texty zpráv, přílohy, jména ani ID schránek v souboru nebudou.',
  'debug.level.full': 'Včetně komunikace s ISDS',
  'debug.level.full.desc':
    'Navíc obsah odeslaných a přijatých dat, tedy i texty vašich zpráv. Zvolte, jen když bez toho chybu nelze najít, a sdílejte jen s někým, komu důvěřujete.',
  'debug.creds':
    'Hesla, přihlašovací údaje ani záložní klíč se nezaznamenávají nikdy, ani v podrobném režimu.',
  'debug.start': 'Spustit záznam',
  'debug.stop': 'Ukončit a uložit',
  'debug.discard': 'Zahodit záznam',
  'debug.recording': 'Zaznamenává se',
  'debug.recording.entries.one': '1 záznam',
  'debug.recording.entries.few': '{n} záznamy',
  'debug.recording.entries.many': '{n} záznamů',
  'debug.recording.hint':
    'Zopakujte to, co nefunguje, a pak záznam ukončete. Režim se sám vypne při restartu aplikace.',
  'debug.saved': 'Uložené soubory',
  'debug.saved.empty': 'Zatím tu nic není.',
  'debug.saved.error': 'Uložené soubory se nepodařilo načíst.',
  'debug.saved.errorAgain': 'Uložené soubory se nepodařilo načíst ani na {n}. pokus.',
  'debug.saved.retry': 'Zkusit znovu',
  'debug.saved.sizeUnknown': 'Velikost se nepodařilo zjistit',
  'debug.share': 'Sdílet',
  'debug.shareTitle': 'Sdílet soubor z režimu ladění',
  'debug.delete': 'Smazat',
  'debug.deleteAll': 'Smazat vše',
  'debug.deleted': 'Smazáno',
  'debug.savedNotice': 'Uloženo: {name}',
  'debug.error': 'Záznam se nepodařilo uložit.',
  'debug.shareError': 'Sdílení se nepodařilo otevřít.',
  'debug.deleteError': 'Soubor se nepodařilo smazat.',
  'debug.saving': 'Ukládá se…',
  'debug.indicator': 'Režim ladění zaznamenává',
  'debug.indicator.hint': 'Otevře režim ladění',
  'faq.explain': 'Co to znamená?',
  'messages.reauth.empty': 'Zprávy zatím nejsou k dispozici',
  'messages.reauth.empty.hint':
    'Přihlaste se znovu výše a schránka se načte. Neznamená to, že je prázdná. Jen jsme se do ní zatím nedostali.',
  'messages.attention': 'Vyžaduje pozornost',
  // The group's subtitle, DERIVED from what the group actually holds (2026-09-09 critique). It used
  // to be one fixed legend printed under a number that mixes four different feeds, so the loudest
  // element on the screen said the same sentence whether it counted one overdue deadline or forty
  // unread newsletters. Assembled from these parts, joined with " · ".
  'attn.overdue.one': '{n} prošlá připomínka',
  'attn.overdue.few': '{n} prošlé připomínky',
  'attn.overdue.many': '{n} prošlých připomínek',
  'attn.dated.one': '{n} připomínka',
  'attn.dated.few': '{n} připomínky',
  'attn.dated.many': '{n} připomínek',
  'attn.fiction.one': '{n} doručeno fikcí',
  'attn.fiction.few': '{n} doručeny fikcí',
  'attn.fiction.many': '{n} doručeno fikcí',
  'attn.unread.one': '{n} nepřečtená',
  'attn.unread.few': '{n} nepřečtené',
  'attn.unread.many': '{n} nepřečtených',
  /** Shown when the cap left plain-unread rows out; they are in the date sections below. */
  'attn.more.one': 'a {n} další níže',
  'attn.more.few': 'a {n} další níže',
  'attn.more.many': 'a {n} dalších níže',
  // Reminder notifications (010). The TITLE is what a lock screen set to hide previews may still
  // show, so it names no message; the subject rides in the body.
  'notif.channel.reminders': 'Připomínky',
  'notif.reminder.tomorrow': 'Připomínka na zítra',
  'notif.reminder.today': 'Připomínka na dnes',
  'notif.hiddenBody': 'Podrobnosti se zobrazí po odemčení',
  // The reminder picker (010 US2), named "Termín" until 2026-10-03: the owner found it unclear, and
  // what the user sets here IS a reminder. "Vaše připomínka" and "nastavujete si ji sami" are
  // load-bearing: the app does not compute legal deadlines and this must not be read as if it did
  // (Principle VI).
  'term.action': 'Připomínka',
  'term.title': 'Vaše připomínka',
  'term.sub': 'Nastavujete si ji sami. Upozorníme vás den předem a v den připomínky.',
  // Near dates get fewer notifications, or none - see `reminderPromise`. Promising two anyway is the
  // easiest promise in the app to break: pick "dnes" after nine in the morning.
  'term.sub.onDay': 'Nastavujete si ji sami. Upozorníme vás v den připomínky.',
  'term.sub.none':
    'Nastavujete si ji sami. Datum si uložíme, upozornění už ale nestihneme poslat.',
  // Notifications switched off (2026-09-24, 010 FR-006). The reminder still works as the chip and the
  // attention group, so the sheet says where it WILL show rather than promising an alert, and the
  // reminder row says the alert will not come and offers the one thing that changes that.
  'term.sub.silent':
    'Nastavujete si ji sami. Upozornění jsou vypnutá, připomínku uvidíte jen v aplikaci.',
  'term.alertsOff': 'Upozornění jsou vypnutá, připomínka nepřijde.',
  'term.alertsOff.action': 'Zapnout',
  'term.preset.week': 'Za týden',
  'term.preset.twoWeeks': 'Za 2 týdny',
  'term.preset.endOfMonth': 'Konec měsíce',
  'term.custom': 'Vlastní datum',
  'term.custom.earlier': 'O den dřív',
  'term.custom.later': 'O den později',
  'term.save': 'Uložit',
  'term.remove': 'Odebrat',
  'term.chip': 'Připomínka {d}',
  'term.chip.today': 'Připomínka dnes',
  'term.chip.overdue': 'Připomínka prošla {d}',
  'term.none': 'Nenastavena',
  'messages.status.sent': 'Odesláno',
  // --- Delivery states (013) -------------------------------------------------------------------
  // The ten ISDS states, five treatments. `detail.delivered` (Dodáno) and `detail.accepted`
  // (Doručeno) below carry two of them; these are the three the old three-state model had no words
  // for. The countdown lives on SENT messages only - see src/features/messages/state/fikce.ts.
  'status.byFiction': 'Doručeno fikcí',
  'faq.legend.bySignIn': 'Doručeno přihlášením',
  'faq.legend.stop': 'Nedoručitelné nebo neprošlo kontrolou',
  'status.byFiction.note': 'Adresát se do schránky nepřihlásil.',
  'status.byFiction.withoutYou': 'bez vašeho přihlášení',
  'status.stop': 'Nedoručitelné',
  'status.stop.antivirus':
    'Zpráva neprošla antivirovou kontrolou a nebyla nikomu doručena. Zkuste ji odeslat znovu bez závadné přílohy.',
  'status.stop.undeliverable':
    'Schránka adresáta byla zneplatněna. Tato zpráva už doručena nebude. Zvolte jinou cestu.',
  'status.note.erased': 'Obsah u státu smazán',
  // 017 - the received "Doručenka". Wording from the design; each line states a fact about what ISDS
  // did or did not report, never an inference of ours.
  'recv.head': 'Doručenka',
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
  'settings.autoDownload.ask.title': 'Stahovat přílohy automaticky?',
  'settings.autoDownload.ask.new': 'Jen nové zprávy',
  'settings.autoDownload.ask.new.desc': 'Zprávy, které přijdou od teď',
  'settings.autoDownload.ask.all': 'I zprávy, které už v telefonu jsou',
  'settings.autoDownload.ask.all.desc': 'Chybějící přílohy se doplní při příští aktualizaci',
  'settings.autoDownload.ask.body':
    'Při aktualizaci schránky se stáhnou přílohy přijatých i odeslaných zpráv, které v telefonu chybí. Zprávu to nedoručí ani neoznačí jako přečtenou: doručená je už tím, že se objevila v seznamu. Přílohy zabírají místo v telefonu a každá se stahuje jen jednou.',
  'settings.autoDownload.ask.confirm': 'Zapnout',
  // 006 - backup. Two things this copy has to carry and keep carrying: what the backup does NOT
  // contain (FR-008), and that the password is the only way in. Both are stated plainly rather than
  // softened, because a user who misunderstands either finds out at the worst possible moment.
  'backup': 'Záloha archivu',
  'backup.on': 'Zapnuto',
  'backup.off': 'Vypnuto',
  'backup.toggle': 'Zálohovat archiv',
  // Shown while the screen is still finding out whether backups are on. It has to exist: the answer
  // is two async reads away (the Keychain, then the target's manifests), and for that gap the screen
  // used to render the OFF copy - telling a user with backups enabled, in a full sentence, that
  // their archive was not backed up anywhere. A placeholder cannot be wrong; that sentence was.
  'backup.loading': 'Zjišťuji stav zálohy…',
  // Says what the switch DOES - and there are two answers, because automatic backups can be turned
  // off. One sentence for both states is a sentence that is wrong in one of them.
  'backup.toggle.desc':
    'Po každé aktualizaci schránky se archiv sám zazálohuje, zašifrovaně a do tohoto telefonu. Uložte si zálohu i jinam: s telefonem se ztratí obojí.',
  'backup.toggle.desc.manual':
    'Zašifrovaná záloha archivu v tomto telefonu. Automatické zálohování je vypnuté. Zálohu vytvoříte tlačítkem.',
  // The state this row is in BEFORE anything is switched on. Neither sentence above is true here:
  // there is no password, so nothing backs itself up and no button exists to press.
  //
  // It also used to end "a archiv už nebude jen v tomto telefonu", which was simply false: the
  // backup is written to this phone's own storage and dies with it - a `pm clear` empties the
  // restore list. The app said the opposite two cards further down ('backup.where'). What IS true,
  // now that 006 T014 exists, is that the user can take the backup off the phone themselves.
  'backup.toggle.desc.off':
    'Zašifrovaná záloha zpráv a nastavení. Uloží se do tohoto telefonu a odtud si ji můžete uložit i jinam.',
  // The Settings ROW does not know the user's settings and should not claim to: it says what the
  // section is, and the section itself says what state it is in.
  'backup.row.desc': 'Zašifrovaná záloha zpráv a nastavení v tomto telefonu.',
  'backup.working': 'Pracuji…',
  // The progress line. `x z y` are real counts - messages read, rows written - never an estimate.
  'backup.stage.reading': 'Čtu zprávy',
  'backup.stage.sealing': 'Šifruji zálohu',
  'backup.stage.writing': 'Ukládám zálohu',
  'backup.stage.fetching': 'Stahuji zálohu',
  'backup.stage.opening': 'Dešifruji zálohu',
  'backup.stage.restoring': 'Obnovuji záznamy',
  'backup.stage.documents': 'Zálohuji přílohy',
  'backup.stage.downloading': 'Stahuji chybějící přílohy',
  // Obnova zapisuje přílohy zpět stejnou fází jako záloha, a řádek pod ní psal "Zálohuji přílohy"
  // (2026-09-24).
  'backup.stage.documents.restore': 'Obnovuji přílohy',
  'backup.progress.count': '{done} z {total}',
  'backup.progress.percent': '{percent} %',
  'backup.leave.title': 'Záloha ještě běží',
  // Obnova a ověření běží jako vlastní běh, a dialog mluvil o záloze i u nich (2026-09-15). Obnově
  // stačí vlastní titulek a tlačítko ("ji" sedí na obnovu stejně jako na zálohu); ověřování je
  // středního rodu, proto má i vlastní otázku.
  'backup.leave.title.restore': 'Obnova ještě běží',
  'backup.leave.title.verify': 'Ověřování zálohy ještě běží',
  'backup.leave.body': 'Chcete ji nechat doběžet na pozadí, nebo ji zrušit?',
  'backup.leave.body.verify': 'Chcete ověřování nechat doběžet na pozadí, nebo ho zrušit?',
  'backup.leave.background': 'Nechat běžet',
  'backup.leave.cancel': 'Zrušit zálohu',
  'backup.leave.cancel.restore': 'Zrušit obnovu',
  'backup.leave.cancel.verify': 'Zrušit ověřování',
  // NOT "Zrušit": next to "Zrušit zálohu" a bare cancel is genuinely ambiguous - cancel the backup,
  // or cancel leaving? This button says what it does.
  'backup.leave.stay': 'Zůstat zde',
  // Obnova, u které otázka přišla ještě včas, ale odpověď až po zapsání záznamů: přílohy se už dopíšou
  // do konce (2026-09-15). Řečeno, aby "Zrušit" nezapadlo beze slova.
  'backup.leave.notStopped': 'Obnovu už nejde zastavit, dokončí se na pozadí.',
  'backup.cancelled': 'Záloha byla zrušena.',
  'backup.now': 'Zálohovat nyní',
  'backup.last': 'Naposledy {when} · {size}',
  // Se zapnutými přílohami znamená "zálohováno" něco jiného, a řádek to musí říct - jinak dvě zálohy
  // vypadají stejně a jedna z nich přílohy neobsahuje (FR-008).
  'backup.last.documents': 'Naposledy {when} · {size} + přílohy {docSize}',
  // The same two sizes on each row of the backup list (2026-10-03): the row showed the archive alone, so
  // a backup chipped "Všechny přílohy" read as 14 kB.
  'backup.size.documents': '{size} + přílohy {docSize}',
  'backup.never': 'Zatím nezálohováno',
  'backup.scope': 'Co je v záloze',
  'backup.scope.desc':
    'Zprávy a jejich stav, koncepty, připomenutí a nastavení aplikace. Stažené přílohy ani přihlašovací údaje v záloze nejsou. Do schránky se po obnovení přihlásíte znovu.',
  // Tentýž odstavec, když jsou přílohy zapnuté. Dvě věty pro dva stavy: jedna věta pro oba by byla
  // v jednom z nich nepravdivá, a je to přesně ta věta, podle které se člověk rozhoduje.
  'backup.scope.desc.documents':
    'Zprávy a jejich stav, koncepty, připomenutí, nastavení aplikace a stažené přílohy. Přihlašovací údaje v záloze nejsou - do schránky se po obnovení přihlásíte znovu.',
  'backup.docs.title': 'Zálohovat i přílohy',
  'backup.docs.desc.off':
    'Záloha ví, že zpráva přílohu měla, ale soubor v ní není. Po obnovení na novém telefonu si přílohy stáhnete znovu - pokud je ISDS ještě má.',
  // Dva režimy příloh (026). Řádek pod přepínačem říká, který platí, a čím se od druhého liší.
  'backup.docs.desc.on.downloaded':
    'Zálohují se přílohy stažené v telefonu. Každý soubor se uloží jen jednou, takže další zálohy jsou menší.',
  'backup.docs.desc.on.all':
    'Chybějící přílohy se stáhnou při zálohování a při aktualizaci schránky.',
  'backup.docs.measuring': 'Počítám velikost příloh…',
  'backup.docs.which': 'Které přílohy',
  'backup.docs.change': 'Změnit',
  'backup.docs.ask.title': 'Zálohovat i přílohy?',
  'backup.docs.change.title': 'Které přílohy zálohovat?',
  'backup.docs.mode.downloaded': 'Jen stažené přílohy',
  'backup.docs.mode.downloaded.count': '{count}, asi {size}',
  'backup.docs.mode.downloaded.none': 'Zatím žádná stažená příloha',
  'backup.docs.mode.downloaded.explain':
    'Co stáhnete později, přibude v další záloze. Každý soubor se uloží jen jednou.',
  'backup.docs.mode.all': 'Stáhnout a zálohovat všechny',
  // "u 1 zprávy", "u 3 zpráv", "u 5 zpráv" - genitiv, podle počtu.
  'backup.docs.mode.all.count.one': 'Chybí u 1 zprávy',
  'backup.docs.mode.all.count.few': 'Chybí u {n} zpráv',
  'backup.docs.mode.all.count.many': 'Chybí u {n} zpráv',
  'backup.docs.mode.all.complete': 'Všechny přílohy už v telefonu jsou',
  // Nepravdivé varování "zprávy se tím doručí" tu je naschvál obráceně (026): doručuje jen načtení
  // seznamu (Provozní řád ISDS, kap. 8) a stažení přes webové služby zprávu ani neoznačí jako přečtenou.
  'backup.docs.mode.all.explain':
    'Chybějící přílohy přijatých i odeslaných zpráv se stáhnou, když zálohujete tlačítkem a při každé aktualizaci schránky, nikdy samy od sebe. Zprávu to nedoručí ani neoznačí jako přečtenou: doručená je už tím, že se objevila v seznamu.',
  'backup.docs.mode.all.gone.one': 'U 1 zprávy už ISDS přílohy smazalo, ty se stáhnout nedají.',
  'backup.docs.mode.all.gone.few': 'U {n} zpráv už ISDS přílohy smazalo, ty se stáhnout nedají.',
  'backup.docs.mode.all.gone.many': 'U {n} zpráv už ISDS přílohy smazalo, ty se stáhnout nedají.',
  'backup.docs.mode.all.wifi':
    'Při aktualizaci schránky platí volba „Jen na Wi-Fi“ z Nastavení → Přílohy.',
  'backup.docs.ask.confirm': 'Zapnout',
  'backup.docs.ask.save': 'Uložit',
  // Co která záloha v seznamu obsahuje (026 US2), přečteno z manifestu, bez hesla.
  'backup.docs.chip.none': 'Bez příloh',
  'backup.docs.chip.downloaded': 'Jen stažené',
  'backup.docs.chip.all': 'Všechny přílohy',
  'backup.docs.missing.one': 'u 1 zprávy chybí přílohy',
  'backup.docs.missing.few': 'u {n} zpráv chybí přílohy',
  'backup.docs.missing.many': 'u {n} zpráv chybí přílohy',
  'backup.count.files.one': '1 soubor',
  'backup.count.files.few': '{n} soubory',
  'backup.count.files.many': '{n} souborů',
  'backup.auto':
    'Záloha se vytvoří po každé aktualizaci schránky, chvíli po ní. Tlačítkem výše ji vytvoříte hned.',
  'backup.auto.off':
    'Automatické zálohování je vypnuté. Zálohu vytvoříte tlačítkem výše; zapnout ho můžete v Pokročilé.',
  'backup.where': 'Záloha se ukládá do tohoto telefonu. Uložení do cloudu zatím není hotové.',
  'backup.how': 'Jak je záloha zašifrovaná',
  'backup.key': 'Heslo k záloze',
  'backup.key.desc':
    'Bez tohoto hesla zálohu nikdo neotevře, ani my. Uschovejte si ho mimo telefon.',
  'backup.key.show': 'Zobrazit heslo',
  'backup.key.hide': 'Skrýt heslo',
  'backup.key.qr': 'Zobrazit QR kód',
  'backup.key.qr.hide': 'Skrýt QR kód',
  'backup.key.qr.hint': 'Při obnovení na druhém telefonu tento kód naskenujete.',
  'backup.key.qr.label': 'QR kód s heslem k záloze',
  'backup.prompt.reveal': 'Zobrazit heslo k záloze',
  'backup.prompt.enable': 'Uložit heslo k záloze',
  'backup.prompt.backup': 'Zálohovat archiv',
  'backup.advanced': 'Pokročilé',
  'backup.keep.title': 'Uchovávat více záloh',
  'backup.keep.desc':
    'Ve výchozím stavu se uchovává jen poslední záloha. Každá další je celá kopie archivu. Se zapnutou volbou se drží několik posledních a nejstarší se maže.',
  'backup.keep.count': 'Počet záloh',
  'backup.auto.title': 'Zálohovat automaticky',
  'backup.auto.desc': 'Po každé aktualizaci schránky, chvíli po ní. Když vypnete, zálohu vytvoříte tlačítkem.',
  'backup.delete': 'Smazat',
  // Lowering the limit deletes immediately - so it has to ask first, and say how many.
  // "Nejstarší", not "starší": what goes is the OLDEST n, and the sentence pairs with "zůstanou
  // 2 nejnovější" - superlative on both sides of the trade.
  'backup.prune.title': 'Smazat nejstarší zálohy?',
  // Two counts in one sentence, and Czech makes both of them agree - the verb with the number of
  // deleted backups ("3 zálohy se smažou" but "5 záloh se smaže"), the adjective with the number
  // kept. Assembled from two counted phrases rather than interpolated into a fixed sentence, which
  // is how "3 starší zálohy se smaže" reached the screen.
  'backup.prune.body': '{deleted}; {kept}.',
  'backup.prune.deleted.one': 'Hned se smaže 1 nejstarší záloha, kterou už nepůjde obnovit',
  'backup.prune.deleted.few': 'Hned se smažou {n} nejstarší zálohy, které už nepůjde obnovit',
  'backup.prune.deleted.many': 'Hned se smaže {n} nejstarších záloh, které už nepůjde obnovit',
  'backup.prune.kept.one': 'zůstane jen ta nejnovější',
  'backup.prune.kept.few': 'zůstanou {n} nejnovější',
  'backup.prune.kept.many': 'zůstane {n} nejnovějších',
  // Zálohy, ze kterých obnova nevrátila všechny přílohy, se nemažou a nepočítají se mezi ponechané
  // (2026-09-15). Věta o tom, co zůstane, by bez nich lhala.
  'backup.prune.held.one': 'Záloha s přílohami, které se nepodařilo obnovit, zůstane také.',
  'backup.prune.held.few': '{n} zálohy s přílohami, které se nepodařilo obnovit, zůstanou také.',
  'backup.prune.held.many': '{n} záloh s přílohami, které se nepodařilo obnovit, zůstane také.',
  'backup.prune.confirm': 'Snížit a smazat',
  'backup.delete.title': 'Smazat zálohu?',
  'backup.delete.body': 'Tuto zálohu už nepůjde obnovit. Ostatní zálohy zůstanou.',
  // Smazání držené zálohy je jediný způsob, jak ji pustit, a jsou v ní přílohy, které telefon nemá.
  'backup.delete.body.held':
    'V této záloze jsou přílohy, které se do telefonu nepodařilo obnovit. Po jejím smazání už je nepůjde obnovit.',
  'backup.deleted': 'Záloha byla smazána.',
  // Smazání, uložení nastavení a snížení počtu záloh končily při chybě mlčky - odmítnutý slib, který
  // nikdo nechytil (2026-09-24). Starší zálohy smaže každá další záloha, takže věta říká, kdy to
  // aplikace zkusí znovu.
  'backup.delete.failed': 'Zálohu se nepodařilo smazat. Zkuste to znovu.',
  'backup.prefs.failed': 'Nastavení zálohy se nepodařilo uložit. Zkuste to znovu.',
  'backup.prune.failed':
    'Starší zálohy se teď nepodařilo smazat. Aplikace to zkusí znovu po příští záloze.',
  'backup.restore': 'Obnovit ze zálohy',
  'backup.restore.none': 'Zatím tu žádná záloha není.',
  // Moving a backup off this phone, and taking one back (T014). "Soubor" rather than "export"
  // because the thing the user gets IS a file, and that is what they will look for later.
  'backup.file': 'Záloha jako soubor',
  'backup.file.desc':
    'Záloha v telefonu zmizí s telefonem. Uložte si ji jinam: soubor je zašifrovaný stejným heslem.',
  'backup.file.export': 'Uložit zálohu do souboru',
  'backup.file.import': 'Načíst zálohu ze souboru',
  'backup.file.exported': 'Záloha uložena.',
  'backup.file.imported': 'Záloha načtena. Najdete ji v seznamu níže.',
  'backup.file.importFailed': 'Soubor se nepodařilo načíst.',
  // T013. "Ověřit" is the promise; the count is what makes it checkable.
  'backup.verify': 'Ověřit zálohu',
  'backup.verify.busy': 'Ověřuji zálohu…',
  // Počty ve tvaru, který číslo žádá (2026-09-24): pevná věta s holými čísly četla "1 schránky, 1
  // zpráv".
  'backup.verify.ok': 'Záloha je v pořádku: {boxes}, {messages}.',
  'backup.verify.failed':
    'Zálohu se nepodařilo otevřít. Buď je poškozená, nebo k ní nesedí heslo.',
  'backup.restore.tooNew': 'Vytvořeno novější verzí aplikace. Aktualizujte aplikaci.',
  'backup.restore.unsupported': 'Tuto zálohu tato verze aplikace nepřečte.',
  // U zálohy, kterou si retence nechává, protože z ní obnova nevrátila všechny přílohy (2026-09-15).
  'backup.restore.held': 'Nesmaže se sama: drží přílohy, které se z ní nepodařilo obnovit.',
  // Titulek dialogu s výsledkem obnovy, kterou obrazovka neviděla skončit - odešlo se z ní s "Nechat
  // běžet" (2026-09-15), stejně jako u uložení přenosu.
  'backup.restore.outcome.title': 'Obnova ze zálohy',
  'backup.restore.key.placeholder': 'Heslo k záloze',
  'backup.restore.useStored': 'Použít heslo z tohoto telefonu',
  // 006 T012b. Ukázat QR uměl telefon od začátku; načíst ho jde teprve teď, když má aplikace
  // fotoaparát kvůli přenosu mezi telefony (025). Psát heslo jde pořád - telefon, který kód
  // ukazuje, může být ten ztracený.
  'backup.restore.scan': 'Načíst heslo z QR kódu',
  'backup.restore.scan.hint': 'Namiřte na QR kód s heslem k záloze',
  'backup.restore.start': 'Obnovit',
  'backup.restore.badKey': 'Heslo má 20 znaků ve tvaru XXXX-XXXX-XXXX-XXXX-XXXX.',
  'backup.restore.failed': 'Zálohu se nepodařilo otevřít. Zkontrolujte heslo.',
  'backup.restore.error': 'Zálohu se nepodařilo obnovit. Zkuste to znovu.',
  // Obnova selhala až po zapsání záznamů, takže přílohy nejsou celé a záloha se drží (2026-09-24). Bez
  // "proto" z `backup.restored.held` - věta před ní mluví o chybě, ne o chybějících přílohách.
  'backup.restore.error.held':
    'Záloha, ze které jste obnovovali, se sama nesmaže, dokud z ní obnova neproběhne celá nebo dokud ji nesmažete.',
  'backup.restored': 'Obnoveno: {messages}, {boxes}.',
  'backup.restored.documents': 'Obnoveno: {messages}, {boxes}, {files}.',
  // Přílohy, které záloha jmenuje, ale tenhle soubor je neobsahuje - typicky záloha vyvezená do
  // souboru, která nese archiv, ne soubory. Radši spočítané a řečené než tiše vynechané. Ve tvaru,
  // který počet žádá (2026-09-15): "1 příloh se nepodařilo obnovit" byl jediný, co tu byl.
  'backup.restored.someMissing.one': '1 přílohu se nepodařilo obnovit.',
  'backup.restored.someMissing.few': '{n} přílohy se nepodařilo obnovit.',
  'backup.restored.someMissing.many': '{n} příloh se nepodařilo obnovit.',
  // Proč se záloha, ze které se obnovovalo, nesmaže: drží přílohy, které telefon nemá (2026-09-15).
  // Bez čísla, protože věta před ní už ho řekla ve správném tvaru.
  'backup.restored.held':
    'Záloha, ze které jste obnovovali, se proto sama nesmaže, dokud z ní obnova neproběhne celá nebo dokud ji nesmažete.',
  // Archiv je obnovený, ale heslo k záloze se neuložilo (odmítnutá výzva k zámku obrazovky). Řečeno
  // u výsledku, ne jako chyba obnovy - obnova se povedla.
  'backup.restored.keyNotSaved':
    'Heslo k záloze se ale do tohoto telefonu nepodařilo uložit, takže telefon zatím nezálohuje.',
  'backup.count.messages.one': '1 zpráva',
  'backup.count.messages.few': '{n} zprávy',
  'backup.count.messages.many': '{n} zpráv',
  'backup.count.boxes.one': '1 schránka',
  'backup.count.boxes.few': '{n} schránky',
  'backup.count.boxes.many': '{n} schránek',
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
  'transfer.phrase.waiting': 'Čekám na druhý telefon…',
  'transfer.phrase.placeholder': 'Heslo z druhého telefonu',
  // FR-008. Velikost je vidět před přenosem vždy; tohle je navíc pro mobilní data, kde ji člověk
  // platí. Ptá se jen u přenosu, který stojí za zeptání - u samotných zpráv (kilobajty) ne.
  'transfer.metered.title': 'Jste na mobilních datech',
  'transfer.metered.body':
    'Přenos má {size}. Na mobilních datech to může něco stát. Pokračovat?',
  'transfer.metered.confirm': 'Přenést i tak',
  'transfer.scan': 'Načíst kód fotoaparátem',
  'transfer.scan.hint': 'Namiřte na kód na druhém telefonu',
  'transfer.scan.denied':
    'Bez přístupu k fotoaparátu kód načíst nejde. Heslo můžete zadat ručně - funguje to stejně.',
  'transfer.scan.noCamera':
    'Tento telefon nemá použitelný fotoaparát. Heslo zadejte ručně - funguje to stejně.',
  'transfer.start': 'Přijmout',
  'transfer.cancel': 'Zrušit přenos',
  // Před heslem, ne po něm. Chvíli to trvá (na archivu s přílohami desítky sekund) a druhý telefon
  // zatím nemá co zadat - říct v tu chvíli "čekám na druhý telefon" je nepravda.
  'transfer.stage.preparing': 'Připravuji odeslání…',
  'transfer.stage.preparing.count': 'Připravuji přílohy: {done} z {total}',
  'transfer.stage.connecting': 'Navazuji spojení',
  'transfer.stage.transferring': 'Přenáším',
  'transfer.stage.finishing': 'Dokončuji',
  // Ukládání toho, co přišlo, už není přenos: nic nejde po síti, jen se zapisuje do archivu. Zrušit ho
  // nejde - zprávy se uloží najednou a přílohy až po nich, takže zastavení v půlce by nechalo zprávy
  // bez příloh (FR-012). Věta pod pruhem říká proč, místo tlačítka, které by nic neudělalo.
  'transfer.stage.applying': 'Ukládám do archivu tohoto telefonu…',
  'transfer.applying.note':
    'Ukládání do archivu už nejde přerušit, aby v něm nic nezůstalo napůl. Nechte aplikaci otevřenou, dokud neskončí.',
  // FR-007. Kde přenos běží, řečeno v průběhu - a co o něm relay ví. Tři stavy, protože dokud není
  // spojení navázané, je jediná pravdivá odpověď "zatím nevím".
  'transfer.route.unknown': 'Zjišťuji, kudy přenos půjde…',
  'transfer.route.direct': 'Přenos jde přímo mezi telefony. Nikam jinam se data nedostanou.',
  // Server jménem, ne popisem (US3): {host} a {host6} jsou výchozí servery crocu, viz TRANSFER_RELAY.
  'transfer.route.relayed':
    'Přímé spojení nešlo, přenos jde přes veřejný přenosový server {host} (v síti IPv6 {host6}). Ten vidí velikost a čas, obsah ne - je zašifrovaný ještě před odesláním.',
  'transfer.got.title': 'Přijato z druhého telefonu',
  'transfer.got.body': 'Záloha z {when}, {size}. Uložit do archivu tohoto telefonu?',
  'transfer.got.confirm': 'Uložit do archivu',
  'transfer.got.tooNew':
    'Tuto zálohu vytvořila novější verze aplikace. Aktualizujte aplikaci a zkuste to znovu.',
  'transfer.got.unsupported': 'Tuto zálohu tato verze aplikace otevřít neumí.',
  // US1. Schránky, zprávy a přílohy ve stejném pořadí, v jakém je ukázal telefon, který odesílal.
  'transfer.done': 'Obnoveno: {what}.',
  // Přílohy, které záloha jmenuje a které se nepodařilo zapsat - spočítané a řečené, ne tiše vynechané.
  'transfer.done.missing.one': '1 přílohu se nepodařilo obnovit.',
  'transfer.done.missing.few': '{n} přílohy se nepodařilo obnovit.',
  'transfer.done.missing.many': '{n} příloh se nepodařilo obnovit.',
  // FR-011. Přihlašovací údaje se nepřenášejí a nikdy se nepřenášely; po obnovení se do schránek
  // přihlásíte znovu. Řečeno tady, protože tady je člověk, který si myslí, že je hotovo.
  'transfer.done.signIn': 'Do schránek se ještě budete muset přihlásit.',
  // Archiv je uložený, jen heslo k záloze, které přišlo s ním, se uložit nepodařilo (třeba odmítnutá
  // výzva k zámku obrazovky). Řečeno, jinak by člověk věřil, že nový telefon zálohuje.
  'transfer.done.keyNotSaved':
    'Heslo k záloze se do tohoto telefonu nepodařilo uložit. Zkontrolujte to na obrazovce Záloha archivu.',
  // Jak dopadlo uložení přenosu, když při jeho konci nebyla otevřená obrazovka přenosu. Řekne to
  // obrazovka zálohy, jakmile je na očích - jinak by to neřekl nikdo.
  'transfer.outcome.title': 'Přenos z druhého telefonu',
  'transfer.error.phrase': 'Heslo nesouhlasí. Nechte si na druhém telefonu ukázat nové.',
  'transfer.error.failed': 'Přenos se nepodařil dokončit.',
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
  'backup.off.title': 'Vypnout zálohování?',
  'backup.off.body':
    'Telefon zapomene heslo k záloze. Zálohy zůstanou uložené, ale bez hesla je neotevřete.',
  'backup.off.confirm': 'Vypnout',
  'backup.off.failed': 'Zálohování se nepodařilo vypnout. Zkuste to znovu.',
  'backup.error': 'Zálohu se nepodařilo vytvořit.',
  'backup.noLock.title': 'Telefon nemá zámek obrazovky',
  'backup.noLock.body':
    'Heslo k záloze je chráněné zámkem telefonu. Nastavte si PIN, gesto nebo otisk prstu a pak zálohování zapněte.',
  // …and the card the scan produces. `scan.found` is phrased as an OFFER, never as a statement of
  // fact: everything else on the detail screen is something ISDS asserted, this is the one line the
  // app inferred, and the wording has to carry that difference on its own.
  'scan.running': 'Hledám v příloze termín…',
  'scan.found': 'Nalezený termín: {d}',
  'scan.from': '„{q}“ · {f}',
  'scan.disclaimer':
    'Odhad z dokumentu, vytvořený ve vašem telefonu. Ověřte si ho v dokumentu. Nejde o údaj od datové schránky.',
  'scan.accept': 'Uložit jako připomínku',
  'scan.dismiss': 'Skrýt',
  // 019 - why a primary action is refusing. Short: it is spoken by a screen reader and read at a
  // glance by someone who has just been shaken at.
  'login.needPassword': 'Nejdřív zadejte heslo',
  'login.needLoginName': 'Nejdřív zadejte přihlašovací jméno',
  'login.needCode': 'Nejdřív zadejte kód',
  'login.needCommCode': 'Nejdřív zadejte komunikační kód',
  // The SENT rail's first two steps read one ISDS field twice - there is no separate submission time.
  'sent.merged': 'Odesláno a dodáno',
  'sent.merged.note': 'ISDS uvádí pro odeslání i dodání jediný čas.',
  'recv.head.fiction': 'Doručenka · fikcí',
  'recv.merged': 'Dodáno a doručeno',
  'recv.merged.note':
    'Schránka byla v tu chvíli přihlášená, zpráva se doručila hned po dodání.',
  // The design wrote this as "…stát čas nepředává". Changed after a device read-through: on a message
  // from Česká pošta, "stát" is read as the SENDER, and the sentence then looks false. The claim was
  // never about who wrote to you - it is about what the ISDS system reports, which is nothing.
  'recv.read.note': 'Přečteno, bez právního významu. ISDS čas přečtení neuvádí.',
  'recv.fiction.note':
    'Deset dní se do schránky nikdo nepřihlásil, doručil ji zákon.',
  'status.note.vault': 'Uloženo v Datovém trezoru',
  'status.notPickedUp': 'Adresát dosud nepřevzal',
  'status.fikce.running': 'lhůta už běží',
  'status.fikce.today': 'fikce dnes',
  'status.fikce.in.one': 'fikce za {n} den',
  'status.fikce.in.few': 'fikce za {n} dny',
  'status.fikce.in.many': 'fikce za {n} dní',
  'messages.compose': 'Napsat',
  'detail.title': 'Zpráva',
  'detail.loading': 'Stahování zprávy…',
  'detail.noSubject': '(bez předmětu)',
  'detail.from': 'Odesílatel',
  'detail.to': 'Komu',
  'detail.delivered': 'Dodáno',
  'detail.accepted': 'Doručeno',
  'detail.deliveryStatus': 'Stav doručení',
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
  'detail.attachments.fullSaved': 'Celá zpráva uložena v archivu',
  'detail.attachments.partlySaved': 'Zpráva v archivu · některé přílohy chybí',
  'detail.attachments.downloading': 'Stahování…',
  'detail.attachments.redownload': 'Stáhnout znovu',
  'detail.attachments.someMissing':
    'Některé přílohy už nejsou uložené na zařízení.',
  'detail.attachments.unavailable.title': 'Příloha už není dostupná',
  'detail.attachments.unavailable.body':
    'Zpráva už není v ISDS k dispozici (po uplynutí lhůty byla odstraněna), takže přílohy nelze znovu stáhnout.',
  'detail.attachment.savedOffline': 'Uloženo offline',
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
  'detail.original.stored': 'Podepsaný originál (ZFO)',
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
  'settings.title': 'Nastavení',
  'settings.appearance': 'Vzhled',
  'settings.theme.light': 'Světlý',
  'settings.theme.dark': 'Tmavý',
  'settings.theme.system': 'Podle systému',
  'settings.language': 'Jazyk',
  'settings.security': 'Zabezpečení',
  'settings.lock': 'Zámek aplikace',
  'settings.lock.desc':
    'Odemykat otiskem prstu, obličejem nebo kódem zařízení.',
  'settings.about': 'O aplikaci',
  'settings.faq': 'Časté dotazy',
  'settings.licences': 'Licence',
  'settings.sourceCode': 'Zdrojový kód',
  'settings.privacy': 'Zásady ochrany osobních údajů',
  'faq.title': 'Časté dotazy',
  'faq.group.app': 'Aplikace',
  'faq.group.isds': 'Datové schránky',
  'faq.help': 'Nápověda',
  'licences.title': 'Licence',
  'licences.appName': 'Obálka',
  'licences.appSpdx': 'Licence MIT',
  'licences.copyright': '© 2026 Přispěvatelé projektu Obálka',
  'licences.searchPlaceholder': 'Hledat komponentu nebo licenci',
  'licences.noResults': 'Nic odpovídajícího jsme nenašli.',
  'licences.bundled': 'Vestavěné komponenty',
  'licences.bundled.desc':
    'Písma a nativní knihovny zabudované přímo do aplikace.',
  'licences.thirdParty': 'Komponenty třetích stran',
  // Counted, not interpolated: two licence groups hold exactly one component, and the screen was
  // rendering "1 komponent". Czech changes form at 1, at 2–4 and again at 5+, and so does the
  // quantifier in "Zobrazit všechny 3" vs "Zobrazit všech 174".
  'licences.count.one': 'Celkem 1 komponenta.',
  'licences.count.few': 'Celkem {n} komponenty.',
  'licences.count.many': 'Celkem {n} komponent.',
  'licences.groupCount.one': '1 komponenta',
  'licences.groupCount.few': '{n} komponenty',
  'licences.groupCount.many': '{n} komponent',
  'licences.showAll.one': 'Zobrazit ji',
  'licences.showAll.few': 'Zobrazit všechny {n}',
  'licences.showAll.many': 'Zobrazit všech {n}',
  'licences.fullText': 'Úplné znění licence',
  'settings.version': 'Verze',
  'lock.prompt': 'Odemknout Obálku',
  'lock.subtitle': 'Aplikace je uzamčena. Pro pokračování ji odemkněte.',
  'lock.unlock': 'Odemknout',
  'lock.failed': 'Ověření se nezdařilo. Zkuste to znovu.',
  // The phone has no screen lock, so the key protecting saved passwords cannot sit behind one (001
  // T028). One line: it shares the fixed-height failure slot on the lock screen.
  'lock.noScreenLock': 'Nastavte v telefonu zámek obrazovky.',
  // The key behind the lock kept failing to read on a phone error that is not a cancel, so "try
  // again" alone would be a loop (001 T028). One line, in the same slot. The link takes the hint's
  // slot and opens the confirmation: a new key, so each box signs in again, and the archive stays.
  'lock.keyUnreadable': 'Klíč zámku se nedaří načíst.',
  'lock.reset.link': 'Nastavit zámek znovu',
  'lock.reset.title': 'Nastavit zámek znovu?',
  'lock.reset.body':
    'Telefon opakovaně odmítl vydat klíč, kterým Obálka chrání uložená hesla a přihlášení. Když zámek nastavíte znovu, vznikne nový klíč a ke každé schránce se znovu přihlásíte. Archiv zpráv zůstane beze změny.',
  'lock.reset.confirm': 'Nastavit znovu',
  'lock.title': 'Odemknout Obálku',
  'lock.hint': 'Otisk prstu · obličej · kód zařízení',
  'lock.unavailable.title': 'Biometrika není k dispozici',
  'lock.unavailable.body':
    'Na tomto zařízení není nastaven otisk prstu, obličej ani kód zařízení. Nastavte je v systému a zkuste to znovu.',
  // Switching the lock off moves the vault key back to its unguarded place (001 T028). When the
  // Keychain refuses, the lock stays on - said in words, because a switch that springs back alone
  // looks like a tap that did not register.
  'lock.disableFailed.title': 'Zámek zůstal zapnutý',
  'lock.disableFailed.body':
    'Zámek aplikace se teď nepodařilo vypnout. Zkuste to prosím znovu.',
  // The phone invalidated the vault key, so every saved password and sign-in stopped opening at once
  // and each box asks to sign in again (001 T028). Said once, plainly, with the archive reassurance.
  'vault.lost.title': 'Přihlaste se znovu ke schránkám',
  'vault.lost.body':
    'Telefon zneplatnil klíč, kterým Obálka chránila uložená hesla a přihlášení, například po vypnutí zámku obrazovky. Archiv zpráv zůstal beze změny. Ke každé schránce se jen znovu přihlaste.',
  'search.title': 'Hledat',
  'search.placeholder': 'Hledat v archivu zpráv',
  'search.hint':
    'Prohledejte celý uložený archiv, napříč schránkami, i offline.',
  'search.noResults': 'Nic nenalezeno',
  'search.count.one': '{n} výsledek',
  'search.count.few': '{n} výsledky',
  'search.count.many': '{n} výsledků',
  // The query is capped. Stating the cap as a total told the user the archive held 100 matches when
  // it held more - under a hint promising the whole archive had been searched.
  'search.count.capped': 'prvních {n} výsledků · zpřesněte hledání',
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
  // 015 - the recipient's address, and the same-name warning that makes people look at it.
  'recipient.noAddress': 'Adresa neuvedena',
  'recipient.sameName': 'Shodné jméno',
  'recipient.found': 'Nalezeno',
  'recipient.sameNameHint': 'Stejné jméno má víc schránek. Rozliší je adresa.',
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
  'send.sent': 'Zpráva odeslána',
  'send.sent.reconciled':
    'Tato zpráva už byla odeslána při předchozím pokusu. Znovu jsme ji neodesílali ani neúčtovali.',
  'send.sent.id': 'ID zprávy: {id}',
  'send.sent.delivered': 'Dodáno do schránky příjemce · {when}',
  'send.sent.accepted': 'Doručeno · {when}',
  'send.sent.open': 'Zobrazit zprávu v archivu',
  'send.done': 'Hotovo',
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
    'Přihlašovací údaje již nejsou platné. Přihlaste se prosím znovu.',
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
  // The same four, short enough for the chip on a message row. Czech keeps the acronyms because
  // they ARE the everyday words here: FO is read as "fyzická osoba" by anyone who has a data box.
  // English has no such acronym, and "FO" there is just three letters of a foreign language, so it
  // spells the thing out instead (reported from the README screenshots, 2026-09-12).
  'box.type.short.OVM': 'OVM',
  'box.type.short.FO': 'FO',
  'box.type.short.PFO': 'PFO',
  'box.type.short.PO': 'PO',
};

const en: Record<string, string> = {
  ...errorEn,
  'app.name': 'Obálka',
  'app.loadFailed': 'The saved boxes could not be loaded.',
  'app.loadFailed.retry': 'Try again',
  'welcome.tagline': 'Your government mail: clear, secure and stress-free.',
  // Not "from a phone": with the article it is 271dp against the 268 a 360dp phone leaves.
  'welcome.restore': 'Restore from phone or backup',
  'welcome.restore.backupOnly': 'Restore from a backup',
  'restore.title': 'Restore the archive',
  'transfer.receiveFrom': 'Receive from another phone',
  'backup.file.desc.firstRun':
    'Have a backup saved as a file? Load it, then restore it from the list below.',
  'login.title': 'Add a data box',
  'login.environment': 'Environment',
  'login.environment.helpA11y': 'What is the environment?',
  'login.environment.help.production':
    'connects the app to the real ISDS service (datovka.gov.cz): your actual data box ' +
    'and messages.',
  'login.environment.help.czebox':
    'uses the czebox test environment (datovka-test.gov.cz) with separate test boxes and never touches ' +
    'your real data.',
  'login.environment.help.recommend': 'For normal use choose',
  'login.env.production': 'Production',
  'login.env.czebox': 'Test',
  'login.loginName': 'Login name',
  'login.password': 'Password',
  'login.password.show': 'Show password',
  'login.password.hide': 'Hide password',
  'login.alias': 'Box name (optional)',
  'login.alias.placeholder': 'e.g. My person, sole trader…',
  'alias.title': 'Box name',
  'alias.renameTitle': 'Edit box',
  'alias.name': 'Your name for it',
  'alias.color': 'Colour',
  'alias.color.taken': 'A dot means another box already has that colour. You can pick it, but the boxes will be harder to tell apart.',
  'alias.color.option': 'Colour {name}',
  'alias.color.option.taken': 'Colour {name}, already used by another box',
  'boxColor.blue': 'blue',
  'boxColor.teal': 'teal',
  'boxColor.purple': 'purple',
  'boxColor.green': 'green',
  'boxColor.bronze': 'bronze',
  'boxColor.rose': 'rose',
  'boxColor.olive': 'olive',
  'boxColor.rust': 'rust',
  'boxColor.plum': 'plum',
  'boxColor.steel': 'steel',
  'alias.edit': 'Edit box name',
  'alias.save': 'Save',
  'login.method': 'Sign-in method',
  'login.method.password': 'Name and password',
  'login.method.otp_totp': 'Name, password and SMS code',
  'login.method.mobile_key': 'Mobile Key',
  'login.method.choose': 'How do you want to sign in?',
  'login.method.chooseSub': 'Pick the method your box supports.',
  'login.advanced': 'Advanced',
  'login.method.password.name': 'Password',
  'login.method.password.desc': 'Your login name and password.',
  'login.method.otp_totp.name': 'SMS code',
  'login.method.otp_totp.desc': 'Password and a one-time SMS code.',
  'login.method.mobile_key.name': 'Mobile Key',
  'login.method.mobile_key.desc':
    'A communication code from the portal; approve sign-in in the Mobile Key app.',
  'login.commCode': 'Communication code',
  'login.commCode.placeholder': 'Generated code from the portal (not your password)',
  'login.mobileKey.help':
    'First activate Mobile Key and generate a communication code in the ISDS Client Portal (Settings → Login options). After submitting, approve the sign-in in the Mobile Key app.',
  'login.mobileKey.title': 'Confirm sign-in in the Mobile Key app',
  'login.mobileKey.sending': 'Sending request…',
  'login.mobileKey.approve':
    'Switch to the Mobile Key app and approve signing in to the data box.',
  'login.mobileKey.expiryHint': 'The request will expire soon.',
  'login.method.help':
    'Most boxes use just a name and password. Choose the SMS code only if you’ve enabled two-factor (OTP) sign-in for the box.',
  'login.submit': 'Sign in',
  'login.cancel': 'Cancel',
  'login.authenticating': 'Signing in…',
  'login.otp.notice.smsSent': 'We sent you a one-time code by SMS.',
  'login.otp.notice.smsSending': 'Asking for a one-time code…',
  'login.otp.stillSending': 'The code is still being sent',
  'login.otp.verify': 'Verification',
  'login.otp.smsTitle': 'Enter the code from the SMS',
  'login.otp.code': 'One-time code',
  'login.otp.submit': 'Confirm code',
  'login.otp.resend': 'Resend SMS',
  'login.retry': 'Try again',
  'login.otpSuggest.title': 'Have an SMS code?',
  'login.otpSuggest.sub':
    'If your box also requires a one-time SMS code, sign in with the SMS code.',
  'login.otpSuggest.btn': 'Sign in with SMS code',
  'login.loginName.placeholder': 'Username',
  'login.creds.title': 'Sign in',
  'login.method.label.password': 'Sign in with password',
  'login.method.label.otp_totp': 'Sign in with SMS code',
  'login.method.label.mobile_key': 'Sign in with Mobile Key',
  'login.otpSuggested.hint':
    'Signing in with your name and password failed. If this box has SMS one-time-code sign-in ' +
    'enabled, sign in using an SMS code.',
  'login.otpSuggested.useSms': 'Sign in with an SMS code',
  'login.otpSuggested.checkPassword': 'Edit name or password',
  'login.signedIn': 'Signed in',
  'common.back': 'Back',
  'common.cancel': 'Cancel',
  'common.keep': 'Keep',
  'common.ok': 'Got it',
  'common.continue': 'Continue',
  'common.optional': '(optional)',
  'common.undo': 'Undo',
  'home.title': 'Boxes',
  'home.addBox': 'Add a data box',
  'home.refreshAll': 'Refresh all boxes',
  'home.settings': 'Settings',
  'home.menu': 'Menu',
  'box.testEnv': 'Test',
  'testEnv.banner': 'Test environment',
  'box.idLabel': 'Box ID',
  'box.loginLabel': 'Login name',
  'box.remove': 'Remove',
  'box.menu': 'Box options',
  'box.rename': 'Edit box',
  'box.removeTitle': 'Remove box?',
  'box.removeMessage':
    'This removes the box, its saved credentials and its local archive (downloaded messages, ' +
    'attachments and reminders) from this device. ' +
    'Nothing changes in ISDS; but anything older than 90 days is no longer there either.',
  'box.remove.delete': 'Delete',
  'box.remove.keep': 'Keep',
  // See the Czech block.
  'box.removeFailed.title': 'Removing the box did not finish',
  'box.removeFailed.kept':
    'The box is still in the app, with all of its data. Try removing it again.',
  'box.removeFailed.incomplete':
    'The box is no longer in the app, but some of its data could not be deleted from this device. ' +
    'The app will try again by itself, or you can try now.',
  'box.removeFailed.unknown':
    'The app could not tell what is left of the box on this device. Try again.',
  'box.removeFailed.retry': 'Try again',
  'box.removeFailed.close': 'Close',
  'box.aliasFailed.title': 'The new box name could not be saved',
  'box.aliasFailed.body': 'The box keeps its current name for now. Try again.',
  'box.aliasFailed.retry': 'Try again',
  'box.aliasFailed.close': 'Close',
  'box.passwordExpires': 'Password valid until',
  'box.lastSynced': 'Refreshed',
  'box.neverSynced': 'Not refreshed yet',
  'box.syncedJustNow': 'just now',
  'box.synced.minutes': '{n} min ago',
  'box.synced.hours': '{n} h ago',
  'box.messages.one': '{n} message',
  'box.messages.other': '{n} messages',
  'box.refreshing': 'Refreshing…',
  'box.credit': 'Credit: {czk} CZK',
  'box.sync.failed': 'Synchronization failed.',
  'box.sync.retry': 'Try again',
  'pwd.expired': 'Your password has expired.',
  'pwd.today': 'Your password expires today.',
  'pwd.soon': 'Your password expires on {d}',
  'pwd.action': 'Change it in the portal',
  'box.reauth.session': 'Your sign-in has expired.',
  'box.reauth.credentials': 'The sign-in credentials are no longer valid.',
  // See the Czech block.
  'box.reauth.passwordExpired':
    'Your password has expired. Change it in the ISDS portal, then sign in with the new one.',
  'box.reauth.action': 'Sign in again',
  // See the Czech block.
  'box.sync.reauth': 'Sign-in expired',
  'box.sync.passwordExpired': 'Password expired',
  'box.sync.error': 'Could not refresh',
  'box.sync.stale': 'Last known state',

  // See the Czech block.
  'crossBox.title': 'In your other boxes',
  'crossBox.prefix': 'Elsewhere',
  'crossBox.overdue.one': '{n} past reminder',
  'crossBox.overdue.other': '{n} past reminders',
  'crossBox.due.today': 'reminder today',
  'crossBox.due.tomorrow': 'reminder tomorrow',
  'crossBox.due.in.one': 'reminder in {n} day',
  'crossBox.due.in.other': 'reminder in {n} days',
  // "last known" rather than "when last checked" (2026-09-15): the words of the switcher row's "Last
  // known state", and about a quarter narrower on a line that shows only the clauses that fit. It was
  // the longest clause in either language. ("at last check" reads as the banned "at last", 022.)
  'crossBox.lastKnown.one': '{n} unread, last known',
  'crossBox.lastKnown.other': '{n} unread, last known',
  'crossBox.unreachable.one': '{n} not refreshed',
  'crossBox.unreachable.other': '{n} not refreshed',
  'crossBox.refreshing': 'refreshing…',
  'crossBox.notShown': '+{n}',

  // See the Czech block.
  'unified.title': 'All boxes',
  'unified.subtitle.one': '{n} box',
  'unified.subtitle.other': '{n} boxes',
  'unified.kind': 'Merged archive',
  'unified.empty': 'No messages yet',
  'unified.empty.hint': 'Once your boxes have loaded, you will see their messages together here.',
  'unified.missing.one': '{n} box could not be refreshed',
  'unified.missing.other': '{n} boxes could not be refreshed',
  'reauth.title': 'Sign in again',
  'reauth.intro': 'Your sign-in to this box has expired. Please sign in again.',
  'reauth.intro.credentials':
    'Your sign-in details for this box are no longer valid. Please enter them again. The ISDS password changes every 90 days.',
  'reauth.intro.passwordExpired':
    'ISDS is refusing the password for this box, and by the date it gave at the last sign-in, that password has expired. Change it in the ISDS portal first, then enter the new password here.',
  'reauth.error': 'Sign-in failed. Check your details and try again.',
  'reauth.expiredStrip': 'Session expired',
  'reauth.submit': 'Sign in',
  'messages.title': 'Received messages',
  'messages.empty': 'No received messages.',
  'messages.empty.hint': "When someone sends you a message, it'll appear here.",
  'messages.segment.received': 'Received',
  'messages.segment.sent': 'Sent',
  'messages.sent.empty': 'No sent messages.',
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
    'Your sign-in details are no longer valid. Please sign in again.',
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
  'messages.synced.now': 'Updated just now',
  'messages.synced.min.one': 'Updated {n} minute ago',
  'messages.synced.min.other': 'Updated {n} minutes ago',
  'messages.synced.at': 'Updated at {d}',
  'messages.synced.on': 'Updated {d}',
  'messages.synced.never': 'Not yet updated',
  'search.hint.title': 'Search the archive',
  'settings.diagnostics': 'DIAGNOSTICS',
  'settings.telemetry.title': 'Send error reports',
  'settings.telemetry.desc':
    'On. When the app hits an error we send a technical description: where it happened, what kind of error it was, and what the data box answered. Never message contents, names, box IDs or attachments.',
  'settings.telemetry.desc.off':
    'Off. Nothing is sent. Turned on, we send a technical description of an error: never message contents, names, box IDs or attachments.',

  // 023 - see the Czech block for why this sits here.
  // See the Czech block.
  'consent.title': 'May we send error reports?',
  'consent.intro':
    'When the app hits an error it can send a technical description of it. Without that we do not find out, and it does not get fixed.',
  'consent.sends': 'Sent: where the error happened, what kind it was, the data box error code, the HTTP code, and the app and system versions.',
  'consent.never': 'Never sent: message contents, subjects, names, box IDs, sign-in details, attachments or document text.',
  'consent.where': 'Reports go to Sentry, on servers in the EU. They are read by the developer of this app.',
  'consent.change': 'You can change this any time in Settings.',
  'consent.yes': 'Send reports',
  'consent.no': 'Do not send',
  'consent.more': 'What exactly gets sent?',

  'settings.debug': 'Debug mode',
  'settings.debug.row.desc':
    'Records a technical trail to a file on your phone. Nothing is sent anywhere; you share the file yourself.',
  'debug.title': 'Debug mode',
  'debug.intro':
    'When an error report is not enough, the app records a detailed technical trail and saves it as a ZIP file on your phone. You can open it and read it. It does not send itself: you share it, with whoever you choose, when you choose.',
  'debug.level': 'What gets recorded',
  'debug.level.standard': 'Without message contents',
  'debug.level.standard.desc':
    'Operations, timings, status codes and error messages. No message text, attachments, names or box IDs.',
  'debug.level.full': 'Including the ISDS traffic',
  'debug.level.full.desc':
    'Also what was sent and received, so your message text is in it. Choose this only when the bug cannot be found without it, and share it only with someone you trust.',
  'debug.creds':
    'Passwords, sign-in details and the recovery key are never recorded, not even in detailed mode.',
  'debug.start': 'Start recording',
  'debug.stop': 'Stop and save',
  'debug.discard': 'Discard recording',
  'debug.recording': 'Recording',
  'debug.recording.entries.one': '1 entry',
  'debug.recording.entries.other': '{n} entries',
  'debug.recording.hint':
    'Do the thing that is not working, then stop the recording. Debug mode also switches itself off when the app restarts.',
  'debug.saved': 'Saved files',
  'debug.saved.empty': 'Nothing here yet.',
  'debug.saved.error': 'The saved files could not be read.',
  'debug.saved.errorAgain': 'The saved files could not be read on attempt {n} either.',
  'debug.saved.retry': 'Try again',
  'debug.saved.sizeUnknown': 'Size could not be read',
  'debug.share': 'Share',
  'debug.shareTitle': 'Share the debug file',
  'debug.delete': 'Delete',
  'debug.deleteAll': 'Delete all',
  'debug.deleted': 'Deleted',
  'debug.savedNotice': 'Saved: {name}',
  'debug.error': 'The recording could not be saved.',
  'debug.shareError': 'The share sheet could not be opened.',
  'debug.deleteError': 'The file could not be deleted.',
  'debug.saving': 'Saving…',
  'debug.indicator': 'Debug mode is recording',
  'debug.indicator.hint': 'Opens debug mode',
  'faq.explain': 'What does this mean?',
  'messages.reauth.empty': 'Messages are not available yet',
  'messages.reauth.empty.hint':
    'Sign in again above and this box will load. It does not mean the box is empty. We have not been able to look.',
  'messages.attention': 'Needs attention',
  'attn.overdue.one': '{n} past reminder',
  'attn.overdue.other': '{n} past reminders',
  'attn.dated.one': '{n} reminder',
  'attn.dated.other': '{n} reminders',
  'attn.fiction.one': '{n} served by fiction',
  'attn.fiction.other': '{n} served by fiction',
  'attn.unread.one': '{n} unread',
  'attn.unread.other': '{n} unread',
  'attn.more.one': 'and {n} more below',
  'attn.more.other': 'and {n} more below',
  'notif.channel.reminders': 'Reminders',
  'notif.reminder.tomorrow': 'Reminder for tomorrow',
  'notif.reminder.today': 'Reminder for today',
  'notif.hiddenBody': 'Details appear once you unlock',
  'term.action': 'Reminder',
  'term.title': 'Your reminder',
  'term.sub': 'You set it yourself. We will tell you the day before and on the day.',
  'term.sub.onDay': 'You set it yourself. We will tell you on the day.',
  'term.sub.none':
    'You set it yourself. We will save the date, but there is no time left to notify you.',
  'term.sub.silent':
    'You set it yourself. Notifications are off, so you will only see it in the app.',
  'term.alertsOff': 'Notifications are off, so this reminder will not alert you.',
  'term.alertsOff.action': 'Turn on',
  'term.preset.week': 'In a week',
  'term.preset.twoWeeks': 'In 2 weeks',
  'term.preset.endOfMonth': 'End of month',
  'term.custom': 'Custom date',
  'term.custom.earlier': 'A day earlier',
  'term.custom.later': 'A day later',
  'term.save': 'Save',
  'term.remove': 'Remove',
  'term.chip': 'Reminder {d}',
  'term.chip.today': 'Reminder today',
  'term.chip.overdue': 'Reminder passed {d}',
  'term.none': 'Not set',
  'messages.status.sent': 'Sent',
  // --- Delivery states (013) - see the Czech block for the rationale ----------------------------
  'status.byFiction': 'Accepted by fiction',
  'faq.legend.bySignIn': 'Accepted on sign-in',
  'faq.legend.stop': 'Undeliverable, or failed the virus check',
  'status.byFiction.note': 'The recipient never signed in to their box.',
  'status.byFiction.withoutYou': 'without you signing in',
  'status.stop': 'Undeliverable',
  'status.stop.antivirus':
    'The message failed the virus check and was never delivered to anyone. Try sending it again without the offending attachment.',
  'status.stop.undeliverable':
    'The recipient’s box was made invalid. This message will never be delivered. Use another route.',
  'status.note.erased': 'Contents erased at the state',
  'recv.head': 'Delivery record',
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
  'settings.autoDownload.ask.title': 'Download documents automatically?',
  'settings.autoDownload.ask.new': 'New messages only',
  'settings.autoDownload.ask.new.desc': 'Messages that arrive from now on',
  'settings.autoDownload.ask.all': 'Also messages already on the phone',
  'settings.autoDownload.ask.all.desc': 'Missing documents are fetched on the next refresh',
  'settings.autoDownload.ask.body':
    'When you refresh the box, the documents of received and sent messages that are not on the phone are downloaded. This does not deliver a message or mark it read: listing it already delivered it. Documents take up space on the phone, and each is downloaded only once.',
  'settings.autoDownload.ask.confirm': 'Turn on',
  'backup': 'Archive backup',
  'backup.on': 'On',
  'backup.off': 'Off',
  'backup.toggle': 'Back up the archive',
  'backup.loading': 'Checking backup status…',
  'backup.toggle.desc':
    'The archive backs itself up after every refresh, encrypted, on this phone. Keep a copy elsewhere too: a lost phone takes both with it.',
  'backup.toggle.desc.manual':
    'An encrypted backup of the archive, on this phone. Automatic backups are off. Use the button to make one.',
  'backup.toggle.desc.off':
    'An encrypted backup of your messages and settings. It is saved on this phone, and from there you can keep a copy elsewhere.',
  'backup.row.desc': 'An encrypted backup of your messages and settings, on this phone.',
  'backup.working': 'Working…',
  'backup.stage.reading': 'Reading messages',
  'backup.stage.sealing': 'Encrypting the backup',
  'backup.stage.writing': 'Saving the backup',
  'backup.stage.fetching': 'Downloading the backup',
  'backup.stage.opening': 'Decrypting the backup',
  'backup.stage.restoring': 'Restoring records',
  'backup.stage.documents': 'Backing up documents',
  'backup.stage.downloading': 'Downloading missing documents',
  'backup.stage.documents.restore': 'Restoring documents',
  'backup.progress.count': '{done} of {total}',
  'backup.progress.percent': '{percent}%',
  'backup.leave.title': 'The backup is still running',
  'backup.leave.title.restore': 'The restore is still running',
  'backup.leave.title.verify': 'The backup is still being verified',
  'backup.leave.body': 'Leave it running in the background, or cancel it?',
  'backup.leave.body.verify': 'Leave the check running in the background, or cancel it?',
  'backup.leave.background': 'Keep it running',
  'backup.leave.cancel': 'Cancel the backup',
  'backup.leave.cancel.restore': 'Cancel the restore',
  'backup.leave.cancel.verify': 'Cancel the check',
  'backup.leave.stay': 'Stay here',
  'backup.leave.notStopped': 'The restore can no longer be stopped, so it will finish in the background.',
  'backup.cancelled': 'The backup was cancelled.',
  'backup.now': 'Back up now',
  'backup.last': 'Last {when} · {size}',
  'backup.last.documents': 'Last {when} · {size} + {docSize} of documents',
  'backup.size.documents': '{size} + {docSize} of documents',
  'backup.never': 'Not backed up yet',
  'backup.scope': 'What the backup holds',
  'backup.scope.desc':
    'Your messages and their status, drafts, reminders and app settings. Downloaded attachments and sign-in details are not in it. You sign in to the data box again after restoring.',
  'backup.scope.desc.documents':
    'Your messages and their status, drafts, reminders, app settings and your downloaded documents. Sign-in details are not in it - you sign in to the data box again after restoring.',
  'backup.docs.title': 'Back up documents too',
  'backup.docs.desc.off':
    'The backup knows a message had an attachment, but the file itself is not in it. On a new phone you download the documents again - if ISDS still has them.',
  'backup.docs.desc.on.downloaded':
    'The documents downloaded to this phone are backed up. Each file is stored once, so later backups are smaller.',
  'backup.docs.desc.on.all':
    'Missing documents are downloaded when you back up and whenever you refresh the box.',
  'backup.docs.measuring': 'Working out what the documents weigh…',
  'backup.docs.which': 'Which documents',
  'backup.docs.change': 'Change',
  'backup.docs.ask.title': 'Back up documents too?',
  'backup.docs.change.title': 'Which documents to back up?',
  'backup.docs.mode.downloaded': 'Only downloaded documents',
  'backup.docs.mode.downloaded.count': '{count}, about {size}',
  'backup.docs.mode.downloaded.none': 'No documents downloaded yet',
  'backup.docs.mode.downloaded.explain':
    'What you download later is added to the next backup. Each file is stored once.',
  'backup.docs.mode.all': 'Download and back up all of them',
  'backup.docs.mode.all.count.one': 'Missing for 1 message',
  'backup.docs.mode.all.count.other': 'Missing for {n} messages',
  'backup.docs.mode.all.complete': 'Every document is on the phone already',
  'backup.docs.mode.all.explain':
    'Missing documents of received and sent messages are downloaded when you back up with the button and whenever you refresh the box, never on their own. This does not deliver a message or mark it read: listing it already delivered it.',
  'backup.docs.mode.all.gone.one': 'ISDS has already deleted the documents of 1 message, so they cannot be downloaded.',
  'backup.docs.mode.all.gone.other': 'ISDS has already deleted the documents of {n} messages, so they cannot be downloaded.',
  'backup.docs.mode.all.wifi':
    'Refreshes follow the “Wi-Fi only” choice in Settings → Documents.',
  'backup.docs.ask.confirm': 'Turn on',
  'backup.docs.ask.save': 'Save',
  'backup.docs.chip.none': 'No documents',
  'backup.docs.chip.downloaded': 'Downloaded only',
  'backup.docs.chip.all': 'All documents',
  'backup.docs.missing.one': 'documents missing for 1 message',
  'backup.docs.missing.other': 'documents missing for {n} messages',
  'backup.count.files.one': '1 file',
  'backup.count.files.other': '{n} files',
  'backup.auto':
    'A backup is made shortly after every refresh of the box. The button above makes one right now.',
  'backup.auto.off':
    'Automatic backups are off. Use the button above to make one; you can switch them back on under Advanced.',
  'backup.where': 'Backups are saved on this phone. Saving to the cloud is not built yet.',
  'backup.how': 'How the backup is encrypted',
  'backup.key': 'Backup password',
  'backup.key.desc':
    'Without this password nobody can open the backup, including us. Keep a copy off the phone.',
  'backup.key.show': 'Show password',
  'backup.key.hide': 'Hide password',
  'backup.key.qr': 'Show QR code',
  'backup.key.qr.hide': 'Hide QR code',
  'backup.key.qr.hint': 'Scan this code on the other phone when restoring.',
  'backup.key.qr.label': 'QR code holding the backup password',
  'backup.prompt.reveal': 'Show the backup password',
  'backup.prompt.enable': 'Save the backup password',
  'backup.prompt.backup': 'Back up the archive',
  'backup.advanced': 'Advanced',
  'backup.keep.title': 'Keep more than one backup',
  'backup.keep.desc':
    'By default only the newest backup is kept. Every extra one is a whole copy of the archive. With this on, the last few are kept and the oldest is deleted.',
  'backup.keep.count': 'Backups kept',
  'backup.auto.title': 'Back up automatically',
  'backup.auto.desc': 'Shortly after every refresh of the box. With this off, backups happen when you press the button.',
  'backup.delete': 'Delete',
  'backup.prune.title': 'Delete the oldest backups?',
  'backup.prune.body': '{deleted}; {kept}.',
  'backup.prune.deleted.one':
    'The oldest backup will be deleted right away and cannot be restored',
  'backup.prune.deleted.other':
    'The {n} oldest backups will be deleted right away and cannot be restored',
  'backup.prune.kept.one': 'only the newest one will be kept',
  'backup.prune.kept.other': 'the {n} newest will be kept',
  'backup.prune.held.one': 'The backup holding documents that could not be restored stays as well.',
  'backup.prune.held.other': 'The {n} backups holding documents that could not be restored stay as well.',
  'backup.prune.confirm': 'Lower and delete',
  'backup.delete.title': 'Delete this backup?',
  'backup.delete.body': 'This backup will not be restorable. The others stay.',
  'backup.delete.body.held':
    'This backup holds documents that could not be restored to this phone. Once it is deleted, they cannot be restored.',
  'backup.deleted': 'The backup was deleted.',
  'backup.delete.failed': 'The backup could not be deleted. Please try again.',
  'backup.prefs.failed': 'The backup setting could not be saved. Please try again.',
  'backup.prune.failed':
    'The older backups could not be deleted just now. The app will try again after the next backup.',
  'backup.restore': 'Restore from a backup',
  'backup.restore.none': 'There is no backup here yet.',
  'backup.file': 'Backup as a file',
  'backup.file.desc':
    'A backup on this phone disappears with the phone. Keep a copy elsewhere: the file is encrypted with the same password.',
  'backup.file.export': 'Save backup to a file',
  'backup.file.import': 'Load a backup from a file',
  'backup.file.exported': 'Backup saved.',
  'backup.file.imported': 'Backup loaded. It is in the list below.',
  'backup.file.importFailed': 'That file could not be read.',
  'backup.verify': 'Verify backup',
  'backup.verify.busy': 'Verifying the backup…',
  'backup.verify.ok': 'The backup is sound: {boxes}, {messages}.',
  'backup.verify.failed':
    'The backup could not be opened. It is either damaged, or the password does not match it.',
  'backup.restore.tooNew': 'Made by a newer version of the app. Update the app.',
  'backup.restore.unsupported': 'This version of the app cannot read that backup.',
  'backup.restore.held': 'Not deleted automatically: it holds documents that could not be restored from it.',
  'backup.restore.outcome.title': 'The restore from a backup',
  'backup.restore.key.placeholder': 'Backup password',
  'backup.restore.useStored': 'Use the password from this phone',
  'backup.restore.scan': 'Scan the password from a QR code',
  'backup.restore.scan.hint': 'Point at the QR code with the backup password',
  'backup.restore.start': 'Restore',
  'backup.restore.badKey': 'The password is 20 characters, as XXXX-XXXX-XXXX-XXXX-XXXX.',
  'backup.restore.failed': 'The backup could not be opened. Check the password.',
  'backup.restore.error': 'The backup could not be restored. Please try again.',
  'backup.restore.error.held':
    'The backup you restored from will not be deleted automatically until a restore from it brings everything back, or you delete it.',
  'backup.restored': 'Restored {messages} from {boxes}.',
  'backup.restored.documents': 'Restored {messages} from {boxes}, and {files}.',
  // Documents the backup names but this copy does not carry - typically a backup exported to a file,
  // which holds the archive rather than the documents. Counted and said, never quietly dropped.
  'backup.restored.someMissing.one': '1 document could not be restored.',
  'backup.restored.someMissing.other': '{n} documents could not be restored.',
  'backup.restored.held':
    'So the backup you restored from will not be deleted automatically until a restore from it brings everything back, or you delete it.',
  'backup.restored.keyNotSaved':
    'The backup password could not be saved on this phone, though, so it is not backing up yet.',
  'backup.count.messages.one': '1 message',
  'backup.count.messages.other': '{n} messages',
  'backup.count.boxes.one': '1 box',
  'backup.count.boxes.other': '{n} boxes',
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
  'transfer.phrase.placeholder': 'Password from the other phone',
  'transfer.metered.title': 'You are on mobile data',
  'transfer.metered.body':
    'The transfer is {size}. On mobile data that may cost you something. Continue?',
  'transfer.metered.confirm': 'Transfer anyway',
  'transfer.scan': 'Scan the code with the camera',
  'transfer.scan.hint': 'Point at the code on the other phone',
  'transfer.scan.denied':
    'Without camera access the code cannot be scanned. You can type the password instead - it works just the same.',
  'transfer.scan.noCamera':
    'This phone has no usable camera. Type the password instead - it works just the same.',
  'transfer.start': 'Receive',
  'transfer.cancel': 'Cancel the transfer',
  'transfer.stage.preparing': 'Getting ready to send…',
  'transfer.stage.preparing.count': 'Getting the documents ready: {done} of {total}',
  'transfer.stage.connecting': 'Connecting',
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
  'transfer.got.tooNew':
    'This backup was made by a newer version of the app. Update the app and try again.',
  'transfer.got.unsupported': 'This version of the app cannot open this backup.',
  'transfer.done': 'Restored {what}.',
  'transfer.done.missing.one': '1 document could not be restored.',
  'transfer.done.missing.other': '{n} documents could not be restored.',
  'transfer.done.signIn': 'You still need to sign in to the data boxes.',
  'transfer.done.keyNotSaved':
    'The backup password could not be saved on this phone. Check it on the Archive backup screen.',
  'transfer.outcome.title': 'The transfer from the other phone',
  'transfer.error.phrase': 'That password does not match. Ask the other phone for a fresh one.',
  'transfer.error.failed': 'The transfer could not be completed.',
  'transfer.error.busy':
    'The previous transfer is still being saved to the archive. Wait until it finishes, then try again.',
  'transfer.stopped.background':
    'The transfer stopped because you left the app or the screen went off - it does not run in the background. Start it again with a fresh password and keep the app open and the screen on until it finishes.',
  'transfer.unavailable': 'This version of the app cannot transfer between phones.',
  'backup.off.title': 'Turn backups off?',
  'backup.off.body':
    'This phone will forget the backup password. The backups stay where they are, but without the password you cannot open them.',
  'backup.off.confirm': 'Turn off',
  'backup.off.failed': 'Backups could not be turned off. Please try again.',
  'backup.error': 'The backup could not be created.',
  'backup.noLock.title': 'This phone has no screen lock',
  'backup.noLock.body':
    'The backup password is kept behind the phone\'s lock. Set a PIN, pattern or fingerprint, then turn backups on.',
  'scan.running': 'Looking for a deadline in the attachment…',
  'scan.found': 'Deadline found: {d}',
  'scan.from': '“{q}” · {f}',
  'scan.disclaimer':
    'An estimate made from the document on your phone. Check it against the document. This did not come from the data box.',
  'scan.accept': 'Save as reminder',
  'scan.dismiss': 'Hide',
  'login.needPassword': 'Enter your password first',
  'login.needLoginName': 'Enter your login name first',
  'login.needCode': 'Enter the code first',
  'login.needCommCode': 'Enter your communication code first',
  'sent.merged': 'Sent and delivered',
  'sent.merged.note': 'ISDS reports a single time for both.',
  'recv.head.fiction': 'Delivery record · by fiction',
  'recv.merged': 'Delivered and accepted',
  'recv.merged.note':
    'The box was signed in at that moment, so the message was accepted as soon as it arrived.',
  'recv.read.note':
    'Opened, no legal significance. ISDS does not report when.',
  'recv.fiction.note': 'Nobody signed in for ten days, so the law accepted it.',
  'status.note.vault': 'Kept in the Data Vault',
  'status.notPickedUp': 'Recipient hasn’t signed for it',
  'status.fikce.running': 'the deadline is already running',
  'status.fikce.today': 'fiction today',
  'status.fikce.in.one': 'fiction in {n} day',
  'status.fikce.in.other': 'fiction in {n} days',
  'messages.compose': 'Compose',
  'detail.title': 'Message',
  'detail.loading': 'Downloading message…',
  'detail.noSubject': '(no subject)',
  'detail.from': 'Sender',
  'detail.to': 'To',
  'detail.delivered': 'Delivered',
  'detail.accepted': 'Accepted',
  'detail.deliveryStatus': 'Delivery status',
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
  'detail.attachments.fullSaved': 'Full message saved to the archive',
  'detail.attachments.partlySaved': 'Message in the archive · some attachments are missing',
  'detail.attachments.downloading': 'Downloading…',
  'detail.attachments.redownload': 'Download again',
  'detail.attachments.someMissing':
    'Some attachments are no longer stored on this device.',
  'detail.attachments.unavailable.title': 'Attachment no longer available',
  'detail.attachments.unavailable.body':
    'The message is no longer in ISDS (removed after its retention period), so the attachments can’t be downloaded again.',
  'detail.attachment.savedOffline': 'Saved offline',
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
  'detail.original.stored': 'Signed original (ZFO)',
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
  'settings.title': 'Settings',
  'settings.appearance': 'Appearance',
  'settings.theme.light': 'Light',
  'settings.theme.dark': 'Dark',
  'settings.theme.system': 'System',
  'settings.language': 'Language',
  'settings.security': 'Security',
  'settings.lock': 'App lock',
  'settings.lock.desc': 'Unlock with fingerprint, face, or your device code.',
  'settings.about': 'About',
  'settings.faq': 'FAQ',
  'settings.licences': 'Licences',
  'settings.sourceCode': 'Source code',
  'settings.privacy': 'Privacy policy',
  'faq.title': 'FAQ',
  'faq.group.app': 'The app',
  'faq.group.isds': 'Data boxes',
  'faq.help': 'Help',
  'licences.title': 'Licences',
  'licences.appName': 'Obálka',
  'licences.appSpdx': 'MIT Licence',
  'licences.copyright': '© 2026 The Obálka contributors',
  'licences.searchPlaceholder': 'Search a component or licence',
  'licences.noResults': 'Nothing matched.',
  'licences.bundled': 'Bundled components',
  'licences.bundled.desc':
    'Typefaces and native libraries compiled into the app itself.',
  'licences.thirdParty': 'Third-party components',
  'licences.count.one': '1 component in total.',
  'licences.count.other': '{n} components in total.',
  'licences.groupCount.one': '1 component',
  'licences.groupCount.other': '{n} components',
  'licences.showAll.one': 'Show it',
  'licences.showAll.other': 'Show all {n}',
  'licences.fullText': 'Full licence text',
  'settings.version': 'Version',
  'lock.prompt': 'Unlock Obálka',
  'lock.subtitle': 'The app is locked. Unlock it to continue.',
  'lock.unlock': 'Unlock',
  'lock.failed': 'Authentication failed. Try again.',
  // See the Czech block.
  'lock.noScreenLock': 'Set a screen lock on the phone.',
  // See the Czech block.
  'lock.keyUnreadable': 'The lock\'s key cannot be read.',
  'lock.reset.link': 'Set up the lock again',
  'lock.reset.title': 'Set up the lock again?',
  'lock.reset.body':
    'Your phone keeps refusing the key Obálka uses to protect saved passwords and sign-ins. If you set up the lock again, a new key is made and you sign in to each box again. Your message archive stays as it is.',
  'lock.reset.confirm': 'Set up again',
  'lock.title': 'Unlock Obálka',
  'lock.hint': 'Fingerprint · face · device code',
  'lock.unavailable.title': 'Biometrics unavailable',
  'lock.unavailable.body':
    'This device has no fingerprint, face, or device code set up. Set one up in your system settings and try again.',
  // See the Czech block.
  'lock.disableFailed.title': 'The app lock is still on',
  'lock.disableFailed.body':
    'The app lock could not be turned off just now. Please try again.',
  // See the Czech block.
  'vault.lost.title': 'Sign in to your boxes again',
  'vault.lost.body':
    'Your phone invalidated the key Obálka used to protect saved passwords and sign-ins, for example after the screen lock was turned off. Your message archive is untouched. Just sign in to each box again.',
  'search.title': 'Search',
  'search.placeholder': 'Search the message archive',
  'search.hint':
    'Search your entire saved archive, across boxes, even offline.',
  'search.noResults': 'Nothing found',
  'search.count.one': '{n} result',
  'search.count.other': '{n} results',
  'search.count.capped': 'first {n} results · narrow the search',
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
  'recipient.noAddress': 'No address given',
  'recipient.sameName': 'Same name',
  'recipient.found': 'Found',
  'recipient.sameNameHint':
    'Several boxes share this name. The address tells them apart.',
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
  'send.sent': 'Message sent',
  'send.sent.reconciled':
    'This message was already sent on a previous attempt. We did not re-send or charge again.',
  'send.sent.id': 'Message ID: {id}',
  'send.sent.delivered': 'Delivered to the recipient’s box · {when}',
  'send.sent.accepted': 'Accepted · {when}',
  'send.sent.open': 'Open the message in the archive',
  'send.done': 'Done',
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
    'Your sign-in details are no longer valid. Please sign in again.',
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
  // The SAME words the switcher uses, never synonyms. A first pass here said "Sole trader" and
  // "Company" while the switcher said "Self-employed" and "Legal entity", which is two English
  // vocabularies for one legal form on one box. `boxTypeShort.test.ts` now requires each of these to
  // be a prefix of its `send.dbType.*` label, so the two cannot drift apart again.
  'box.type.short.OVM': 'Authority',
  'box.type.short.FO': 'Individual',
  'box.type.short.PFO': 'Self-employed',
  'box.type.short.PO': 'Legal entity',
};

// One table per language in `LANGUAGES`: the `Record` is what makes a language added to that list
// refuse to build until its table exists here (and its plural rule below).
const MESSAGES: Record<Locale, Record<string, string>> = { cs, en };

/**
 * The raw tables, for tests only.
 *
 * `t()` resolves one key at a time, which cannot answer "does any string in the app boast" (022) or
 * "do both locales define the same keys". Exported rather than re-parsed from source so the guard
 * checks what actually ships.
 */
export const STRINGS_FOR_TEST: Record<Locale, Record<string, string>> = MESSAGES;

// The active UI locale; `t()` reads it live. Written only by the SettingsProvider, when it applies a
// stored language and when one is chosen - never from a render (see `SettingsProvider`).
let activeLocale: Locale = 'cs';
export function setActiveLocale(next: Locale): void {
  activeLocale = next;
}
export function getActiveLocale(): Locale {
  return activeLocale;
}

/**
 * Resolve a UI/error key to localized copy in the active locale; falls back to Czech, then the key
 * (so missing strings are visible). `params` interpolate `{name}` placeholders.
 */
export function t(
  key: string,
  params?: Record<string, string | number>,
): string {
  let s = MESSAGES[activeLocale][key] ?? MESSAGES.cs[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      s = s.split(`{${k}}`).join(String(v));
    }
  }
  return s;
}

type PluralCategory = 'one' | 'few' | 'many' | 'other';
/**
 * Plural rules per locale (cs: one/few/many; en: one/other). A language added to `LANGUAGES` does not
 * build without one: Ukrainian's `few` is not Czech's (21 is `one` there), so borrowing another
 * language's rule would pick the wrong form of every counted string.
 */
const PLURAL_RULES: Record<Locale, (n: number) => PluralCategory> = {
  cs: n => {
    if (n === 1) {
      return 'one';
    }
    if (n >= 2 && n <= 4) {
      return 'few';
    }
    return 'many';
  },
  en: n => (n === 1 ? 'one' : 'other'),
};

/**
 * Plural category for `n` in the ACTIVE locale - use it to pick the matching string key form, e.g.
 * t(`box.messages.${plural(n)}`, { n }). Each locale's string map must define the forms it uses.
 */
export function plural(n: number): PluralCategory {
  return PLURAL_RULES[activeLocale](n);
}
