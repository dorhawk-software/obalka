# Data Model: Messages, Attachments & Sync Resilience

Builds on 001's stores. No new secrets. As first written, only envelopes and per-box sync metadata
were persisted. The same feature then added the offline archive: the `messages` table (v3/v4),
downloaded detail in `detailJson`, and attachment files on disk. See spec §Offline-first archive.

## App models (in-memory projections of the ISDS wire types)

### MessageEnvelope *(list row; from `tRecord`)*

| Field | Type | Notes |
|-------|------|-------|
| `id` | text | `dmID`. |
| `subject` | text | `dmAnnotation`. |
| `sender` / `senderAddress` | text / text? | `dmSender` / `dmSenderAddress`. |
| `recipient` / `recipientAddress` | text? / text? | `dmRecipient` / `dmRecipientAddress` (cached since v4). |
| `recipientBoxId` | text? | `dbIDRecipient`. |
| `deliveryTime` / `acceptanceTime` | int (epoch)? | `dmDeliveryTime` / `dmAcceptanceTime`. |
| `state` | int | `dmMessageStatus` (1–10); unread = `>0 && <7`. |
| `attachmentSize` | int? | `dmAttachmentSize`: total attachment size in KB, rounded. A small file reports 0, so it is never a 'no attachments' flag (FR-016). |
| `openedAt` | int (epoch)? | Local-only (v14): when the message was opened on this device. |

### MessageDetail + MessageAttachment *(from `MessageDownload` → `tReturnedMessage`)*

`MessageDetail`: `id, subject, sender, senderAddress, recipient, recipientAddress, deliveryTime,
acceptanceTime, attachments[], attachmentsUnavailable?`. `MessageAttachment`: `name (dmFileDescr),
mimeType (dmMimeType), metaType (dmFileMetaType)`, `contentBase64` (inline `dmEncodedContent`,
transient, cleared once persisted), `localPath` (the on-disk file, source of truth), `size`. File
metadata are XML **attributes**; parsed with an attribute-aware parser (`parseSoapBodyWithAttrs`).

*Amended 2026-09-14 (004 amendment):* `MessageDetail` also carries `signedZfo?: { fileName, localPath,
size }` — the message's signed original, the file `DZ_<dmID>.zfo` in its attachment directory. Received
details are read from `SignedMessageDownload` now (`signedMessage.ts`), `MessageDownload` being the
fallback. `attachmentsUnavailable` additionally stops the detail offering to fetch the original.

*Amended 2026-09-15 (refusal codes):* `attachmentsUnavailable` is set only when ISDS answers `1219`,
the one code its web-service manual gives for a deleted message (004 research R8), for a message past
its retention window (`MessagesController.attachmentsGone`, `originalGone`). Until then the detail
screen set it after any server failure more than 90 days after `deliveryTime`, so an outage or a
paused VoDZ service marked the files lost for good. Any other code is now a retryable error with its
own message (`detail.attachments.refused`, `detail.original.refused`), and an outage is what it was.

*Amended 2026-09-15 (a large-volume download that stops part-way):* `MessageDetail` also carries
`enclosuresMissingFrom?: number`. On a VoDZ message whose enclosure download stopped after some
arrived, `attachments` are enclosures 0 … n-1 in ISDS's order and every enclosure from n on is missing;
the next download resumes there. Set and cleared only by `MessagesController.downloadVodzDetail`, and
absent on every other message (004 Amendment 2026-09-15, FR-018).

## Schema additions to `accounts` (since 001)

001 created `accounts` with the base columns; this feature + the multi-box/messages work added:

| Field | Type | Added by | Notes |
|-------|------|----------|-------|
| `alias` | text? | migration baseline | User nickname; primary display name when set. |
| `host` | text | migration baseline | `production` \| `czebox` per-box ISDS environment. |
| `lastSyncedAt` | int? | migration baseline | Last successful refresh. |
| `messageCount` / `unreadCount` | int? | migration baseline | From the last refresh. |
| `syncError` | text? | **migration v2** | `reauth` \| `error` \| null — last refresh failure, persisted so the flag + the refresh-all skip survive a restart. |

Later features added `pdzCreditCzk` (v9), `dbType` (v10) and `sessionCookie` (v13; emptied and unused
since 001 T028, 2026-09-15 - sessions are sealed Keychain items).

## Migration framework *(`src/services/db/migrations.ts`)*

A small Flyway-style runner replaces the previous ad-hoc `CREATE IF NOT EXISTS` + "ALTER if column
missing" checks.

- **`schema_migrations(version, name, appliedAt)`** records applied versions.
- **`MIGRATIONS[]`**: each has a unique, increasing `version` and a list of SQL `statements`.
  - `v1 baseline` — the full pre-migration schema (accounts + app_settings) via `CREATE IF NOT
    EXISTS`. Fresh install creates everything; a pre-migration DB already has the tables, so v1 is a
    recorded no-op. Both converge at v1.
  - `v2 account_sync_error` — `ALTER TABLE accounts ADD COLUMN syncError`.
  - `v3 cached_messages`, `v4 cached_message_recipient` (this feature's offline archive);
    `v5 message_search_text` (004); v6–v14 from later features. `MIGRATIONS` in `migrations.ts` is
    the authoritative list.
- **`runMigrations(db)`** creates `schema_migrations`, reads applied versions, and runs only the
  pending ones in order, recording each. Idempotent; a shipped migration is never edited (add the
  next version instead). Unit-tested off-device with a fake DB (fresh apply, idempotency, partial
  upgrade, version uniqueness).

## Sync-state lifecycle

```
add box            → syncError = null
refresh success    → setSyncResult(...)  (also clears syncError)
refresh failure    → recordSyncFailure(boxId, classifyFailure(account, outcome))  → persisted
app launch         → syncStates seeded from each account.syncError (flag + skip restored)
re-auth success    → next refresh's success clears syncError
remove box         → row (and syncError) deleted
```

`classifyFailure(account, outcome)`: 401 → `reauth`; otherwise a cookie-session box (OTP / Mobile Key)
failing for a non-network reason → `reauth` (expired session); a password box / network+timeout →
`error`.
