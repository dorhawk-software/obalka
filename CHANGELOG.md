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

- **Časté dotazy odpoví, proč Obálka, když existuje Portál občana.** Komu stačí oficiální
  aplikace a pro koho je Obálka: víc schránek v jednom seznamu, lhůty na očích a pošta v telefonu.
  Odpověď o mazání zpráv nově říká, že 90 dní běží od doručení přihlášením a zprávu doručenou
  fikcí ISDS drží nejméně tři roky.

## 1.1.0 (2026-11-18)

### Nové

- **Změna hesla v aplikaci.** Schránce, která se přihlašuje jménem a heslem, změníte heslo přímo v
  Obálce, dokud to současné platí: zadáte současné a dvakrát nové.
- **Upozornění, že heslo brzy vyprší.** Týden a den předem oznámení připomene, že je potřeba heslo
  změnit, jinak se do schránky nedostanete.
- **Přílohu i podepsaný originál můžete stáhnout, kam chcete.** Tlačítko Stáhnout vedle souboru
  uloží jeho kopii přes systémový dialog; klepnutím na řádek se soubor otevře jako dřív.

### Lepší

- **Odmítnuté heslo říká, co může znamenat.** ISDS odmítá vypršelé heslo stejně jako špatné, takže
  aplikace řekne obojí a nabídne cestu do portálu ISDS.
- **Než telefon požádá o oznámení, Obálka řekne, k čemu jsou.** Po přidání schránky nejdřív vysvětlí
  upozornění na konec platnosti hesla; systémový dotaz přijde, jen když je chcete.

### Změněno

- **Nový vzhled: pošta jako na papíře.** Horní část schránky je přední strana obálky. Zprávy, které
  na vás čekají, leží jako listy papíru, ostatní jsou v rejstříku po dnech. Přijatá zpráva leží v
  obálce, ve které přišla, doručenka je ústřižek s razítkem za každý krok a přílohy jsou listy
  papíru. Odeslaná zpráva má známku zrušenou razítkem ISDS. Tlačítko Napsat je zlatá poštovní známka
  a zamčená Obálka je obálka zapečetěná voskem.
- **Každá obrazovka v novém vzhledu.** Přihlášení, kód z SMS v osmi políčkách, hledání, záloha,
  přesun do jiného telefonu, změna hesla, Nastavení i Co je nového. Otázky vyjíždějí zespodu,
  tlačítka ukazují značkou, co udělají, a tlačítko, které otázku zavře, říká, co zůstane. Data se
  všude píšou stejně a tmavý vzhled má vlastní odstíny místo světlých linek.

### Opraveno

- **Změna platnosti hesla v portálu se projeví i v Obálce.** Když heslo začne nebo přestane vypršet,
  aplikace to zjistí při obnovení, bez nového přihlášení, a podle toho upozorní, nebo přestane.
- **Opravy napříč aplikací.** Systémové Zpět na Androidu vrací o krok při přidávání schránky a na
  iPhonu jde zpráva zavřít přejetím od okraje. Čtečka obrazovky dosáhne na pole nové zprávy, při
  největším písmu se nic neusekne a přepínač schránek ukazuje všechny schránky. Otevřená otázka se
  už neukáže přes zamčenou obrazovku a jednopísmenná slova nezůstávají na konci řádku. Okraj dialogů
  v tmavém režimu je stejný ze všech stran, dřív svítil jen nahoře.

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
