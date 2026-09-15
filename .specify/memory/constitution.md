# Obálka datové schránky Constitution
<!-- A modern, cross-platform mobile client for the Czech ISDS (data-box) system. -->

These principles exist to beat the specific, repeated failures of the incumbent "Datovka" app
(crashes, UI-blocking sync, dated UX, no biometrics) while preserving what users love (free,
durable local archive, multi-box, quick mobile access). Every spec, plan, and task MUST comply.

## Core Principles

### I. Never Block the UI Thread (NON-NEGOTIABLE)
All networking, SOAP/XML parsing, cryptography, signature verification, and synchronization run
OFF the JS main thread — in native code (native `fetch`, native crypto) or worker threads. The UI MUST remain interactive (scrolling, navigation, cancel) during any sync or download.
No operation may freeze the app on launch. Rationale: the incumbent's main-thread background work
("zasekne se", 2–3 min frozen launch) is the single most-cited reason for 1-star reviews.

### II. Crash-Resilient by Contract (NON-NEGOTIABLE)
Every ISDS call and every multi-step flow (especially login, OTP entry, and sending) MUST have
explicit timeout, error, and retry handling, and MUST NOT hard-crash — least of all at the "last
step." Failures degrade to a clear, recoverable, localized UI state with a retry path. Rationale:
reviews are dominated by "spadne u posledního kroku" / "constant crashes and logouts."

### III. Privacy First, On-Device Only
There is NO backend of ours. The app talks to ISDS web services directly from the device.
Credentials and session secrets live only in the platform secure enclave (iOS Keychain / Android
Keystore). The app offers a biometric lock (Face ID / Touch ID / fingerprint, falling back to the
device passcode). The lock is OPT-IN and off by default; when it is on, it MUST gate the credentials
themselves, not only the screen: nothing that can sign in to ISDS is readable while the app is locked.
Re-auth after an app update or device change MUST NOT force full reconfiguration. Any cloud backup
is CLIENT-SIDE ENCRYPTED so no provider (iCloud/Google) can read message contents. We never transmit
government mail or credentials to any server we operate.

> **Known gaps against this principle (2026-09-15).** Box passwords and per-box sessions are sealed
> under a vault key that sits behind the lock's biometric gate when the lock is on (001 T028,
> `docs/accounts.md`), and React Native's shared cookie jar is emptied whenever a sign-in ends, so no
> session waits outside the vault between sign-ins (018). Still outside the gate: a handshake cookie a
> process killed mid-sign-in leaves in that jar, until the next sign-in starts; and the database key and
> the backup passphrase's app-usable copy, which are device-bound Keychain items that protect the
> archive, not a sign-in.

### IV. The Local Archive Is Sacred
Messages and their original signed ZFO envelopes are persisted locally, survive ISDS's 90-day
deletion window, and are NEVER silently lost or overwritten. Destructive operations require explicit
user intent. Rationale: long-term archive ("ukládá minulost", "dlouhodobá archivace") is the single
most-praised feature and the app's core reason to exist.

> **As built (2026-09-15).** Each downloaded message's signed original is kept as a `.zfo` file beside
> its attachments, carried by backups and phone transfer, and can be saved from the message (004
> amendment). Its seal is stored, not verified by the app, and none of the signed downloads has yet been
> exercised against a real test box.

### V. Modern, Accessible, Czech-First UX
Mobile-first layouts; a real, correct dark mode (no black-on-black); Dynamic Type / large-font and
screen-reader support; full Czech localization as the primary language. Sensible defaults with an
OPTIONAL compact/density mode for power users who manage several boxes. **Visual consistency is a top
priority:** spacing, padding, radii, colour, and type come ONLY from the single defined scale in the
living design system (`DESIGN.md`, implemented as the theme tokens in `src/theme/`) — never hand-tuned ad-hoc per screen; the SAME pattern reused
anywhere MUST use the SAME metrics; vertical/horizontal rhythm between stacked elements is uniform, not
one-off. **No layout jumps:** content MUST NOT shift, reflow, or resize when a transient/async element
(spinner, loader, sync/"updating" indicator, badge, error/empty line) appears or disappears — reserve
the space up front (fixed height/width slots; prefer a constant-line-height text indicator over a
height-changing spinner) so neighbours never move. Rationale: "zastaralé", "UX hell", "nepřehledné", the
dark-mode bug, inconsistent spacing, and jarring layout shifts are recurring complaints, while a
minority value density.

### VI. Honest Scope
We only advertise authentication methods that ISDS actually exposes to third parties
(username+password, username+password+OTP, and Mobile Key). NIA / BankID / mojeID federated login is
NOT available via the public API — the Provozní řád describes those only through the Client Portal —
and is clearly marked "not yet available" rather than shipped half-broken. **Mobile Key IS available
to third-party applications** and is implemented: Provozní řád ISDS (26. 6. 2026) §5 "Implementace
přihlášení (Mobilní klíč)" states *"Aplikace třetí strany mají možnost … přihlašovat uživatele pomocí
aplikace Mobilní klíč"*, with the protocol in Technical Annex 2. No feature is announced before it
works end-to-end against a real test box.

This principle cuts both ways: claiming LESS than we ship is as dishonest as claiming more. Until
2026-08-16 this section said Mobile Key was unavailable while `authService.mobileKeyLogin()` was
shipping, tested and offered in the add-box picker.

### VII. Verify Against the Test Environment
Development and automated tests run against the ISDS test environment (czebox), never real
government mailboxes. No feature is "done" until exercised against a real test data box on a real
device/emulator.

## Technical Constraints

- **Platform**: React Native CLI (bare), TypeScript strict, New Architecture (Fabric + TurboModules).
- **Architecture**: direct device → ISDS SOAP/HTTPS; no server tier. **No background polling of any
  kind, and therefore no new-message alerts of our own.** Every ISDS call is a sign-in, and Provozní
  řád ISDS §17 requires applications installed on a local station to sign in *"pomocí manuálního
  příkazu uživatele"*; automatic sign-in is reserved for server applications. Fetching the received
  list is additionally legal service under §17(3). The app therefore calls ISDS only on a user action —
  opening the app, opening a box or folder, pull-to-refresh, or an explicit send or download (014 FR-001); incoming post is announced by the state's own e-mail / SMS / Mobile Key
  notifications. (Reminders a user sets themselves remain permissible — a device timer makes no ISDS
  call.)
- **Storage**: SQLCipher-encrypted SQLite (op-sqlite) for message metadata and search (a substring match
  over a normalised subject/party/address column; attachment text is not indexed); downloaded attachments
  and each message's signed original (`.zfo`) as files in the app sandbox, indexed by the DB; box
  passwords and per-box session cookies sealed (XChaCha20-Poly1305) under a vault key, each in its own
  Keychain/Keystore item, the key behind the biometric gate while the app lock is on (001 T028, 018).
- **Licensing**: we MUST NOT statically/dynamically link GPLv3 `libdatovka`; it is a reference only.
  The app stays under a permissive license so distribution is unencumbered.
- **Supported auth (v1)**: username+password, username+password+SMS one-time code (TOTP), and Mobile Key
  (`mobile_key` — `processLogin?type=mep-ws` + `mepWsStateUpdate2` polling). Nothing else.

## Development Workflow

- **Spec-driven**: every feature flows constitution → specify → clarify → plan → tasks → analyze →
  implement, with artifacts under `specs/NNN-*/`. `tasks.md` checkboxes are the unit of progress.
- **Quality gates per feature**: `/speckit-analyze` clean; all tasks checked; a manual run-through
  on a real device/emulator against a czebox test box before the next feature starts.
- **Code style**: **always use braces for blocks** — every `if`/`else`/`for`/`while`/`do` body is
  wrapped in `{ }`, even single statements (no `if (x) return;`). Enforced by ESLint
  `curly: ['error', 'all']`; code must pass `npm run lint`, `npm test`, and `tsc --noEmit` clean.
- **Definition of done** for any user-facing flow: cannot block the UI thread (I), cannot hard-crash
  (II), has a localized error+retry path (II/V), and is exercised against the test environment (VII).

## Governance

This constitution supersedes other practices. Any plan or task that conflicts with a NON-NEGOTIABLE
principle (I, II) is rejected, not merely flagged. Amendments require: a written rationale, a version
bump per the policy below, and propagation to dependent templates/specs. Complexity that appears to
violate a principle MUST be justified in the feature's plan or removed.

Versioning policy (semantic): MAJOR = principle removed/redefined or other backward-incompatible
governance change; MINOR = new principle/section or materially expanded guidance; PATCH = wording
/typo/non-semantic clarifications.

**Version**: 3.0.0 | **Ratified**: 2026-06-12 | **Last Amended**: 2026-09-15

Amendment 3.0.0 (2026-09-15) — MAJOR: a principle was redefined by an owner's decision, and two known
gaps were closed by building rather than by rewording.
1. **III** — "the app is biometric-locked" is now an opt-in lock, off by default. The owner decided
   against forcing it on. What was tightened at the same time: when the lock is on it MUST gate the
   credentials themselves, and it does (001 T028, the vault key). The remaining exposure is recorded as
   dated known gaps.
2. **IV** — signed ZFO originals are stored, backed up and transferred (004 amendment); the known gap is
   replaced by an as-built note.
3. **Technical Constraints** — storage lists the `.zfo` files and the sealed credentials.


Amendment 2.1.0 (2026-09-14) — MINOR: factual corrections plus a new known-gaps record, from an audit
of every document against the code before the repository was made public. No rule was relaxed.
1. **I** — the venue clause named `BGTaskScheduler`/WorkManager for synchronization, which the
   Architecture constraint (2.0.0) forbids; it now names native code and worker threads only.
2. **III, IV** — the principles stand, but the app does not meet all of them: an opt-in lock, box
   passwords without biometric access control, session cookies in the encrypted DB, no stored ZFO. These
   are recorded as dated known gaps rather than written out of the principles.
3. **V** — the design system of record is `DESIGN.md`; `docs/ui-guide.md` was superseded by 009.
4. **Technical Constraints** — the ISDS triggers match 014 FR-001; storage has no full-text index and no
   ZFO files.


Amendment 2.0.0 (2026-08-16) — MAJOR: a principle was redefined and a constraint reversed, both
because the document had drifted from what ships and from the operator's rules.
1. **VI. Honest Scope** — Mobile Key was listed as unavailable via the public API. It is available
   (Provozní řád §5) and has been implemented all along (`authService.mobileKeyLogin()`, four passing
   tests, offered in the add-box picker). NIA / BankID / mojeID remain Portal-only and unavailable.
   Same correction applied to **Supported auth (v1)**.
2. **Technical Constraints / Architecture** — "New-message alerts via scheduled background polling"
   is reversed to *no background polling at all*, per Provozní řád §17 (locally-installed apps sign
   in only on a manual user command) and §17(3) (fetching the received list is legal service).
   Background sync was removed in features 014/014b; this records the rule behind it.
Both were surfaced by cross-referencing the constitution against `docs/isds-provozni-rad-2026-06-26.md`,
archived the same day.
