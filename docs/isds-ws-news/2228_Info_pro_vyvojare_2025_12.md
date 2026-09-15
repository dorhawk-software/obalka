# Info pro vyvojare 2025 12

_Source: https://info.mojedatovaschranka.cz/info/files/2228_Info_pro_vyvojare_2025_12.pdf_

```text
Informační systém datových schránek



Informace pro vývojare aplikací –
prosinec 2025
Datum: 04.12.2025
Verze: 1.0
Klasifikace: veřejný dokument



1 Anotace změn
    1.   Úprava lhůt pro přerazítkování
    2.   Rozšíření API pro Mobilní klíč
    3.   Odstranění atributu isds_send ze stažené zprávy – pouze VT
    4.   Povolení DDD příloh – z VT -> PROD



2 Harmonogram změn
Pro body 1 a 2:

         Na Veřejném testu i Produkci od 4.12.2025 večer.

Pro bod 3:

         Na Veřejném testu od 4.12.2025 večer, na Produkci později

Pro bod 4:

         Na Produkci se povolí automaticky 1.1.2026



3 Popis změn
3.1 Úprava lhůt pro přidání archivních razítek
Po prvních praktických zkušenostech a používáním WS pro přerazítkování ArchiveISDSDocument
bylo rozhodnuto o úpravě lhůt, v nichž lze přidat archivní razítko.

    a) První archivní razítko do CAdES-T (tj. po stažení podepsané zprávy):
           • PROD i VT: nejdříve 24 hodin po stažení (-> chyba 2209)
    b) Další archivní razítko do CAdES-A (tj. pokračování archivace):
           • PROD: nejdříve 18 měsíců před exspirací předchozího archivního razítka (-> chyba
                2206)
           • VT: 24 hodin po přidání předchozího archivního razítka (pro usnadnění testování)

Dokumentace: WS_manipulace_s_datovymi_zpravami.pdf, verze 3.61 (součást Provozního řádu ISDS)




                                                                                           1
Informační systém datových schránek


3.2 Změny v API pro Mobilní klíč
Na žádost vývojářů bylo přidáno rozšíření API pro přihlašování aplikací třetích stran pomocí Mobilního
klíče tak, aby uživatel získal více informací o stavu přihlašování.

K tomuto účelu vznikla rozšířená verze služby pro periodické zjišťování stavu přihlašování –
mepWsStateUpdate2

Služba vrací větší množinu stavů (více informací o stavu přihlašování, které lze předávat čekajícímu
uživateli) a také textový popis stavu.

 Kód stavu      Textový popis
 -1             Zadané ID požadavku neexistuje
 1              Požadavek zaznamenán, čeká na odeslání push notifikace
 11             Push notifikace odeslána na mobilní zařízení
 12             Upozornění v notifikačním centru zařízení (jen Android)
 13             Spuštěn Mobilní klíč (jen iOS)
 19             Nepodařilo se odeslat push notifikaci na mobilní zařízení
 2              Přihlášení potvrzeno
 3              Uživatel zamítnul přihlášení, nebo vypršel čas pro potvrzení přihlášení



Odpověď je formátována jako JSON, její struktura je následující:
 {
      "status": 11,
      "description": "Push notifikace odeslána na mobilní zařízení"
 }


Dokumentace: MobilniKlic_autentizace.pdf, verze 1.3 (součást Provozního řádu ISDS)



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



3.4 DDD přílohy i na PROD
1.1.2026 dopoledne se povolí DDD soubory (záznamy digitálních tachografů) jako přílohy datových
zpráv. V prostředí VT se testuje již od září 2025.

Podrobnosti viz Info_pro_vyvojare_2025_9.pdf.

                                                                                                    2
```
