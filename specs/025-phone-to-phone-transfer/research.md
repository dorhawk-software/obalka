# Research — phone to phone with a code phrase (025)

Written before any code, because the expensive part of this feature is a decision (a native toolchain)
rather than a screen, and the wrong decision is expensive to unmake.

## §1 — Which library

The user described it from memory: *"connecting to a relay and creating a readable onetime pass phrase
from the sender which the receiver inputs… encrypted… very fast, resumable"*. Two projects match that
sentence and they are close cousins.

| | [croc](https://github.com/schollz/croc) | [magic-wormhole](https://magic-wormhole.readthedocs.io/en/latest/welcome.html) |
| --- | --- | --- |
| Language | Go (MIT) | Python reference; Go (`wormhole-william`), Rust |
| Code phrase | `1234-comedy-pastel-alpine` | `7-crossover-clockwork` |
| Key agreement | PAKE from the phrase | SPAKE2 from the phrase |
| Resume | Headline feature, per-chunk | Weaker; not its selling point |
| Local transfer | `OnlyLocal` / `DisableLocal` options | Transit negotiates direct connections |
| Mobile clients | none first-party | Wormhole William Mobile, Destiny — both gomobile |

**Chosen: croc**, confirmed by the user 2026-09-13. Resumability and speed are the two things they
named, and those are croc's own headline claims rather than magic-wormhole's.

The runner-up is not a bad choice — wormhole's protocol is better specified and its mobile story is
better trodden — and if the spike finds croc's API hostile to binding, switching is a §2 decision, not
a re-spec.

### What was ruled out, and why it stays ruled out

- **A JavaScript implementation.** [`magic-wormhole-js`](https://github.com/bakkot/magic-wormhole-js)
  establishes a channel and sends text; it never implemented file transfer and is unmaintained. Its own
  README points at the Rust WASM build instead.
- **Rust compiled to WASM.** Hermes has no WebAssembly. Not "slow" — absent.
- **Reimplementing the protocol in TypeScript.** SPAKE2 exists on npm and `@noble` has the primitives,
  so this is achievable, which is exactly what makes it dangerous. A hand-rolled PAKE that is subtly
  wrong produces a channel that looks encrypted, behaves normally, and protects nothing — with no test
  that fails. This app already took the opposite lesson once: `argon2.ts` proves the native path agrees
  with the reference before trusting it, and `nativeSealedFixture.test.ts` pins the bulk cipher against
  a byte-for-byte fixture. There is no equivalent safety net available for a bespoke PAKE.

Everything therefore routes through **gomobile**, which is what §2 prices.

## §2 — Can it be bound, and what does it cost

### croc is a real library, not just a CLI

This is the finding that makes the feature plausible. `github.com/schollz/croc/v10/src/croc` exports:

- `New(Options)` / `NewCtx(ctx, Options)` → `*Client`, with `Send()` and `Receive()`.
- `Options` carrying the fields this feature needs by name:
  - `SharedSecret` — **the code phrase is an input**, so FR-010 (we generate it, with stated entropy)
    is a parameter rather than a fork.
  - `OnlyLocal` / `DisableLocal` — **local-only is a supported mode.** FR-007's "did this go direct or
    through a relay?" is a flag we set, not a state we infer from traffic, and SC-003 ("no packets to a
    relay host") becomes a property of the configuration rather than a hope.
  - `RelayAddress`, `RelayAddress6`, `RelayPorts`, `RelayPassword` — a relay can be pinned or replaced
    without touching the app.
  - `Curve`, `HashAlgorithm` — the crypto parameters are visible and reviewable.
- `Client` exposes `TotalSent` / `TotalChunksTransferred` and the connection step, which maps onto the
  existing `BackupProgress` without inventing a second progress vocabulary.
- `NewCtx` takes a `context.Context`, which maps onto the existing `CancelSignal` — cancellation is
  already a solved problem in this codebase and does not need a second mechanism.

### What the binding actually looks like

gomobile binds a **restricted subset** of Go: exported functions over strings, ints, `[]byte`, errors,
and interfaces implemented on the host side for callbacks. It will not bind `Options` or `Client`
directly. So the shape is a thin Go package of our own:

```
transfer.Send(path string, secret string, onlyLocal bool, p Progress) error
transfer.Receive(dir string, secret string, onlyLocal bool, p Progress) error
type Progress interface { Step(stage string, sent int64, total int64); Relayed(bool) }
```

…compiled to `.aar` (Android) and `.xcframework` (iOS), with a TurboModule above it. That wrapper is
also where FR-001 is enforced: it takes a **path to bytes that are already sealed**, and has no access
to anything else.

### The cost, which is the open question

Unmeasured, and deliberately not guessed at here. What is known:

- A gomobile binding ships the Go runtime per architecture. This is the dominant cost and it is the
  reason T001 exists.
- For scale: `react-native-quick-crypto` (OpenSSL) took the debug x86_64 APK from 95 MB to 107 MB, and
  that was a dependency with a daily payoff. This one runs **once per phone lifetime**.
- If the answer comes back at tens of megabytes per platform, the honest outcome is to stop and say so.
  The file export (006 T014) already solves the problem, less pleasantly, for nothing.

**T001 is therefore a hard gate, not a warm-up.** No product code before the number exists.

## §3 — Where this sits against the constitution

**Principle III** says: *"We never transmit government mail or credentials to any server we operate."*

- We operate nothing here. The relay is a third party's, or — with `OnlyLocal` — absent.
- What crosses the wire is sealed before the transport sees it (FR-001), so the relay's view is
  ciphertext, sizes and timing.
- **006's deferral is narrower than it looks.** Its deferred list reads "Cross-ecosystem — needs a
  neutral server the project has committed not to run." That sentence rules out *us* running a relay
  for continuous sync. It does not rule out a user-initiated transfer across somebody else's relay, and
  this feature is not sync (see the spec's "deliberately not continuous sync").

The genuinely new thing is smaller and worth naming: **this would be the first socket this app opens to
a host that is not ISDS.** That is a change in what the app is, not just what it does, and FR-007's
on-screen disclosure is the price of it.

**Principle IV** is untouched by construction: the receiving side is the existing
`unpackPortable` → `restoreBackup` path, whose merge rules are additive and never-replace-with-nothing,
and which has tests to that effect. The one rule this feature must not be allowed to relax is FR-003 —
no second restore implementation. A transport that wrote rows itself would be re-deciding, in the
place where getting it wrong destroys an archive, a question that was already decided carefully.

## §4 — The recovery key crossing the wire

The archive is sealed under the recovery key, so a transfer that carries only the archive leaves the
user typing twenty characters at the end — which is the chore this feature exists to remove. The key
therefore travels with it, over the PAKE channel and nowhere else.

That is defensible precisely because of what PAKE is: an attacker at the relay gets **one online guess
per attempt** and nothing to take away and grind offline. It is not defensible if the phrase is weak,
which is why FR-010 makes the phrase ours. croc's `SharedSecret` being an input rather than a fixed
behaviour is what makes that a configuration line instead of a patch.

The entropy target belongs in the plan, not here, but the shape of the argument is: the phrase is typed
once, by hand, under the user's eye, between two devices in the same room — so it can afford to be
longer than a CLI default chosen for people typing into a terminal all day.

## §5 — What the spike must answer

1. **Size.** APK and IPA, before and after, release, per architecture. The gate.
2. **Does it build at all** for `arm64-v8a`/`x86_64` and for the iOS simulator plus device slices, on
   the CI runners this project already uses.
3. **Does `OnlyLocal` do what it says** — two emulators/devices on one network, with a packet capture
   proving nothing reaches a relay host.
4. **Does resume work** across a killed process, not just a dropped connection.
5. **Progress and cancel** reach JavaScript often enough to drive the existing `ProgressBar`, and a
   cancel actually stops the Go side rather than orphaning it.

If (1) fails, the rest is moot and the feature is closed with the numbers written down — which is a
result, not a failure.
