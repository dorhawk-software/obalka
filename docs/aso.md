# App Store Optimization (ASO) & Naming

App display/brand name: **Obálka** ("envelope" - ties to the signed ZFO *obálka* of a data message).
Internal RN project name stays `ObalkaDatovaSchranka`; store-facing names below.

> ⚠️ **Trademark caveat (verify before registering):** "datová schránka" is a generic/legal term -
> nobody owns it. The brand **"Obálka"** is the only ownable mark, so check that CZ.NIC (or others)
> don't hold a confusingly similar mark before registering, and consider protecting "Obálka" yourself.

## App Store (iOS)

- **Name** (≤30): `Obálka: datová schránka`  (23 chars - brand + top keyword in the highest-weight field)
- **Subtitle** (≤30): `Datové zprávy a ISDS chytře`  (27 chars - adds keywords + benefit)
- **Keywords** (≤100, hidden, comma-separated, **no spaces after commas**):
  `datovka,datová,schránka,ISDS,datové,zprávy,úřad,podání,eGovernment,pošta,doručenka,DS`
  - Rules: don't repeat words already in name/subtitle (the algorithm combines them); no spaces after
    commas (wastes chars); don't list singular+plural of the same word - the root suffices.

> **Not ready to publish as is.** The keyword set above repeats words the name and subtitle already carry
> (`datová`, `schránka`, `ISDS`, `datové`, `zprávy`) and lists two forms of one root (`datová` / `datové`) —
> both against the rules stated with it. Revise it before the store listing goes out.

## Google Play (Android)

- **Title** (≤30): `Obálka – datová schránka ISDS`  (29 chars - Play has no keyword field, so keywords live in
  title + description)
- **Short description** (≤80, high ranking weight): `Moderní aplikace pro datové schránky. Čtěte a odesílejte datové zprávy z ISDS.`  (78 chars)
- **Long description**: weave keywords in naturally (Play penalizes stuffing; target ~2–3 % keyword
  density). Terms to distribute: datová schránka, datové zprávy, ISDS, doručenka, úřední pošta,
  eGovernment, OSVČ, firma, úřad.

## Other ranking levers

- Ratings + install count weigh roughly as much as keywords. Plan a tasteful in-app review prompt
  **after a few successful sent messages** (not on first launch) - and only when the app feels reliable
  (ties to the constitution's crash-resilience goal; don't prompt users who just hit an error).

_Source: user-provided ASO set (2026-06-12). TODO: draft the full Play long description with placed keywords._
