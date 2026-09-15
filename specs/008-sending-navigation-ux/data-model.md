# Phase 1 Data Model: Sending & Navigation UX

Mostly UI; the only persistence change is making the message cache **folder-aware** so a box's
**sent** list is archived alongside **received** without collision.

## Entities

### `MessageEnvelope` (existing — `src/services/isds/types.ts`)
Unchanged shape. For a **sent** message, `recipient`/`recipientAddress`/`recipientBoxId` identify the
party you sent to (vs received's `sender`); `state` (`dmMessageStatus`) progresses dodáno → doručeno →
přečteno. Reused as-is for both folders.

### `messages` cache row (SQLite — `messagesStore` / `migrations.ts`)
**Change:** add a nullable **`folder TEXT`** column (migration v8); NULL reads as `'received'` via
`COALESCE` in the store queries. *(Planned as `folder TEXT NOT NULL DEFAULT 'received'` with the key
widened to `(boxId, folder, messageId)`; as built, neither was needed.)*
- **Key:** unchanged `(boxId, messageId)`; dmIDs are unique across folders, so a row belongs to exactly
  one folder.
- **Migration (new, additive):** `ALTER TABLE messages ADD COLUMN folder TEXT;` then treat NULL as
  `'received'` (existing archived mail is received). No data rewrite, reversible.
- **FTS / search (004):** the existing `searchText` index is unchanged; search spans both folders
  (a hit can be a sent or received message — the hit can carry its `folder` for display).

| Field (added) | Type | Notes |
|---|---|---|
| `folder` | `'received' \| 'sent'` | which ISDS list the row came from; NULL reads as `'received'` |

### Folder (UI state, not persisted)
The `Přijaté \| Odeslané` segment: `'received' \| 'sent'`. Drives which list `MessageList` loads,
refreshes, and reads from cache. Default `'received'`. Not stored (resets per box open) — optionally
remember the last segment per session later.

### No new entities for the other tracks
- **Testovací banner** — derived from `account.host === 'czebox'` (no storage).
- **Overflow `⋯` menu / add-box-in-menu** — pure navigation/IA; reuse `AliasEditor` (rename) + the
  existing remove-confirm + `addBox` (no schema).
- **Swipe-to-delete** — gesture UI over existing remove/discard actions; no schema. Per Principle IV,
  message rows expose **no destructive archive delete** (only boxes/drafts do, both already confirmed/
  undoable).

## Store API changes (`MessagesStore`)
- `cacheList(boxId, folder, envelopes, syncedAt)` — folder added.
- `getList(boxId, folder)` — folder added; returns that folder's cached envelopes + downloaded set.
- `getEnvelope(boxId, messageId)` / `cacheDetail` / `markRead` — unaffected (keyed by messageId, which is
  unique across folders).
- `search` — may include each hit's `folder`.

## Controller changes (`MessagesController`)
- **`listSent(account, signal)`** — mirrors `listReceived`: live `getSentMessages` → cache under
  `folder='sent'` → typed `MessagesOutcome`; offline → `getCachedMessages(boxId, 'sent')`.
- `getCachedMessages(boxId, folder = 'received')` — folder param (defaulted, back-compatible).

## State transitions
None new. A sent message's `state` is read-only here (it transitions server-side); the cache simply
reflects the latest synced value, same as received.
