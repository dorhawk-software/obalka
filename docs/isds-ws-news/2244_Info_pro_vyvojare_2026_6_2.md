# Info pro vyvojare 2026 6 (v1.1)

_Source: https://datovka.gov.cz/info/files/2244_Info_pro_vyvojare_2026_6_2.pdf_

```text
Informační systém datových schránek



Informace pro vývojare aplikací –
cerven 2026
Datum: 23.06.2026
Verze: 1.1
Klasifikace: veřejný dokument



1 Anotace změn
   1. Změna domény produkčního prostředí mojedatovaschranka.cz -> datovka.gov.cz
   2. Jemný typ DS ve zprávách a doručenkách (VT -> PROD)

Novinky v PROD jsou popsány v dokumentaci verze 3.8, změny WS jsou uvedeny ve WSDL definicích
verze 3.11.

2 Harmonogram změn
Pro bod 1:

       Na Veřejném testu od 29.1.2026, na Produkčním prostředí od 25.6.2026

Pro bod 2:

       Na Veřejném testu již od 16.4.2026, na Produkčním prostředí od 25.6.2026



3 Popis změn
3.1 Změna domény
ISDS postupně přechází do domény gov.cz.

Testovací prostředí ISDS, běžící historicky na doméně czebox.cz je (od 29.1.2026) dostupné na doméně
datovka-test.gov.cz. Dosavadní URL odvozené od czebox.cz zůstávají prozatím v platnosti, tedy
aplikace by neměly nic poznat, nicméně doporučujeme postupně přejít na doménu novou.

Obdobná změna na produkčním prostředí je provedena 25.6.2026. Nová doména bude
datovka.gov.cz.

Termín ukončení platnosti starých domén nebyl dosud určen, vývojáři budou v předstihu informováni.

3.1.1 CMS2
I do CMS2 byl testovací ISDS publikován v internetové doméně czebox.cz. Nově však je používána
přidělená doména datovka-test.cms2.cz.

Obdobná změna na produkčním prostředí je provedena 25.6.2026. Nová doména bude
datovka.cms2.cz.


                                                                                                  1
Informační systém datových schránek


Stávající domény zůstávají v platnosti, termín ukončení však není znám, doména není pod správou
ISDS.



3.2 Jemný typ schránky v popisu zprávy a doručenky
Na základě požadavku vývojářů byla provedena změna v datech stažení zprávy a doručenky: v datech
doručenky a datové zprávy je nově zapisován jemný typ schránky odesílatele (např. 31 pro advokáta).
Ve stávající verzi (platné od zahájení provozu) zde byl uveden pouze typ hrubý (např. 30 = PFO pro
všechny PFO i PFO podtypy). Hlavním důvodem jsou případy více schránek jedné PFO (např. základní a
advokáta) – pak v ZFO doručence odeslané zprávy nemusí být na první pohled zřejmé, z jaké schránky
to dotyčná PFO poslala.

Jedná se o element dmSenderType s hodnotami postaru pouze 10 = OVM, 20 = PO, 30 = PFO, 40 = FO,
0 pro systémové zprávy, ponovu však se zde budou uvádět typy jemné (10, 11, 12 až 50). WSDL/XSD
samotné se však měnit nemusí (až na komentář), tento výčet typů není součástí XSD.

Změna hodnoty údaje (rozšíření možností výčtu) ve struktuře datové zprávy a doručenky je
nekompatibilní změna, ale spíše drobná – jeden element může místo 4 hodnot obsahovat 13 hodnot,
máme za to, že většina spisovek to ani nepozná. Aplikace se přesto musí zkontrolovat a připravit – bylo
proto nasazeno předem na VT.

U zpráv podaných před zavedením změny se typ schránky nemění – týká se jen zpráv podaných od
druhého den po nasazení, tj. od 26.6.2026 . Starší zprávy (tj. podané před 26.6.2026 a stažené po
změně) budou obsahovat i nadále hrubý typ.

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
…


Úprava byla v prostředí Veřejného testu ISDS přes dva měsíce.


                                                                                                     2
```
