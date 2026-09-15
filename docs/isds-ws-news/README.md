# ISDS "Informace pro vývojáře" - developer changelog archive

Text extractions (via `pdftotext -layout`) of every **"Informace pro vývojáře aplikací"**
(Information for application developers) bulletin published by the ISDS operator, from the official
index: <https://datovka.gov.cz/info/cs/2052.html>. These are the operator's running
changelog of ISDS web-service changes + new operations - the canonical place to discover capabilities
we can adopt. Each `.md` links back to its source PDF.

> **Fetching these.** The site moved to `datovka.gov.cz` on 26 June 2026 and `/info/files/*` now
> **302s to the info homepage** for any request that does not look like a browser navigation - which
> is why a plain `curl`/WebFetch returns a 64 KB landing page instead of a PDF, for new *and* old
> files alike. Sending the navigation headers gets the real file:
>
> ```sh
> curl -sS --http2 -o out.pdf https://datovka.gov.cz/info/files/<name>.pdf \
>   -H 'User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36' \
>   -H 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' \
>   -H 'Referer: https://datovka.gov.cz/info/cs/2052.html' \
>   -H 'Sec-Fetch-Dest: document' -H 'Sec-Fetch-Mode: navigate' \
>   -H 'Sec-Fetch-Site: same-origin' -H 'Sec-Fetch-User: ?1' \
>   -H 'Upgrade-Insecure-Requests: 1'
> ```
>
> The `Sec-Fetch-*` set is what the filter checks; a User-Agent alone is not enough.

> Reference only - Czech, verbatim machine extraction (layout preserved, so tables read oddly). The
> authoritative spec is always the **Provozní řád ISDS** + the versioned WSDL/XSD.

## Findings relevant to Obálka (what we could adopt)

| Operation / change | Doc | Relevance | Status for us |
|---|---|---|---|
| **Production domain moved** `mojedatovaschranka.cz` → **`datovka.gov.cz`** (PROD 25. 6. 2026); test `czebox.cz` → `datovka-test.gov.cz` (29. 1. 2026). Old URLs "zůstávají prozatím v platnosti", no end date announced, migration recommended. | [2026-06](2244_Info_pro_vyvojare_2026_6_2.md) | Our endpoints pointed at the retired names. | ✅ **Migrated 2026-08-16** - `endpoints.ts` + the compose portal link + user-facing copy. Verified by DNS (same IPs), TLS (SANs cover `www`/`ws1`/`ws2` on both), and identical path-by-path HTTP behaviour on the test host. An authenticated round-trip is **not** verified - see the note in `endpoints.ts`. |
| **`dmSenderType` now carries the FINE box type** (10, 11, 12 … 50, e.g. 31 = advokát) instead of the coarse 10/20/30/40, on every list/download/delivery-info response. Operator calls it an incompatible change. Applies to messages submitted from 26. 6. 2026. | [2026-06](2244_Info_pro_vyvojare_2026_6_2.md) | Would break any parser that switches on the four old values. | ✅ **Unaffected** - we never read `dmSenderType`. Our `normalizeDbType` handles the unrelated *string* `dbType` (`OVM_REQ`, `PFO_ADVOK`) by prefix, which did not change. |
| **Mobile Key (Mobilní klíč) login for 3rd-party apps** - `mepWsStateUpdate2` polls login status; ISDS pushes an approval prompt to the user's NIA Mobile Key app (states: push sent → shown → confirmed/rejected). Spec: `MobilniKlic_autentizace.pdf` v1.3. | [2025-12](2228_Info_pro_vyvojare_2025_12.md) | Passwordless, no-OTP sign-in for third-party apps. | ✅ **Implemented** - `authService.mobileKeyLogin()` (`processLogin?type=mep-ws` + `mepWsStateUpdate2` polling), offered as *Mobilní klíč* on the add-box and re-auth forms; see constitution Principle VI. First logged here as a research spike that challenged our "no 3rd-party federated login" assumption. |
| **GetListOfErasedMessages** - async list of envelopes of ISDS-erased messages over a period (1: request → 2: poll/download). | [2021-09](2177_Info_pro_vyvojare_2021_9.md), [2022-01](2175_Info_pro_vyvojare_2022_1_VoDZ_ZIP_ASiC.md) | Lets the **durable archive (004)** mark messages ISDS deleted, and reconcile with the web portal - instead of guessing from a failed re-download (cf. our 90-day expiry heuristic). | Candidate for 004. |
| **GetMessageStateChanges** - message state changes over a period. | [2022-01](2175_Info_pro_vyvojare_2022_1_VoDZ_ZIP_ASiC.md) | Could make a user-initiated refresh cheaper than re-listing (state deltas only). | Not used. 003's background sync was removed by 014, so this could only serve a refresh the user asks for. |
| **`isds_send` attribute removed** from `Signed*Download` / `GetSignedDeliveryInfo` responses (undocumented, meaningless). | [2025-12](2228_Info_pro_vyvojare_2025_12.md) | Parser robustness - confirm we never read it (we don't). | ✅ Not relied on. |
| **DDD files** (digital tachograph records) allowed as attachments (PROD from 2026-01). | [2026-01](2229_Info_pro_vyvojare_2026_1.md), [2025-09](2224_Info_pro_vyvojare_2025_9.md) | New attachment file type - our generic file handling already covers it (no special-casing). | ✅ No change. |
| **External notifications** - `RegisterForNotifications` + `GetListForNotifications` (reduced delivered-list without triggering legal "delivery by login"). | [2021-09](2177_Info_pro_vyvojare_2021_9.md) | Would be ideal for new-message alerts, **but requires CERTIFICATE access** (Spisová služba / Hostovaná SS / Přístupové rozhraní), not username+password. | ❌ Out of scope (access type we don't have). |

## Index (newest first)

| Date | Markdown | Source |
|---|---|---|
| 2026-06 | [2244_Info_pro_vyvojare_2026_6_2.md](2244_Info_pro_vyvojare_2026_6_2.md) | [pdf](https://datovka.gov.cz/info/files/2244_Info_pro_vyvojare_2026_6_2.pdf) |
| 2026-04 | [2239_Info_pro_vyvojare_2026_4.md](2239_Info_pro_vyvojare_2026_4.md) | [pdf](https://info.mojedatovaschranka.cz/info/files/2239_Info_pro_vyvojare_2026_4.pdf) |
| 2026-01 | [2229_Info_pro_vyvojare_2026_1.md](2229_Info_pro_vyvojare_2026_1.md) | [pdf](https://info.mojedatovaschranka.cz/info/files/2229_Info_pro_vyvojare_2026_1.pdf) |
| 2025-12 | [2228_Info_pro_vyvojare_2025_12.md](2228_Info_pro_vyvojare_2025_12.md) | [pdf](https://info.mojedatovaschranka.cz/info/files/2228_Info_pro_vyvojare_2025_12.pdf) |
| 2025-09 | [2224_Info_pro_vyvojare_2025_9.md](2224_Info_pro_vyvojare_2025_9.md) | [pdf](https://info.mojedatovaschranka.cz/info/files/2224_Info_pro_vyvojare_2025_9.pdf) |
| 2025-03 | [2194_Info_pro_vyvojare_2025_3.md](2194_Info_pro_vyvojare_2025_3.md) | [pdf](https://info.mojedatovaschranka.cz/info/files/2194_Info_pro_vyvojare_2025_3.pdf) |
| 2025-01 | [2187_Info_pro_vyvojare_2025_1.md](2187_Info_pro_vyvojare_2025_1.md) | [pdf](https://info.mojedatovaschranka.cz/info/files/2187_Info_pro_vyvojare_2025_1.pdf) |
| 2024-12 | [2171_Info_pro_vyvojare_2024_12.md](2171_Info_pro_vyvojare_2024_12.md) | [pdf](https://info.mojedatovaschranka.cz/info/files/2171_Info_pro_vyvojare_2024_12.pdf) |
| 2024-10 | [2170_Info_pro_vyvojare_2024_10.md](2170_Info_pro_vyvojare_2024_10.md) | [pdf](https://info.mojedatovaschranka.cz/info/files/2170_Info_pro_vyvojare_2024_10.pdf) |
| 2024-06 | [2169_Info_pro_vyvojare_2024_6.md](2169_Info_pro_vyvojare_2024_6.md) | [pdf](https://info.mojedatovaschranka.cz/info/files/2169_Info_pro_vyvojare_2024_6.pdf) |
| 2024-03 | [2168_Info_pro_vyvojare_2024_3.md](2168_Info_pro_vyvojare_2024_3.md) | [pdf](https://info.mojedatovaschranka.cz/info/files/2168_Info_pro_vyvojare_2024_3.pdf) |
| 2023-11 | [2172_Info_pro_vyvojare_2023_11.md](2172_Info_pro_vyvojare_2023_11.md) | [pdf](https://info.mojedatovaschranka.cz/info/files/2172_Info_pro_vyvojare_2023_11.pdf) |
| 2023-10 | [2173_Info_pro_vyvojare_2023_10.md](2173_Info_pro_vyvojare_2023_10.md) | [pdf](https://info.mojedatovaschranka.cz/info/files/2173_Info_pro_vyvojare_2023_10.pdf) |
| 2023-07 | [2174_Info_pro_vyvojare_2023_7.md](2174_Info_pro_vyvojare_2023_7.md) | [pdf](https://info.mojedatovaschranka.cz/info/files/2174_Info_pro_vyvojare_2023_7.pdf) |
| 2022-01 | [2175_Info_pro_vyvojare_2022_1_VoDZ_ZIP_ASiC.md](2175_Info_pro_vyvojare_2022_1_VoDZ_ZIP_ASiC.md) | [pdf](https://info.mojedatovaschranka.cz/info/files/2175_Info_pro_vyvojare_2022_1_VoDZ_ZIP_ASiC.pdf) |
| 2021-12 | [2176_Info_pro_vyvojare_2021_12.md](2176_Info_pro_vyvojare_2021_12.md) | [pdf](https://info.mojedatovaschranka.cz/info/files/2176_Info_pro_vyvojare_2021_12.pdf) |
| 2021-09 | [2177_Info_pro_vyvojare_2021_9.md](2177_Info_pro_vyvojare_2021_9.md) | [pdf](https://info.mojedatovaschranka.cz/info/files/2177_Info_pro_vyvojare_2021_9.pdf) |
| 2021-03 | [2178_Info_pro_vyvojare_2021_3.md](2178_Info_pro_vyvojare_2021_3.md) | [pdf](https://info.mojedatovaschranka.cz/info/files/2178_Info_pro_vyvojare_2021_3.pdf) |
| 2020-09 | [2179_Info_pro_vyvojare_2020_9.md](2179_Info_pro_vyvojare_2020_9.md) | [pdf](https://info.mojedatovaschranka.cz/info/files/2179_Info_pro_vyvojare_2020_9.pdf) |
| 2020-06 | [2180_Info_pro_vyvojare_2020_6.md](2180_Info_pro_vyvojare_2020_6.md) | [pdf](https://info.mojedatovaschranka.cz/info/files/2180_Info_pro_vyvojare_2020_6.pdf) |
| 2020-02 | [2181_Info_pro_vyvojare_2020_2.md](2181_Info_pro_vyvojare_2020_2.md) | [pdf](https://info.mojedatovaschranka.cz/info/files/2181_Info_pro_vyvojare_2020_2.pdf) |
| 2019-12 | [2182_Info_pro_vyvojare_2019_12.md](2182_Info_pro_vyvojare_2019_12.md) | [pdf](https://info.mojedatovaschranka.cz/info/files/2182_Info_pro_vyvojare_2019_12.pdf) |
| 2019-09 | [2183_Info_pro_vyvojare_2019_9.md](2183_Info_pro_vyvojare_2019_9.md) | [pdf](https://info.mojedatovaschranka.cz/info/files/2183_Info_pro_vyvojare_2019_9.pdf) |
| 2019-05 | [2184_Info_pro_vyvojare_2019_5.md](2184_Info_pro_vyvojare_2019_5.md) | [pdf](https://info.mojedatovaschranka.cz/info/files/2184_Info_pro_vyvojare_2019_5.pdf) |
| 2018 | [2185_Info_pro_vyvojare_2018_nove_verze_WS.md](2185_Info_pro_vyvojare_2018_nove_verze_WS.md) | [pdf](https://info.mojedatovaschranka.cz/info/files/2185_Info_pro_vyvojare_2018_nove_verze_WS.pdf) |
