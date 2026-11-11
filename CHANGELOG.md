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

### Pod kapotou

- **Aktualizovaná knihovna, která čte odpovědi datových schránek** (fast-xml-parser 5.12.0).

## 1.0.0 (2026-11-11)

### Nové

- **První vydání Obálky.** Všechny datové schránky v jednom seznamu, šifrovaný archiv zpráv, příloh
  i podepsaných originálů v telefonu, který po 90 dnech nezmizí, běžící lhůty a doručení fikcí na očích,
  odesílání, hledání bez připojení, šifrovaná záloha a přenos do nového telefonu. Ke schránce se
  přihlašuje jen na váš pokyn, nic se neděje na pozadí.
