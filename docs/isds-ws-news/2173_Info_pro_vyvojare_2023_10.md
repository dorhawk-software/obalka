# Info pro vyvojare 2023 10

_Source: https://info.mojedatovaschranka.cz/info/files/2173_Info_pro_vyvojare_2023_10.pdf_

```text
Informační systém datových schránek



Informace pro vývojare aplikací – ríjen
2023
Datum: 23.11.2023
Verze: 1.2
Klasifikace: veřejný dokument



1 Anotace změn
      1. Zavedení nových typů schránek PFO profesních – PFO architekt, PFO autorizovaný inženýr a
         technik a PFO autorizovaný zeměměřický inženýr;
      2. Definitivní stanovení velikost VoDZ na 100 MB;
      3. Definitivní stanovení počtu příloh ve zprávě na 50;
      4. Limit pro celkovou velikost rozbalených příloh typu ZIP na 3 GB;
      5. Přidání atributů dmFileGuid a dmUpFileGuid v popisu příloh;
      6. Změna velikosti externího identifikátoru uživatele pro Přístupové rozhraní na 40 znaků;
      7. Nový číselník chyb.



2 Harmonogram změn
Pro body 1 – 4:

      Na Veřejném testu ISDS od 5.10.2023, na Produkci od 1.1. 2024.

Pro body 5 a 6:

      Na Produkci od 5.10.2023



3 Popis změn
3.1 Nové typy schránek PFO profesních
Novelou zákona č. 300/2008 Sb. se zavádějí profesní datové schránky PFO pro profese související se
stavebním zákonem:

 číslo   zkratka     Dlouhý název                            Střední název             Krátký název
 37      PFO_ARCH    Podnikající fyzická osoba - architekt   PFO architekt             Architekt
 38      PFO_AIAT    Podnikající fyzická osoba – autorizo-   PFO inženýr / technik     Inženýr / technik
                     vaný inženýr / technik
 39      PFO_AZI     Podnikající fyzická osoba – autorizo-   PFO zeměměřický inženýr   Zeměměřický inženýr
                     vaný zeměměřický inženýr




                                                                                                       1
Informační systém datových schránek


U těchto schránek PFO není povinné IČO (mnozí z držitelů jej ani nemají, jsou zaměstnanci) a schránky
nejsou synchronizovány s ROS (i když IČO bude zapsáno). Správu schránek provádějí příslušné komory.

Po nasazení na VT 5.10.2023 zde budou zřízeny schránky nových typů k testování poslání zpráv a
vyhledávání. Přihlašovací údaje budou zveřejněny na vývojářském webu.

3.1.1 WSDL a dokumentace
Nové typy schránek jsou obsaženy ve verzi WSDL/XSD definic 3.04 (pro aplikace ignorující VoDZ ve verzi
2.37). Prozatím jsou ke stažení na vývojářském webu poradnaisds.cz nebo na obvyklých adresách.

Změny jsou popsány ve verzi 3.0 vývojářské dokumentace, která je/bude součástí Provozního řádu ISDS
nebo s předstihem na vývojářském webu.



3.2 Velikost Velkoobjemové zprávy
Novelu vyhlášky č. 194/2009 Sb. budou zavedeny tzv. Velkoobjemové zprávy (VoDZ), tj. datové zprávy
s přílohami většími než 20 MB. Po diskusích s vývojáři a správci IS rozhodl správce ISDS o tom, že
velikost VoDZ bude max. 100 MB, tedy bude snížena z původně plánovaných 1 GB. Velikost 100MB
bude nastavena nyní v prostředí Veřejného testu a od 1.1.2024 i na Produkci.

WSDL definice obsahující VoDZ mají verzi 3.0x. Popis je uveden v dokumentaci verze 3.0. Oboje je ke
stažení na vývojářském webu.



3.3 Limit počtu příloh ve zprávě
Nově bude omezen počet příloh v jedné zprávě (běžné i VoDZ), shodně pro klientský portál i webové
služby – na 50. Pokud někdo potřebuje posílat větší počet, má k dispozici ZIP, který pojme až 1000
souborů v adresářové struktuře do 4. úrovně.



3.4 Limit velikosti rozbalených komprimovaných příloh
V ISDS budou nově povoleny komprimované kontejnerové formáty ZIP a ASiC. Kromě omezení na tyto
formáty, uvedené v předchozí dokumentaci, bylo zavedeno ještě omezení na celkovou velikost všech
příloh (v kontejnerech typu ZIP nebo ASiC) po rozbalení – na 3 GB. Je to z důvodu ochrany informačních
systémů adresátů.



3.5 Přidání atributů dmFileGuid a dmUpFileGuid
Na přání vývojářů byly u služby CreateBigMessage, u elementů popisujících přílohy dmFile i dmExtFile
povoleny nepovinné atributy dmFileGuid a dmUpFileGuid. Některé spisovky je používají k popisu
vazeb mezi přílohami. Význam a popis je shodný s popisem CreateMessage.

WSDL/XSD verze 3.04




                                                                                                    2
Informační systém datových schránek


3.6 Zvětšení velikosti externího identifikátoru
Pro billing Přístupového rozhraní ISDS (§ 14a zákona o ISDS) byla zavedena evidence externích klientů.
Identifikaci těchto klientů má na starost externí aplikace (ISDS je nezná a nedokáže odlišit). Aplikace
(typu Portál občana) proto s každým požadavkem na přihlášení předává řetězcový identifikátor
nazvaný IDExtAcc, který nemá pro ISDS žádný jiný procesní význam, než že při prvním použití (pro
přístup do jedné schránky) v roce bude zapsán do billingové statistiky.

Délka tohoto identifikátoru byla stanovena na 32 znaků, což se ukazuje jako omezující. Délka proto
byla zvětšena na 40 znaků (stávající omezení na povolené znaky se nemění), a současně bylo zavedena
přísnější kontrola dodržování. Od této doby bude požadavek z Přístupového rozhraní, obsahující
IDExtAcc > 40 znaků, odmítnut s chybou 401 s doplňujícím textem

   Predany identifikator uzivatele ma delku Y, ktera presahla max. povolenou delku 40.




                                                                                                     3
```
