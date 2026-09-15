# Info pro vyvojare 2021 9

_Source: https://info.mojedatovaschranka.cz/info/files/2177_Info_pro_vyvojare_2021_9.pdf_

```text
Informační systém datových schránek



Informace pro vývojare aplikací –
podzim 2021
Datum: 26.08.2021
Verze: 1.1
Klasifikace: veřejný dokument



1 Anotace změn
   1. Pro rozhraní webových služeb je uvolněn přístup do „archivní databáze“ – úložiště obálek
      (metadat) datových zpráv, které byly již vymazány z datových schránek.
   2. Je zaveden mechanismus předávání informací o dodání datové zprávy do datové schránky pro
      externí aplikace. Aplikace (typu Portál občana) pak může sama notifikovat své uživatele o
      dodání zprávy. Čtení těchto informací o přijatých zprávách nezpůsobí doručení zpráv v dotčené
      schránce.



2 Harmonogram změny
Na produkčním ISDS se změny objeví v odstávce 5.9.2021. Novinky nijak nezasahují do stávajících
aplikací.



3 Popis změn
3.1 Seznam obálek smazaných zpráv
Archivní databáze není optimalizovaná na takový počet přístupů, který externí aplikace dokážou
najednou vyvolat. Proto pro získání seznamu obálek smazaných zpráv je použito asynchronní
zpracování:

   1. Aplikace požádá službou GetListOfErasedMessages o seznam za určité období a dostane
      pouze identifikátor požadavku.
   2. S tímto identifikátorem se periodicky ptá pomocí služby PickUpAsyncResponse, je-li již
      požadavek zpracován, pokud ano, dostane výsledek v XML nebo CSV komprimovaném
      formátu.

Hlavní význam seznamu smazaných (kromě vlastní evidence, resp. sjednocení s klientským portále
ISDS) je možnost nalézt libovolně starou datovou zprávu a k ní stáhnout doručenku. Přílohy těchto
zpráv jsou však již definitivně vymazány. Nijak nesouvisí s Datovým trezorem – zprávy v trezoru
nejsou zprávy vymazané.




                                                                                                    1
Informační systém datových schránek


3.2 Externí notifikace
Externím aplikacím s certifikátovým přístupem (typu Spisová služba, Hostovaná spisová služba nebo
Přístupové rozhraní) je nově umožněno stahovat redukovaný seznam dodaných zpráv bez vyvolání
akce „Doručení zpráv přihlášením“ v dotčené datové schránce. Použití je zejména pro potřeby
externích notifikací příjmu zpráv, tedy nevyužívat standardní notifikace ISDS, ale řídit si notifikace dle
svých potřeb a používat své notifikační kanály. Aplikace od ISDS získá stejná data, jaká se používají ve
standardních notifikací příjmu datové zprávy, v rozšířené variantě.

Pro umožnění stahování seznamu došlých zpráv za každou schránku je třeba provést registraci
k odběru službou RegisterForNotifications. Pro stažení seznamu se volá služba
GetListForNotifications.



3.3 WSDL a dokumentace
Výše uvedené novinky jsou obsaženy v nové verzi WSDL definic, verze 2.33. V Provozním řádu se
objeví těsně po odstávce, resp. jsou ke stažení na vývojářském webu Smartadministration.cz nebo na
obvyklých adresách.

Změny jsou popsány ve verzi 2.73 vývojářské dokumentace, která je součástí Provozního řádu nebo
s předstihem na vývojářském webu.




                                                                                                         2
```
