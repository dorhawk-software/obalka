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

## 1.1.0 (2026-11-11)

### Nové

- **Změna hesla v aplikaci.** Schránce, která se přihlašuje jménem a heslem, změníte heslo přímo
  v Obálce, dokud to současné platí: zadáte současné a dvakrát nové.
- **Upozornění, že heslo brzy vyprší.** Týden a den předem oznámení připomene, že je potřeba heslo
  změnit, jinak se do schránky nedostanete.

### Lepší

- **Odmítnuté heslo říká, co může znamenat.** ISDS odmítá vypršelé heslo stejně jako špatné, takže
  aplikace řekne obojí a nabídne cestu do portálu ISDS.

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
