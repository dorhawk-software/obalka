# Zásady ochrany osobních údajů – Obálka

[English version](PRIVACY.en.md)

Platné od 24. 9. 2026. Předchozí znění najdete v historii tohoto souboru na GitHubu.

## Stručně

- **Aplikace nemá žádný server.** Mluví přímo s Informačním systémem datových schránek (ISDS),
  a to jen tehdy, když o to požádáte.
- **Vaše zprávy, přílohy a hesla zůstávají ve vašem telefonu.** Vývojáři aplikace k nim nemají
  přístup.
- **Hlášení o chybách odcházejí jen s vaším souhlasem**, bez obsahu zpráv, jmen a ID schránek.
- **Přenos do jiného telefonu** může vést přes veřejný server nástroje croc, šifrovaně – server obsah
  nevidí.
- **Žádné reklamy, žádné sledování, žádný účet, žádný prodej údajů.**

## Kdo za aplikaci odpovídá

Správcem osobních údajů je Ondřej Šimon, ondrej@dorhawk.software, který aplikaci vydává pod
označením „Dorhawk Software“ (není to firma).

Obálka je nezávislá aplikace s veřejným zdrojovým kódem. Není oficiální aplikací Digitální
a informační agentury (správce ISDS) ani České pošty (provozovatele ISDS).

## Co zůstává ve vašem telefonu

Tyto údaje vývojáři aplikace nezpracovávají a nemají k nim přístup:

- **přihlašovací údaje a přihlášení** – v zabezpečeném úložišti telefonu (iOS Keychain, Android
  Keystore), zašifrované;
- **archiv zpráv** (obálky, stavy, koncepty, připomínky, nastavení) – v šifrované databázi;
- **stažené přílohy a podepsané originály zpráv** – v úložišti aplikace, kam jiné aplikace
  nemají přístup;
- **zálohy archivu** – zašifrované heslem, které vytvoří aplikace; uloží se v telefonu, případně
  tam, kam soubor sami uložíte;
- **záznam režimu ladění** – jen když ho zapnete; soubor v telefonu, který sdílíte jen vy sami.

Data aplikace se **nezahrnují do záloh celého telefonu** (iCloud, Google, počítač) ani do přenosu
při nastavování nového telefonu. Do nového telefonu je přenesete zálohou nebo přenosem v aplikaci.

Fotoaparát slouží jen ke čtení QR kódu z obrazovky druhého telefonu; kód se přečte přímo
v telefonu a nic se neukládá ani neodesílá. Oznámení jsou jen místní připomínky termínů, které si
nastavíte. Otisk prstu nebo obličej ověřuje systém telefonu; aplikace dostane jen výsledek.

## S kým aplikace komunikuje

### ISDS (datové schránky)

To je účel aplikace. Posílá se to, co ISDS potřebuje: přihlašovací údaje, dotazy na zprávy
a zprávy, které odešlete. Vždy přes HTTPS, přímo z telefonu, jen na váš pokyn (otevřením aplikace
nebo schránky, obnovením seznamu, stažením či odesláním zprávy), nikdy na pozadí.
Co se s údaji děje v ISDS, určují pravidla ISDS.

Pozor: už načtení seznamu přijatých zpráv je podle zákona doručením (§ 17 odst. 3 zákona
č. 300/2008 Sb.). Platí to pro každou aplikaci k datovým schránkám.

### Sentry – hlášení o chybách, jen se souhlasem

Aplikace se zeptá, zda smí posílat hlášení o chybách. Dokud neodpovíte, nic neodesílá. Rozhodnutí
změníte kdykoli v Nastavení → Diagnostika.

- **Co hlášení obsahuje:** jaká chyba nastala a kde v kódu, verze aplikace a systému, model
  telefonu, technické údaje (paměť, jazyk, časové pásmo). Na Androidu také náhodný identifikátor,
  který si knihovna Sentry vytvoří při instalaci – není nijak spojený s vaší osobou.
- **Co nikdy neobsahuje:** obsah ani předměty zpráv, jména, ID schránek, přihlašovací údaje, přílohy.
- **IP adresu** Sentry neukládá. Z adresy ale při příjmu odvodí přibližnou polohu (zemi, případně
  město).
- Při prvním spuštění po udělení souhlasu může na Androidu odejít i hlášení o zamrznutí aplikace,
  ke kterému došlo dříve.
- **Kam:** Sentry (Functional Software, Inc., USA), hlášení se ukládají na serverech v EU
  (Frankfurt). Sentry je americká firma, proto k datům může mít přístup i z USA; je certifikovaná
  podle rámce EU–USA pro ochranu údajů (Data Privacy Framework) a se Sentry je uzavřená smlouva
  o zpracování osobních údajů.
- **Jak dlouho:** 30 dní, pak se hlášení smažou.
- Hlášení čtou jen vývojáři aplikace, aby mohli chyby opravit.

### Přenos do jiného telefonu

Jen když přenos sami spustíte. Telefony se nejdřív zkusí spojit napřímo ve vaší síti. Když to nejde,
spojí se přes veřejný server open-source nástroje croc (croc.schollz.com), který provozuje jeho autor
Zack Schollz; server je teď v Německu. Server vidí IP adresy obou telefonů, čas a objem dat. Obsah
nevidí – je šifrovaný mezi oběma telefony klíčem z jednorázové fráze, kterou máte jen vy.
Přihlašovací údaje se nepřenášejí nikdy. Na iPhonu se systém při prvním přenosu zeptá na přístup
k místní síti; když ho nepovolíte, přenos půjde přes server.

### Odkazy a obchody

Odkazy (např. portál datových schránek) se otevírají ve vašem prohlížeči. Apple a Google zpracovávají
údaje o stažení aplikace podle svých zásad.

## Právní základ

- **Hlášení o chybách:** váš souhlas (čl. 6 odst. 1 písm. a) GDPR a § 89 odst. 3 zákona
  č. 127/2005 Sb.). Souhlas můžete kdykoli odvolat v Nastavení.
- **E-maily, které nám pošlete:** vyřízení vašeho dotazu (čl. 6 odst. 1 písm. f) GDPR).
- **Údaje ve vašem telefonu a komunikace s ISDS a se serverem croc:** tyto údaje vývojáři aplikace
  nezpracovávají; zpracovává je aplikace ve vašem telefonu na váš pokyn.

## Jak dlouho

- **V telefonu:** dokud je nesmažete – odebráním schránky nebo odinstalováním aplikace.
- **Hlášení o chybách:** 30 dní.
- **Server croc:** jen po dobu přenosu.
- **E-maily:** jen po dobu potřebnou k vyřízení vaší věci.

## Vaše práva

Máte právo na přístup ke svým údajům, jejich opravu a výmaz, omezení zpracování, přenositelnost,
právo vznést námitku a kdykoli odvolat souhlas. Stačí napsat na ondrej@dorhawk.software.

Hlášení o chybách neobsahují nic, podle čeho by se dala přiřadit právě vám, takže je většinou nelze
dohledat; smažou se ale samy po 30 dnech a jejich odesílání vypnete v Nastavení.

Stížnost můžete podat u Úřadu pro ochranu osobních údajů, Pplk. Sochora 27, 170 00 Praha 7,
https://uoou.gov.cz.

## Děti

Aplikace není určena dětem mladším 15 let.

## Bezpečnost

Zdrojový kód je veřejný: https://github.com/dorhawk-software/obalka. Bezpečnostní chybu prosím
hlaste soukromě na ondrej@dorhawk.software nebo podle souboru SECURITY.md.

## Změny

Změny se zveřejní v tomto souboru s novým datem platnosti. Historie všech změn je na GitHubu.
