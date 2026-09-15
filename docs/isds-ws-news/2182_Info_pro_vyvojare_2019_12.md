# Info pro vyvojare 2019 12

_Source: https://info.mojedatovaschranka.cz/info/files/2182_Info_pro_vyvojare_2019_12.pdf_

```text
Informační systém datových schránek



Informace pro vývojáře aplikací, které
využívají Autentizační službu ISDS –
prosinec 2019
Datum: 4.11.2019
Verze: 1.2

Klasifikace: veřejný dokument


Anotace změny
Dochází k rozšíření množiny údajů o schránce a uživateli do Autentizační služby ISDS o dosud
chybějící adresní prvky a informaci o AIFO uživatele.


Harmonogram změny
V prostředí Veřejného testu ISDS bude změna nasazena 6.11.2019. Na produkčním ISDS bude změna
nasazena 8.12.2019


Dokumentace
Aktuální popis rozhraní Autentizační služby a výčet předávaných atributů je uveden ve veřejné
dokumentaci, příloze provozního řádu ISDS - OdesilaciBranaAutentizacniSluzba_ISDS.pdf. Současně
s nasazením na Veřejný test bude dokumentace upravena.
Obecný popis služby je uveden v Provozním řádu ISDS, kapitola 10.


Popis změn
V rozhraní jsou přidány tři nové atributy.
adDistrict – část obce u popisu schránky (u schránky FO jde o adresu bydliště, u schránky PFO o
ostatních jde o adresu sídla). Tato informace je již delší dobu zapisována do ISDS, získávána je
především z ROB, nebo z formulářů Czech POINT. Hodnota může být i prázdná, nebo duplicitní s obcí.
adCode – RUIAN kód adresního místa u popisu schránky (pro typy schránek platí totéž co pro
adDistrict). Aplikace si může tento kód přeložit sama na adresu. Údaj je uveden jen u adres,
které jsou zkontrolované proti RUIAN, neměly by být nesprávné. Může však být prázdný.
aifoTicket – stringový token vrácený ISZR službou e175 – iszrUlozMapaAifo. Aplikace, napojená
na OVM schránku/subjekt (jiná nemá na Autentizační službu nárok), si jej může nechat přeložit na
AIFO fyzické osoby (konkrétního schránkového uživatele ISDS) pro svůj AIS službou e176 –
iszrPodejMapaAifo. Tímto procesem získá aplikace jednoznačnou identitu fyzické osoby, která se
přihlásila do Autentizační služby. Ne všichni uživatelé ISDS jsou ztotožněni (mají AIFO) a lze je tímto
postupem ověřovat. Procento se liší podle typu schránek a typu uživatelů, např. držitelé schránek

                                                                                                          1
Informační systém datových schránek


typu FO nebo PFO jsou ztotožněni z 98 % (prakticky všichni kromě cizinců, kteří nejsou v ROB), ale
např. pověřené osoby u schránek typu PO jsou ztotožněni jen z cca 55 %. S tím je třeba počítat pro
své procesy.
Správce na příští rok plánuje tzv. „doztotožnění“ co největšího počtu uživatelů ISDS (české
národnosti), aby se identitní kmen ISDS zkvalitnil, zejména se to bude týkat pověřených osob u
schránek PO a OVM, které komunikují s veřejnou správou místo oprávněných osob (statutárních
zástupců či vedoucích). I s tím můžete ve svých plánech počítat.


Přidání nových atributů do existují Autentizační služby
Nové atributy nebudou automaticky přidány k dosavadním povoleným, je třeba o změnu požádat
správce, nejlépe textovou žádostí do datové schránky MV, s označením K rukám: odbor
eGovernmentu. Nezapomeňte uvést ID OVM schránky, pod níž je služba registrovaná, její ID (nebo
název).


Testovací prostředí ISDS a testování
V prostředí Veřejného testu ISDS lze o přidání atributů požádat i formou vývojářského fóra na
smartadministartion.cz. Ale reálné použití na neprodukčním prostředí je omezené – v testovacím
ROB není dost identit pro zkoušení předávání AIFO.
Předpokladem pro ověření překladu AIFO je napojení vaší aplikace na testovací ISZR.
Bude existovat jeden společný veřejný účet, napojený na testovací ROB. Jeho přístupové údaje budou
zveřejněné všem zájemcům, a proto budeme sledovat, jestli jej někdo nezneužije. Protože nejde
aktivnímu účtu s plnými právy zakázat přístup do Portálu, budeme sledovat zejména:
    •   změnu hesla;
    •   změnu přihlašovacích metod;
    •   změnu nastavení schránky;
    •   přidávání či mazaní pověřených osob;
    •   registrace služeb apod.
Přihlašování se do schránky, zasílání zpráv z a do této schránky, pokud nepřesáhne rozumné počty,
nevadí. Ale ve vlastním zájmu neposílejte žádné zprávy, které by neměli vidět jiní, schránka je
přístupná všem! Nezapomeňte, že tato schránka je velmi nevhodná pro testování spisových aplikací,
protože časté přihlašování oprávněné osoby bude způsobovat neustále doručování dodaných zpráv.
Aktivity se schránkou jsou logované, a kdo schránku úmyslně použije v rozporu s tímto dokumentem,
bude mu odebrán přístup do Testovacího prostředí (viz podmínky pro přístup do prostředí veřejného
testu ISDS, se kterými všichni vývojáři museli souhlasit).

Společná testovací schránka a její držitel
ID schránky: ms2gceg
Typ schránky: FO
Login: gp2hb4
Heslo: NikdoNemente-2xTrest
Jméno: Miluše Ficnarová, nar. 25.10.1966,

                                                                                                     2
Informační systém datových schránek


Místo narození: Souňov, okres Kutná Hora
Adresa: Havlíčkova 119, 40721 Česká Kamenice – Horní Kamenice
RUIAN kód adresy: 7021
Tuto (fiktivní) fyzickou osobu je třeba zavést do vaší testovací aplikace (napojené na testovací ISZR)
získat její AIFO pro svůj AIS. Poté můžete získat z ISDS aifoTicket a nechat si jej přeložit na svoje AIFO
(pomocí ISZR služby e176) a provést vyhledání ve své evidenci. Kdo není napojen na ISZR, bude
k vyhledávání používat jméno, příjmení, datum narození plus případně další předané atributy.




                                                                                                             3
```
