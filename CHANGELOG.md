# Co je nového

Co se změnilo v každé verzi Obálky, psáno pro ty, kdo ji používají. Nejnovější verze je nahoře.
In English: [CHANGELOG.en.md](CHANGELOG.en.md).

<!-- Jak tento soubor funguje (spec 029, scripts/changelog.mjs):
     Každá změna, které si uživatel všimne, přibude pod "Unreleased" tady I v CHANGELOG.en.md, ve stejném
     commitu a se stejným počtem položek v každém druhu. Druhy, v tomto pořadí: Nové, Lepší, Změněno,
     Opraveno, Pod kapotou (na čem je aplikace postavená; samotné nikoho po aktualizaci neruší).
     Položka začíná tučnou větou o tom, co se změnilo: "- **Co se změnilo.** Proč na tom záleží."
     `npm run release` odmítne prázdné Unreleased a udělá z něj "## <verze> (<datum>)". Z té sekce je text
     vydání na GitHubu, "Co je nového" v App Store a na Google Play a okno Co je nového v aplikaci. -->

## Unreleased

### Nové

- **Přílohu i podepsaný originál můžete stáhnout, kam chcete.** Tlačítko Stáhnout vedle souboru uloží
  jeho kopii přes systémový dialog; klepnutím na řádek se soubor otevře jako dřív.

### Změněno

- **Horní část schránky je přední strana obálky.** Jméno schránky je v okénku obálky pod zlatou
  chlopní; klepnutím na okénko přepnete schránku, vedle je hledání a pod ním Přijaté a Odeslané.
- **Zprávy, které na vás čekají, leží jako listy papíru, ostatní jsou v knize zpráv po dnech.** Obálka
  odesílatele je zalepená zlatou chlopní, dokud zprávu nepřečtete, a pod zprávou doručenou fikcí je
  vidět okraj druhé obálky. Den a den v týdnu stojí jednou u první zprávy dne.
- **Řádek o ostatních schránkách je obyčejná věta.** "V ostatních schránkách **2 nepřečtené**" bez
  barevných teček a čar; na úzkém displeji se zkrátí úvod na "Jinde:", ne zpráva sama.
- **Tlačítko Napsat je zlatá poštovní známka.** Má perforovaný okraj a natištěný rámeček.
- **Prázdná schránka je otevřená obálka.** Pod ní stojí, kdy se Obálka naposledy podívala
  ("Naposledy dnes ve 14:02"), stejnými slovy jako na konci seznamu zpráv.
- **Přijatá zpráva leží v obálce, ve které přišla.** Odesílatel je na obálce s poštovním razítkem
  dne a minuty doručení, adresát v okénku a předmět na listu, který z obálky vyjíždí.
- **Zpráva doručená fikcí má nahoře zlatý pruh s tlačítkem Připomenout.** Pruh říká den, kdy zákon
  zprávu doručil za vás, a Připomenout rovnou nastaví připomínku lhůty, která tím dnem začala.
- **Doručenka je odtrhávací lístek.** Každý krok má razítko - fajfku za dodání, hodiny za fikci,
  plné kolečko za doručení přihlášením - krátkou poznámku a vpravo datum nad časem.
- **Přílohy jsou listy papíru s typem souboru.** U každé stojí, že je v archivu; podepsaný originál
  je v řadě s nimi.
- **Odeslaná zpráva je obálka s orazítkovanou známkou.** Na známce je, kolik odeslání stálo, razítko
  nese čas, kdy zprávu přijalo ISDS, a pod obálkou je doručenka, která se doplní, až ji adresát otevře.
- **Když ISDS zprávu přijme, dopadne na známku razítko.** Telefon jednou pevně ťukne jako razítko
  o stůl a obálka pak vyjede na své místo; se sníženým pohybem se vše jen prolne.
- **Zamčená Obálka je obálka zapečetěná voskovou pečetí.** Zámek říká, že zprávy i přihlášení jsou pod
  zámkem, a tlačítko Odemknout je dole, kam dosáhne palec.
- **Při odemknutí se pečeť zlomí a obálka otevře.** Poprvé od spuštění aplikace se pečeť s lehkým
  ťuknutím rozlomí, chlopeň se překlopí a pod ní je schránka; při dalším odemknutí se jen otevře chlopeň.
  Nepovedené ověření pečetí jen zatřese. Se sníženým pohybem se zámek jen prolne.
- **Otevřená zpráva vyjde z obálky.** Dlaždice odesílatele se zvětší v obálku zprávy a z ní vyjede list
  s předmětem; otevření zprávy už neťuká, čtení je tiché. Se sníženým pohybem se zpráva jen prolne.
- **Posunete-li zprávu dolů, obálka se zasune do horní lišty.** Odesílatel a v okénku adresát zůstanou
  nahoře, zatímco čtete doručenku a přílohy; nahoře zprávy se lišta vrátí.
- **Odlesk na okénku obálky se pohne, když telefon nakloníte.** Jen o kousek a jen na obrazovce, kterou
  máte před sebou; se sníženým pohybem zůstane stát.
- **Odeslané zprávy jsou v knize zpráv po dnech jako přijaté.** Vpravo stojí, kdy zprávu ISDS
  dodalo nebo kdy byla doručena, s poštovním razítkem; rozepsané koncepty jsou list nad seznamem. Ve
  všech schránkách nese zpráva jen zkratku své schránky, aby se vešel odesílatel i adresát.
- **Všechny schránky ukazují obálky schránek vějířem.** V záhlaví i v přepínači leží obálky
  sloučených schránek přes sebe, na přední je jejich počet; schránky v přepínači mají svou obálku a
  přidání schránky je plné tlačítko.

### Opraveno

- **Prázdná schránka ukáže prázdnou obálku, i když v ostatních schránkách něco čeká.** Dřív byl pod
  řádkem o ostatních schránkách jen prázdný papír.
- **Otevřený dotaz nezůstane nad zamčenou aplikací.** Když aplikace odešla do pozadí s otevřeným
  dialogem (třeba s potvrzením placeného odeslání nebo s dotazem na mobilní data), po návratu byl vidět
  i přes zamykací obrazovku. Teď se zavře; přijatý přenos počká, až bude aplikace zase odemčená.

## 1.1.0 (2026-11-11)

### Nové

- **Změna hesla v aplikaci.** Schránce, která se přihlašuje jménem a heslem, změníte heslo přímo v
  Obálce, dokud to současné platí: zadáte současné a dvakrát nové.
- **Upozornění, že heslo brzy vyprší.** Týden a den předem oznámení připomene, že je potřeba heslo
  změnit, jinak se do schránky nedostanete.

### Lepší

- **Odmítnuté heslo říká, co může znamenat.** ISDS odmítá vypršelé heslo stejně jako špatné, takže
  aplikace řekne obojí a nabídne cestu do portálu ISDS.
- **Než telefon požádá o oznámení, Obálka řekne, k čemu jsou.** Po přidání schránky nejdřív vysvětlí
  upozornění na konec platnosti hesla; systémový dotaz přijde, jen když je chcete.

### Opraveno

- **Změna platnosti hesla v portálu se projeví i v Obálce.** Když heslo začne nebo přestane vypršet,
  aplikace to zjistí při obnovení, bez nového přihlášení, a podle toho upozorní, nebo přestane.
- **Okraj dialogů v tmavém režimu je stejný ze všech stran.** Dřív svítil jen nahoře.

## 1.0.0 (2026-11-11)

### Nové

- **První vydání Obálky.** Všechny datové schránky v jednom seznamu, šifrovaný archiv zpráv, příloh
  i podepsaných originálů v telefonu, který po 90 dnech nezmizí, běžící lhůty a doručení fikcí na
  očích, odesílání, hledání bez připojení, šifrovaná záloha a přenos do nového telefonu. Ke schránce
  se přihlašuje jen na váš pokyn, nic se neděje na pozadí.
- **Tečka u Odeslaných.** Když se odeslaná zpráva doručí, doručí fikcí nebo ji nejde doručit, ukáže
  to tečka u Odeslaných, dokud je neotevřete.

### Lepší

- **Odeslané zprávy se archivují i bez otevírání Odeslaných.** Při otevření aplikace se načtou
  odeslané zprávy všech schránek, takže se dostanou do archivu, zálohy, přenosu i hledání dřív, než
  je ISDS po 90 dnech smaže.
- **Počty nepřečtených platí hned po obnovení jedné schránky.** Dřív se aktualizovaly až při
  obnovení všech schránek.
- **Odeslaná zpráva říká, ke kdy platí její stav.** Dokud se stav může změnit, ukáže u stavu
  doručení „Stav k …“, takže je poznat, jak je starý.

### Opraveno

- **Odeslané ve všech schránkách najednou ukazují zprávy ze všech schránek.** Dřív chyběly zprávy
  schránky, jejíž Odeslané jste ještě neotevřeli zvlášť. Stažení dolů teď počká, až se schránky
  aktualizují, a hned ukáže nové zprávy.
- **Řádek podepsaného originálu je stejně vysoký jako přílohy nad ním.**
- **Stahování „jen nových zpráv“ vynechá staré odeslané zprávy.** Za nové se počítají jen zprávy
  doručené po zapnutí.

### Pod kapotou

- **Aktualizovaná knihovna, která čte odpovědi datových schránek** (fast-xml-parser 5.12.0).
