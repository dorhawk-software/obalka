# MobilniKlic_autentizace - ISDS Mobile Key (Mobilní klíč) authentication for 3rd-party apps

_Verbatim extraction of `MobilniKlic_autentizace.pdf` v1.3 (2025-12-03), Technická příloha 2 of the
Provozní řád ISDS. Source bundle: https://info.mojedatovaschranka.cz/info/files/2237_Provozni_rad_ISDS_17_04_2026.zip (pril_2/)._

```text
Datové schránky


Podpora autentizace Mobilním klíčem
v rozhraní WS v ISDS
                            Vytvořeno dne: 25.4.2019
                            Aktualizováno: 27.11.2025
                                            Verze: 1.3
                         Klasifikace: Veřejný dokument
                            ISDS – Podpora autentizace Mobilním klíčem




Obsah

1         Úvod .................................................................................................3
    1.1      Použité zkratky ........................................................................................3
    1.2      Definice hostname pro prostředí ISDS .....................................................3
    1.3      Poznámky k novým verzím .......................................................................3
     1.3.1      Poznámky ke změnám ve verzi 1.3 ............................................................ 3
2         Autentizace pomocí Mobilního klíče ..................................................3
    2.1      Postup v bodech .......................................................................................4
     2.1.1      Registrace MK a získání komunikačního kódu .............................................. 4
     2.1.2      První POST požadavek .............................................................................. 5
      2.1.2.1      Odpověď z ISDS ............................................................................................... 5

     2.1.3      Periodická kontrola přihlášení .................................................................... 5
     2.1.4      Druhý POST požadavek ............................................................................ 7
      2.1.4.1      Odpověď ......................................................................................................... 7

     2.1.5      Zneplatnění cookie ................................................................................... 7




                                                             2                                              Veřejný dokument
                               ISDS – Podpora autentizace Mobilním klíčem


1       Úvod
        Tento dokument popisuje, jak se mohou externí aplikace, využívající rozhraní webových
        služeb, přihlašovat do schránky ISDS pomocí Mobilního klíče, způsobu přihlašování
        zavedeného v létě 2019.



1.1     Použité zkratky
        Zkratka                    Význam
        ATS                        Aplikace třetí strany, externí aplikace, která se chce přihlašovat do
                                   ISDS
        MK                         Mobilní klíč
        WS                         Webové služby (SOAP)




1.2     Definice hostname pro prostředí ISDS
        Název                      Adresa prostředí
        Veřejný test               www.czebox.cz
        Produkce                   www.mojedatovaschranka.cz


1.3     Poznámky k novým verzím
1.3.1   Poznámky ke změnám ve verzi 1.3
        Platné od 4.12.2025.
              •   Nová rozšířená verze služby pro periodické zjišťování stavu přihlašování –
                  mepWsStateUpdate2 – podrobnosti kap.2.1.3



2       Autentizace pomocí Mobilního klíče
        Externí aplikace třetích strany (ATS) musí v prvním kroku projít autentizačním
        mechanismem pro získání autentizační cookie (přitom dojde k potvrzení přihlášení pomocí
        Mobilního klíče uživatelem) a poté pomocí této cookie odesílá potřebná data. Na konci
        relace volá ATS službu pro zneplatnění obdržené cookie. Při nečinnosti delší než 30 minut
        bude relace přerušena (cookie zneplatněna).
        Webové služby ISDS pro aplikace třetích stran jsou dostupné na adrese
             https://<adresa_prostředí>/apps/DS/<endpoint_webové_služby>
        Pro text v hlavičkách X-Response-message-text je použita znaková sada UTF-8 a hodnota
        v hlavičce je kódována podle RFC 822 / RFC 2047
        (http://www.ietf.org/rfc/rfc2047.txt), kde je použita metoda B (base64
        enkódování). Pokud text přesahuje 70 znaků, je rozdělen do více bloků – viz příklad:
        X-Response-message-text: =?UTF-
        8?B?SmVkbm9yw6F6b3bDvSBrw7NkIG5lbW9obCBiw710IHphc2w=?= =?UTF-
        8?B?w6FuLiBaa3VzdGUgdG8sIHByb3PDrW0sIHBvemTEm2ppLg==?=




                                                       3                                    Veřejný dokument
                            ISDS – Podpora autentizace Mobilním klíčem


        Při každém požadavku by měla aplikace zasílat svoji jedinečnou identifikaci v hlavičce
        User-agent, aby bylo možné v případě hledání v logu snadno odlišit požadavky jedné ATS
        od jiných - viz příklad:
        User-agent: Email connector 1.0
        Kompletní ukázkový příklad v jazyce JAVA je k dispozici na vývojářském webu
        https://poradnaisds.cz v sekci Testovací prostředí > Dokumentace a formuláře
        (priklady_DemoMK.zip).




2.1     Postup v bodech
        1) V prostředí klientského portálu ISDS (https://www.mojedatovaschranka.cz) je třeba
           pro účet, jenž bude používán pro toto přihlašování, aktivovat Mobilní klíč a poté pro
           tento účet vygenerovat tzv. komunikační kód. Podrobnosti v kap. 2.1.1.
        2) ATS zasílá POST požadavek s basic autentizací, v níž je použito uživatelské jméno k
           účtu a komunikační kód jako heslo. Podrobnosti v kap. 2.1.2.
        3) Systém ISDS vrací odpověď, je získána pracovní S-COOKIE. Podrobnosti v kap.
           2.1.2.1.
        4) Aplikace Mobilní klíč obdrží PUSH notifikaci a vyžádá si od uživatele potvrzení
           přihlášení.
        5) ATS periodicky kontroluje stav přihlášení pomocí získané S-COOKIE. Podrobnosti
           v kap. 2.1.3
        6) Po získání potvrzení o přihlášení pomocí Mobilního klíče se zasílá POST požadavek
           s basic autentizací - stejně jako v bodě 2 (uživatelské jméno a komunikační kód jako
           heslo) + je přidána S-cookie. Podrobnosti v kap. 2.1.4.
        7) V odpovědi ATS získá autentizační cookie IPCZ-X-COOKIE. Tato cookie slouží k
           autentizaci při volání webových služeb a má platnost 30 minut. Podrobnosti v kap.
           2.1.4.1.
        8) ATS další komunikaci, již pomocí standardních WS z rozhraní ISDS, provádí s pomocí
           získané IPCZ-X-COOKIE na adrese
           https://<adresa_prostředí>/apps/DS/<endpoint_webové_služby>
        9) Po ukončení komunikace ATS volá službu pro zneplatnění IPCZ-X-COOKIE podle
           kapitoly 2.1.5


2.1.1   Registrace MK a získání komunikačního kódu
        Nutným předpokladem pro použití MK při přihlášení do ISDS přes WS je úspěšná
        registrace MK k účtu v ISDS. Registrace se provádí v prostředí klientského portálu ISDS,
        stránka Nastavení > Možnosti přihlášení > Přihlášení mobilním klíčem. Postupujte
        dle návodu na stránce nebo v nápovědě portálu.
        Po ověření funkčnosti MK přihlášením do portálu ISDS, si na výše uvedené stránce
        vygenerujte komunikační kód stisknutím tlačítka Vygenerovat přístupové údaje. Tento
        kód si poznamenejte.




                                                  4                                Veřejný dokument
                              ISDS – Podpora autentizace Mobilním klíčem




                            Obrázek 1 - získání komunikačního kódu v Nastavení portálu



2.1.2     První POST požadavek
          Získání S-cookie a vynucení přihlášení MK uživatelem proběhne po odeslání POST
          požadavku na adresu:
            https://[adresa_prostredi]/as/processLogin?type=mep-ws&
            applicationName=[jmeno_aplikace]&
            uri=https://[adresa_prostredi]/apps/DS/[endpoint_webove_sluzby]


          Tato služba je zabezpečena Basic autentizací, tj. v požadavku musí být zaslána hlavička v
          tomto tvaru hodnotaA:hodnotaB, zakódována do Base64.
          HodnotaA je tvořena uživatelským jménem.
          HodnotaB je tvořena komunikačním kódem.


          jmeno_aplikace se předá do PUSH notifikace, aby uživatel věděl, k čemu se přihlašuje
          (jaké aplikaci povoluje přístup do své schránky).


2.1.2.1   Odpověď z ISDS
          Pokud autentizace podle komunikačního kódu proběhla úspěšně, pak se vrací HTTP status
          302 a redirect na url
            https://[adresa_prostredi]/as/mepWsStateUpdate
          a hlavička s S-COOKIE:
            Set-Cookie:S-COOKIE=.....;

          Pokud autentizace proběhla neúspěšně, pak se vrací HTTP status 401.


2.1.3     Periodická kontrola přihlášení
          V této fázi ATS musí čekat, než uživatel na svém mobilním zařízení potvrdí přihlášení.
          PUSH notifikace (obsahující název aplikace, v detailu pak název schránky a jméno
          uživatele) zajistí spuštění aplikace a potvrzení.




                                                      5                                  Veřejný dokument
                       ISDS – Podpora autentizace Mobilním klíčem




                                 Obrázek 2 - vzhled notifikace v liště



Aplikace periodicky (např. každou vteřinu) kontroluje status přihlašování na adrese:
https://[adresa_prostredi]/as/mepWsStateUpdate s S-COOKIE získanou v předchozím
kroku.
Možné hodnoty odpovědi (v těle odpovědi):
      •   "-1": request nerozpoznán (chyba)
      •   "1": zatím nepotvrzený požadavek / čeká se na potvrzeni v aplikaci MK
      •   "2": požadavek potvrzený
      •   "3": požadavku vypršela platnost (exspirovaný)


Od prosince 2025 se alternativně nabízí rozšířená verze služby – mepWsStateUpdate2.
Služba vrací větší množinu stavů (více informací o stavu přihlašování, které lze předávat
čekajícímu uživateli) a také textový popis stavu.
Kód stavu       Textový popis
-1              Zadané ID požadavku neexistuje
1               Požadavek zaznamenán, čeká na odeslání push notifikace
11              Push notifikace odeslána na mobilní zařízení
12              Upozornění v notifikačním centru zařízení (jen Android)
13              Spuštěn Mobilní klíč (jen iOS)
19              Nepodařilo se odeslat push notifikaci na mobilní zařízení
2               Přihlášení potvrzeno
3               Uživatel zamítnul přihlášení, nebo vypršel čas pro potvrzení přihlášení


Odpověď je formátována jako JSON, její struktura je následující:
{
     "status": 11,
     "description": "Push notifikace odeslána na mobilní zařízení"
}


Pouze stav 2 znamená, že se uživatel přihlásil.
Schválení požadavku na přihlášení musí proběhnout do 240 sekund.



                                                 6                                  Veřejný dokument
                              ISDS – Podpora autentizace Mobilním klíčem




2.1.4     Druhý POST požadavek
          Po získání stavu 2 v předchozím kroku je nutno odeslat znovu POST požadavek na adresu
            https://[adresa_prostredi]/as/processLogin?type=mep-ws&
            applicationName=[jmeno_aplikace]&
            uri=https://[adresa_prostredi]/apps/DS/[endpoint_webove_sluzby]


          Je použita Basic autentizace, shodná s prvním POST požadavkem (kap. 2.1.2) a je předána
          S-COOKIE.


2.1.4.1   Odpověď
          V případě úspěchu se vrací vrátí HTTP status 302 a autentizační IPCZ-X-COOKIE
            Set-Cookie:IPCZ-X-COOKIE=.......;
          Tato cookie slouží k autentizaci pro následné volání webových služeb a má platnost 30
          minut.


2.1.5     Zneplatnění cookie
          Zneplatnění autentizační cookie probíhá zasláním GET požadavku na adresu
            https://<adresa_prostředí>/as/processLogout?uri=https://<adresa_prostredi>
            /apps/DS/<endpoint_webové_služby>




                                                    7                              Veřejný dokument
```
