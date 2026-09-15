# Implementation Plan: Per-box ISDS session isolation

**Branch**: `018-per-box-session` | **Date**: 2026-08-17 | **Spec**: [spec.md](./spec.md)

## Summary

Stop cookie-authenticated boxes sharing one native cookie jar. Capture each box's session at its own
login, store it against that box, replay it explicitly on that box's calls, and keep the shared jar
out of the WS path entirely.

## The shape of the fix

The foundation already decided the approach; this wires it up.

```
login  →  clearAll()  →  POST login  →  readSession(host)  →  store against boxId
call   →  read stored session for boxId  →  http.send({ cookie, useJar: false })
remove →  drop the accounts row (the session goes with it); jar cleared at the next login
```

**The jar is never the source of truth for a WS call.** `useJar: false` on every WS send is the
load-bearing line: it is what makes a second box's login incapable of affecting the first's traffic,
rather than merely unlikely to.

## Where the session lives

A new `sessionCookie` column on `accounts` (migration 13), beside the existing unused
`sessionValidUntil`. Reasoning is in the spec's Assumptions: a biometric-gated keychain entry could not
serve a per-call credential, while the encrypted DB already holds the mail this session
grants access to — and beats today's **unencrypted** native jar.

*Superseded 2026-09-15 (001 T028):* the column is emptied by a launch migration and never written again.
Each session is a Keychain item `cz.obalka.session.<boxId>`, sealed under the vault key, and the
controllers read it at call time through `credentialsFor`. See 001 plan "The vault key".

## How it threads through

- `ListMessagesArgs` (and the send/search/credit arg types) gain `sessionCookie: string | null`.
- Controllers resolve it exactly where they already resolve the password — `resolvePassword` has the
  shape to copy.
- Login methods **return** the captured cookie; `authService` persists it with the account.
- The transport's rule per call: `password` → HTTP Basic, no cookie; otherwise → the box's cookie.
  **Both** pass `useJar: false`.

## Constitution Check

| Principle | Status |
|---|---|
| I — UI thread | ✅ no new sync work |
| II — Crash-resilient | ✅ a missing session degrades to a 401 → re-auth, never a throw |
| III — Privacy first | ✅ **this is the point** — a bearer credential stops being shared between identities, and moves from an unencrypted store to the encrypted one |
| IV — Archive sacred | ✅ untouched |
| V — UX | ✅ no visible change when it works; re-auth when a session genuinely expires |
| VI — Honest scope | ✅ the module claimed a guarantee it never delivered; that gap closes |
| VII — Test environment | ⚠️ czebox boxes here are password boxes — the decisive test needs two OTP boxes, which the user is setting up |

## Risks

1. **Regressing password boxes**, which work today. They are the only boxes testable here, so every
   change to their path must be visible in tests.
2. **Forcing a re-login on every launch** if the stored session is not persisted or not read back —
   the native jar survives restarts today, so this must too (US3).
3. **The decisive case cannot be verified without two OTP boxes.** Everything else is unit-tested;
   that one is walked by the user.
