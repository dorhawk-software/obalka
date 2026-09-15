# Info pro vyvojare 2025 1

_Source: https://info.mojedatovaschranka.cz/info/files/2187_Info_pro_vyvojare_2025_1.pdf_

```text
Informační systém datových schránek



Informace pro vývojare aplikací – leden
2025
Datum: 28.01.2025
Verze: 1.2
Klasifikace: veřejný dokument



1 Anotace změn
    1. Nová příloha u některých systémových zpráv.
    2. Omezení počtu stránek u výsledku fulltextového vyhledávání – pouze VT
    3. Možnost nahlášení „spamu“ a označení podezřelých zpráv – pouze VT



2 Harmonogram změn
Pro bod 1:

        Na všech prostředích od 30.1.2025.

Pro body 2 a 3:

        Na Veřejném testu ISDS od 30.1.2025.



3 Popis změn
3.1 Osvědčení o digitálním úkonu jako příloha SZ
Některé úkony se schránkou, provedené přímo z klientského portálu (přidání uživatele, smazání
uživatele, znepřístupnění, opětovné zpřístupnění, vydání nových přístupových údajů) resp. z „NIA
předsíně“ (zřízení schránky FO) byly správcem označeny jako úkony v katalogu služeb. Proto se při
jejich provedení generuje PDF dokument Osvědčení o digitálním úkonu (ODÚ), který slouží jako doklad
o provedení úkonu podle § 5 Zákona o právu na digitální služby. Uživatel najde toto PDF (obsahující též
vložená XML data) jako přílohu příslušné systémové zprávy, resp. u zřízení schránky jako přílohu Uvítací
zprávy. Existující přílohy starých systémových zpráv se nemění, protože některé aplikace je mohou
zpracovávat. Není vyloučeno, že v budoucnu zůstane příloha jediná – ODÚ.




                                                                                                      1
Informační systém datových schránek




3.2 Omezení počtu stránek u výsledku fulltextového vyhledávání
Služba ISDSSearch3 (i starší ISDSSearch2) může vracet neomezený počet stránek výsledků
fulltextového hledání schránek.

Služba ISDSSerach3 umožňuje stránkování výsledků pomocí dvou parametrů: pageSize = velikost
stránky a page = pořadové číslo stránky. Zatímco velikost stránky je omezena na 100 záznamů
(konstanta MAXSIZE), počet stránek omezen není - služba má v případě, že se žádá o stránku, která
neobsahuje žádné výsledky, vracet prázdnou odpověď. Spisovky obvykle rozumně stránkují výsledky
doporučeným způsobem (od první až do poslední neprázdné).

Kvůli jedné nerozumné aplikaci ISDS zavádí nový test vstupních parametrů. Bude zavedena konstanta
MAXPAGE, implicitně = 99 (stránky jsou počítány od 0, tedy max. počet stránek je 100). Systém bude
kontrolovat, že zadaná hodnota požadované stránky s výsledky (page) není větší než MAXPAGE. Pokud
ano, vrátí se nová aplikační chyba č. 1189 s textem „Příliš velká hodnota parametru page.“

Až 100x100 výsledků fulltextu je daleko více, než spisové aplikace potřebují k vyhledání schránky. Tato
služba nemá fungovat jako zdroj dat o schránkách.

Prozatím nasazeno na VT pro úpravu aplikací.




                                                                                                     2
Informační systém datových schránek


3.3 Nahlášení „spamu“ a nový příznak u zpráv
V ISDS byl implementována možnost nahlášení podezřelých nebo obtěžujících zpráv, jejich analýza a
případné zpětné označení takových zpráv novým příznakem (+ různá opatření proti odesílateli).
Aplikace se na to měly připravit. Správce vydá metodická doporučení, jak na případy podezřelých zpráv
mají aplikace reagovat.

Změny jsou zavedeny ve WSDL/XSD definicích verze 3.08 – pouze na VT. Očekává se diskuse vývojářů
k navrženému řešení. V testovacím prostředí bude umožněno vyzkoušet si přístup do schránky
s podezřelými či zablokovanými zprávami.

Obdobné nahlášení bude možné provést i z klientského portálu (z detailu došlé zprávy)




a zpráva s příznakem bude výrazně označena:




Aplikace by se měly chovat podobně.

3.3.1 Nová služba pro nahlášení „podezřelé zprávy“
Existuje veřejná WS SuspMessageReport, na vstupu povinně ID zprávy a nepovinně jméno, kontaktní
email a telefon a příznak Předat komplet a Poznámka. Zpráva musí být došlá do schránky volajícího a


                                                                                                   3
Informační systém datových schránek


musí v ní ještě existovat (nebýt u daného příjemce – oznamovatele smazaná), jinak se oznámení
odmítne. Nesmí být ze schránky OVM ani zpráva systémová.

Vstup:

    •     dmID – ID oznamované zprávy, povinné
    •     repName – jméno oznamovatele, nepovinné
    •     repMail – kontaktní mail oznamovatele, nepovinné
    •     repTel – kontaktní telefon oznamovatele, nepovinné
    •     allowComplete – BOOL příznak svolení se stažením kompletní zpráv včetně příloh, povinné
    •     note – obecná poznámka, nepovinná

Výstup:

    •     status

Specifické chyby:

    •     1186 – Oznámená zpráva nebyla dodána do schránky volajícího.
    •     1187 – Oznámená zpráva je již smazaná.
    •     1188 – Oznámená zpráva je od odesílatele typu OVM, nelze nahlásit.

Popis:

Pokud uživatel spisové aplikace nabude podezření, že zpráva (kromě zpráv zaslaných ze schránek
OVM!) vykazuje znaky „spamu“ (tj. nevyžádané obchodní sdělení, opakované bezdůvodné urážení,
možnost mallware apod.), může takovou zprávu nahlásit touto službou správci. Správce provede
analýzu zprávy a rozhodne o oprávněnosti oznámení.

Je třeba zadat ID existující zprávy došlé do schránky, z níž je služba volána a povolit správci stažení
kompletní zprávy (tj. ekvivalent stažení a poslání, správce sám stahovat zprávy nemůže). Pokud stažení
nebude povoleno, pak v případě, že nikdo jiný zprávu nenahlásí, bude pravděpodobně oznámení
odloženo, protože bez příloh se analýza provést nedá.

Samotným nahlášením zprávy tato zpráva nezíská žádný nový příznak. Teprve po analýze, která může
trvat hodiny až dny, se tato zpráva (a její „kopie“ v jiných schránkách) může zpětně označit jako
„podezřelá“ a získá speciální příznak, abys ní mohla aplikace zacházet „jinak“.



3.3.2 Nový příznak v seznamech a detailech
Zprávy, které analýza spamu označí jako podezřelé, získají speciální příznak. Příznak se objeví u níže
uvedených služeb u elementu dmRecord (nebo obdobného, detaily v XSD) jako nepovinný atribut
specMessFlag=“1“:

    •     GetListOfReceivedMessages
    •     MessageEnvelopeDownload
    •     MessageDownload
    •     BigMessageDownload




                                                                                                     4
Informační systém datových schránek


3.3.3 Zablokování stahování
Zcela výjimečně, pro případy nebezpečného agresivního malware, který prošel AV kontrolou jako
příloha zprávy, bude mít správce možnost u některých zpráv zablokovat stahování. Aplikace pak při
volání služeb na stažení zprávy dostane specifickou chybu 3022 „Správce zakázal stažení této zprávy
(antiSpam opatření).“. Při získání této chyby by aplikace měla přestat tuto zprávu stahovat (je zbytečné
to zkoušet dokola) a kontaktovat podporu ISDS.




                                                                                                      5
```
