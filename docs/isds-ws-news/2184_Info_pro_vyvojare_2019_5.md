# Info pro vyvojare 2019 5

_Source: https://info.mojedatovaschranka.cz/info/files/2184_Info_pro_vyvojare_2019_5.pdf_

```text
Informační systém datových schránek



Informace pro vývojáře aplikací, které
pracují s datovými zprávami
Datum: 24.4.2019
Verze: 1
Klasifikace: veřejný dokument


Anotace změny
Mění se způsob označení datové zprávy stavem 7 („stažená příjemcem“) u odeslaných zpráv.


Harmonogram změny
V prostředí veřejného testu ISDS bude změna nasazena v odstávce 5.5.2019. Na produkčním ISDS
bude změna nasazena později, dle odezvy vývojářů, buď již v následující odstávce 1.6.2019, nebo
v září 2019.


Odpovídající verze dokumentace
Změny jsou popsány ve veřejné dokumentaci, příručce WS_manipulace_s_datovymi_zpravami.pdf
od verze 2.68.


Vysvětlení
V současné verzi ISDS (tj. před popisovanou změnou) platí: pokud je přijatá datová zpráva označena
příjemcem jako „stažená“ (stav 7), je tento stav viditelný i z pohledu odesílatele (mezi odeslanými
zprávami).

Po nasazení změny bude platit: změna stavu na 7 u přijaté zprávy proběhne jako dnes, ale z pohledu
odesílatele zůstane zpráva ve stavu 6. Situace, že zpráva může mít různý stav z pohledu příjemce a
odesílatele, není pro ISDS nová – již dnes se to děje v případě, že jedna strana má trezor a uplyne 90
dní (z jedné strany je pak ve stavu 9, z druhé ve stavu 10), v různých stavech z obou stran se může
zpráva nacházet před dodáním (stav menší než 4).

Celý koncept „stažení zprávy“ je poněkud umělý – tento stav zprávy říká pouze to, že portálový
příjemce kliknul na řádek seznamu přijatých zpráv a získal detail zprávy, neříká nic o tom, že si přílohy
zprávy stáhnul a seznámil se s nimi. Stav 7 je nad rámec zákona o ISDS, nemá žádný význam
v doručování zpráv, není uveden událostí a časem v doručence zprávy, stav 7 se ztratí při přenosu do
Datového trezoru, není uveden v doručence smazané zprávy aj.

Externí aplikace (spisová služba) v roli příjemce může přijaté zprávy, které si stáhne pomocí speciální
webové služby, sama označit tímto stavem (např. proto, aby si je nestahovala podruhé). Protože ale
toto označení závisí pouze na autorovi aplikace, nelze se na něj spolehnout, jsou spisové služby, které
to nedělají, protože to pro svůj procesní model nepotřebují.


                                                                                                         1
Informační systém datových schránek


Rozhraní webových služeb
Stav zprávy se objevuje v rozhraní WS v popisu zprávy či doručenky (ale stav 7 jen jako informace,
není pro to žádná událost ve výpisu doručovacích událostí). Zde dojde ke změně – v informacích u
odeslané zprávy se nebude nově vracet stav 7 („stažená příjemcem“), ale pouze 6 („doručená
přihlášením“). S tím ostatně musí již dnes spisové služby počítat, protože ne všechny aplikace
označení „stažená“ provádějí. Z hlediska všech procesů daných zákonem je stav 7 ekvivalentní stavu
6.

Teoreticky se může stát, že stav 7 je použit ve filtru na seznam odeslaných zpráv (služba
GetListOfSentMessages). Praktický význam to ale nemá, spíše by se jednalo o chybu návrhu dané
aplikace – u odeslaných zpráv se musí uvažovat vždy současně stavy 6 i 7. Takže změna, že stav 7 u
nových odeslaných nebude, nemůže situaci zhoršit, jen u chybně napsaných zlepšit. U seznamu
přijatých (GetListOfReceivedMessages) filtr na stav 7 význam má – zde se ale nic nemění.


Dotčené webové služby
V práci s přijatými datovými zprávami se nic nemění.

GetListOfSentMessages
Služba vrací seznam odeslaných zpráv ze schránky volajícího. Ve staré verzi vrací stavy 6 i 7 u zpráv
doručených přihlášením, nově bude vracet stavy 6 a 7 u zpráv dodaných dříve než 5.5.2019 na VT,
resp. (zřejmě) 1.6.2019 na PROD. U zpráv novějších se již stav 7 vracet nebude.

Je chybou (i ve staré verzi) používat stav 7 (bez stavu 6) ve filtru na vstupu služby.

SignedSentMessageDownload
Služba vracející podepsanou staženou odeslanou datovou zprávu ve formátu ZFO (podepsané XML).
Stará verze vrací v elementu dmMessageStatus i stav 7, označený příjemcem. Nově se nerozlišuje
stav 6 a 7, vrací se pouze procesně významný stav 6 („doručeno přihlášením“).

GetDeliveryInfo a GetSignedDeliveryInfo
Služby vracející informace o doručování datové zprávy, ve verzi základní a podepsané. Pokud se na
doručenku ptá odesílatel, v nové verzi nedostane v elementu dmMessageStatus stav 7 („stažená
příjemcem“), ale jen stav 6 („doručená fikcí“).


Zpětná kompatibilita dat
Datové zprávy, označené již dříve příjemcem jako stažené (stav 7), zůstanou navždy v tomto stavu, a
odpovídající rozhraní bude vždy vracet skutečný stav. Toto platí i pro zprávy historické, viditelné
v klientském portálu (a v budoucnu také v rozhraní WS).




                                                                                                        2
```
