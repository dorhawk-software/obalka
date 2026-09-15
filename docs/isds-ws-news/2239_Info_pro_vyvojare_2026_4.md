# Info pro vyvojare 2026 4

_Source: https://info.mojedatovaschranka.cz/info/files/2239_Info_pro_vyvojare_2026_4.pdf_

```text
Informační systém datových schránek



Informace pro vývojare aplikací – duben
2026
Datum: 28.04.2026
Verze: 1.2
Klasifikace: veřejný dokument



1 Anotace změn
    1.   DDD formát – rozšíření testů
    2.   Vyhledávání PFO_BASE (VT i PROD)
    3.   Atribut isds_send v ZFO zprávě (VT -> PROD)
    4.   Jemný typ DS ve zprávách a doručenkách (pouze VT)

Novinky v PROD (bod 2) jsou popsány v dokumentaci verze 3.7, změny WS jsou uvedeny ve WSDL
definicích verze 3.10.

2 Harmonogram změn
Pro bod 1 a 2:

         Na Veřejném testu i Produkčním prostředí od 16.4.2026

Pro bod 3:

         Na Veřejném testu již od 4.12.2025, na Produkčním prostředí od 16.4.2026

Pro bod 4:

         Na Veřejném testu (pouze) od 16.4.2026.



Původně plánovaná změna domény z mojedatovaschranka.cz na datovka.gov.cz byla odložena cca o
měsíc.



3 Popis změn
3.1 DDD formát
U DDD souborů digitálních tachografů, povolených od 1.1.2026 jako přílohy datové zprávy, byly
povoleny další novější varianty formátu. Výsledkem bude neodmítání některých DDD souborů při
vložení do zprávy z důvodu, že obsah neodpovídá příponě.




                                                                                           1
Informační systém datových schránek


3.2 Vyhledávání základních typů schránek
Na základě podnětu od vývojáře byla provedena úprava ve vyhledávání schránek: pokud nějaká PFO
má více schránek typu PFO (např. PFO základní a PFO advokát), nedokázaly stávající služby vyhledat
jen schránku PFO základní, zatímco PFO podtyp ano.

Problém byl v tom, že identifikátor typu schránky PFO se používal ve dvou významech: jako kategorie
PFO (včetně podtypů, tzv. hrubý typ), a jako označení typu schránky PFO základní. Podle kontextu se
význam obvykle poznal. Po naplnění ISDS 2.5 miliony schránek PFO se ukázalo, že existuje nemálo PFO
(tj. jedno IČO), ke kterému jsou zřízeny dvě a více schránek kategorie PFO. Při pokusu vyhledat podle
IČO schránku PFO pomocí parametrického hledání (FindFDataBox2) ze strany neOVM schránky se
vrátil status, že ve výsledku je více než jeden záznam. U fulltextového hledání (ISDSSearch3) se vrátila
množina výsledků, ale nešlo výsledek omezit pouze na PFO základní.

Řešení spočívá v přidání nového virtuálního (neskutečného) typu schránky „PFO_BASE“ (a dalších)
k identifikátorům používaným k popisu hledané schránky.

Identifikátory jsou:

 Identifikátor     Význam pro hledání
 PFO_BASE          Pouze PFO – základní typ
 PO_BASE           Pouze PO – základní typ
 OVM_MAIN          Pouze OVM hlavní schránka


Platí:

    •    Je-li na vstupu parametrického nebo fulltextového vyhledání (i v hledání v Seznamu DS) použit
         PFO_BASE, bude hledání omezeno pouze na typ PFO (číselně 30), bude-li použito PFO, bude
         hledání omezeno na typy PFO a podtypy [30, 31, 32, 34, 35, 36, 37, 38, 39 a 50].
    •    Je-li na vstupu parametrického nebo fulltextového vyhledání (i v SDS) použit PO_BASE, bude
         hledání omezeno pouze na typ PO (číselně 20), bude-li použito PO, bude hledání omezeno na
         typy PO, OVM_PO a PO_REQ - [20, 22, 16]. Zde je použití spíše teoretické, dvě schránky PO
         s jedním IČO by se neměly objevit.
    •    Je-li na vstupu parametrického nebo fulltextového vyhledání (i v SDS) použit OVM_MAIN,
         bude hledání omezeno pouze na typ OVM (číselně 10), bude-li použito OVM, bude hledání
         omezeno na typy OVM hlavní, OVM_REQ, OVM_PFO, OVM_FO - [10, 13, 14, 15]. Je novinkou
         pouze pro parametrické vyhledávání.

 Způsob hledání         PFO_BASE               PO_BASE               OVM_MAIN
 parametrické           nové                   nové                  nové
 fulltextové            nové                   nové                  již dříve existovalo
 SDS fulltext           nové                   nové                  již dříve existovalo


V prostředí VT lze novinku vyzkoušet – existují dvě schránky PFO pro jedno IČO 41630149:

    •    typ PFO – ID: pyymbuw
    •    typ PFO_ADVOK – ID: yr9mbut




                                                                                                      2
Informační systém datových schránek


Zatímco parametrický dotaz na typ „PFO“ vrátí dva záznamy (pokud se ptá OVM) nebo chybu (pokud
se ptá neOVM), při použití typu „PFO_BASE“ se vrátí jeden záznam.
      <v20:FindDataBox2>
          <v20:dbOwnerInfo>
             <v20:dbID></v20:dbID>
             <v20:dbType>PFO_BASE</v20:dbType>
             <v20:ic>41630149</v20:ic>
             <v20:pnGivenNames> </v20:pnGivenNames>
…



Fulltextový dotaz lze položit takto:
      <v20:ISDSSearch3>
          <v20:searchText>41630149</v20:searchText>
          <v20:searchType>GENERAL</v20:searchType>
          <v20:searchScope>PFO_BASE</v20:searchScope>
          <v20:page>0</v20:page>
          <v20:pageSize></v20:pageSize>
…


Pro využití této novinky je třeba používat WSDL definice verze 3.10.



3.3 Atribut isds_send
Při stažení datové zprávy nebo doručenky do ZFO (podepsaná XML data) z KP nebo pomocí příslušných
WS se k vnějšímu elementu odpovědi (tj. např. SignedMessageDownloadResponse) historicky
přidává atribut isds_send, který však již dnes nemá žádný význam. Atribut nebyl nikdy
dokumentován a není uveden ve WSDL/XSD definici. Je uveden u vnějšího elementu odpovědi mezi
elementy, které slouží k technickému popisu XML, jako jsou namespaces, tj. v části, která nenese žádné
údaje zpracovávané aplikacemi.

Atribut isds_send se přestane přidávat do ZFO. Změna se týká KP (stažení zprávy nebo doručenky do
ZFO) a webových služeb: SignedMessageDownload, SignedSentMessageDownload,
GetSignedDeliveryInfo, SignedBigMessageDownload, SignedSentBigMessageDownload.

Na VT je nasazeno již o začátku prosince 2025 bez jakékoliv odezvy.



3.4 Jemný typ schránky v popisu zprávy a doručenky
Na základě požadavku vývojářů byla provedena změna v datech stažení zprávy a doručenky: v datech
doručenky a datové zprávy je nově zapisován jemný typ schránky odesílatele (např. 31 pro advokáta).
Ve stávající verzi (platné od zahájení provozu) zde byl uveden pouze typ hrubý (např. 30 = PFO pro
všechny PFO i PFO podtypy). Hlavním důvodem jsou případy více schránek jedné PFO (např. základní a
advokáta) – pak v ZFO doručence odeslané zprávy nemusí být na první pohled zřejmé, z jaké schránky
to dotyčná PFO poslala.

Jedná se o elementu dmSenderType s hodnotami postaru pouze 10 = OVM, 20 = PO, 30 = PFO, 40 =
FO, 0 pro systémové zprávy, ponovu však se zde budou uvádět typy jemné (10, 11, 12 až 50). WSDL/XSD
samotné se však měnit nemusí (až na komentář), tento výčet typů není součástí XSD.



                                                                                                    3
Informační systém datových schránek


Změna hodnoty údaje (rozšíření možností výčtu) ve struktuře datové zprávy a doručenky je
nekompatibilní změna, ale spíše drobná – jeden element může místo 4 hodnot obsahovat 13 hodnot,
máme za to, že většina spisovek to ani nepozná. Aplikace se přesto musí zkontrolovat a připravit – je
proto nasazeno předem na VT.

U zpráv podaných před zavedením změny se typ schránky nemění – týká se jen zpráv podaných druhý
den po nasazení, tj. od 27.3.2026 . Starší zprávy (tj. podané před 27.3.2026 a stažené po změně) budou
obsahovat i nadále hrubý typ.

Hrubý typ schránky odesílatele na jemný se v elementu dmSenderType změní:

    •   Na výstupu WS vracejících obálku zprávy: MessageDownload, BigMessageDownload,
        MessageEnvelopeDownload + podepsaných variantách včetně SignedSentMessage-
        Download;
    •   Na výstupu WS vracejících seznam zpráv: GetListOfSentMessages, GetListOfRe-
        ceivedMessages, GetListOfErasedMessages;
    •   Na výstupu WS vracejících doručenku: GetDeliveryInfo, GetSignedDeliveryInfo;
    •   Ve stažených ZFO z KP (zpráva i doručenka).

Ukázka na výstupu:
     <q:GetDeliveryInfoResponse xmlns:q="http://isds.czechpoint.cz/v20"
xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
         <q:dmDelivery>
            <p:dmDm xmlns:p="http://isds.czechpoint.cz/v20">
               <p:dmID>1637401</p:dmID>
               <p:dbIDSender>v7h2kxf</p:dbIDSender>
               <p:dmSender>Dvořák - advokát</p:dmSender>
               <p:dmSenderAddress>Dvořákova 201, 12300 Praha,
CZ</p:dmSenderAddress>
               <p:dmSenderType>31</p:dmSenderType>
               <p:dmRecipient>Test </p:dmRecipient>
               <p:dmRecipientAddress>Dvory 201, Krč, 14300 Praha 4,
CZ</p:dmRecipientAddress>
               <p:dmSenderOrgUnit xsi:nil="true"/>




                                                                                                    4
```
