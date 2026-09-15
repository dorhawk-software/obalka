# Feature Specification: Messages, Attachments & Sync Resilience

**Feature Branch**: `002-messages-and-resilience` (built on `master` alongside 001)
**Created**: 2026-06-12
**Status**: Implemented (received messages + detail + attachments + reauth/sync resilience); live-validated on czebox + production boxes;
the refresh-all control and the per-box last-synced / refreshing display were retired by 011's
inbox-first navigation. `refreshAll` still runs on launch, after adding a box and after re-auth.
Per-box unread counts now show in the box switcher (`BoxRow`).
**Input**: Continuation of 001 — once a box is signed in, the user must read its received mail,
open attachments, refresh reliably across multiple boxes, and recover gracefully when a box's
session expires or its credentials stop working. Plus the cross-cutting durability that the whole
app relies on: a real DB migration framework.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Read received messages for a box (Priority: P1)

From the signed-in home, the user taps a box and sees its received messages newest-first, with
sender, subject, delivery date, an unread indicator, and an attachment marker — Gmail-style flat
rows. Pull-to-refresh reloads.

**Independent Test**: Open a box with known received messages; confirm the list matches the web
portal (count, unread state, subjects); pull to refresh; confirm an unread message shows the unread
treatment and a read one does not.

**Acceptance Scenarios**:

1. **Given** a signed-in box, **When** the user opens it, **Then** received messages load
   newest-first and never crash on an empty list or a single-record response.
2. **Given** the list is loaded, **When** a message is unread (`dmMessageStatus` 6), **Then** it is
   visually distinguished (gold dot + bold) from a read one (status 7).
3. **Given** the session has expired, **When** the list is requested, **Then** a clear "session
   expired, sign in again" state is shown — never a crash.

### User Story 2 - Open a message and its attachments (Priority: P1)

The user taps a message, sees the full envelope (sender + address, recipient + address, delivered /
accepted timestamps), and a list of attachments. Tapping an attachment opens it in the device's
viewer (e.g. a PDF reader).

**Independent Test**: Open a message with a PDF attachment; confirm the envelope fields render;
tap the attachment and confirm it opens in the system viewer; if no viewer exists, confirm a
recoverable message rather than a crash.

**Acceptance Scenarios**:

1. **Given** a message in the list, **When** the user taps it, **Then** the full message downloads
   (`MessageDownload`) and the envelope + attachment list render.
2. **Given** the detail is open, **When** the user taps a PDF attachment, **Then** the persisted
   file is opened by the OS viewer.
3. **Given** no app can open the MIME type, **When** the user taps it, **Then** a clear localized
   notice appears — no crash.

### User Story 3 - Refresh many boxes reliably (Priority: P2)

A single "refresh all" syncs every box. Per-box state shows last-synced time, message/unread
counts, and a "refreshing…" indicator. A box known to need re-auth is **skipped** (a refresh would
just fail again) and keeps its flag. *Amended 2026-09-14:* the refresh-all control and the per-box
last-synced / refreshing display no longer exist (011); see the Status line.

**Acceptance Scenarios**:

1. **Given** several boxes, **When** the user taps refresh-all, **Then** each box's counts +
   timestamp update; a transient failure is retried, an auth failure is flagged.
2. **Given** a box flagged for re-auth, **When** refresh-all runs, **Then** that box is not
   contacted and keeps its flag (no wasted call, no spinner on it).

### User Story 4 - Recover a box whose login stopped working (Priority: P2)

When a box's session expires or its credentials change (e.g. the user changed the password, or
turned OTP on/off on the ISDS portal), the home flags it and offers "sign in again". Re-auth lets
the user confirm/choose the login method and re-enter the password; on success the box is restored
and the working method is persisted.

**Acceptance Scenarios**:

1. **Given** an OTP box whose session expired, **When** refresh fails, **Then** the box shows
   "session expired" + a re-auth action that re-runs the OTP login.
2. **Given** a password box whose stored password no longer works, **When** refresh fails (401),
   **Then** the box shows "credentials no longer valid" (distinct copy) + a re-auth action.
3. **Given** a box's OTP was removed on the portal, **When** the user re-auths and picks
   "password", **Then** it succeeds and the box's method is corrected to `password` for good.
4. **Given** a box is flagged for re-auth, **When** the app is force-quit and reopened, **Then**
   the flag is still shown (it is persisted) — the box is not silently re-synced.

### User Story 5 - The app survives upgrades without losing or corrupting data (Priority: P1, cross-cutting)

A user who already runs the app and installs a new version must keep their boxes and have any new
schema applied automatically — only the not-yet-applied changes run.

**Independent Test**: Open the app on a DB created by an older build; confirm boxes still load and
any new columns exist; confirm a second launch applies nothing new.

## Requirements *(mandatory)*

- **FR-001** Received messages list via `GetListOfReceivedMessages` (`/DS/dx`; OTP boxes via the
  session cookie at `/apps/DS/dx`), `dmStatusFilter="1023"` (all states), newest-first.
- **FR-002** Unread = `dmMessageStatus > 0 && < 7` (6 = delivered/unread, 7 = read; confirmed live).
- **FR-003** Message detail via `MessageDownload` (`/DS/dz`; OTP via `/apps/DS/dz`); envelope from
  `dmReturnedMessage.dmDm`, delivery/acceptance times from the `tReturnedMessage` wrapper, files
  from `dmDm.dmFiles.dmFile[]` (metadata are XML **attributes**, content is `dmEncodedContent`).
  *Amended 2026-09-14 (004 amendment):* a received message now downloads with
  `SignedMessageDownload` on the same endpoint and auth, and the detail is read from the signed
  content with the same mapping; `MessageDownload` stays behind it as the fallback whenever the signed
  original does not yield a detail, and the original is kept as a `.zfo`. Not yet verified on czebox.
  See [004 › Amendment 2026-09-14](../004-local-archive-search/spec.md) FR-007.
- **FR-004** Attachments open via the OS viewer (open the persisted file → ACTION_VIEW / openDocument);
  a missing viewer is a recoverable, localized condition.
- **FR-005** `MessagesController` NEVER throws — every path resolves to a typed outcome (Principle II).
- **FR-006** Refresh-all skips boxes flagged `reauth`; transient (`error`) boxes are retried.
- **FR-007** A failed refresh is classified by `classifyFailure`. A 401 on any box, or a non-network
  failure on a cookie-session box (OTP / Mobile Key), becomes `reauth`, with the copy
  `box.reauth.session` for cookie boxes and `box.reauth.credentials` for password boxes
  (`reauthCopy.ts`). A network or timeout failure, or a server fault on a password box, becomes
  `error` and is retried. Messages differ; recovery (re-auth) is the same. *Amended 2026-09-15:* a
  cookie box's call that the portal redirects to its sign-in page is an auth fault in the transport
  (018 FR-006 amended), so it arrives here as `reauth` directly rather than as a server fault.
- **FR-008** The per-box failure flag is **persisted** (`accounts.syncError`) and restored on launch.
- **FR-009** Re-auth persists the login method that actually worked (`accounts.authMethod`).
- **FR-010** Schema changes are applied by a **versioned migration runner** (see data-model);
  only un-applied versions run on each open; a migration never re-runs.

## Success Criteria

- **SC-001** Opening a box, reading a message, and opening a PDF attachment all succeed against a
  real box without a crash (validated live on czebox + two production boxes).
- **SC-002** A re-auth flag survives a force-quit + cold relaunch (validated live).
- **SC-003** A box whose method changed (OTP→password) is corrected on re-auth and stops trying the
  old flow (validated live).
- **SC-004** An app upgrade applies only new migrations; existing boxes are preserved (validated by
  applying migration v2 `syncError` to the existing dev DB with no data loss).

## Offline-first archive (2026-06-13, feature 004 seed)

The app is now offline-first for reading: synced messages and downloaded attachments stay viewable
without a connection.

- **FR-011** Every synced envelope is cached in the `messages` table (migration v3/v4, incl.
  recipient) — the message list is viewable offline.
- **FR-012 (split: view ≠ download attachments)** Opening a detail renders its **envelope from the
  cached list** — no network, no attachment download (ISDS only ships the full envelope in the list;
  `MessageEnvelopeDownload` carries no files). Attachments (potentially large/many) are downloaded
  ONLY by an explicit **"Stáhnout přílohy"** action (`MessageDownload`, which fetches all of a
  message's files at once); never automatically on entry (auto-download is a future opt-in — see
  *Deferred: automatic attachment download* below). *Amended 2026-09-14:* the action's label is
  **Stáhnout celou zprávu**, and it downloads the signed message (FR-003 amended), which carries the
  files too.
- **FR-013** Downloaded attachments are written as files under the app's private storage
  (`attachmentFileStore`, `DocumentDir/attachments`), with their paths and metadata in `detailJson`,
  so they open offline; each shows **Uloženo offline**. Tapping download while offline / on a
  broken-sync box fails with a clear message (you can't download then). *Amended 2026-09-15 (refusal
  codes):* a download that fails past ISDS's retention window marks the files "no longer available"
  (`attachmentsUnavailable`) only when ISDS answers `1219`, the code its manual gives for a deleted
  message (004 research R8). Until then any server failure more than 90 days after delivery did, so an
  outage could mark a message's files lost for good. Any other code now says ISDS did not release the
  message and leaves the retry (`detail.attachments.refused`). Tests: `__tests__/messages/messages.test.ts`
  › getDetail: telling a deleted message from a download that failed; `__tests__/messages/messageDetailDownload.test.tsx`
  (the screen no longer decides this itself). *Amended 2026-09-15 (a large-volume download that stops
  part-way):* a VoDZ message whose enclosures stopped arriving after at least one is kept with what
  arrived and recorded as incomplete (`enclosuresMissingFrom`), where it used to be cached as the whole
  message. The detail says so and offers **Stáhnout chybějící přílohy**, which asks ISDS only for the
  missing ones and never rewrites a file it holds; a lost session half-way asks for re-authentication
  and keeps what arrived. A message the archive already held whole stays whole when the download
  offered for its missing files stops part-way: the enclosures past the stop are still listed (review,
  2026-09-15). See [004 › Amendment 2026-09-15](../004-local-archive-search/spec.md).
- **FR-014** ~~The list distinguishes downloaded from not-yet-downloaded attachments.~~ *No longer
  true:* list rows carry no attachment indicator today (no later spec records its removal). The
  downloaded state shows only in the detail (**Uloženo offline** per attachment). The envelope-only
  detail is always viewable offline.
- **FR-016 (no false "no attachments")** The UI MUST NOT infer "this message has no attachments"
  from the list envelope. `dmAttachmentSize` is the attachment **size in KB, rounded**, so a small
  file reports `0` — using it as a has-attachments flag silently hid a real attachment (regression
  found live: a message with a tiny `Textová zpráva.PDF` showed "no attachments"). The detail
  therefore **always** offers "Stáhnout přílohy" and only states there are none **after** an actual
  download confirms zero.
- **FR-015** Removing a box clears its cached archive (`clearBoxCache`). *Amended 2026-09-14:* the
  cached rows only, until then — the downloaded files were left on disk deliberately, with nothing in
  the app able to reach them, while the removal dialog (`box.removeMessage`) told the user the
  attachments were deleted. `clearBoxCache` now also removes the box's attachment directory, signed
  originals included (`attachmentFileStore.removeForBox`); a failure to delete is reported
  (`file.write`) and does not stop the removal. Test: `__tests__/messages/messages.test.ts` › keeping
  the signed original › removing a box.
- **FR-017 (auto-sync on launch)** On a cold start with ≥1 box, the app **unconditionally** refreshes
  all boxes once (`refreshAll`) so a fresh open shows current mail and clears a stale failure flag
  once connectivity is back. `reauth`-flagged boxes are still skipped (nothing to retry until the
  user re-logs in). **Decision (2026-06-13):** kept unconditional even though listing legally
  *delivers* mail (§17/3, see [013's spec](../013-message-states-and-sync-consent/spec.md)) — i.e. opening the app delivers any
  pending message. The user accepted this trade-off over an error-only / deliberate-sync model.
- **FR-018 (mark as read on open)** Opening an unread message's detail marks it read:
  `MarkMessageAsDownloaded` (dmInfo `/DS/dx`; OTP via `/apps/DS/dx`, same auth split as the list)
  transitions it to `dmMessageStatus` 7 server-side, and on confirmation the cached `state` is set to
  read so the list drops its unread treatment (gold dot + bold) on return. This replaces the implicit
  read that the old auto-`MessageDownload` gave (the detail no longer downloads on entry). It is
  best-effort: never throws, never blocks the detail, fires only for an unread message, and a failure
  (offline / session expired / server) is swallowed — the next live sync reconciles the true state.
  Distinct from legal *delivery* (the list, §17/3); read is an informational "seen" receipt.
  - **Unread badge:** a confirmed mark also decrements the box's `unreadCount` by one (floored at 0;
    `accounts.decrementUnread`, persisted) so the box-switcher unread badge reflects it. The inbox
    re-reads accounts (DB-only, no network) whenever it regains focus and when the switcher opens, so
    the badge updates on return without a manual refresh; any drift self-corrects on the next sync
    (`recordSync` re-derives the true count).

Architecture: shared encrypted DB (`database.ts` `getDb()`), `MessagesStore` (in-memory + SQLite),
`MessagesController` caches list/detail on success and exposes `getCachedMessages` /
`getCachedEnvelope` / `getCachedDetail`. The detail screen loads the envelope from
`getCachedEnvelope` and only calls `getDetail` (MessageDownload; the signed download since 2026-09-14)
on the explicit download action.
"Offline" is inferred from the transport's failure; the messages path does not consult NetInfo. (The
NetInfo dependency added by 025 is used only by the phone-to-phone transfer.) Validated live (incl.
airplane mode): cached list + envelope detail work offline; the download button fetches attachments
and marks each as saved offline in the detail.

## Deferred: automatic attachment download (3 modes)

> **Built by 026 (2026-09-26)** as one mode, "on list sync", with Wi-Fi only - see
> [026's spec](../026-attachment-downloads/spec.md). The first caveat below is **wrong** and stays only as
> the record of what was believed: the ISDS web-service manual says a download through the web services
> does not set state 7 (*"v ESS ne automaticky, ale explicitním voláním WS MarkMessageAsDownloaded"*), and
> 026 keeps a downloaded message unread until it is opened.

Today attachments download only on the explicit **"Stáhnout přílohy"** tap (FR-012). A future
**setting** lets the user opt into auto-download, with **three modes** (persisted in `app_settings`,
default `never`; surfaced in Settings — 007 infra):

1. **Never** (`never`) — current behaviour. Attachments fetch only on the explicit button. Lightest
   on storage/bandwidth.
2. **On message-list sync** (`on-list-sync`) — "always when receiving the message list": after a list
   sync, auto-download (`MessageDownload`) the attachments of messages not yet downloaded, so the
   whole box is available offline without opening anything. Heaviest.
3. **On opening a message** (`on-detail-open`) — when a detail is opened, auto-fire the download
   instead of waiting for the button tap (the button remains as the manual fallback / for the other
   modes).

**Mechanism.** All modes use the same `MessageDownload` (all-or-nothing per message) and the existing
`cacheDetail`; only the *trigger* differs. The detail indicator (FR-013) already reflects downloaded
state (list rows no longer carry one, see FR-014), so no UI changes beyond the setting. All modes
apply to **both received and sent** messages — sent messages carry attachments too (fetched by the
ordinary signed download, or for a large-volume message over 20 MB by the VoDZ per-enclosure path,
`vodzAttachmentDownloader`; see [005's VoDZ contract](../005-sending-messages/contracts/isds-bigmessage.md)),
so the setting governs both folders.

**Caveats to design around (important).**
- **`MessageDownload` marks the message READ** (server-side `dmMessageStatus` → 7, same as FR-018).
  So **`on-list-sync` would auto-read every message** on each sync — it effectively destroys unread
  tracking. Either accept that (some users just want everything offline and don't track unread), gate
  it behind a clear warning, or investigate whether a non-read-marking download path exists
  (`SignedMessageDownload`/`MessageEnvelopeDownload` don't carry the files). *Amended 2026-09-14:*
  that parenthesis is wrong for `SignedMessageDownload` — the files are inside its signed content, and
  it is now the download (FR-003 amended); whether it marks a message read has not been measured.
  `on-detail-open` is
  consistent — opening already marks read (FR-018) — so it has no extra read side effect.
- **Storage**: attachments are files on disk (metadata in `detailJson`), so `on-list-sync` grows app
  storage rather than the DB; this ties into 004 storage management.
- **Bandwidth / Wi-Fi-only (data saver)**: a top-level **"auto-download on Wi-Fi only"** toggle so
  auto-download never spends cellular data — applies to **all** auto modes (essential for the heavy
  `on-list-sync`, but also `on-detail-open`; a user on metered data must be able to stop auto-download
  from eating their allowance, while still downloading manually via the button on cellular). When the
  toggle is on and the device is on cellular, auto-download is skipped (the manual button still works).
- **Skip** broken-sync (`reauth`/`error`) and offline boxes — they can't download (FR-013).
- **Legal**: auto-*download* does not change delivery (the list already delivered, §17/3); it only
  changes read state, per the first caveat.

Status (2026-06-18): deferred. Reconfirmed + scope tightened per user — modes cover **both sent and
received**, and **Wi-Fi-only** is a top-level data-saver toggle across all modes (not just
`on-list-sync`). ~~The settings UI for this pairs with the 003 **Settings → Notifications** backlog
entry (both are user-facing toggles in feature 007's Settings screen).~~ *(That 003 entry is moot since
014 removed the notification settings.)*

## Deferred: cross-client read-state reconciliation (→ 003 sync engine)

**Problem.** Read state is a cached projection of server truth. The mobile→server direction is handled
(FR-018 pushes a read to ISDS), but the **server→mobile** direction drifts: if a message is read on the
web portal (or another device), the phone keeps showing it unread (and the box's unread badge stale)
until the next full sync. ISDS has **no push API**, so true real-time is impossible — the only levers
are *when* we reconcile and *how cheaply*.

**Mechanism (the right tool).** `GetMessageStateChanges` (dmInfo `/DS/dx`; OTP via `/apps/DS/dx`, same
auth split as the list) takes a time window and returns **only** the messages whose status changed,
each as `{ dmID, dmEventTime, dmMessageStatus }` (XSD `tStateChangesRecord`, vendored). Two properties
make it ideal: it is a **delta** (tiny payload, not the whole list), and — unlike the list — it does
**not** legally *deliver* (delivery is triggered *exclusively* by `GetListOfReceivedMessages`, §17/3,
[013's spec](../013-message-states-and-sync-consent/spec.md)). So it can be polled often, side-effect-free.

**Design.** A lightweight *reconcile* path, separate from a full sync: call `GetMessageStateChanges`
for the recent window, apply each new `dmMessageStatus` onto the cached message, and recompute each
box's unread count. Triggers: **app foreground/resume** (`AppState → active` — the common phone→web→
phone case) + a **gentle periodic tick while foregrounded** (concurrent read on another device). The
full, *delivering* list sync stays only where we want new mail: launch (FR-017) + pull-to-refresh. This
folds naturally into the 003 background-fetch / notifications engine.

**Caveats to resolve before building.** (1) Confirm against the provozní řád that
`GetMessageStateChanges` truly does not deliver, and how its window is scoped — the XSD annotates the
inputs as *čas dodání* (delivery time) while records carry `dmEventTime`. (2) It's still bounded
staleness, not real-time (fine for a data-box app). (3) New *mail* still arrives only via the
delivering list call — state-reconcile must never silently deliver.

**Status (2026-06-13).** Deferred per product decision. Until built, **pull-to-refresh** (and launch /
auto-sync) is the reconcile path — the count is "last synced," reconciled on the next sync.
**Amended by 014 (2026-08-14).** The 003 engine this would fold into is gone, and a periodic tick while
foregrounded would be an ISDS sign-in with no user command, which 014 FR-001 (Provozní řád §17) rules
out. If this is built, reconcile only on a user action as 014 FR-001 lists them: opening the app,
opening a box or folder, or pull-to-refresh. (014 does not say whether a return from the background
counts as opening the app.)

## Notes / non-obvious findings

- RN `fetch` follows the OTP 302 and drops the intermediate `X-Response-message-*` headers → the
  "code sent" confirmation uses our own localized string.
- Enabling OTP on a box disables username+password (a bare 401, indistinguishable from a wrong
  password) — handled by the `suggestOtp` recovery + the re-auth method picker.
- Until 018 (2026-08-17) the OTP session cookie lived in the shared native OkHttp jar and survived
  restarts. Since 018, each cookie-session box (OTP or Mobile Key) has its cookie captured at login,
  stored in `accounts.sessionCookie` (migration v13; since 2026-09-15 a sealed Keychain item instead,
  001 T028) and replayed with `useJar: false`, so a box keeps
  syncing on its own stored session until ISDS expires it.
- *Amended 2026-09-23 (double-tap audit), in code and tests, not walked on a device:* opening an
  attachment and the signed original (`MessageDetail` `AttachmentRow`, `SignedOriginalSection`) was
  guarded by `opening`/`fetching` state, which lands a render late, so a fast double tap launched the
  viewer twice or started a second signed-original fetch that aborted the first. Both run under
  `useSingleFlight` (`src/app/useSingleFlight.ts`); coming back to the app from the viewer frees the
  viewer's guard (`release()`) even if the open call never settles, while a fetch still running stays
  guarded. Test: `__tests__/messages/attachmentOpenOnce.test.tsx`, which fails against the pre-fix
  screens. Device walk owed: double-tap an attachment and the signed original; one viewer each, and
  both open again after coming back.
