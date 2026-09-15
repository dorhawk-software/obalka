# Info pro vyvojare 2018 nove verze WS

_Source: https://info.mojedatovaschranka.cz/info/files/2185_Info_pro_vyvojare_2018_nove_verze_WS.pdf_

```text
Informační systém datových schránek



Informace pro vývojáře, používající
rozhraní webových služeb ISDS
Datum: 4. 9. 2018
Verze: 1.2
Klasifikace: veřejný dokument


Nové verze webových služeb pro správu schránek a vyhledávání
Od odstávky 2. 9. 2018 je v prostředí Veřejného testu nasazena verze jádra ISDS, obsahující kromě
stávajících veřejných webových služeb i jejich nové rozšířené a upravené verze. Jedná se o tyto
služby:

Kategorie vyhledávání
FindDataBox, ISDSSearch2

Kategorie správa schránek
CreateDataBox, UpdateDataBoxDescr, DeleteDataBox, DisableDataBoxExternally,
DisableOwnDataBox, EnableOwnDataBox, AddDataBoxUser, DeleteDataBoxUser,
DeleteDataBoxUsers, UpdateDataBoxUser, GetDataBoxUsers

Kategorie informace
GetOwnerInfoFromLogin, GetUserInfoFromLogin

Nová verze WSDL a XSD definic
Odpovídající verze definic (verze 2.31 – obsahuje staré i nové verze WS) budou umístěny v průběhu
týdne po odstávce ke stažení v prostředí Smartadministration pro vývojáře, nebo na webu jednotlivě,
např.

https://www.czebox.cz/static/wsdl/v20/db_manipulations.wsdl

Staré verze služeb zůstanou funkční. Pokud to nebude vysloveně nutné (z důvodu opravy chyby),
nebudou se již měnit.

Jmenná konvence
Nové služby mají sufix „2“ za jménem (tedy FindDataBox2 nahrazuje FindDataBox atd.), s výjimkou
v případě služby ISDSSearch3, která nahrazuje ISDSSearch2. V tomto textu budeme nové služby
souhrnně označovat jako služby „dvojkové“.

Souběžná platnost služeb
Nové dvojkové služby budou fungovat souběžně se starými službami, s jedinou výjimkou: služba
GetDataBoxUsers bude ještě v tomto roce zrušena a funkční bude jen její dvojková verze
GetDataBoxUsers2.

Dokumentovány v nových příručkách pro vývojáře (součást provozního řádu ISDS) budou již jen
dvojkové verze (od verze příruček 2.64). Popis starých verzí (včetně GetDataBoxUsers2) bude

                                                                                                    1
Informační systém datových schránek


zachován již jen ve starších verzích dokumentace (do 2.63), které budou ke stažení na vývojářském
webu.

Koho se změna týká
Aplikací Poskytovatelů dat a dalších aplikací veřejné správy i spisových aplikací a externích klientů
ISDS.

    a) Kdo ve své aplikaci používá službu GetDataBoxUsers pro výpis seznamu uživatelů schránky,
       MUSÍ přejít na její novou podobu GetDataBoxUsers2. Pokud dále s uživateli pracuje (přidává
       pověřené osoby, edituje, maže) musí též používat dvojkové verze. Kdo bude muset vyměnit
       pouze GetDataBoxUsers, může zůstat u WSDL verze 2.28.
    b) Kdo používá služby pro vyhledávání, MŮŽE přejít na jejich nové verze, nebo zůstat u starých.
    c) Kdo používá služby pro získání informací o schránce a uživateli, MŮŽE přejít na jejich nové
       verze, nebo zůstat u starých.

Běžné aplikace používají služby pro vyhledávání adresáta, případně služby informační a služby pro
manipulaci se zprávami. Tyto aplikace se NEMUSÍ měnit. Služeb pro manipulaci s datovými zprávami
(posílání zpráv, stahování seznamů a zpráv apod.) se výše uvedené změny netýkají.

Harmonogram nasazení
V prostředí Veřejného testu ISDS jsou změny nasazeny od odstávky 2. 9. 2018. Služba
GetDataBoxUsers bude vypnuta již bez dalšího upozornění v průběhu podzimu. O vypnutí služby
GetDataBoxUsers byly vývojáři informováni již v květnu – viz https://www.datoveschranky.info/-
/informace-pro-vyvojare-pouzivajici-rozhrani-webovych-sluzeb-pro-spravu-uzivatelu-datovych-
schranek.

V prostředí produkčního ISDS budou všechny změny nasazeny v listopadové odstávce
(pravděpodobně 4. 11. 2018). O termínu vypnutí služby GetDataBoxUsers zatím není rozhodnuto
(čeká se na úpravy jiných aplikací veřejné správy, které službu používají).

Na vývojářském webu Smartadministration bude v týdnu po odstávce k dispozici nová sada
vzorových příkladů v Java, dotNET a PHP.


Popis změn
Změny v popisu služeb se týkají zejména dvou základních struktur popisujících datovou schránku
(OwnerInfo) a uživatele schránku (UserInfo). Obě struktury jsou aktualizované poprvé od spuštění
ISDS v roce 2009. Jsou doplněny informace o ztotožnění, rozšířeny elementy adresy, naopak
vynechány již nepoužívané (a proto dnes prázdné) elementy. Přehlednou tabulku změn vidíte níže
v textu.

Legenda:

Význam barev
Odebrané elementy
Přidané elementy
Jinak změněné

                                                                                                        2
Informační systém datových schránek


X ve sloupci – tato hodnota nebyla ve staré nebo není v nové verzi.



Struktura OwnerInfo
Použito ve službách FindDataBox, GetOwnerInfoFromLogin, UpdateDataBoxDescr aj.

Element                          Verze 1                           Verze 2
ID schránky                      dbID                              dbID

Ztotožněn? 1                     X                                 aifoIsds

Typ schránky                     dbType                            dbType

IČO                              Ic                                ic

První jméno                      pnFirstName
                                                                                    2
                                                                   pnGivenNames
Druhé a další jména              pnMiddleName

Příjmení                         pnLastName                        pnLastName

Rodné příjmení 3                 pnLastNameAtBirth                 x

Název subjektu                   firmName                          firmName

Datum narození                   biDate                            biDate

Obec narození                    biCity                            biCity

Okres narození                   biCounty                          biCounty

Stát narození                    biState                           biState

Kód adresního místa 4 5          X                                 adCode

Město / Obec                     adCity                            adCity

Část obce                        X                                 adDistrict

Ulice                            adStreet                          adStreet

Číslo orientační                 adNumberInStreet                  adNumberInStreet

Číslo popisné/evidenční          adNumberInMunicipality            adNumberInMunicipality

PSČ                              adZipCode                         adZipCode

Stát                             adState                           adState

Občanství / Stát registrace 6    nationality                       nationality

E-mail 7                         email                             x



1
  Pouze pro schránky FO, PFO a PFO_podtypy, OVM_PFO a OVM_FO
2
  Sloučení křestních jmen do jednoho elementu, stejně jako je to v ROB
3
  Rodné příjmení se dle výkladu nesmí držet v ISDS
4
  Adresa v popisu schránky má různý význam pro různé typy schránek
5
  Kód adresního místa z RUIAN – jednoznačný identifikátor adresy, pokud je znám
6
  Občanství (FO nebo PFO) se nesmí vracet, ponecháme pro případnou novelu zákona, dnes se vrací NIL; pro PO
se vrací stát registrace
7
  Email na úrovni schránky nebyl zaveden

                                                                                                          3
Informační systém datových schránek


Element                       Verze 1                        Verze 2
Tel. číslo 8                  telNumber                      x

Id OVM (z ROVM) 9             identifier                     dbIdOVM

Kód externí agendy            registryCode                   x

Stav schránky                 dbState                        dbState

Povýšená schránka             dbEffectiveOVM                 x 10

Příjem PDZ (otevřené          dbOpenAddressing               dbOpenAddressing

adresování)
Nadřízená schránka OVM 11     X                              dbUpperID




Struktura UserInfo
Použito ve službách GetDataBoxUsers, GetUserInfoFromLogin aj.

Element                       Verze 1                         Verze 2
Ztotožněn?                    x                               aifoIsds

První jméno                   pnFirstName
                                                              pnGivenNames
Druhé a další jména           pnMiddleName

Příjmení                      pnLastName                      pnLastName

Rodné příjmení 12             pnLastNameAtBirth               x

Kód adresního místa           x                               adCode

Město / Obec                  adCity                          adCity

Část obce                     x                               adDistrict

Ulice                         adStreet                        adStreet

Číslo orientační              adNumberInStreet                adNumberInStreet

Číslo popisné / evidenční     adNumberInMunicipality          adNumberInMunicipality

PSČ                           adZipCode                       adZipCode

Stát                          adState                         adState

Datum narození                biDate                          biDate

ID uživatele (login) 13       userID                          x

IsdsID 14                     x                               isdsID


8
  Telefon na úrovni schránky nebyl zaveden
9
  Pouze pro schránky OVM, OVM_PO, OVM_PFO a OVM_FO, jinak prázdné
10
   Po novele již neexistuje
11
   Pouze pro schránky OVM_REQ, jinak prázdné
12
   Rodné příjmení se dle výkladu nesmí držet v ISDS
13
   Není důvod zde vracet přihlašovací údaj

                                                                                       4
Informační systém datových schránek


Typ uživatele                     userType                             userType

Práva uživatele                   userPrivils                          userPrivils

IČ společnosti 15                 ic                                   ic

Název společnosti 16              firmName                             firmName

Kontaktní adresa                  caStreet                             caStreet

Kontaktní adresa - obec           caCity                               caCity

Kontaktní adresa – PSČ            caZipCode                            caZipCode

Kontaktní adresa – stát           caState                              caState




Specifické úpravy některých služeb ISDS
Služba FindDataBox2
Služba FindDataBox pro vyhledávání schránek je nejpoužívanější webová služba ISDS. Tato služba má
na vstupu strukturu OwnerInfo pro zadání parametrů hledání, na výstupu taktéž stejnou strukturu
s výsledkem hledání (obecně v opakovací sekci). Jen některá pole lze použít jako filtr pro vyhledávání.

Nezmění se logika a pravidla vyhledávání (s výjimkou změny elementů). Jediná viditelná změna bude
odstranění starého způsobu omezení výstupu osobních údajů – v určitých případech se místo
osobních údajů (biCity, biCounty, biState, nationality u schránek typu FO a PFO) vracela
hvězdička, nově se bude ve stejných případech vracet hodnota NIL.

Podle elementu dbIdOVM (identifikátor OVM subjektu z Rejstříku OVM) lze i vyhledávat.

Nová služba FindDataBox2 bude mít na vstupu i výstupu novou podobu OwnerInfo. Na výstupu bude
významný boolovský element aifoIsds (příznak ztotožnění s ROB – je-li „true“, pak údaje o fyzické
osobě = držiteli schránky, jsou automatizovaně udržovány ve stavu podle ROB). Element může mít
hodnotu „true“ nebo „false“ u schránek FO, PFO, PFO profesní, OVM_PFO a OVM_FO, jinde má
hodnotu nil.

Příklad:

Odpověď na vyhledání jedné schránky (např. PFO z neOVM) bude tedy vypadat:

   <p:FindDataBox2Response xmlns:p="http://isds.czechpoint.cz/v30"
xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
       <p:dbResults>
          <p:dbOwnerInfo>
             <p:dbID>ggd4spn</p:dbID>
             <p:aifoIsds>true</p:aifoIsds>
             <p:dbType>PFO</p:dbType>
             <p:ic>25483404</p:ic>
             <p:pnGivenNames>Jan Václav</p:pnGivenNames>
             <p:pnLastName>Nejedlý</p:pnLastName>
             <p:firmName>Nejedlý - zahradník</p:firmName>

14
    Místo UserID se vrací unikátní IsdsID (IsdsID vrací GetDataBoxUsers2)
15
   ICO subjektu, který je právnickým statutárem
16
   Název subjektu, který je právnickým statutárem

                                                                                                      5
Informační systém datových schránek

             <p:biDate>1980-12-21</p:biDate>
             <p:biCity xsi:nil="true"/>
             <p:biCounty xsi:nil="true"/>
             <p:biState xsi:nil="true"/>
             <p:adCode>12345678</p:adCode>
             <p:adCity>Příbram II</p:adCity>
             <p:adDistrict>Lhota</p:adDistrict>
             <p:adStreet>Pražská</p:adStreet>
             <p:adNumberInStreet xsi:nil="true"/>
             <p:adNumberInMunicipality>30</p:adNumberInMunicipality>
             <p:adZipCode>26101</p:adZipCode>
             <p:adState>CZ</p:adState>
             <p:nationality xsi:nil="true"/>
             <p:dbIdOVM xsi:nil="true"/>
             <p:dbState>1</p:dbState>
             <p:dbOpenAddressing>true</p:dbOpenAddressing>
             <p:dbUpperID xsi:nil="true"/>
          </p:dbOwnerInfo>
       </p:dbResults>
       <p:dbStatus>
          <p:dbStatusCode>0000</p:dbStatusCode>
          <p:dbStatusMessage>Provedeno úspěšně. </p:dbStatusMessage>
       </p:dbStatus>
    </p:FindDataBox2Response>



Poznámka:
Služba FindDataBox2 dokáže nahradit službu FindPersonalDataBox, zavedenou pro potřeby Finanční
správy. Tato služba proto zmizí z veřejné dokumentace, byť bude nadále funkční.



Služba ISDSSearch3
Použitá služby bude rozšířeno o použití hodnoty identifikátoru OVM (IdOVM) pro vyhledávání. Této
služby se netýkají změny výše uvedených struktur. Změny jsou v textu vyznačeny červeně.

Změny vstupních parametrů – je přidán způsob hledání IDOVM:

      searchType – způsob hledání, string daný výčtem: GENERAL, ADDRESS, ICO, IDOVM, DBID;
       nepovinné, není-li uvedeno, použije se GENERAL

Změny výstupních parametrů – je přidán výstupní parametr dbIdOVM a odebrán parametr
dbEffectiveOVM:

      dbResults – pole (opakovací sekce) výsledků (nalezených schránek) dbResult;
          o dbID – ID schránky;
          o dbType – typ schránky daný řetězcovou konstantou
          o dbName – název schránky
          o dbAddress – složená adresa sídla schránky
          o dbBiDate – datum narození (je vraceno, pouze pokud vyhledávající schránka je OVM);
          o dbICO – IČO subjektu (pokud existuje)
          o dbEffectiveOVM – příznak tzv. Povýšené schránky OVM,
          o dbIdOVM – hodnota identifikátoru OVM (pokud existuje)
          o dbSendOptions – možnosti volající schránky odesílat do nalezené schránky různé typy
             datových zpráv; výčet hodnot: ALL, DZ, PDZ, NONE nebo DISABLED.

                                                                                                   6
Informační systém datových schránek


Příklad hledání podle IdOVM:
Požadavek:

     <v30:ISDSSearch3>
         <v30:searchText>13239473</v30:searchText>
         <v30:searchType>IDOVM</v30:searchType>
         <v30:searchScope></v30:searchScope>
         <v30:page></v30:page>
         <v30:pageSize></v30:pageSize>
          <v30:highlighting>false</v30:highlighting>
      </v30:ISDSSearch3>


Odpověď:
      <p:ISDSSearch3Response xmlns:p="http://isds.czechpoint.cz/v30"
xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
         <p:totalCount>1</p:totalCount>
         <p:currentCount>1</p:currentCount>
         <p:position>0</p:position>
         <p:lastPage>1</p:lastPage>
         <p:dbResults>
            <p:dbResult>
               <p:dbID>g3x4qsq</p:dbID>
               <p:dbType>OVM</p:dbType>
               <p:dbName>Ministerstvo úrody</p:dbName>
               <p:dbAddress>Lesní 1/1, 11000 Kvítečkov, CZ</p:dbAddress>
               <p:dbBiDate xsi:nil="true"/>
               <p:dbICO>13239473</p:dbICO>
               <p:dbIdOVM>13239473</p:dbIdOVM>
               <p:dbSendOptions>DZ</p:dbSendOptions>
            </p:dbResult>
         </p:dbResults>
         <p:dbStatus>
            <p:dbStatusCode>0000</p:dbStatusCode>
            <p:dbStatusMessage>Provedeno úspěšně.</p:dbStatusMessage>
         </p:dbStatus>
      </p:ISDSSearch3Response>

Poznámky:
   1. vracet dbEffectiveOVM je již dnes zbytečné, protože se po novele zákona o ISDS přestalo
      používat;
   2. protože data pro vyhledávácí engine (společná pro ISDSSearch2 i ISDSSearch3) budou nově
      obsahovat hodnoty IdOVM, může i stará služba vyhledávat podle IdOVM (při searchType =
      GENERAL), ale nemůže jej vracet.



Služba GetDataBoxList
OVM aplikace, které mají povolení stahovat seznamy schránek pomocí služby GetDataBoxList,
mohou nyní použít službu (název beze změny) s novým parametrem „ALL2“ (místo parametru „ALL“).
Ve výstupním seznamu pak obdrží sloupce odpovídající nové podobě struktury OwnerInfo.




                                                                                             7
Informační systém datových schránek


Úpravy aplikace SDS
Seznam datových schránek (samostatná aplikace na url https://www.czebox.cz/sds/welcome.do)
začne v prostředí Veřejného testu ISDS také využívat identifikátor OVM, na vstupu pro vyhledání
schránky i ve výstupních datech. Změna se týká

       webových služeb SearchSubject a GetInfo – vzniknou alternativní „dvojkové“ verze
        SearchSubject2 a GetInfo2 (staré verze budou fungovat nadále vedle nových);
       souborů se seznamy schránek (otevřená data – např.
        https://www.czebox.cz/sds/datafile.do?format=xml&service=seznam_ds_ovm) – ve
        staženém souboru přibude identifikátor OVM jako element IdentifikatorOvm.

Popis nových služeb i datových souborů je k dispozici na stránce SDS v prostředí veřejného testu:
https://www.czebox.cz/sds/welcome.do?part=opendata.




                                                                                                    8
```
