# App Store listing

The listing as it goes to App Store Connect. `tools/asc.py listing` uploads the blocks below verbatim and
`tools/asc.py listing --dry` compares the store with them, so an edit lands here first. Background and the
keyword rules are in [`docs/aso.md`](../aso.md).

Rules the text keeps:

- **No other platform is named.** App Review rejects an iOS listing that mentions Android (guideline 2.3.10).
- **No other app's name in the keywords** (2.3.7) - so not "Datovka", however often people search it.
- **Project voice**, never "I": "Aplikace…", "vývojáři aplikace" / "the developers".
- **It says it is not official**, near the end: an independent client of the public ISDS interface, not
  from the Digitální a informační agentura, which administers ISDS, or Česká pošta, which operates it
  (as the README and the website say since 2026-11-18).
- Limits: name and subtitle 30 characters, promotional text 170, keywords 100 **bytes** (comma-separated,
  no spaces; a Czech letter with a diacritic takes two), description 4000.

Shared by both languages:

- Primary category **Productivity**, secondary **Business**.
- Support URL: `https://github.com/dorhawk-software/obalka/issues`
- Marketing URL: `https://github.com/dorhawk-software/obalka`
- Privacy policy: `https://github.com/dorhawk-software/obalka/blob/main/PRIVACY.md` (cs),
  `https://github.com/dorhawk-software/obalka/blob/main/PRIVACY.en.md` (en)

## cs

### name
Obálka - datové schránky

### subtitle
Více schránek v jednom seznamu

### promotional text
Osobní, živnostenská i firemní schránka v jednom seznamu. Uvidíte, kdy se zpráva počítá za doručenou a kdy běží lhůta. Pošta zůstává ve vašem telefonu, bez serveru.

### keywords
ISDS,datová,schránka,úřad,doručenka,fikce,podání,OSVČ,eGovernment,pošta,přílohy,zfo

### description
Pošta od státu, která se čte jako pošta.

Obálka je nezávislý klient datových schránek pro ty, kdo jich mají víc. Osobní, živnostenská i firemní schránka jsou v jednom seznamu a u každé zprávy je vidět, kdy se počítá za doručenou: po deseti dnech to platí, i když ji neotevřete, a lhůty běží. Zprávy, přílohy i podepsané originály zůstávají v šifrovaném archivu v telefonu i poté, co je ISDS po 90 dnech smaže.

CO UMÍ
• Sloučená schránka: osobní, živnostenská i firemní schránka v jednom seznamu. Štítek u každé zprávy řekne, kam přišla.
• Lhůty a fikce: sekce Vyžaduje pozornost ukáže běžící desetidenní lhůtu. Když se zpráva počítá za doručenou bez vašeho přihlášení (doručení fikcí), řekne to rovnou.
• Archiv, který nemizí: obálky, přílohy i podepsaný originál (.zfo), který se stahuje spolu s přílohami, zůstávají v telefonu, jak dlouho chcete.
• Doručenka: co se se zprávou stalo a kdy.
• Odesílání: úřadům zdarma, soukromým schránkám jako poštovní datová zpráva s kreditem viditelným předem.
• Hledání napříč všemi schránkami, i bez připojení.
• Přílohy se mohou stahovat samy, volitelně jen na Wi‑Fi. Zpráva přitom zůstane nepřečtená.
• Šifrovaná záloha celého archivu i s přílohami a přenos do nového telefonu jedním kódem nebo QR.
• Světlý i tmavý vzhled, čeština i angličtina.

NIC NA POZADÍ
Už samotné vypsání seznamu zpráv je podle zákona doručení. Obálka se proto ke schránce přihlašuje jen na váš pokyn: nic se nesynchronizuje na pozadí a nic se nedoručí bez vašeho vědomí.

SOUKROMÍ
• Žádný server: aplikace mluví přímo s ISDS. Vaše zprávy, přílohy ani hesla nikam jinam nejdou.
• Volitelný zámek otiskem, obličejem nebo kódem zařízení.
• Zálohu bez vašeho hesla nikdo neotevře, ani vývojáři aplikace.
• Hlášení o chybách jen s vaším souhlasem a nikdy s obsahem zpráv.

PŘIHLÁŠENÍ
Jménem a heslem, SMS kódem nebo Mobilním klíčem. Funguje i s testovacím prostředím ISDS.

Obálka není oficiální aplikace. Není od Digitální a informační agentury, která ISDS spravuje, ani od České pošty, která ho provozuje, a není s nimi nijak spojená; používá veřejné rozhraní ISDS pro aplikace třetích stran. Zdrojový kód je otevřený pod licencí MIT.

## en-US

### name
Obálka - Czech Data Boxes

### subtitle
Every data box in one list

### promotional text
Personal, sole-trader and company boxes in one list. See when a message counts as delivered and when a deadline runs. Your mail stays on your phone, with no server.

### keywords
datová,schránka,datové,schránky,government,official,letters,delivery,receipt,eGovernment,zfo

### description
Mail from the state that reads like mail.

Obálka is an independent client for Czech data boxes (datové schránky), made for people who hold more than one. Personal, sole-trader and company boxes sit in one list, and every message shows when it counts as delivered: after ten days it does, even unopened, and deadlines start running. Messages, attachments and their signed originals stay in an encrypted archive on your phone after ISDS deletes them 90 days after delivery.

WHAT IT DOES
• One inbox: personal, sole-trader and company boxes in a single list. A label on every message says where it arrived.
• Deadlines and deemed delivery: Needs attention shows the running ten-day period. When a message counts as delivered without you signing in (delivery by fiction), it says so plainly.
• An archive that stays: envelopes, attachments and the signed original (.zfo), which downloads together with the attachments, remain on your phone for as long as you want.
• Delivery record: what happened to a message, and when.
• Sending: free to public authorities, and to private boxes as a postal data message with the credit shown up front.
• Search across every box, offline.
• Attachments can download on their own, on Wi‑Fi only if you like. The message stays unread.
• An encrypted backup of the whole archive, attachments included, and a move to a new phone with one code or QR.
• Light and dark appearance, Czech and English.

NOTHING IN THE BACKGROUND
Under Czech law, merely listing your messages counts as delivery. So Obálka signs in to a box only when you ask it to: nothing syncs in the background, and nothing is delivered without you knowing.

PRIVACY
• No server: the app talks to ISDS directly. Your messages, attachments and passwords go nowhere else.
• An optional lock with Face ID, Touch ID or the device passcode.
• Nobody opens a backup without your password, not even the developers.
• Crash reports only with your consent, and never with message content.

SIGNING IN
Username and password, SMS code or Mobile Key. Works with the ISDS test environment too.

Obálka is not an official app. It is not from the Digital and Information Agency, which administers ISDS, or from Česká pošta, which operates it, and is not affiliated with either; it uses the public ISDS interface for third-party applications. The source code is open under the MIT licence.
