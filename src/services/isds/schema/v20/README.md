# ISDS web-service schemas (v20) - vendored source of truth

Official ISDS (Informační systém datových schránek) WSDL/XSD definitions, namespace
`http://isds.czechpoint.cz/v20`. These are the **source of truth** for our TypeScript models -
generated types are derived from these files, never hand-edited to diverge from them.

- **Source**: `https://www.mojedatovaschranka.cz/static/wsdl/v20/<file>` — the files are still served there
  (checked 2026-09-14), although the directory URL now redirects to the operator's info site and the new
  `datovka.gov.cz` domain does not host them
- **Fetched**: 2026-06-12
- **Do not edit** these files; re-fetch from the source to update, then regenerate models.

## Files

| File | Defines |
|------|---------|
| `dmBaseTypes.xsd` | Data-message types (`tFile`/`dmFile`, `tHash`, `dmStatus`, `dmEvent`, `dmType`, …) |
| `dbTypes.xsd` | Data-box types (`dbOwnerInfo`, `dbUserInfo`, address/owner records, …) |
| `db_access.wsdl` | Access ops incl. `GetOwnerInfoFromLogin(2)`, `GetUserInfoFromLogin(2)`, `GetPasswordInfo`, `ChangeISDSPassword` (used by feature 001) |
| `dm_operations.wsdl` | Message operations (send/download, lists) - features 002/003/005 |
| `dm_info.wsdl` | Message info/state operations |
| `db_search.wsdl` | Data-box search (`FindDataBox2`, …) - feature 005 recipient lookup |
| `db_manipulations.wsdl` | Data-box management operations |

## Note

These public government interface definitions are vendored for interoperability. We do **not** link
GPL `libdatovka`; these schemas are the operator's published contract.
