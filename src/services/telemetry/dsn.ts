// Where crash reports go. Empty here on purpose.
//
// A Sentry DSN is NOT a secret - it ships inside every copy of every client that uses it, and it
// grants exactly one capability: sending events to one project. Sentry's own guidance is that it may
// be public. So this is committed rather than kept in an env file, which would only add build
// plumbing to protect something that is printed in the app bundle anyway.
//
// An EMPTY value here is still meaningful and still supported: `startTelemetry()` treats it as
// "telemetry is not configured" and does nothing at all - no SDK init, no handlers installed, no
// network - so every call site degrades to a no-op. That was this file's state until 2026-09-11 and
// is what the whole feature was built and tested against.
//
// It now points at the `obalka` project, and the host is the part that matters:
// `ingest.de.sentry.io` is the EU region. The FAQ tells users in Czech that reports go to servers in
// the EU, and this string is what makes that sentence true rather than aspirational.
//
// Note what is NOT in this string: the organisation's SLUG. `o4512067310649344` is the numeric org
// ID. The slug is build-time plumbing only; it lives in `SENTRY_ORG` in
// `.github/workflows/ios-sideload.yml` and in the gitignored `sentry.properties` files, and a stale
// one is caught by that workflow's preflight.
//
// This is the org's SECOND project. The company was renamed (Lelek Software to Dorhawk Software)
// and a new organisation was created rather than the old one renamed, so both the org ID and the
// project ID here changed - a rename alone would have changed neither. The `lelek-software` project
// is therefore dead, not migrated: anything it already received stays there and is not worth
// moving, since no build that reported to it was ever given to anyone.
//
// A first attempt landed in a US org (`ingest.us.sentry.io`) and was abandoned rather than used:
// region is fixed when the ORGANIZATION is created and a US org cannot be migrated, so pointing at
// it would have meant editing the FAQ to say something the app's users would like less.
//
// Not a secret. A DSN ships inside every copy of every client that uses it and grants exactly one
// capability, sending events to one project; Sentry's own guidance is that it may be public. The
// AUTH TOKEN is the real credential, and it lives in `sentry.properties`, which is gitignored.
export const SENTRY_DSN =
  'https://b6d6036d0bcb2b8f37553ed0470a99d3@o4512067310649344.ingest.de.sentry.io/4512067322118224';

/**
 * Which environment a report came from.
 *
 * Kept beside the DSN because the two are always decided together. `development` while the app is
 * running from Metro; a release build should set this to `production` (or `alpha` while it is not
 * published), so a crash from your own emulator does not sit next to a crash from a real user.
 */
export const SENTRY_ENVIRONMENT = __DEV__ ? 'development' : 'alpha';
