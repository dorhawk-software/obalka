# 006 research — what has to be true before any backup code

Written 2026-09-08, against the app as it stands. The spec was drafted 2026-06-14; four features have
changed what the archive *is* since, and two of those changes alter the threat model. Everything below
is checked against the code, not recalled.

## 1. What a backup would actually contain

| Store | Holds | Size order |
|---|---|---|
| `messages` | envelope fields + `detailJson` (the downloaded detail, attachments as **paths**, base64 cleared) + `searchText` | KB per message |
| `accounts` | box identity, `secretRef` (a pointer), `lastSyncedAt`, counters, `pdzCreditCzk`, **`sessionCookie`** | tiny |
| `drafts`, `reminders`, `app_settings` | unsent drafts, user deadlines, settings + scan dismissals | tiny |
| `files/attachments/<boxId>/<messageId>/` | **the documents themselves** | 100 KB – tens of MB each; VoDZ up to the 20 MB inline limit and beyond |

So the archive is **two things with completely different economics**: a metadata database measured in
megabytes, and a document store measured in hundreds of megabytes to gigabytes.

### 1.1 The session cookie is now inside the database (018, migration v13)

`accounts.sessionCookie` did not exist when this spec was written. It is a **bearer credential** — as
018's own spec puts it, holding it is equivalent to being signed in. FR-007 says credentials stay in
the Keychain and may be omitted from the backup; that sentence is now incomplete, because a straight
database backup carries a live session for every OTP box.

Three options, and the spec must pick one:

1. **Strip it from the snapshot** (recommended). The restored device re-authenticates, which it must do
   anyway — a session that has sat in a backup for a month is almost certainly dead, so restoring it
   buys nothing and widens what the ciphertext protects.
2. Keep it, and accept that the backup is worth exactly as much as a signed-in phone.
3. Keep it in a separate, differently-keyed compartment. Complexity with no user-visible gain.

*2026-09-15 (001 T028):* option 1 shipped (FR-007 as amended), and the question is now moot going
forward: the session left the database for a sealed Keychain item, and the column is emptied at launch.

### 1.2 What else is credential-shaped

`secretRef` is only a Keychain pointer — worthless off-device. Passwords themselves are never in the
DB (`__tests__/security/noPlaintextSecrets.test.ts` pins this). Message *content* is the sensitive
bulk, and it is government mail: the ciphertext is the whole protection.

## 2. The key trap, restated with the actual code

The spec called this out and the code confirms it exactly: `getOrCreateDbKey()` stores the SQLCipher
key under `WHEN_UNLOCKED_THIS_DEVICE_ONLY`. That flag means the key **cannot leave the device and is
not itself backed up by iCloud Keychain**. A backup encrypted with it is unrecoverable by design.

Therefore the backup key must come from something the user can reproduce: a passphrase or a generated
recovery key, stretched with a memory-hard KDF. There is no third option that survives a lost phone.

## 3. Crypto: what is actually available to this app

| Option | Shape | Verdict |
|---|---|---|
| `@noble/hashes/argon2` + `@noble/ciphers/chacha` | **pure JS**, MIT | No native module, no rebuild, works in jest. Argon2id and XChaCha20-Poly1305 both present. |
| `react-native-libsodium` | native, MIT | Fast, complete, but a native dependency and another thing to keep building on both platforms. |
| `react-native-quick-crypto` | JSI/OpenSSL, MIT | Fast; node-crypto API. No Argon2id (scrypt/PBKDF2 only). |

**The deciding constraint is not the KDF, it is the bulk.** A passphrase KDF runs once per operation;
even a slow pure-JS Argon2id at a second or two is acceptable, arguably desirable. Bulk AEAD is the
opposite: encrypting a gigabyte of attachments in JavaScript would run on the **single JS thread**,
which Principle I forbids blocking, and would take minutes.

That yields a rule rather than a library choice:

- **Metadata tier (megabytes): pure JS is fine.** No new native dependency, testable in jest.
- **Attachment tier (gigabytes): pure JS is not.** It needs either a native AEAD or per-file streaming
  off the JS thread — and that decision can be deferred, because the tiers can ship separately.

## 4. Tiering, and the honesty problem inside it

FR-004 leaves "attachments: store vs re-download" open. It cannot stay open, because the two answers
make **different promises**:

- **Metadata only.** Cheap, fast, fits any free cloud quota. But ISDS deletes message content after 90
  days, so a restored archive would list messages whose documents are gone forever. The app would be
  backing up the index to a library it no longer has.
- **Metadata + attachments.** Keeps the promise the archive exists for, at gigabytes in the user's own
  cloud and a real encryption cost.

Recommendation: **both, as separate tiers, with the second one's cost stated plainly** — off by
default, with the size shown before it is turned on. What must not happen is a backup that *looks*
complete and silently omits the documents; that is the 013 lock-screen mistake in a new costume.

## 5. Storage targets

| Platform | Target | Constraint |
|---|---|---|
| iOS | iCloud Documents / CloudKit private DB | Needs the iCloud container entitlement — which the **unsigned sideload build cannot carry**. Untestable on this project's current iOS path. |
| Android | Google Drive `appDataFolder` | OAuth + Google's restricted-scope review for a published app; usable in a debug build with a test client. |

This is worth stating early: 006 is the first feature whose *testing* depends on distribution
mechanics the project does not have. The iOS half cannot be verified on a sideloaded IPA.

## 6. What 014 changed

014 removed background work wholesale: the app makes no ISDS call the user did not ask for. A backup
upload is **not** an ISDS call, so it does not breach that rule — but "continuous archive sync" (US3)
implies exactly the kind of background scheduler 014 deleted, and 010 had to justify re-introducing a
timer for a purely local reminder. US3 therefore needs the same argument made explicitly, or it stays
deferred. Backup on demand, and after a user-initiated sync, needs no such argument.

## 7. Consequences for the spec

1. FR-007 must say what happens to `accounts.sessionCookie` (recommendation: strip).
2. FR-004 must resolve the tier question rather than defer it.
3. A new requirement: the backup must state its own scope in the UI — what is in it and what is not.
4. US3 (continuous sync) needs 014's background argument or an explicit deferral.
5. Testability: the iOS target cannot be verified on the current sideload path. Android first is not a
   preference, it is the only half that can be walked.
