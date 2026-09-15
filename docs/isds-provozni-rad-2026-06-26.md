# Provozní řád ISDS - 26. 6. 2026

_Source: https://datovka.gov.cz/info/files/2245_Provozni_rad_ISDS_26_06_2026.pdf_ (26 pages, effective 26 June 2026)

The authoritative operating rules. Verbatim `pdftotext -layout` extraction; the PDF is canonical.
See `docs/isds-ws-news/README.md` for what this document settles for Obálka.

```text
                                Provozní řád ISDS




                             Zpracoval: Ing. Alžběta Randusová, produktový manažer ISDS

                                                             Ing. Pavel Tesař, analytik ISDS

                                Schválil: Ing. Mgr. Ondřej Menoušek, vedoucí projektu ISDS

                                                             Digitální a informační agentura

                                                               Datum schválení: 26. 6. 2026



© Digitální a informační agentura        Provozní řád ISDS                       Strana 1 z 26
Provozní řád informačního systému
datových schránek (ISDS)

Verze k 26. 6. 2026

Provozní řád ISDS je souhrn ustanovení a pravidel vybraných z dokumentů, kterými se
řídí Digitální a informační agentura (dále též Agentura) a spolupracující subjekty a které
jsou závazné pro provoz ISDS.

ISDS je zřízen a provozován na základě zákona č. 300/2008 Sb., o elektronických
úkonech a autorizované konverzi dokumentů, ve znění pozdějších předpisů, (dále jen
„Zákon“). Jeho Správcem je Digitální a informační agentura. Provozovatelem ISDS je
držitel poštovní licence, Česká pošta, s.p.

ISDS je informačním systémem veřejné správy ve smyslu zákona č. 365/2000 Sb.,
o informačních systémech veřejné správy, ve znění pozdějších předpisů.




© Digitální a informační agentura    Provozní řád ISDS                         Strana 2 z 26
Obsah

  I.           ÚVOD........................................................................................ 4
         1.    Vymezení pojmů (abecedně) ................................................................................ 4
         2.    Odkazy.................................................................................................................. 7



  II.          INFORMAČNÍ SYSTÉM DATOVÝCH SCHRÁNEK .................. 8
         1. Datová schránka ................................................................................................... 8
         2. Přístupové údaje ................................................................................................. 10
         3. Přihlášení do ISDS .............................................................................................. 13
         4. Přihlášení do datové schránky ve smyslu § 17 odst. 3 Zákona............................ 14
         5. Přihlášení pro získání přístupu k funkcím ISDS aplikacemi třetích stran ............. 15
         6. Datová zpráva ..................................................................................................... 16
         7. Automatické notifikace a rozhraní pro příjem notifikací ........................................ 17
         8. Napojení aplikací třetích stran ............................................................................. 17
         9. Napojení povinných subjektů uvedených v Zákoně ............................................. 20
         10. Seznam držitelů datových schránek (SDS) ......................................................... 20
         11. Autentizační služba PVS ..................................................................................... 21
         12. Přístupové rozhraní ............................................................................................. 22
         13. Oznamování změn dodavatelům aplikací ............................................................ 22
         14. Důvěrnost informací ............................................................................................ 23
         15. Zpracování osobních údajů ................................................................................. 23
         16. Bezpečnost ISDS ................................................................................................ 23
         17. Dodržování přiměřenosti ..................................................................................... 23
         18. Opatření zamezující šíření nevhodných zpráv..................................................... 24
         19. Dostupnost ISDS ................................................................................................ 24
         20. Údržba systému .................................................................................................. 24



  III.         KONTAKTY .............................................................................25

  IV.          TECHNICKÉ PŘÍLOHY ...........................................................26




© Digitální a informační agentura                        Provozní řád ISDS                                              Strana 3 z 26
 I. Úvod

1.    Vymezení pojmů (abecedně)

Autentizační služba PVS
Služba ISDS, která umožňuje zaregistrovaným informačním systémům veřejné správy využívat auten-
tizaci a identifikaci uživatelů na základě jejich uživatelských účtů v datových schránkách.

Datová schránka
Datové schránky představují elektronická úložiště, které je určeno k doručování dokumentů orgánů
veřejné moci, provádění úkonů vůči orgánům veřejné moci a dodávání dokumentů fyzických osob,
podnikajících fyzických osob a právnických osob. Datová schránka je součástí ISDS.

Datová zpráva
Datovou zprávou jsou obecně elektronická data, která lze přenášet prostředky pro elektronickou komu-
nikaci a uchovávat na záznamových médiích, používaných při zpracování a přenosu dat elektronickou
formou. Ve smyslu nařízení Evropského Parlamentu a Rady (EU) č. 910/2014 ze dne 23. července 2014
o elektronické identifikaci a službách vytvářejících důvěru pro elektronické transakce na vnitřním trhu
a o zrušení směrnice 1999/93/ES (dále jen Nařízení eIDAS) se jedná o data v elektronické podobě,
zejména jako text nebo zvuková, vizuální nebo audiovizuální nahrávka.

Datová zpráva ISDS (DZ)
V kontextu ISDS se jedná o soubor ve formátu ZFO, obsahující strukturu předepsanou Provozním řá-
dem ISDS. Zjednodušeně lze datovou zprávu ISDS popsat jako obálku, obsahující předepsané elementy
(metadata) a přílohy, které do ní vkládá odesílatel. Od roku 2024 je zavedena rozšířená varianta Velko-
objemová datová zpráva (VoDZ), která může mít velikost až 100 MB, zatímco běžná DZ jen 20 MB.

Datový trezor
Doplňková služba, zajišťující na komerčním základě dlouhodobé uložení zpráv v datové schránce.

Dotovaná datová zpráva
Uživatel datové schránky, případně jiný subjekt, může určit, že bude hradit veškeré Poštovní datové
zprávy odeslané z datové schránky jiného uživatele. Obchodní název této služby je Dotovaná datová
zpráva.

Informační systém veřejné správy (též ISVS)
Informační systém ve smyslu § 2 písm. b), zákona č. 365/2000 Sb., o informačních systémech veřejné
správy.

Identita občana
Identita občana slouží jako nástroj pro bezpečné a zaručené ověření totožnosti uživatele online služeb
veřejné správy. k prokazování totožnosti online slouží různé identifikační prostředky, jejichž poskyto-
vatelé získali akreditaci a jsou napojeni na Národní bod pro identifikaci a autentizaci., označovaný též
jako NIA.




© Digitální a informační agentura          Provozní řád ISDS                               Strana 4 z 26
ISDS
Informační systém datových schránek zajišťuje bezpečnou a průkaznou elektronickou komunikaci mezi
orgány veřejné moci (dále též „OVM“) na straně jedné a fyzickými či právnickými osobami na straně
druhé, jakož i mezi OVM a všemi typy subjektů navzájem.

JIP
Jednotný identitní prostor, zabezpečená adresářová služba obsahující údaje pro autentizaci a autorizaci
uživatelů z řad úředních osob, provozovaná Digitální a informační agenturou jakou součást služeb
Czech POINT.

Kontaktní místo veřejné správy
Kontaktním místem veřejné správy je dle § 8a odst. 1 a 2 zákona č. 365/2000 Sb., pracoviště
Czech POINT (Český podací ověřovací informační národní terminál). Seznam pracovišť je uveden
na webu https://www.czechpoint.gov.cz/public/.

Mobilní klíč eGovernmentu
Aplikace Mobilní klíč umožňuje jednoduché a rychlé přihlášení do ISDS bez nutnosti zadávat složité
jméno a heslo. Multi-faktorová autentizace pomocí mobilního telefonu nebo tabletu na platformě iOS
či Android zároveň zvyšuje úroveň zabezpečení uživatelského účtu. Aplikaci lze zároveň využít jako
jeden z prostředků pro el. identifikaci v rámci služeb Identity občana.

Odesílací brána
Součást aplikačního rozhraní ISDS, umožňující registrované externí webové aplikaci připravit koncept
datové zprávy, který následně může uživatel ISDS po úspěšné autentizaci odeslat.

Odpovědní datová zpráva
Uživatel datové schránky může určit, že bude hradit dodání dokumentu, který je odpovědí na jeho Poš-
tovní datovou zprávu. Obchodní název této služby je Odpovědní datová zpráva.

Orgán veřejné moci
Podle § 1 odst. 1 Zákona se tímto rozumí státní orgány, územní samosprávné celky a fyzické nebo
právnické osoby, pokud těmto fyzickým nebo právnickým osobám byla svěřena působnost v oblasti
veřejné správy. Zdrojem referenčního údaje o tom, zda je daný subjekt orgánem veřejné moci, je Rej-
střík orgánů veřejné moci a soukromoprávních uživatelů údajů, viz § 52b zákona č. 111/2009 Sb., o zá-
kladních registrech.

Poštovní datová zpráva (PDZ)
Obchodní označení pro zprávy přenesené v rámci komerčního provozu dle § 18a Zákona. Poštovní
datové zprávy dodané do konce roku 2021 jsou doručovány okamžikem, kdy se do datové schránky
přihlásí osoba, která má s ohledem na rozsah svého oprávnění přístup k tomuto dokumentu. PDZ do-
dané od 1. ledna 2022 jsou doručovány buď okamžikem, kdy se do datové schránky přihlásí osoba,
která má s ohledem na rozsah svého oprávnění přístup k tomuto dokumentu nebo desátým dnem od
dodání, tedy shodně jako běžné datové zprávy.

Provozovatel
Držitel poštovní licence ve smyslu Zákona (Česká pošta, s.p.).




© Digitální a informační agentura          Provozní řád ISDS                              Strana 5 z 26
Přístupové rozhraní
Přístupové rozhraní pro poskytovatele internetových služeb provozované jako součást ISDS na základě
zmocnění v § 14a Zákona. Přístupové rozhraní může využívat jen osoba, které bylo vydáno povolení
k využívání těchto služeb.

Portál veřejné správy (dále též PVS)
Portál veřejné správy slouží především k zajištění přístupu k informacím a pro zveřejňování informací
souvisejících s výkonem veřejné správy. PVS je místem, kam mohou orgány veřejné moci automatizo-
vaným způsobem umisťovat jak zákonem stanovené, tak nad rámec zákona vydávané informace a do-
kumenty. Dále PVS zajišťuje komunikaci uživatelů s orgány veřejné moci prostřednictvím datových
schránek a prostřednictvím kontaktních míst veřejné správy Czech POINT.

Rejstřík orgánů veřejné moci a soukromoprávních uživatelů údajů
Součást Registru práv a povinností. Obsahuje referenční údaje o tom, které subjekty jsou ve smyslu
zákona o základních registrech i datových schránek orgánem veřejné moci.

Seznam držitelů datových schránek
Plným názvem „Seznam fyzických osob, podnikajících fyzických osob, právnických osob a orgánů ve-
řejné moci, které mají zřízenu a zpřístupněnu datovou schránku“, viz § 14b Zákona.

Spisová služba
Ve smyslu zákona č. 499/2004 Sb., o archivnictví a spisové službě, ve znění pozdějších předpisů, jsou
veřejnoprávní původci mimo jiné povinni vést evidenci spisů buď písemnou formou, nebo elektronic-
kou formou za použití výpočetní techniky. ISDS umožňuje napojení elektronické spisové služby po-
mocí definovaného rozhraní (viz Technická příloha 2).

Správce
Digitální a informační agentura ve smyslu § 14 odst. 2 ve spojení s § 2 odst. 2 Zákona a § 2 písm. c)
zákona č. 365/2000 Sb.

Systémová datová zpráva
Specifický typ datové zprávy, odeslané buď ze systémové schránky Správce (aaaaaaa) nebo Provozo-
vatele (zzzzzzq).

Systémová notifikace e-mailem
Informační systém datových schránek rozesílá notifikační e-mailové zprávy na adresy, které ke svým
účtům registrovali sami uživatelé. Obsahem zpráv jsou zejména upozornění (notifikace) o dodaných
zprávách a také informace o změnách služeb či jiných podstatných událostech, které se mohou nějak
uživatele dotýkat a měl by o nich vědět.

Systémová notifikace krátkou textovou zprávou (SMS)
Volitelně si uživatelé mohou objednat zasílání placených notifikací formou SMS. Touto cestou dosta-
nou upozornění na nově dodané datové zprávy.

Velkoobjemová datová zpráva (VoDZ)
VoDZ má shodný formát s běžnou Datovou zprávou, liší se jen velikostí a dále tím, jak se vytváří
a zpracovává pomocí aplikačního rozhraní.


© Digitální a informační agentura         Provozní řád ISDS                              Strana 6 z 26
2.       Odkazy

Adresy datových schránek
Informační systém datových schránek publikuje své služby na následujících URL adresách. V textu
Provozního řádu používáme primárně první z nich, nicméně všechny uvedené URL adresy lze modifi-
kovat tak, že místo této adresy vložíte jinou.
     •   https://datovka.gov.cz (primární adresa),
     •   https://datovka.cms2.cz (adresa pro použití v rámci Centrálního místa služeb),
     •   https://mojedatovaschranka.cz (tato adresa bude výhledově ukončena).

Informační systém registru práv a povinností (AIS RPP působnostní)
https://rpp-ais.egon.gov.cz/AISP/verejne/domu

Informační web datových schránek
https://datovka.gov.cz/

Klientský portál datových schránek (ISDS)
https://www.datovka.gov.cz/

Mobilní klíč eGovernmentu
iOS:             https://apps.apple.com/cz/app/mobiln%C3%AD-kl%C3%ADč-isds/id1466762017
Android:         https://play.google.com/store/apps/details?id=cz.mojedatovaschranka.mobilniklic

Identita občana
https://www.identita.gov.cz/Home

Podmínky pro využívání přístupového rozhraní
https://portal.gov.cz/vestniky/yukd8p7/

Portál veřejné správy
https://portal.gov.cz/

Rejstřík orgánů veřejné moci a soukromoprávních uživatelů údajů
https://rpp-ais.egon.gov.cz/AISP/verejne/domu

Seznam držitelů datových schránek
https:/datovka.gov.cz/sds/search

Správa dat Seznamu orgánů veřejné moci
https://www.czechpoint.cz/spravadat/

Testovací prostředí pro dodavatele aplikací třetích stran
https://datovka-test.gov.cz/




© Digitální a informační agentura          Provozní řád ISDS                              Strana 7 z 26
II. Informační systém datových schránek

1. Datová schránka

Zřízení datové schránky
Orgánům veřejné moci, právnickým osobám zapsaným v registru osob, podnikajícím fyzickým osobám
zapsaným v registru osob a dále vybraným profesním skupinám podnikajících fyzických osob (advo-
káti, daňoví poradci, insolvenční správci, statutární auditoři, znalci, soudní překladatelé a tlumočníci,
autorizovaní architekti, autorizovaní inženýři a autorizovaní technici, úředně oprávnění zeměměřičští
inženýři) jsou datové schránky zřízeny automaticky ze Zákona. O zřízení datové schránky mohou
Správce požádat fyzické osoby, podnikající fyzické osoby a právnické osoby nezapsané v registru osob.
Náležitosti žádosti definuje Zákon v § 3 odst. 3 a 4 (fyzické osoby), § 4 odst. 4 a 5 (podnikající fyzické
osoby nezapsané v registru osob) a § 5 odst. 4 a 5 (právnické osoby nezapsané v registru osob).

Žádost o zřízení datové schránky lze podat následujícími způsoby:
    a) Na kontaktním místě veřejné správy (pracoviště Czech POINT). v tomto případě není nutné
       žádost opatřovat úředně ověřeným podpisem (viz § 27 odst. 3 Zákona).
    b) Vyplněním formuláře žádosti, jeho vytištěním, opatřením úředně ověřeným podpisem a zaslá-
       ním na poštovní adresu podatelny Správce.
    c) Online v prostředí klientského portálu ISDS po přihlášení Identitou občana. Zřízení je možné,
       pokud se uživatel přihlásil pomocí elektronického prostředku pro identifikaci s minimální
       úrovní důvěry „značná“. Tato varianta platí jen pro žádosti o datové schránky fyzické osoby
       nebo podnikající fyzické osoby.
    d) Online v prostředí klientského portálu ISDS po přihlášení účtem oprávněné osoby náležící
       k jiné datové schránce, za předpokladu, že uživatelský účet je propojen s konkrétní identitou
       zapsanou v registru obyvatel, tzn. že uživatel je ztotožněn. Tato varianta platí jen pro žádosti
       o zřízení datové schránky fyzické osoby.
Pokud žádost obsahuje všechny zákonné náležitosti a zároveň (v případě fyzické osoby a podnikající
fyzické osoby) byla osoba žadatele jednoznačně ztotožněna (pozn.: identifikace držitele datové
schránky primárně probíhá vůči registru obyvatel), Správce zřídí Datovou schránku do 3 pracovních
dnů od přijetí žádosti. Přístupové údaje jsou následně žadateli zaslány do jeho datové schránky fyzické
osoby jako datová zpráva výhradně do vlastních rukou adresáta, případně poštovní zásilkou do vlastních
rukou výhradně jen adresáta nebo jsou vydány formou tzv. virtuální obálky (viz oddíl Přístupové údaje
pro oprávněné osoby datových schránek). Do datové schránky fyzické osoby logicky nemohou být do-
ručovány přístupové údaje náležící k účtu samotného držitele této schránky.
V případě žádosti podané online po přihlášení Identitou občana je datová schránka zřízena i zpřístup-
něna bezodkladně. Přístupové údaje jsou žadateli vydány teprve na jeho výslovnou žádost, protože pří-
stup do schránky již má zajištěn pomocí Identity občana.
V případě žádosti podané online pomocí účtu oprávněné osoby jiné datové schránky je datová schránky
fyzické osoby zřízena bezodkladně a přístupové údaje jsou vydány na obrazovku Klientského portálu
ISDS.
V případě žádosti o zřízení datové schránky právnické osoby nezapsané v registru osob je nutné, aby
bylo doloženo, že žadatel je oprávněn za tuto právnickou osobu jednat. Tento doklad není Správcem
vyžadován, pokud je osoba žadatele uvedena ve veřejném rejstříku dostupném dálkově (např. RES,
ARES apod.)




© Digitální a informační agentura           Provozní řád ISDS                                Strana 8 z 26
V opačném případě vyzve Správce žadatele k zaslání kompletně vyplněné žádosti, případně k doplnění
údajů.

Zřízení další datové schránky Orgánu veřejné moci dle § 6 Zákona
Další datová schránka orgánu veřejné moci se zřizuje zejména pro potřebu vnitřní organizační jednotky
orgánu veřejné moci nebo výkonu konkrétní agendy nebo činnosti orgánu veřejné moci. Žádost zašlete
do datové schránky Agentury v podobě běžného úředního dopisu. Náležitosti žádosti jsou:
    •   název další datové schránky,
    •   kompletní adresní údaje ve struktuře dle § 6 Vyhlášky č. 359/2011 Sb., o základním registru
        územní identifikace, adres a nemovitostí,
    •   osobní údaje fyzické osoby, která bude zavedena jako oprávněná v této další schránce a to buď:
            o jméno, příjmení, číslo občanského průkazu,
            o jméno, příjmení, datum narození, místo narození, stát narození.
Přístupové údaje jsou odeslány poštou na adresu sídla organizační složky do vlastních rukou výhradně
jen adresáta osoby uvedené v žádosti.

Zpřístupnění datové schránky
Dle § 10 odst. 2 Zákona je datová schránka zpřístupněna (aktivována) prvním přihlášením osoby uve-
dené v § 8 odst. 1 až 4 Zákona do datové schránky, nejpozději však patnáctým dnem po dni doručení
přístupových údajů. Toto přihlášení je možné pouze prostřednictvím klientského portálu datových
schránek. V případě žádosti podané online po přihlášení Identitou občana je datová schránka zřízena
i zpřístupněna bezodkladně.

Znepřístupnění datové schránky na žádost
Subjekty, kterým byla datová schránka zřízena na žádost, mohou také požádat o její znepřístupnění.
Žádost o znepřístupnění datové schránky lze podat následujícími způsoby:
        a) Na kontaktním místě veřejné správy (pracoviště Czech POINT). V tomto případě není
           nutné žádost opatřovat úředně ověřeným podpisem (viz § 27 odst. 3 Zákona).
        b) Odesláním žádosti opatřené ověřeným podpisem na poštovní adresu podatelny Správce.
        c) Odesláním žádosti do datové schránky Správce.
        d) Zadáním požadavku v prostředí klientského portálu ISDS.
Správce znepřístupní Datovou schránku do 3 pracovních dnů od přijetí žádosti dle písmena a) až c).
Požadavky zadané dle písmena d) jsou vyřízeny okamžitě.

Znepřístupnění datové schránky ze zákona
Subjekty uvedené v § 16 Zákona (věznice, vazební věznice, detenční ústavy, soudy) oznamují změny
způsobující znepřístupnění datové schránky pomocí rozhraní pro poskytovatele dat, popsaného
v Technické příloze 3, případně pomocí Portálu pro poskytovatele dat. Dle povahy nastalé události mají
možnost zadat ohlášení vedoucí buď k dočasnému nebo trvalému znepřístupnění datové schránky.

Zrušení datové schránky
Datovou schránku zruší Správce 3 roky po zániku subjektu, pro který byla zřízena, viz § 13 Zákona.
Záznamy o přenesených zprávách (obálky těchto zpráv bez příloh) uchovává ISDS trvale.

Žádost o povolení příjmu Poštovních datových zpráv
Žádost o umožnění dodávání Datových zpráv dle § 18a odst. 1 Zákona lze podat následujícími způsoby:



© Digitální a informační agentura         Provozní řád ISDS                               Strana 9 z 26
     a) Zaškrtnutím příslušné volby v prostředí administrativní části klientského portálu ISDS. Po ode-
        slání žádosti je dodávání Poštovních datových zpráv povoleno ihned, bez dalšího schvalování
        Správcem.
     b) Na kontaktním místě veřejné správy (pracoviště Czech POINT).
Všechny datové schránky fyzických osob, podnikajících fyzických osob a právnických osob (včetně
podtypů) jsou iniciálně nastaveny tak, aby do nich bylo možné dodávat PDZ. Možnost ukončit či ná-
sledně povolit příjem PDZ zůstává výhradně držitelům datových schránek fyzických osob.

Žádost o ukončení povolení příjmu Poštovních datových zpráv
Žádost o ukončení povolení dodávání datových zpráv dle § 18a odst. 1 Zákona lze podat následujícími
způsoby:
     a) Zaškrtnutím příslušné volby v prostředí administrativní části klientského portálu ISDS. Po ode-
        slání žádosti je dodávání Poštovních datových zpráv ukončeno ihned, bez dalšího schvalování
        Správcem.
     b) Na kontaktním místě veřejné správy (pracoviště Czech POINT).
Příjem PDZ si mohou na žádost ukončit pouze držitelé datových schránek fyzické osoby.

Odesílání Poštovních datových zpráv
Odesílání Poštovních datových zpráv je službou České pošty s.p. Zájemce o tuto službu musí kontak-
tovat Českou poštu s.p., například pomocí klientské zóny na www.cpost.cz.


2.     Přístupové údaje

Přístupové údaje pro oprávněné osoby datových schránek
Oprávněným osobám (uživatelům), kterým byly vytvořeny účty k datové schránce, jsou zasílány pří-
stupové údaje buď datovou zprávou do datové schránky fyzické osoby, případně listovní zásilkou nebo
vydány tzv. virtuální obálkou. Pro všechny typy uživatelů (kromě držitele datové schránky fyzické
osoby samotného) platí, že primární variantou představuje doručení přístupových údajů do datové
schránky fyzické osoby ve formě systémové datové zprávy „výhradně do vlastních rukou adresáta“.
Pokud uživatel nemá zpřístupněnou datovou schránku fyzické osoby, je využita listovní zásilka v re-
žimu „do vlastních rukou výhradně jen adresáta“. Pravidla adresace jsou následující:
     a) Fyzickým osobám a podnikajícím fyzickým osobám nezapsaným v registru osob budou přístu-
        pové údaje zaslány na kontaktní adresu, kterou uvedou v žádosti o zřízení datové schránky.
        Pokud adresu pro doručení nevyplní, použije se adresa získaná z evidence obyvatel. Žadatel
        může zvolit pro doručení i zahraniční kontaktní adresu. Pokud se tato nachází v některé ze
        zemí, do kterých lze prostřednictvím Provozovatele doručovat v režimu „do vlastních rukou
        výhradně jen adresáta“, jsou mu následně odeslány přístupové údaje. Seznam těchto zemí je
        zveřejňován na informačním webu datových schránek. Pokud zvolil adresu v zemi, kam nelze
        doručovat v režimu do vlastních rukou výhradně jen adresáta, je mu zaslán pouze omluvný
        dopis s informací, jak dále postupovat.
     b) Vedoucím Orgánů veřejné moci budou odeslány na adresu jejich úřadu.
     c) Statutárním zástupcům právnických osob ztotožněným v registru obyvatel budou zaslány
        na adresu trvalého pobytu, popř. doručovací adresu uvedenou v registru obyvatel. U neztotož-
        něných osob budou přístupové údaje zaslány na adresu trvalého pobytu uvedenou v obchodním
        rejstříku.




© Digitální a informační agentura          Provozní řád ISDS                             Strana 10 z 26
    d) Alternativu vůči listovní zásilce představují přístupové údaje vydávané pro oprávněnou osobu
       datové schránky fyzické osoby. Pokud je žádost přijata na kontaktním místě veřejné správy,
       a je z pohledu ISDS úspěšně zpracována, mohou být žadateli na přání vydány přístupové údaje
       na místě formou tzv. virtuální obálky. Na zadaný e-mail je zaslán odkaz směřující na aktivační
       portál, kde si žadatel následně vyzvedne přístupové údaje.
Dále, pokud žadatel požádá o zřízení datové schránky online, přístupové údaje jsou vydány teprve
na jeho výslovnou žádost, protože přístup do schránky má již zajištěn pomocí Identity občana.
Přístupové údaje vydané Správcem při zřízení datové schránky i ve všech dalších případech jsou platné
pouze pro první přihlášení, kdy systém uživatele rovnou vyzve ke změně hesla, tak aby si uživatel zadal
heslo vlastní. Systém může kdykoliv znovu požádat uživatele o změnu přístupového hesla. Princip
změny hesla je poté stejný, jako v případě použití prvních přístupových údajů. V případě, že uživatel
používá k přístupu do datové schránky jiný technický prostředek (aplikaci), zajistí systém ISDS pomocí
programového rozhraní informování o okamžiku vypršení platnosti hesla a současně umožní heslo
změnit bez nutnosti použít webové rozhraní. Podrobná pravidla tvorby hesla jsou popsána v Technické
příloze 2 (popis služby ChangeISDSPassword).
Uživatel ISDS si může pomocí klientského portálu na vlastní riziko nastavit neomezenou platnost hesla.
Takové heslo pak neexpiruje automaticky, nicméně Správci je ponechána možnost v mimořádných pří-
padech změnu hesla vynutit.

Přístupové údaje pro administrátora či pověřenou osobu
Dle § 8 odst. 6 Zákona mohou oprávněné osoby pověřit další fyzické osoby přístupem do své datové
schránky, případně dle § 8 odst. 7 Zákona jmenovat administrátora s právem pověřovat další fyzické
osoby k přístupu do jejich datové schránky. Žádost o vygenerování přístupových údajů pro tyto osoby
lze podat následujícími způsoby:
    a) Na kontaktním místě veřejné správy (pracoviště Czech POINT).
    b) Vyplněním elektronického formuláře žádosti v prostředí administrativní části klientského por-
       tálu ISDS.
Přístupové údaje jsou generovány dle stejných pravidel jako při vzniku účtu, viz kapitola Přístupové
údaje pro oprávněné osoby datových schránek.

Pověřené osobě lze přidělit následující práva:
    •   Číst zprávy
    •   Číst zprávy určené do vlastních rukou
    •   Vytvářet a odesílat datové zprávy
    •   Prohlížet seznam dodaných zpráv i doručenek
    •   Vyhledávat datové schránky
    •   Mazat zprávy z trezoru
Jakmile je účet administrátora nebo pověřené osoby zřízen, ISDS odešle systémovou informační zprávu
do datové schránky žadatele.

Přístupové údaje pro poskytovatele dat
Externí agendové systémy povinných poskytovatelů dat dle § 16 Zákona přistupují ke službám ISDS
po přihlášení pomocí přihlašovacích údajů vydaných Správcem konkrétní fyzické osobě na základě
žádosti poskytovatele dat. Údaje potřebné v takové žádosti:
    •   jméno, příjmení
    •   vykonávaná funkce uvnitř organizace poskytovatele dat


© Digitální a informační agentura          Provozní řád ISDS                             Strana 11 z 26
    •    datum narození
    •    jméno poskytovatele dat
    •    jméno evidence (jména evidencí)
    •    sídlo (adresa) poskytovatele dat
    •    korespondenční adresa
    •    jméno a příjmení nadřízeného pracovníka
Žádost lze podat následujícím způsobem:
    a) Odesláním žádosti podepsané uznávaným elektronickým podpisem na e-podatelnu Správce
       (posta@dia.gov.cz).
    b) Odesláním žádosti opatřené ověřeným podpisem na poštovní adresu podatelny Správce.
    c) Odesláním žádosti do datové schránky Správce.
Oprávněný pracovník poskytovatele dat může následně požádat Správce o umožnění přístupu elektro-
nické aplikace, která se bude ke službám ISDS přihlašovat komerčním systémovým certifikátem.

Zneplatnění přístupových údajů a vydání nových
O zneplatnění vlastních přístupových údajů a vydání nových dle § 12 odst. 1 Zákona lze požádat násle-
dujícím způsobem:
    a)   Na kontaktním místě veřejné správy (pracoviště Czech POINT).
    b)   Odesláním žádosti opatřené ověřeným podpisem na poštovní adresu podatelny Správce.
    c)   Odesláním žádosti do datové schránky Správce.
    d)   Zadáním požadavku v prostředí klientského portálu ISDS po přihlášení Identitou občana.

Změna hesla
Každý uživatel ISDS si může změnit vlastní heslo v prostředí klientského portálu ISDS. Změna hesla
není považována za zneplatnění přístupových údajů ve smyslu Zákona.

Změna oprávněné osoby (vedoucí OVM, statutární zástupce)
         a) Změny vedoucích představitelů orgánů veřejné moci jsou automatizovaně přebírány z Rej-
            stříku OVM.
         b) Změny oprávněných osob u právnických osob zapsaných v registru osob jsou automatizo-
            vaně přebírány z registru osob, kam je zapisuje věcně příslušný editor po oznámení sub-
            jektu, kde došlo ke změně. Změnu statutárního zástupce právnické osoby je též možné
            ohlásit na kontaktním místě veřejné správy (pracoviště Czech POINT). Přílohou oznámení
            je v tomto případě listina dokládající změnu, například notářský zápis z valné hromady
            společnosti.
         c) Změny v evidenci statutárních auditorů ohlašuje Komora auditorů České republiky pomocí
            rozhraní pro poskytovatele dat.

Zrušení přístupu pověřené osoby či administrátora
Přístupové údaje pověřené osoby či administrátora Správce zneplatní neprodleně po obdržení žádosti
o zrušení pověření. Tuto žádost může podat oprávněná osoba následujícími způsoby:
    a) Na kontaktním místě veřejné správy (pracoviště Czech POINT).
    b) Vyplněním elektronického formuláře žádosti a jeho následným odesláním v prostředí klient-
       ského portálu ISDS.




© Digitální a informační agentura         Provozní řád ISDS                            Strana 12 z 26
Nakládání s přístupovými údaji
§ 9 odst. 2 Zákona uvádí: „Osoba oprávněná k přístupu do datové schránky je povinna zacházet s pří-
stupovými údaji tak, aby nemohlo dojít k jejich zneužití“. Uživatel ISDS, který předá své přístupové
údaje externí aplikaci, provozované mimo zařízení pod jeho plnou kontrolou, porušuje uvedené usta-
novení Zákona. Pokud Správce ISDS detekuje takové chování, může přistoupit ke zneplatnění přístu-
pových údajů uživatele nebo může přijmout jiné opatření, kterým zamezí možnému zneužití
kompromitovaných přístupových údajů. Zařízením pod plnou kontrolou uživatele se rozumí např. jeho
vlastní či pracovní PC, telefon, tablet apod. Mimo sféru kontroly uživatele se dostávají internetové,
webové a cloudové aplikace, kde dochází k ukládání přístupových údajů na servery mimo kontrolu
uživatele.

Změna osobních údajů
ISDS čerpá změny osobních údajů držitelů datových schránek i dalších uživatelů z registru obyvatel
(ROB), za předpokladu, že je fyzická osoba v agendě ISDS tzv. ztotožněna, bylo tedy získáno její
AIFO. Pokud nebyl uživatel schránky ztotožněn v ROB, spoléhá se na referenční údaje Registru osob
(ROS) nebo na údaje poskytnuté příslušným poskytovatelem dat, jako je např. profesní komora.
Pokud fyzická osoba, které byla zřízena datová schránka, změnila své osobní údaje (jméno, příjmení,
bydliště) a změna nebyla automaticky provedena, může tuto změnu ohlásit Správci, nejlépe formou
datové zprávy, případně jiným způsobem. Správce zajistí opravu údajů po prověření údajů v poskytnu-
tých dokladech.


3.    Přihlášení do ISDS
Náležitosti přístupových údajů a elektronické prostředky k přihlášení jsou stanoveny vyhláškou
č. 194/2009 Sb., o stanovení podrobností užívání a provozování informačního systému datových schrá-
nek (dále jen „vyhláška č. 194/2009 Sb.“). Nově vydané přístupové údaje jsou vždy tvořeny uživatel-
ským jménem a heslem, tak jak je definuje § 1 výše uvedené vyhlášky.

Přihlášení jménem a heslem dle § 1 vyhlášky č. 194/2009 Sb.
Uživatel má možnost zvolit rozšířené zabezpečení přihlašování formou jednorázového hesla (OTP =
One Time Password), a to buď formou SMS kódu doručeného pomocí placené služby Premium SMS
(Time-based One Time Password - TOTP) nebo formou bezpečnostního kódu generovaného software
/ hardware prostředkem dle specifikace RFC4226 (HMAC-Based One-Time Password - HOTP). Bez-
pečnostní heslo ve smyslu vyhlášky č. 194/2009 Sb. je pak tvořeno statickou částí doplněnou o tento
jednorázový bezpečnostní kód.
Pokud uživatel zvolí rozšířenou možnost zabezpečení, pak se nadále nemůže přihlašovat pouze jménem
a statickým heslem. V případě ztráty mobilního telefonu, hardware prostředku, případně pokud nastane
jakákoli jiná situace, která mu znemožní získání jednorázového bezpečnostního kódu, je jedinou mož-
ností, jak obnovit přístup k datové schránce, požádat o zneplatnění přístupových údajů a vydání nových.

Přihlášení jménem, heslem a certifikátem dle § 2 vyhlášky č. 194/2009 Sb.
Pokud si uživatel v prostředí klientského portálu ISDS v sekci Nastavení zaregistruje autentizační cer-
tifikát, nemůže se nadále přihlašovat bez něj. Certifikát je po přihlášení možné odregistrovat. Dojde-li
k tomu, že zaregistrovaný certifikát expiruje, uživatel ztrácí možnost přihlášení pomocí svých přístu-
pových údajů. Jedinou možností je pak požádat o zneplatnění přístupových údajů a vydání nových,
čímž dojde k odregistrování certifikátu.




© Digitální a informační agentura          Provozní řád ISDS                              Strana 13 z 26
Technický prostředek lze použít k přihlášení, pokud splní technické požadavky uvedené ve vyhlášce
č. 194/2009 Sb.

Přihlášení Identitou občana
Uživatelé datových schránek, kteří jsou v rámci ISDS ztotožněni v Registru obyvatel, se mohou ke
svým účtům v ISDS přihlásit pomocí libovolného prostředku pro elektronickou identifikaci s minimální
úrovní důvěry „značná“. Podrobnější informace o Identitě občana naleznete na webových stránkách
těchto služeb, viz kapitola 2 Odkazy. Přihlášení Identitou občana je možné jen v prostředí Klientského
portálu ISDS. Z prostředí aplikací třetích stran (přihlášení pomocí webových služeb) není tato autenti-
zační metoda podporována. Používáním Identity občana nedochází k deaktivaci přístupových údajů,
každý uživatel tedy má stále možnost přihlášení i pomocí nich, nicméně uživatel má možnost si sám
jejich použití deaktivovat a tím zvýšit úroveň zabezpečení přístupu do ISDS.
Držitelé více uživatelských účtů v ISDS si po úspěšném přihlášení mohou zvolit, který ze svých účtů
aktuálně chtějí využít. Pokud následně chtějí vstoupit do jiné datové schránky (použít jiný účet), mohou
to provést bez nového přihlášení – stačí vybrat z nabídky účtů v pravém horním rohu Portálu. Po od-
souhlasení Portál zobrazí obsah nové schránky.

Přihlášení pomocí Mobilního klíče eGovernmentu (dále “Mobilní klíč”)
Každý uživatel ISDS, kterému byly vydány přístupové údaje k účtu v datové schránce, si může po při-
hlášení do Klientského portálu ISDS aktivovat přihlašování pomocí mobilní aplikace „Mobilní klíč“.
Odkazy pro instalaci aplikace do mobilních telefonů a tabletů na platformách iOS a Android naleznete
v kapitole 2 Odkazy. Používáním Mobilního klíče nedochází k deaktivaci přístupových údajů, každý
uživatel tedy má stále možnost přihlášení i pomocí nich. Přihlášení pomocí Mobilního klíče je možné
jak v prostředí Klientského portálu ISDS (dále “Portál”), tak i pomocí aplikačního rozhraní ISDS, po-
kud tuto možnost bude příslušná aplikace třetí strany podporovat.
Držitelé více uživatelských účtů v ISDS mohou používat Mobilní klíč pro jeden i více uživatelských
účtů, musí však provést aktivaci Mobilního klíče jednotlivě pro každý zvolený účet.
Pokud je k Mobilnímu klíči připojeno víc uživatelských účtů (schránek), mohou uživatelé zvolit, který
ze svých účtů aktuálně využít. Pokud následně chtějí vstoupit do jiné datové schránky (použít jiný účet),
mohou to provést bez nového přihlášení - stačí vybrat z nabídky účtů v pravém horním rohu Portálu.
Po odsouhlasení Portál zobrazí obsah nové schránky.



4.       Přihlášení do datové schránky ve smyslu § 17 odst. 3 Zákona
Přihlášení do DS ve smyslu Zákona proběhne automaticky jako důsledek vybrané množiny operací
prováděných uživatelem datové schránky s jejich přesnou specifikací:
     •    Uživatel se ve smyslu Zákona přihlásil do datové schránky VŽDY, kdy se přihlásil MANU-
          ÁLNĚ na klientském portálu ISDS. Během této doby uživatel může pracovat s portálem: pro-
          hlížet si seznamy zpráv, stahovat došlé zprávy nebo dodejky/doručenky k odeslaným zprávám,
          konfigurovat svoje nastavení. Toto pravidlo platí, pokud již byla datové schránka zpřístupněna.
     •    Uživatel se ve smyslu Zákona přihlásil do datové schránky, pokud se přihlásil prostřednictvím
          aplikace třetí strany a provedl operaci získání seznamu došlých datových zpráv.
     •    Uživatel se ve smyslu Zákona nepřihlásil do datové schránky, pokud se přihlásil prostřednic-
          tvím aplikace třetí strany a provedl jakoukoli jinou operaci než získání seznamu došlých dato-
          vých zpráv.




© Digitální a informační agentura            Provozní řád ISDS                             Strana 14 z 26
Přístup do znepřístupněné schránky
K doručení datových zpráv v důsledku přihlášení do DS může dojít pouze v případě, že je tato DS zpří-
stupněná. Přihlašuje-li se uživatel do dočasně či trvale znepřístupněné DS, může využívat jen určité
omezené možnosti práce se schránkou a zprávami. Konkrétně, znepřístupněná DS umožní zobrazit
a stáhnout doručenou i odeslanou zprávu i dodejku a doručenku. Dále také umožňuje využívat funkci
ověření datové zprávy. Není možné z takové DS odesílat nové zprávy, ani není možné, aby do ní byly
nové zprávy dodávány.
Přihlášený uživatel může změnit své heslo a pokud je k tomu oprávněn, může také odebrat některou
z pověřených osob. Nemůže však přidat novou pověřenou osobu.


5.     Přihlášení pro získání přístupu k funkcím ISDS aplikacemi
       třetích stran

Způsob přihlášení
Všechny způsoby přihlášení, které umožňuje Portál datových schránek s výjimkou přihlášení Identitou
občana, je možné též implementovat v externí aplikaci. Doporučeným způsobem přihlášení aplikace
třetí strany je basic autentizace za pomoci systémového certifikátu, a to zejména s ohledem na zabez-
pečení a dále také proto, že akce vyvolané externí aplikací jsou pak v ISDS korektně logovány jako
akce externího systému a nikoli konkrétní fyzické osoby, která svěřila své přístupové údaje aplikaci.

Implementace přihlášení (basic autentizace)
Autentizační kanál je založen na basic http autentizaci, respektive na X509 klientském certifikátu dle
zvolené varianty. V této variantě není používána cookie a je tedy nutné, aby každý https požadavek
obsahoval hlavičku Authorisation se jménem a heslem, resp. klientský X509 certifikát.
Možné varianty připojení jsou:
     a) basic autentizace:
        https://ws1.datovka.gov.cz/DS/*
     b) klientský https certifikát zaregistrovaný jako systémový certifikát:
        https://ws1c.datovka.gov.cz/cert/DS/*
     c) klientský https certifikát zaregistrovaný jako uživatelský certifikát a basic autentizace:
        https://ws1c.datovka.gov.cz/certds/DS/*
     d) klientský https certifikát zaregistrovaný jako certifikát hostované spisové služby a id schránky
        jako jméno, heslo prázdné:
        https://ws1c.datovka.gov.cz/hspis/DS/*

Implementace přihlášení (jednorázový bezpečnostní kód)
Aplikace třetí strany mají možnost využít rozšířené zabezpečení a přihlašovat se jménem, statickým
heslem a jednorázovým bezpečnostním kódem (viz výše, odstavec Přihlášení jménem a heslem dle § 1
vyhlášky č.194/2009 Sb.). Vzhledem k technické povaze tohoto způsobu přihlášení je nutné, aby apli-
kace pracovala s autentizační cookie. Detailní popis autentizačního mechanismu pro přihlášení touto
metodou je uveden v souboru ISDS_OTP_autentizace.pdf, který je součástí Technické přílohy č.2.
Upozorňujeme, že autentizační metoda pomocí HOTP nebude do budoucna již podporována. Jako
multi-faktorovou autentizaci doporučujeme buď jméno/heslo/certifikát nebo Mobilní klíč.




© Digitální a informační agentura           Provozní řád ISDS                             Strana 15 z 26
Implementace přihlášení (Mobilní klíč)
Aplikace třetí strany mají možnost využít rozšířené zabezpečení a přihlašovat uživatele pomocí apli-
kace Mobilní klíč. Podrobný popis této metody je součástí Technické přílohy 2, v dokumentu Mobil-
niKlic_autentizace.pdf.


6.       Datová zpráva

Formát datové zprávy
Datovou zprávu tvoří obálka a obsah zprávy.
Strukturu datové zprávy určuje Technická příloha 1 (soubor dmBaseTypes.xsd).
Systém ISDS umožňuje získání datové zprávy označené elektronickou pečetí Agentury založené
na kvalifikovaném certifikátu (viz dokumentace webových služeb ISDS v příloze – operace Signed-
MessageDownload). Pokud uživatel v prostředí klientského portálu ISDS ukládá datovou zprávu
do souboru, zpráva se ukládá v tomto tvaru.
Podrobnější informace o ochranných prvcích sloužících v rámci celkového postupu při kontrole pra-
vosti datové zprávy naleznete v kapitole 2.1 „Vytvoření nové zprávy (odeslání zprávy)“ a v kapitole
2.4.2 „Stažení došlé podepsané zprávy“ v dokumentaci „Webové služby rozhraní ISDS pro manipulaci
s datovými zprávami“.
Obsahem zprávy může být jedna či více příloh v počítačovém formátu uvedeném v Příloze 3 vyhlášky
č. 194/2009 Sb.
Provozovatel má právo nepřijmout k odeslání datovou zprávu obsahující škodlivý kód.

Povolení přenosu formátů elektronických podpisů, pečetí a časových razítek
Vyhláška č. 194/2009 Sb. o stanovení podrobností užívání a provozování informačního systému dato-
vých schránek upravuje pouze přípustné formáty příloh datové zprávy dodávané do datové schránky.
Datovou zprávou se dle § 19 Zákona rozumí všechny dokumenty orgánů veřejné moci doručované
prostřednictvím datové schránky, úkony prováděné vůči orgánům veřejné moci prostřednictvím datové
schránky a dokumenty fyzických osob, podnikajících fyzických osob a právnických osob dodávané
prostřednictvím datové schránky. Zákon č. 300/2008 Sb. a související právní předpisy umožňují a v ně-
kterých případech dokonce přímo ukládají, aby tyto datové zprávy byly elektronicky podepsány a bylo
k nim připojeno časové razítko. Proto správce rozhodl, aby Informační systém datových schránek
umožňoval kromě doručování vlastních dokumentů i doručování elektronických podpisů, pečetí a ča-
sových razítek v běžně rozšířených formátech:
     •    CER, CRT, DER, PK7 – formáty certifikátů dle standardu X.509,
     •    P7B, P7C, P7F, P7M, P7S – formáty certifikátů a elektronických podpisů dle PKCS#7,
     •    TST, TSR – formáty pro elektronické razítko.

Omezení velikosti datové zprávy
ISDS umožňuje odeslat pouze datovou zprávu s přílohami, jejichž celková velikost bude maximálně
100 MB. Celková velikost kompletní datové zprávy, tedy obálky a příloh převedených do Base64 for-
mátu, může velikost 100 MB přesáhnout, obvykle ne více než o dalších 30 MB, nicméně rozbalení
komprimovaných příloh je limitováno až na 3 GB. Maximální počet příloh v jedné datové zprávě je
omezen na 100.




© Digitální a informační agentura         Provozní řád ISDS                            Strana 16 z 26
Hromadná datová zpráva
Pokud uživatel odesílá prostřednictvím klientského rozhraní datovou zprávu na více příjemců, použije
se funkce hromadného zasílání datových zpráv. Způsob odesílání datové zprávy na více příjemců s po-
mocí technického prostředku (aplikace) se může lišit v závislosti na způsobu implementace jednotli-
vých dodavatelů těchto aplikací. Jedna hromadná zpráva může mít maximálně 50 adresátů. Hromadná
zpráva není podporována u Velkoobjemových datových zpráv.

Doba uchovávání datové zprávy
ISDS uchová datovou zprávu po dobu 90 dnů od okamžiku, kdy se do datové schránky přihlásila osoba,
která má s ohledem na rozsah svých oprávnění přístup k dokumentu v datové zprávě obsaženém
(tj. od okamžiku doručení přihlášením). Datovou zprávu, která nebyla doručena přihlášením, uchovává
ISDS po dobu nejméně 3 let.


7.    Automatické notifikace a rozhraní pro příjem notifikací
ISDS generuje celou řadu automatických notifikací a zároveň nabízí i aplikační rozhraní, které mohou
využít externí aplikace (viz kapitola Napojení aplikací třetích stran).

Systémové datové zprávy
Systémové zprávy jsou odesílány při vybraných událostech či změnách, týkajících se datové schránky
a také jako „uvítací“ zpráva pro nové uživatele. Přehled systémových datových zpráv i příslušných udá-
lostí je uveden v Technické příloze 2, v dokumentu WS_Manipulace_s_datovymi_zpravami.pdf. Sys-
témové zprávy jsou odesílány buď ze systémové schránky Správce (aaaaaaa) nebo Provozovatele
(zzzzzzq).

Systémová notifikace e-mailem
Pokud si uživatel registruje e-mailovou adresu ke svému účtu, ISDS mu zasílá upozornění na dodání
nové zprávy, a to buď v základní nebo rozšíření podobě vč. předmětu zprávy a identifikace odesílatele.
ISDS nicméně nikdy nepřeposílá samotný obsah zprávy na e-mail. Dále touto cestou ISDS může infor-
movat uživatele o podstatných událostech ve vztahu k dotčení datové schránce nebo službách spojených
s ní.

Systémová notifikace krátkou textovou zprávou (SMS)
Pokud si uživatel registruje ke svému účtu telefonní číslo, na kterém má povolen příjem prémiových
(placených) SMS, ISDS mu zasílá upozornění na dodání nových datových zpráv.

Notifikace v prostředí aplikace Mobilní klíč eGovernmentu
Pokud si uživatel registruje přihlašování pomocí aplikace Mobilní klíč eGovernmentu, může získávat
upozornění na dodání nových datových zpráv i cestou této aplikace. Zároveň zde získává i upozornění
na další události spojené s datovou schránkou a jeho účtem.


8.    Napojení aplikací třetích stran
ISDS umožňuje napojení aplikací třetích stran, jako jsou například Agendové informační systémy or-
gánů veřejné moci, spisové služby orgánů veřejné moci, ERP systémů nebo DMS systémů komerčních
organizací a podobně, pomocí Webových služeb. Podrobný popis dostupných služeb je uveden v Tech-
nické příloze 2. Využití aplikačního rozhraní je automaticky povolené, nevyžaduje tedy žádnou regis-
traci, a je bezplatné.


© Digitální a informační agentura         Provozní řád ISDS                             Strana 17 z 26
Tyto služby jsou definované soubory dm_operations.wsdl a dm_info.wsdl. Použité datové typy jsou
definovány souborem dmBaseTypes.xsd. Podrobnosti a popis parametrů obsahuje soubor WS_Mani-
pulace_s_datovymi_zpravami.pdf (Technická příloha 2).

Webové služby manipulující s datovými zprávami pro použití v externích agendách
(včetně elektronických spisových služeb)

V dm_operations jsou definovány následující webové služby:
    •   vytvoření a odeslání nové zprávy – CreateMessage
    •   vytvoření a odeslání hromadné zprávy – CreateMultipleMessage
    •   stažení došlé zprávy – MessageDownload
    •   stažení došlé zprávy s pečetí Agentury – SignedMessageDownload
    •   stažení odeslané zprávy s pečetí Agentury – SignedSentMessageDownload
    •   ověření uložené datové zprávy – AuthenticateMessage
    •   přepodepsání velmi staré zprávy, dodejky či doručenky – Re-signISDSDocument.

V dm_arch je definována následující webová služba:
    •   přidání archivního razítka k uložené zprávě (ZFO formát) - ArchiveISDSDocument

V dm_info jsou definovány následující webové služby:
    •   stažení obálky došlé zprávy – MessageEnvelopeDownload
    •   stažení obálky odeslané zprávy – SentMessageEnvelopeDownload
    •   označení zprávy jako „Přečtená“ – MarkMessageAsDownloaded
    •   stažení informace o dodání a doručování zprávy – GetDeliveryInfo
    •   stažení informace o dodání a doručování zprávy, s pečetí Agentury
        – GetSignedDeliveryInfo
    •   stažení seznamu došlých zpráv – GetListOfReceivedMessages
    •   stažení seznamu odeslaných zpráv – GetListOfSentMessages
    •   doručení poštovní datové zprávy – ConfirmDelivery
    •   stažení seznamu zpráv, u kterých došlo ke změně stavu
        – GetMessageStateChanges
    •   zjištění identifikace odesílatele zprávy – GetMessageAuthor
    •   získání rozšířené identifikace odesílatele zprávy – GetMessageAuthor2
    •   smazání dlouhodbě uložené DZ (trezorové) – EraseMessage
    •   požadavek na stažení seznamu smazaných zpráv - GetListOfErasedMessages
    •   vyzvednutí asynchronního požadavku - PickUpAsyncResponse
    •   registrace externích notifikací - RegisterForNotifications
    •   stažení záznamů pro notifikace – GetListForNotifications
    •   oznámení podezřelé zprávy – SuspMessageReport

Pro práci s VoDZ existují tyto metody:
    •   vytvoření VoDZ – CreateBigMessage
    •   ověření neporušenosti VoDZ – AutenticateBigMessage
    •   nahrání přílohy – UploadAttachment
    •   stažení přílohy – DownloadAttachment
    •   stažení přijaté VoDZ – SignedBigMessageDownload
    •   stažení podepsané odeslané VoDZ – SignedSentBigMessageDownload
    •   stažení VoDZ v XML – BigMessageDownload



© Digitální a informační agentura       Provozní řád ISDS                          Strana 18 z 26
Aplikace mohou také využívat služby ISDSSearch, FindDataBox, CheckDataBox, GetDataBoxList,
GetDataBoxActivityStatus, FindPersonalDataBox, PDZinfo, DataBoxCreditInfo, DTinfo a PDZSen-
dInfo, GetDataBoxAddress popsané v souboru db_search.wsdl (viz Technická příloha 2). Popis jejich
funkčních parametrů je uveden v souboru WS_Vyhledavani_datovych_schranek.pdf (viz Technická
příloha 2).
Přihlášení do datové schránky majitele a doručování zpráv ve smyslu § 17 odst. 3 Zákona způsobuje
výhradně stažení seznamu došlých zpráv – GetListOfReceivedMessages.

Odesílací brána ISDS
Odesílací brána umožňuje aplikaci poskytovatele předání konceptu datové zprávy do perimetru ISDS,
kde tento koncept může autentizovaný uživatel schválit a odeslat. Tato služba je k dispozici všem drži-
telům datových schránek po předchozí samoobslužné registraci. Využití odesílací brány není chápáno
jako přihlášení do datové schránky ve smyslu Zákona. Autentizace uživatele tak nezpůsobuje doručení
dodaných datových zpráv. Služba je popsána v dokumentu OdesilaciBrana_ISDS.pdf (Technická pří-
loha 2).

Webové služby související s přístupovými údaji
Tyto služby jsou definované v souboru db_access.wsdl. Použité datové typy jsou definovány
souborem dbTypes.xsd. Podrobnosti a popis parametrů obsahuje soubor
WS_souvisejici_s_pristupem_do_ISDS.pdf (Technická příloha 2).

V db_access jsou definovány následující webové služby:
    •   získání informací o schránce přihlášeného uživatel – GetOwnerInfoFromLogin
    •   získání informací o přihlášeném uživatel – GetUserInfoFromLogin
    •   získání informace o expiraci hesla – GetPasswordInfo
    •   změna hesla – ChangeISDSPassword
Volání služeb definovaných v db_access.wsdl nezpůsobuje doručování zpráv dle § 17 odst. 3 Zákona.

Webové služby související OTP autentizací
Tyto služby jsou definované v souboru ChangePassword.wsdl. Použité datové typy jsou definovány
souborem ChangePasswordTypes.xsd. Podrobnosti a popis parametrů obsahuje soubor OTP_autenti-
zace.pdf (viz Technická příloha 2).

V ChangePassword.wsdl jsou definovány následující webové služby:
    •   změna hesla uživatele s OTP autentizací – ChangePasswordOTP
    •   zaslání jednorázového TOTP kódu formou SMS – SendSMSCode
Volání služeb definovaných v ChangePassword.wsdl nezpůsobuje doručování zpráv dle § 17 odst. 3
Zákona.

Verzování služeb
Některé služby existují ve více verzích, podporovaných souběžně. V technických přílohách tak můžete
narazit na službu ISDSSearch2 i ISDSSearch3 atd. Doporučujeme využívat novější verze, nicméně
i starší jsou stále funkční a není plánováno jejich ukončení.




© Digitální a informační agentura          Provozní řád ISDS                             Strana 19 z 26
9.       Napojení povinných subjektů uvedených v Zákoně
ISDS je z titulu § 15 a § 16 Zákona napojen na další agendové informační systémy, jako je například
Informační systém evidence obyvatel, obchodní rejstřík a další. s těmito systémy komunikuje ISDS po-
mocí webových služeb popsaných v Technické příloze 3, případně pomocí rozhraní specifických pro
konkrétní technické řešení.

Webové služby manipulující s datovými schránkami pro poskytovatele dat
Slouží pro použití specializovanými programy subjektů uvedených v § 15 a § 16 Zákona. Tyto služby
jsou definované pomocí souborů WS_Sprava_datovych_schranek.wsdl. Použité datové typy jsou defi-
novány souborem dbTypes.xsd.

Seznam webových služeb:
     •    vytvoření datové schránky – CreateDataBox
     •    trvalé znepřístupnění datové schránky – DeleteDataBox
     •    změna informací o datové schránce a jejím majiteli – UpdateDataBoxDescr
     •    přidání oprávněné osoby – AddDataBoxUser
     •    zrušení oprávněné osoby nebo zneplatnění přístupu při zrušení pověření – DeleteDataBoxUser
     •    změna informací o pověřené osobě – UpdateDataBoxUser
     •    znepřístupnění datové schránky při omezení osobní svobody / detenci / omezení způsobilosti
          nebo přerušení činnosti – DisableDataBoxExternally
     •    znepřístupnění datové schránky na žádost – DisableOwnDataBox
     •    znovuzpřístupnění datové schránky – EnableOwnDataBox
     •    získání seznamu oprávněných osob DS – GetDataBoxUsers a GetDataBoxUsers2
     •    nastavení přijímání komerčních DZ – SetOpenAddressing
     •    zrušení nastavení přijímání komerčních DZ – ClearOpenAddressing
Žádná z těchto webových služeb nezpůsobuje přihlášení do datové schránky a doručování zpráv ve
smyslu § 17 odst. 3 Zákona.

Verzování služeb
Některé služby existují ve více verzích, podporovaných souběžně. V technických přílohách tak můžete
narazit na službu ISDSSearch2 i ISDSSearch3 atd. Doporučujeme využívat novější verze, nicméně
i starší jsou stále funkční a není plánováno jejich ukončení.


10. Seznam držitelů datových schránek (SDS)
Kromě webové aplikace, pomocí které může veřejnost vyhledávat držitele zpřístupněných datových
schránek, nabízí SDS dvě služby externím aplikacím. Obě tyto služby jsou dostupné zcela veřejně, bez
nutnosti autentizace k jejich užití.
Pozn.: Seznam držitelů datových schránek obsahuje od 1.2.2024 informace o všech zpřístupněných da-
tových schránkách právnických osob a orgánů veřejné moci. Pro schránky fyzických a podnikajících
fyzických osob platí, že jsou v SDS obsaženy pouze pokud si o zveřejnění samy požádaly. Datový obsah
SDS je aktualizován nejméně jednou za 24 hodin, obvykle jednou za 3 hodiny.

Webové služby pro vyhledání datové schránky a získání informací o jejím držiteli
Metody GetInfo a SearchSubject jsou detailně popsány v souboru sds_ws.pdf, obsaženém v Příloze 2
tohoto Provozního řádu.



© Digitální a informační agentura          Provozní řád ISDS                           Strana 20 z 26
Datové exporty SDS jako otevřená data
SDS publikuje kompletní seznamy schránek v členění na právnické osoby, podnikající fyzické osoby
a orgány veřejné moci. Tyto soubory jsou volně ke stažení ve formátu XML. Detailní popis struktury
souborů a jejich URL adresy jsou uvedeny v dokumentu sds_datove_soubory.pdf, obsaženém v Příloze
2 tohoto Provozního řádu. Z důvodů ochrany osobních údajů není seznam schránek fyzických osob
publikován jako otevřená data.


11. Autentizační služba PVS
Autentizační služba PVS slouží k autentizaci uživatelů jiných informačních systémů na základě ověření
identity uživatele v identitním prostoru datových schránek. Kromě potvrzení o úspěšném přihlášení po-
skytuje služba se souhlasem uživatele též jeho identifikační údaje, jako je např. jméno, příjmení, typ
uživatele, typ datové schránky, údaje o datové schránce apod. Přihlášením se do informačního systému
za pomoci autentizační služby nedochází k přihlášení do datové schránky ve smyslu § 17 odst. 3 Zá-
kona.
Informační systém může Autentizační službu PVS využívat na základě registrace provedené
oprávněnou osobou nebo administrátorem v prostředí Klientského portálu ISDS. Technická specifikace
Autentizační služby PVS tvoří Technickou přílohu 4 tohoto Provozního řádu.
Funkčnost Autentizační služby lze kombinovat s Odesílací bránou ISDS, viz část II, kap. 7 tohoto Pro-
vozního řádu. Všechny informační systémy, které mají platnou registraci k využití Autentizační služby
PVS, mají zároveň rovnou registrováno též využití Odesílací brány ISDS.

Podmínky využívání Autentizační služby PVS
Digitální a informační agentura z pozice Správce ISDS stanovuje následující podmínky využívání Au-
tentizační služby PVS (dále jen AS).
    a) AS slouží výhradně k identifikaci a autentizaci uživatelů jiných informačních systémů veřejné
       správy, případně jiných informačních systémů ve správě orgánu veřejné moci (dále jen IS).
    b) Správce IS zajišťuje taková bezpečnostní pravidla a opatření, aby nedošlo ke zneužití osobních
       či přihlašovacích údajů uživatelů datových schránek.
    c) Správce i provozovatel IS zajišťuje, aby AS byla využívána v souladu s technickou specifikací
       AS a Provozním řádem ISDS.
    d) Správce IS zodpovídá za škodu způsobenou v souvislosti s využíváním AS. Správce IS se od-
       povědnosti zprostí, prokáže-li, že škodě nemohlo být zabráněno ani při vynaložení veškerého
       úsilí, které na něm lze spravedlivě požadovat.
    • Agentura je oprávněna pozastavit využívání AS tomu IS, u kterého by hrozilo zneužití AS v dů-
       sledku, kterého by mohla být ohrožena bezpečnost přihlašovacích či osobních údajů uživatelů
       datových schránek nebo provoz ISDS jako takového.
    e) Správce IS zodpovídá za nakládání s osobními údaji uživatelů datových schránek, které získal
       prostřednictvím AS. Správce IS podléhá příslušným ustanovením zákona č. 110/2019 Sb.,
       o zpracování osobních údajů.
    f) Správce IS je povinen nahlásit Správci ISDS jako bezpečnostní incident každý pokus o získání
       nebo zneužití informací souvisejících s přístupovými nebo osobními údaji uživatelů datových
       schránek nepovolanou osobou. Nahlášení se provádí na infolinku datových schránek a portálu
       veřejné správy – technickou podporu.
    g) IS může využívat AS na základě registrace provedené v konfiguraci datové schránky OVM.
       Doporučeným postupem je nejprve provést konfiguraci Autentizační služby v prostředí veřej-
       ného testovacího prostředí ISDS a teprve po otestování funkčnosti v produkčním prostředí
       ISDS.


© Digitální a informační agentura         Provozní řád ISDS                             Strana 21 z 26
    h) Veřejnou část serverového certifikátu, kterým se aplikace autentizuje pro využití AS, může
       správce IS samoobslužně vložit do ISDS v prostředí klientského portálu, části „Nastavení / Pří-
       stup externích aplikací“. Pokud pracovník správce IS z organizačních důvodů nemá přístup
       do nastavení datové schránky subjektu, může veřejnou část certifikátu zaslat Agentuře s žádostí
       o jeho registraci v ISDS. Správce IS bere na vědomí, že neposkytne-li Agentura nový certifikát
       své aplikace s předstihem nejméně 30 dnů před expirací zaregistrovaného certifikátu, vystavuje
       se riziku dočasné nefunkčnosti autentizace.


12. Přístupové rozhraní
Přístupové rozhraní pro poskytovatele internetových služeb (viz § 14a Zákona) slouží pro správu pří-
stupových údajů a identity osob oprávněných k přístupu do datových schránek a vazby přístupových
údajů těchto osob na přístupové údaje k individuálním uživatelským účtům v aplikaci poskytovatele.
Prakticky služby tohoto přístupového rozhraní umožňují obsluhu datové schránky z jiné internetové
aplikace, a to, aniž by uživatel této aplikace musel pokaždé zadávat své přístupové údaje k datové
schránce. Přihlášení k jeho datové schránce je realizováno na základě propojení jeho uživatelského účtu
v internetové aplikaci s uživatelským účtem ISDS.
Využití Přístupového rozhraní je možné teprve po vydání povolení Správcem, které je vázáno zejména
na splnění Podmínek pro využití přístupového rozhraní, tak jak jsou definovány ve Věstníku Digitální
a informační agentury (viz odkazy). Zájemce o využívání služeb Přístupového rozhraní tedy musí nej-
prve podat žádost na adresu Správce ISDS.
Technická specifikace přístupového rozhraní je obsažena v Technické příloze 5 tohoto Provozního
řádu.
Je zodpovědností správce internetové aplikace, aby poskytl Agentuře nový certifikát své aplikace
s předstihem nejméně 30 dnů před expirací zaregistrovaného certifikátu. Neučiní-li tak, vystavuje se
riziku dočasné nemožnosti využívat přístupové rozhraní.


13. Oznamování změn dodavatelům aplikací
Vzhledem k důležitosti, jakou pro orgány veřejné moci i pro řadu dalších subjektů představuje správná
funkčnost napojení vlastních aplikací na Informační systém datových schránek, Správce ISDS věnuje
zvláštní pozornost komunikaci se zástupci dodavatelů těchto aplikací. V rámci informačního webu da-
tových schránek je zřízena webová stránka, na které jsou publikovány jednak oznámené změny v oblasti
webových služeb, ale také pravidla vzájemného vztahu mezi Správcem ISDS a dodavateli aplikací tře-
tích stran. Více viz https://datovka.gov.cz/info/cs/74.html.

Upozornění na plánované změny v ISDS
Na výše uvedené stránce jsou publikována stručná upozornění na budoucí změny aplikačního rozhraní
ISDS (změny webových služeb). Změny, které neovlivňují existující funkcionalitu, mohou být nasa-
zeny a oznámeny kdykoli. Oproti tomu změny, které jakýmkoli způsobem mění existující funkčnost
webových služeb nebo přihlášení k nim, jsou zveřejňovány obvykle dva měsíce před jejich nasazením,
nebrání-li tomu mimořádné provozní či bezpečnostní důvody.

Pracovní prostor pro registrované dodavatele aplikací
Agentura zřídila pracovní prostor pro všechny zájemce o novinky a změny aplikačního rozhraní infor-
mačního systému datových schránek. Výrobce nebo dodavatel spisové služby, případně jiné aplikace,
využívající webové služby ISDS, se může do tohoto prostoru zaregistrovat zde:
https://registrace.poradnaisds.cz.


© Digitální a informační agentura          Provozní řád ISDS                             Strana 22 z 26
Obsahem pracovního prostoru jsou zejména knihovny obsahující aktuální i starší verze dokumentace
k webovým službám, ale i diskuzní fórum moderované Provozovatelem ISDS. Zveřejňování informací
o webových službách ISDS v rámci tohoto pracovního prostoru považuje Agentura za splnění infor-
mační povinnosti Správce Informačního systému datových schránek vůči dodavatelům aplikací třetích
stran.


14. Důvěrnost informací
ISDS používá a ukládá informace uvedené v § 14 odst. 3. Zákona. Správce ani Provozovatel ISDS nej-
sou oprávněni k přístupu do datových schránek jiných subjektů. ISDS je ve smyslu zákona č. 365/2000
Sb., informačním systémem veřejné správy, který je podle § 9 odst. 1 tohoto zákona neveřejnou evi-
dencí.


15. Zpracování osobních údajů
Správce i provozovatel ISDS zpracovávají osobní údaje v rozsahu, který je nezbytný pro splnění poža-
davků platných právních předpisů. Podrobné informace naleznete na této stránce.


16. Bezpečnost ISDS
ISDS, jakožto informační systém veřejné správy ve smyslu § 2 písm. b) zákona č. 365/2000 Sb., je
povinen podrobovat se pravidelnému bezpečnostnímu auditu. Zajištění auditu je zodpovědností Provo-
zovatele.

Bezpečnostní standardy
Návrh a implementace ISDS respektuje zásady následujících standardů:
    •   ISO/IEC řady 27001:2006 - Systémy řízení bezpečnosti informací ISMS


17. Dodržování přiměřenosti
Při práci s datovou schránkou musí být zohledněna frekvence stahování seznamů zpráv, stahování zpráv
a doručenek a odesílání datových zpráv tak, aby uživatel osobně nebo aplikace, kterou pro přihlašování
do datové schránky používá, nezatěžovala systém zbytečnými opakovanými dotazy, například na exis-
tenci nových datových zpráv.
Aplikace instalované na lokální stanici (jednotlivý počítač) se musí do datové schránky přihlašovat
pomocí manuálního příkazu uživatele (např. stisknutím tlačítka pro výběr a odesílání zpráv). Serverové
aplikace (případ, kdy s ISDS komunikuje server, který zprostředkovává požadavky klientských stanic)
se mohou do datové schránky přihlašovat automatizovaně při zohlednění nezbytně nutné frekvence
doručování a odesílání datových zpráv.
Aplikace, kterou pro práci s datovou schránkou uživatel využívá, musí zejména evidovat již doručené
datové zprávy a při následných dotazech na existenci nových datových zpráv stahovat jen seznam nově
doručených zpráv.
Automatizovaný dohledový systém Provozovatele ISDS sleduje a vyhodnocuje zátěž generovanou jed-
notlivými účty. Sledováno je pět kategorií činnosti:
    •   Stahování jednotlivých odeslaných zpráv
    •   Stahování jednotlivých došlých zpráv
    •   Stahování dodejek či doručenek


© Digitální a informační agentura         Provozní řád ISDS                             Strana 23 z 26
    •   Označování došlých zpráv jako stažené
    •   Stahování seznamů zpráv
Při déletrvajícím překračování interních limitů některé z výše uvedených kategorií činnosti může Pro-
vozovatel ISDS pomocí systémové zprávy informovat držitele schránky, k níž náleží daný účet, o této
skutečnosti. Pokud se situace nezlepší nebo držitel schránky svůj provoz nezdůvodní, může Provozo-
vatel přikročit (v souladu s § 5b zákona č. 365/2000 Sb., o informačních systémech veřejné správy,
v platném znění) k dočasnému aktivaci režimu omezeného přístupu pro daný účet. o zapnutí (i vypnutí)
omezujícího režimu bude schránka informována systémovou zprávou.

Jak se projeví režim omezeného přístupu:
        1. Nejprve je bez omezení propuštěn stanovený počet požadavků – až do systémem stanovené
           limitní hranice, odpovídající „normálnímu“ chování uživatele odpovídající běžnému pro-
           vozu schránky.
        2. Při příchodu nového požadavku po překročení limitní hranice v daném dni pro některé ze
           sledovaných volání webových služeb, pokud se právě nezpracovává jiný požadavek ze stej-
           ného účtu schránky, bude aplikováno omezení, spočívající v odložení vyřízení požadavku
           o nastavený čas T (současné nastavení je T = 3s).
        3. Pokud se již zpracovává jiný požadavek ze stejného účtu datové schránky, nový požadavek
           bude po čase T odmítnut. Tím se zabrání obcházení omezení zvýšením počtu vláken.
Cílem omezujícího režimu není zablokování práce, ale zpomalení na „normální“ úroveň. Popsané ome-
zení může být aplikováno i na více účtů jedné schránky. Přístupy přes klientský portál (i účtem v ome-
zeném režimu) nebudou nijak dotčeny.


18. Opatření zamezující šíření nevhodných zpráv
Příjemce zprávy, která dle něj vykazuje znaky „nevhodnosti“ může takovou zprávu nahlásit provozo-
vateli buď pomocí funkce klientského portálu ISDS nebo volání příslušné webové služby (Susp-
MessageReport). Do kategorie nevhodných zpráv řadíme nevyžádaná obchodní sdělení, opakovaná
podání se stejným obsahem, přílohy se závadným obsahem apod. Pokud bude příjemcem udělen sou-
hlas s přístupem k obsahu zprávy Správci a Provozovateli, bude provedena analýza obsahu a dle vý-
sledku může být taková zpráva označena příznakem “spam”. V závažných případech mohou být přijata
opatření, která zabrání dalšímu šíření takové zprávy, jako je např. zablokování stahování, zákaz odesí-
lání zpráv apod.


19. Dostupnost ISDS
ISDS je provozován nepřetržitě v režimu 24 x 7 s výjimkou plánovaných odstávek a pravidelné údržby.
Plánované odstávky zveřejňuje Provozovatel na stránkách https://datovka.gov.cz/.


20. Údržba systému
Údržba informačního systému ISDS může být učiněna kdykoliv během provozu, nejvýše však jedenkrát
v kalendářním týdnu, a to zpravidla každý pátek od 0:00 do 1:00 hod. v této době nemusí být systém
dostupný.




© Digitální a informační agentura          Provozní řád ISDS                             Strana 24 z 26
III. Kontakty
Správce:
Digitální a informační agentura
Na Vápence 915/14, 130 00 Praha 3
https://dia.gov.cz

Provozovatel:
Česká pošta, s.p.
Útvar e-GOV
Olšanská 38/9, 130 00 Praha 3

Informační zdroje:
Informační webové stránky projektu naleznete na adrese:
https://datovka.gov.cz/
Primárním kontaktním místem pro uživatele datových schránek je v případě obtíží či nejasností
telefonická linka +420 954 200 200, provozovaná v pracovní dny od 8 – 18 hodin.




© Digitální a informační agentura        Provozní řád ISDS                       Strana 25 z 26
IV. Technické přílohy
Technická příloha 1:
Popis XML struktury obálky datové zprávy.

Technická příloha 2:
Popis rozhraní pro komunikaci ISDS s Agendovými Informačními Systémy (AIS) třetích
stran (Elektronické spisové služby, agendy, rejstříky, DMS, ERP apod.).

Technická příloha 3:
Popis rozhraní ISDS pro příjem změnových údajů od povinných subjektů ze Zákona.

Technická příloha 4:
Popis Autentizační služby PVS a Odesílací brány.

Technická příloha 5:
Popis Přístupového rozhraní pro poskytovatele internetových služeb.




© Digitální a informační agentura   Provozní řád ISDS                  Strana 26 z 26
```
