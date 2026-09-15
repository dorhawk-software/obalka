# Info pro vyvojare 2023 7

_Source: https://info.mojedatovaschranka.cz/info/files/2174_Info_pro_vyvojare_2023_7.pdf_

```text
Informační systém datových schránek



Informace pro vývojare aplikací –
cervenec 2023
Datum: 02.08.2023
Verze: 1.1
Klasifikace: veřejný dokument



1 Anotace změn
    1. Zavedení minimální délky vyhledávací fráze pro služby fulltextového vyhledávání schránek.
    2. Nový číselník chyb



2 Harmonogram změny
Na Veřejném testu ISDS od 27.7.2023, na Produkci od 5.10. 2023.



3 Popis změn
3.1 Minimální délka vyhledávací fráze
Služby fulltextového vyhledávání datových schránek ISDSSearch2 a ISDSSearch3 dnes akceptují
vyhledávací frázi délky jeden znak. Výsledná vrácená množina schránek je příliš velká a neslouží
k vyhledávání. V klientském portálu je zavedeno omezení na dva znaky fráze. Služba parametrického
vyhledávání FindDataBox2 má již dnes omezení na tři znaky.

Nově je u webových služeb ISDSSearch2 a ISDSSearch3 zavedena minimální délka vyhledávací fráze
v elementu searchText 2 znaky. Pokud bude zaslán požadavek s frází délky 1 znak, pak se vrátí nová
chyba 1180 – „Příliš krátká vyhledávací fráze.“.

WSDL a XSD definice služeb se nemění (platí stále verze 2.36).



Příklad chybného požadavku:
<v20:ISDSSearch3>
   <v20:searchText>a</v20:searchText>
   <v20:searchType>GENERAL</v20:searchType>
   <v20:searchScope>ALL</v20:searchScope>
   <v20:page>1</v20:page>
   <v20:pageSize>100</v20:pageSize>
</v20:ISDSSearch3>


Vrátí se:
<p:ISDSSearch3Response>
   <p:dbStatus>

                                                                                                   1
Informační systém datových schránek

      <p:dbStatusCode>1180</p:dbStatusCode>
      <p:dbStatusMessage>Příliš krátká vyhledávací fráze.</p:dbStatusMessage>
   </p:dbStatus>
</p:ISDSSearch3Response>




                                                                                2
```
