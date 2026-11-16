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

- **Dopis vyjíždí zpod obálky.** Na detailu zprávy a při psaní leží horní okraj dopisu pod obálkou a
  stín obálky padá dolů na dopis; dřív ležel dopis navrchu a jeho stín mířil nahoru. Spodní listy v
  tmavém vzhledu nevrhají stín vzhůru; okraj dělá jejich odstín.
- **V tmavém vzhledu karty a obálky končí vlastním odstínem.** Kolem karet, obálek, nabídky schránky a
  oznámení dole už není slabá světlá linka; okraj dělá o stupeň světlejší plocha a stín pod ní, jako ve
  světlém vzhledu.
- **Tlačítka ukazují, co udělají.** Před slovy každého tlačítka, které něco dělá, je jeho značka: klíč u
  „Přihlásit se“, koš u „Smazat“, obálka se šipkou u „Odeslat“. Tlačítka, která jen pokračují nebo
  nechávají věci, jak jsou („Pokračovat“, „Ponechat“), zůstávají jen slovy, takže je na první pohled
  vidět, které tlačítko něco změní.
- **Dva odkazy k heslu zálohy mají mezi sebou místo.** „Načíst heslo z QR kódu“ a „Použít heslo z tohoto telefonu“ se dotýkaly, takže palec mířící na jeden mohl trefit druhý; teď je mezi nimi 8 bodů.
- **Vypínač „Jen na Wi-Fi“ říká, proč je ztlumený.** Dokud se přílohy nestahují automaticky, stojí pod ním „Platí, když se přílohy stahují automaticky.“ Nejsvětlejší šedý text je o odstín tmavší, aby se dal přečíst i na šedém podkladu.
- **Tlačítko, které otázku zavře, říká, co zůstane.** Místo „Zrušit“ třeba „Nechat zapnuté“, „Neodesílat“ nebo „Zavřít fotoaparát“, a příjem zálohy z druhého telefonu má „Přijmout zálohu“: co se stane, je jasné i bez čtení otázky.
- **Razítko odeslané zprávy ruší známku jako na skutečné poště.** Kruh razítka leží přes okraj známky, tmavým inkoustem jako vlnky, a datum je na papíře známky. Vlnky vybíhají z kruhu a datum nepřeškrtávají. Na úzkém telefonu už nepřekrývá jméno odesílatele.
- **Nápověda a zásady ochrany soukromí říkají, kdo co dělá.** Kde stálo „my“, teď stojí aplikace nebo její vývojáři, takže je jasné, kdo k vašim datům může a kdo ne.
- **Pole pro heslo bez opakovaného slova.** Nad polem stojí „Heslo“ a uvnitř už ne, stejně jako u uživatelského jména.
- **Hlášení chyb má vlastní ikonu.** V Nastavení › Diagnostika vede řádek s hlášením chyb brouk místo zvonku; zvonek zůstává jen u upozornění.
- **Detail zprávy má stejnou hlavičku jako ostatní obrazovky.** Při přechodu ze seznamu do zprávy a do Nastavení už hlavička neposkočí.
- **Čisté okénko obálky v tmavém vzhledu.** Šedý pruh a šmouha, které v noci ležely na okénku s adresou, jsou pryč.
- **Nedostupný přepínač nevypadá zapnutě.** Přepínač, který zrovna nejde použít, má šedou dráhu; jezdec zůstává na své straně, takže je vidět, co se použije, až to půjde.
- **Méně červené v přepínači schránek.** U schránky s problémem je červeně jen to, co se stalo; „Poslední známý stav“ je šedě a výstražný odznak už nezakrývá písmena.
- **Záloha bez opakování.** Obrazovka zálohy říká každou věc jednou; přepínač příloh má kratší popis. Přihlášení jménem používá slovo ISDS „Uživatelské jméno“.
- **Aplikace mluví sama za sebe.** Texty, které dřív mluvily v první osobě („Ukládám…“, „pošleme“), teď říkají, co dělá aplikace, nebo co se právě děje („Ukládání…“).
- **Nedoručitelná zpráva má v Odeslaných svou značku.** Před slovem „Nedoručitelné“ stojí plné kolečko
  s přeškrtnutím, jako v nápovědě a v detailu zprávy; dřív to byl nejtišší řádek v seznamu.
- **Šedá tlačítka jsou zřetelná i na papíře.** „Zálohovat nyní“, „Ověřit zálohu“ a „Zobrazit heslo“
  mají o tón tmavší výplň, takže už nevypadají jako tučný text.
- **Řádky s časem říkají, co se tehdy stalo.** „Aktualizováno před 5 minutami“ nad zprávami
  a „Zálohováno 15. 11. 2026 17:13“ u zálohy místo nejasného „Naposledy“.
- **Data se píšou podle normy.** „12. 11. 2026 9:20“ a „29. 8.“ všude stejně, v obálce, na doručence,
  v zálohách i na razítku; dřív měla každá obrazovka svůj tvar.
- **Odeslaná zpráva nese tutéž známku, jakou ukázalo psaní.** Stejně velkou, i s druhem zprávy,
  jen orazítkovanou. Než vyberete adresáta, stojí v rohu obálky bledá prázdná známka místo
  čárkovaného rámečku.
- **Nedostupné Odeslat je stejně tlumené jako ostatní tlačítka.** Dokud zpráva nemá adresáta nebo
  obsah, vypadá tlačítko stejně jako jiná, která zatím nejdou použít.
- **Monogram schránky vynechá titul.** „Ing. Ondřej Dvořák“ je OD, ne IO, takže dvě schránky
  jednoho člověka nevypadají jako dva lidé.
- **Zelená u doručených odeslaných zpráv je tmavší.** „Doručeno“ v Odeslaných je i drobným písmem
  dobře čitelné.
- **Nevybraná volba má zřetelný kroužek.** Kroužky ve Vzhledu, Jazyku a jinde mají stejný okraj jako
  vypnutý přepínač.
- **Štítek Testovací má o kousek větší písmo.** Je teď stejně velký jako ostatní štítky.
- **Odmítnuté přihlášení neopakuje svůj nadpis.** Text karty začíná rovnou tím, co je špatně:
  „Jméno nebo heslo je špatně…“.
- **Smazání záznamu z režimu ladění se ptá jako smazání zálohy.** „Smazat záznam?“, pod tím název
  souboru a co se stane; dřív byl nadpisem jen rozlomený název souboru.
- **Počet nepřečtených u schránky svítí zlatou známky.** Je o kousek větší a stejně žlutý jako
  tlačítko Napsat; značka nedokončeného přihlášení má stejný lem.
- **Stahování příloh neznámé velikosti ukazuje běžící pruh.** Dřív stál pruh napůl a nehýbal se.
- **Pokročilé volby zálohy říkají, co skrývají.** Řádek pod nadpisem Pokročilé už jen neopakuje
  nadpis: zve k automatickému zálohování a počtu záloh.
- **Odpočet fikce u odeslané zprávy má obálku s hodinami.** Stejnou značku, jakou fikci ukazují
  přijaté zprávy, místo stopek.
- **Ikona aplikace má tmavou a tónovanou podobu.** Na iPhonu se v tmavém režimu ukáže modrá obálka se
  zlatou chlopní na tmavém podkladu, v tónovaném režimu šedá; Android 13 a novější ji s tematickými
  ikonami přebarví podle tapety.
- **Aplikace se na Androidu otevírá na papíře.** Úvodní obrazovka systému už není šedobílá, takže
  obrazovka po ní nepřebliká do barvy aplikace.
- **Záznam režimu ladění je ve schránce na chlopni obálky.** Obálka tak dál sahá až k horní hraně.
- **Záloha vypadá jako zbytek aplikace.** Zálohovat a ověřit jsou dvě stejná tlačítka, průběh
  zálohy se ukáže přímo pod přepínačem, zálohy v seznamu mají štítek s přílohami vpravo a otevřená
  záloha nabízí Smazat a Obnovit vedle sebe.
- **Otázka na hlášení o chybách nabízí obě odpovědi stejně.** „Neodesílat“ i „Odesílat hlášení“
  jsou stejná tlačítka; dřív bylo souhlasné vyplněné a odmítnutí jen orámované.
- **Časté dotazy mají nadpisy jako Nastavení.** Upozornění u datových schránek je tichý řádek
  pod nadpisem skupiny, ne samostatná poznámka s ikonou.
- **Úvodní obrazovka ukazuje obálku, která čeká na schránku.** Okénko je zatím prázdné, pod ním
  název aplikace, tlačítka pro přidání schránky a obnovení a jazyk v rohu.
- **Čekání vypadá všude stejně.** Kde aplikace na něco čeká, točí se její vlastní kroužek místo
  systémového, na Androidu i na iPhonu stejně.
- **Výsledky hledání vypadají jako seznam zpráv.** Mají den a měsíc, odesílatele, sponku, vlastní
  připomínku i štítek schránky, ve které zpráva je, a odeslanou zprávu poznáte podle stavu doručení.
- **Z textu zprávy je dopis na A4.** Příloha „Textová zpráva.pdf" má odesílatele, příjemce s adresou,
  datum a předmět, jak bývá v českém dopise zvykem, a je psaná stejným písmem jako aplikace.
- **Placená zpráva se ptá se známkou, kterou zaplatíte.** Otázka před odesláním poštovní datové
  zprávy ukáže známku s cenou a kredit schránky a vyjede stejně jako ostatní otázky v aplikaci.
- **Nová zpráva je obálka, kterou posíláte.** Odesílatel je na obálce, příjemce v jejím okénku a
  známka v rohu ukáže, zda bude zpráva zdarma, nebo placená, hned jak příjemce vyberete. Předmět a
  text píšete na list zastrčený pod obálkou.
- **Termín nalezený v příloze se nabízí klidněji.** Návrh je tichý podklad bez rámečku, uložit ho
  jako připomínku nebo skrýt jde odkazy pod ním a během hledání běží stejný pruh jako jinde v aplikaci.
- **Anglické razítko obíhá celý kruh.** Jeho slova vyplní kruh stejně jako česká, nezůstane v něm
  prázdné místo.
- **Přílohy, které se nedaly stáhnout nebo otevřít, mají stejný vzhled jako ostatní.** Soubor zůstává
  listem papíru, jen bledším, a chybějící přílohy stáhnete modrým tlačítkem jako celou zprávu.
- **Přepínač Přijaté a Odeslané má písmo celé aplikace** a zvolená záložka i tlačítko Napsat se při
  spuštění objeví celé najednou, ne po kouscích.
- **Připomínky a upozornění na heslo mají v liště oznámení modrou barvu obálky,** stejnou jako ikona
  aplikace.
- **Každá otázka ukazuje, čeho se týká.** Nad nadpisem je značka: zámek, záloha, příloha, přenos nebo
  upozornění; při přenosu dat je hlavní odpověď zvýrazněná a stojí první.
- **Krátká oznámení dole na obrazovce už nezakrývají tlačítko Napsat.** Stojí nad ním, odcházejí
  pozvolna a v tmavém režimu mají jemný okraj, aby se neztrácela.
- **Nabídka schránky se otevře vedle tlačítka ⋯ a úprava schránky vyjíždí zdola.** Úprava ukazuje
  obálku schránky se jménem a barvou tak, jak je píšete a vybíráte, a stačí jí jediné tlačítko Uložit.
- **Připomínka a výběr odesílatele mají nový vzhled.** Termíny připomínky jsou jedna karta s výraznějšími
  popisky a Odebrat stojí vedle Uložit; schránky k odeslání mají svou obálku a zvolenou označuje kroužek.
- **Otázky a upozornění vyjíždějí zdola jako ostatní panely.** Odpovědi jsou pod sebou na dosah palce,
  ta hlavní nahoře, a nad otázkou je to, čeho se týká: například obálka odebírané schránky.
- **Co je nového se čte jako text.** Každá změna je jeden odstavec s tučnou první větou, seřazené podle
  druhu, a spodní okna mají větší nadpis a víc místa po stranách.
- **Licence se čtou snáz.** Každá licence má na přehledu jeden řádek s počtem komponent, každá
  komponenta otevře text své licence i se svým copyrightem a text plyne v odstavcích.
- **Režim ladění je uspořádanější.** Probíhající záznam má vlastní kartu s počtem záznamů a oběma
  tlačítky, uložení potvrdí modrý pruh a každý uložený soubor nabízí Sdílet a Smazat vedle sebe.
- **Přenos do jiného telefonu je přehlednější.** Zálohy k odeslání jsou na jednom listu s velikostí
  a tím, co obsahují, a odeslání je jedno velké tlačítko. Přijímání má vlastní obrazovku: načtení kódu,
  pole pro heslo a tlačítko Přijmout, které počká, než heslo zadáte.
- **Přenos do jiného telefonu končí obrazovkou, která řekne, co přišlo.** Archiv dorazí jako hromádka
  obálek, pod ní co se obnovilo, co zbývá udělat a kudy přenos šel. Během přenosu je vedle stavu vidět,
  kolik dat už prošlo, a když se přenos zastaví, řekne to červený blok nahoře v části, které se týká.
- **Změna hesla vypadá jako zbytek přihlášení.** Pravidla nového hesla jsou na listu a splněná se
  zeleně zaškrtnou. Chyba je tónovaný blok bez ikony a změněné heslo potvrdí velký zámek.
- **Přihlásit znovu vypadá jako přidání schránky.** Schránka je list s vlastní obálkou a zámkem. Když
  ISDS heslo odmítne, formulář i napsané heslo zůstanou a pod polem je list s důvody a dvěma odkazy.
- **Všechny zprávy, které vyžadují pozornost, leží na stejném okraji.** Dřív ho měly jen zprávy
  doručené fikcí a vypadaly jako hromádka více zpráv; jak byla zpráva doručena, říká štítek.
- **Přihlašovací pole jsou klidnější.** Způsob přihlášení označuje malý štítek, popisky polí jsou
  tlumené a komunikační kód Mobilního klíče je vidět, jak ho píšete. Když ISDS heslo odmítne, je pod
  poli list s důvody a dvěma odkazy.
- **Když ISDS přihlášení odmítne, řekne to jedna karta se zámkem.** Upravit jméno nebo heslo vrátí
  vyplněná pole, ne volbu způsobu přihlášení, a odkaz vede do portálu ISDS. Jiné chyby ukazují
  zalepenou obálku, důvod a Zkusit znovu.
- **Způsoby přihlášení jsou jeden list s výběrem vpravo, jako v Nastavení.** Při přidání schránky
  i při novém přihlášení. Nápověda k prostředí zůstává pod přepínačem otevřená.
- **Kód z SMS se píše do osmi políček, jedno na každou číslici.** Pole přijme jen číslice, nejvýš
  osm, i když kód vložíte s mezerami. Potvrdit jde až celý kód. Že kód přišel, říká modrý pruh.
- **Při spuštění čeká pod logem jeden tenký pruh místo točícího se kolečka.** Když se schránky
  nenačtou, na jeho místě je zpráva a tlačítko Zkusit znovu; logo se přitom nepohne.
- **Při čekání na Mobilní klíč leží obálka vaší schránky.** Chlopeň je zalepená, v okénku je
  přihlašovací jméno a pod ní se pohybuje jen jeden pruh; točící se kolečko a pulzující dlaždice zmizely.
- **Napřed jméno, potom druh schránky.** „Jan Novák - podnikající fyzická osoba“ je teď na obálce
  „Jan Novák“ a pod ním tišeji „PFO · ID …“; klepnutím se zkratka rozepíše. V seznamech a hledání
  stojí jen jméno.
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
- **Upozornění nad seznamem zpráv jsou karty v barvě sdělení.** Odhlášená schránka, končící heslo
  i chybějící schránka mají vlastní kartu s tlačítkem; řádek o uložených zprávách je pod nimi
  tišší.
- **Načítání schránky má tvar knihy zpráv.** Než se zprávy načtou, jsou na jejich místě řádky se
  dnem a dvěma řádky textu; synchronizaci ukazuje tenký pruh pod upozorněními, který nic neposune.
- **Když není co ukázat, obálka ukáže proč.** Odeslané bez zpráv mají obálku s prázdnou známkou,
  schránka, která se nenačetla, obálku zalepenou, schránka čekající na přihlášení prázdné okénko a
  hledání stoh obálek. Pole hledání má lupu a lišta nad hledáním končí bez čáry.
- **Karty jsou listy papíru, které mají váhu.** Leží na papíře s měkkým stínem a bez rámečku. V
  Nastavení má každá volba svou značku v jamce a vybraná možnost modrý kroužek s tečkou; vypnutý
  přepínač je teplý jako papír.
- **Heslo k záloze a kód přenosu jsou lístky na vzoru obálky.** Heslo i kód stojí na lístku větším
  písmem ve dvou řádcích a QR kód je na papíře s logem Obálky v jeho barvách; varování a tlačítka
  jsou pod lístkem. Během přenosu jsou pod ním jen řádky: co se děje, pruh, Zrušit přenos a nakonec,
  kudy přenos jde. Pruh průběhu leží v papíře jemněji.
- **Odeslaná zpráva je obálka, ve které odešla.** Odesílatelem jste vy, v okénku je adresát s adresou a
  známku přeškrtlo razítko z okamžiku, kdy zprávu přijalo ISDS; pod ní je doručenka, která se doplní,
  až ji adresát otevře. Připomínka a stažení příloh mají značku v jamce a tlačítko Stáhnout je v kartě.
- **Testovací schránka má nad zprávou pruh jako letecká pošta.** Modré a zlaté proužky říkají, že nejde
  o skutečnou poštu.

### Opraveno

- **Okno odeslané zprávy už nezakryje razítko.** S adresou rostlo okno nahoru přes datum a čas
  odeslání; teď se obálka prodlouží dolů.
- **Hodiny nad zlatou chlopní jsou v tmavém režimu čitelné.** Stavový řádek byl bílý na žluté.
- **Přepínač schránek ukáže všechny schránky.** Čtvrtá schránka se schovala pod okraj seznamu a nic
  neříkalo, že tam je.
- **Čtečka obrazovky dosáhne na pole zprávy a slyší víc.** Na iPhonu se dá dostat do polí Komu,
  Předmět a Text; vypnutý přepínač se ozve, volby říkají „vybráno“, nadpisy jsou nadpisy, Pokročilé
  říká, jestli je otevřené, a hledání příjemce oznámí, co dělá.
- **Malá tlačítka mají plnou dotykovou plochu.** Stažení přílohy, odebrání přílohy, odkazy na portál
  a další mají 48 bodů jako zbytek aplikace; Pokročilé a Nápověda se už neperou o stejné místo.
- **Anglická aplikace píše velikosti a kredit anglicky.** „2.6 MB of 4.2 MB“ a „1,234 CZK“ místo
  české desetinné čárky a „Kč“.
- **Ztlumená tlačítka na Androidu blednou jako celek.** Slova na nich dřív zmizela do barvy tlačítka.
- **Při největším písmu se nic neusekne.** Den v seznamu se už nelámal po číslicích, zkratky
  v dlaždicích se vejdou, pole příjemce není useknuté. Písmo roste nejvýš na dvojnásobek, i na iPhonu.
- **Zrušené ověření při zapínání zámku už netvrdí, že telefon nemá zámek obrazovky.** Telefon
  s PIN kódem bez otisku prstu dostal po zrušení hlášku „Biometrika není k dispozici“.
- **Ukazatel obnovení v tmavém režimu už není bílý kotouč.** Na Androidu ho aplikace kreslí na
  barvu karet.
- **Panel dole na Androidu zavřete stažením dolů.** Výběr schránky, výběr jazyka nebo lhůty i ostatní
  panely se dřív za prstem nehnuly; teď jdou stáhnout a puštěný příliš brzy se vrátí zpět.
- **Na iPhonu se ze zprávy otevřené ze seznamu vrátíte přejetím od okraje.** Gesto na ní dřív
  nedělalo nic; teď zpráva pod prstem zmizí a jste zpět ve schránce.
- **Pokyn ve čtečce kódu je čitelný i v tmavém režimu.** Čtečka ukazuje okénko obálky, kam kód
  namířit, a pokyn se Zrušit leží na spodním panelu.
- **Text na tlačítkách bez rámečku je v písmu aplikace.** Třeba Zrušit, Poslat SMS znovu nebo Koupit
  kredit se na Androidu kreslily systémovým písmem.
- **Přehyby obálky vedou až do rohů.** Na obálce zprávy končily čáry kus před okrajem.
- **Nedoručitelná odeslaná zpráva to v Odeslaných říká čitelně.** Slovo „Nedoručitelné“ bylo světlým
  písmem na světlém papíře, skoro neviditelné; teď je tmavé jako ostatní text.
- **Zpráva, kterou aplikace v telefonu nenajde, ukáže zalepenou obálku a cestu zpět.** Dřív byla na
  prázdné obrazovce jen červená věta „Zkuste to znovu“ nad tlačítkem Zpět.
- **Jednopísmenná slova nezůstávají na konci řádku.** "v", "k", "s", "o" a další jdou na nový řádek se
  slovem za sebou a číslo se nerozdělí od jednotky ("4,2 MB"), v nastavení, nápovědě i v Co je nového.
  Režim ladění píše velikost s desetinnou čárkou.
- **Prázdná schránka ukáže prázdnou obálku, i když v ostatních schránkách něco čeká.** Dřív byl pod
  řádkem o ostatních schránkách jen prázdný papír.
- **Co píšete do polí, je písmem aplikace.** Na Androidu pole psala systémovým písmem.
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
