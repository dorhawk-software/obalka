# 006 plan — encrypted backup, built from the inside out

**Input**: `spec.md` (revised 2026-09-08) + `research.md`. **Status**: ~~plan only; nothing built.~~
*Amended 2026-09-14:* historical plan, 2026-09-08. Phases 1, 2, 2b and 3 are built; Phase 4 (the cloud
targets) is not. Where the build departed from this plan: the KDF runs through native Argon2 behind a
known-answer check against `@noble` (T005); restore is one SQLite transaction rather than a file swap
(T008); the recovery key stays viewable behind device authentication rather than being shown once
(T012, FR-013). `tasks.md` is the record.

## The shape of the problem

Three parts, and only one of them is hard to get right:

1. **The envelope** — turn a passphrase and a pile of bytes into ciphertext nobody else can read, and
   back again. Pure computation. Fully testable in jest, on any machine, with no device, no cloud
   account and no entitlement.
2. **The snapshot** — decide what goes in, build it atomically, put it back without ever damaging what
   is already there. Pure-ish; needs the DB and the filesystem, both of which already have test fakes.
3. **The target** — iCloud or Drive. Entitlements, OAuth, a Google review, and (for iOS) a
   distribution path this project does not currently have.

They are listed in the order they should be built, which is the reverse of the order they are usually
attempted. **Part 3 is the only part that cannot be tested here, so it must be the last thing the
other two depend on** — behind a `SyncTarget` interface whose first implementation writes to a local
file. A backup that round-trips through a file on disk proves the crypto and the atomicity; swapping
in Drive afterwards changes where the bytes go and nothing else.

## Phase 1 — the envelope (no dependencies, no device)

- `src/services/backup/envelope.ts`: `seal(plaintext, passphrase) -> bytes` / `open(bytes, passphrase)`.
- Format, versioned from byte one, because a backup written today must be readable by an app built in
  three years: `magic | formatVersion | kdfParams | salt | nonce | ciphertext+tag`.
- Argon2id from `@noble/hashes` (pure JS — no native module, so it runs in jest and needs no rebuild),
  XChaCha20-Poly1305 from `@noble/ciphers`. Parameters recorded IN the header rather than assumed, so
  they can be raised later without orphaning old backups.
- The recovery key is generated (`crypto.getRandomValues`, the same source the DB key uses) rather
  than typed. A generated key has no weak instances; a chosen passphrase does. Shown once, at setup.

**Tests**: round-trip; wrong passphrase fails as authentication, not as garbage; a flipped byte
anywhere in the ciphertext fails; a header from a future format version is refused with a clear reason
rather than misparsed; KDF parameters actually come from the header.

## Phase 2 — the snapshot (fakes only)

- `snapshot.ts` builds a manifest + a byte stream from the real stores: `accounts` **without
  `sessionCookie`** (FR-007 as amended), `messages`, `drafts`, `reminders`, `app_settings`.
- `restore.ts` is the half that can destroy something, so it is staged: decrypt → verify → write to a
  **new** database file → swap. Never a partial write over a live archive (FR-006, Principle IV).
- Restore is **additive by default**: the archive is append-mostly and a restore that deletes local
  messages absent from the backup would be a data-loss bug wearing a feature's clothes.

**Tests**: a snapshot contains no session cookie and no password (extend
`__tests__/security/noPlaintextSecrets.test.ts` to the backup path — a new place for a secret to leak
is a new place for that suite to look); a restore into a populated archive keeps local-only messages; a
restore that fails mid-way leaves the original archive byte-identical; a snapshot round-trips through
Phase 1 unchanged.

## Phase 2b — the documents (Tier 2), decided in 2026-09-08

The user chose both tiers with the documents behind a switch, so this is v1 scope rather than a later
cycle. It is a different problem from Tier 1 and needs its own shape.

**Per file, not per archive.** Each attachment becomes its own sealed object. That buys three things
at once: an interrupted backup resumes instead of restarting, an unchanged archive re-uploads nothing,
and one corrupted object costs one document rather than the whole backup.

**Chunked, so the app keeps breathing.** `react-native-blob-util` already gives us
`fs.readStream(path, encoding, bufferSize, tick)` and `fs.writeStream` — the `tick` is the same
yield-between-units discipline `pdfText.ts` uses between pages, and it is what stops a 20 MB document
freezing the UI (Principle I). Each ~1 MiB chunk is sealed with its own tag and its index in the
additional data, so a truncated or reordered file is detected rather than silently short; the final
chunk is marked, so truncation exactly at a boundary is caught too.

**Native cipher, chosen for this and nothing else.** `react-native-quick-crypto` (JSI/OpenSSL,
hardware AES) is the candidate: AES-256-GCM per chunk at native speed. It is a NEW native dependency
and therefore a rebuild on both platforms — acceptable here and nowhere else, because pure JS at
gigabyte scale is the one thing research.md ruled out. The KDF stays `@noble` in Phase 1: it runs once
per backup and needs no native help.

**Addresses are keyed, not plain hashes.** Naming an object by the hash of its content would let the
storage provider recognise a document it has seen before — and government mail contains many
identical files (every box gets the same ISDS welcome letter). The address is therefore an HMAC of the
content under a key derived from the recovery key, so the same document stored by two people, or by
the same person twice, produces unrelated names.

**What the interface must say.** With a switch, "backed up" means two different things, so the status
has to name which one it is (FR-008) and the size has to be shown before the switch is turned on —
this is the user's own cloud quota being spent.

## Phase 3 — a target that is not the cloud

- `SyncTarget` interface (`src/services/backup/backupService.ts`): `listManifests()`, `putBackup(manifest, archive)`,
  `getArchive(name)`, `deleteBackup(name)`, plus optional `hasObject` / `putObject` / `getObject` for the document tier.
- `fileSyncTarget` (`src/services/backup/fileTarget.ts`) writes into the app's own documents directory. This is not a stepping stone that
  gets thrown away: it is **export/import to a file the user controls**, which is a real feature for
  anyone who does not want a cloud account at all, and it is the only backup path that can be walked
  end to end on this project's current iOS distribution.

## Phase 4 — the actual cloud, and only then

- Android: Drive `appDataFolder`. iOS: iCloud, which needs the entitlement and therefore a signed
  build. Each is one implementation of `SyncTarget` plus its account plumbing.

## What this plan deliberately does not do

- **No continuous sync (US3).** 014 deleted background work and 010 had to argue its way back to a
  local timer; a background uploader needs that argument first. Phases 1–3 are on-demand only.
- ~~**No attachment tier yet.**~~ Superseded 2026-09-08 by the user's decision (spec FR-004); built
  2026-09-12 as Phase 2b (T018–T024).
- **No cross-ecosystem sync.** Unchanged from the original spec: it needs a neutral server the project
  has committed not to run.

## The risk worth naming

The failure mode here is not a crash, it is a **quiet one**: a backup that appears to work for two
years and cannot be restored on the day it is needed. The mitigations are structural rather than
diligent — a versioned header, parameters carried in the file, a restore path exercised in tests
rather than only at setup, and a "verify this backup" action that performs a real decrypt instead of
checking that a file exists.
