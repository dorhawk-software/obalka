# Releasing

**Status (2026-09-23):** built, not yet run. The release workflow, the release command and the signing
configuration exist; the first real release is their first test against Apple and Google, and may need
one adjustment there.

## How a release works

1. On an up-to-date, clean `main`: `npm run release -- 0.1.0`. The command (`scripts/release.mjs`) checks
   that the version goes up and the tag is free, runs `npm run verify`, sets the version in
   `package.json` and `src/app/appInfo.ts`, commits `Release v0.1.0`, tags `v0.1.0`, and pushes the commit
   and the tag together.
2. The tag starts **`.github/workflows/release.yml`**:
   - **verify** - the tag, `package.json` and `APP_VERSION` must agree, then the full `npm run verify`.
   - **ios** (macOS, Xcode 26.3) - a signed archive, uploaded to App Store Connect; it appears in
     TestFlight once Apple has processed it, usually within half an hour.
   - **android** - a signed app bundle for every device ABI, kept as a workflow artifact and uploaded to
     Google Play's internal testing track once that is switched on (below).
   - **github-release** - a GitHub release for the tag, marked pre-release while the major number is 0,
     created only when at least one platform shipped.
3. A platform whose secrets are not set up yet is **skipped with a warning**, not failed, so Apple can be
   switched on before Google or the other way round.
4. Both platform jobs build the **phone-to-phone transfer's Go archive** first (below) and fail the
   release if it is missing - a developer build without it just hides the transfer, a release must not.

## The transfer's Go archives (025)

The transfer is croc, in Go, bound with gomobile: `obalkatransfer.aar` for Android and
`Obalkatransfer.xcframework` for iOS. Neither is committed; the workflows build them.

- **Scripts.** `scripts/build-transfer-aar.sh` (Linux or macOS; Go, a JDK, the Android SDK and the NDK
  `android/build.gradle` names, installed on CI by `scripts/install-ndk.sh`) and
  `scripts/build-transfer-xcframework.sh` (macOS only; Go and Xcode). Both stage the Go module through
  `native/transfer/prepare.sh`, which applies the one patch to croc (its relay lookup at load time; 025
  T025) and runs `go vet` and `go test` before anything is bound.
- **Pinned.** Go from the `go` line of `native/transfer/go.mod` (`actions/setup-go` reads it); gomobile
  and gobind as `tool` directives in the same file, installed with `go install tool`. `gomobile init` is
  never run, because it installs `gobind@latest`. croc is pinned in go.mod, and `prepare.sh` refuses a
  croc whose patched file changed. Xcode is the job's `DEVELOPER_DIR` (26.3), the NDK is the app's.
- **Where they run.** `ci.yml`: the `ios` job builds the framework before `pod install`, and the
  `transfer-android` job builds the `.aar` on every push (no Android app is built in CI; this catches a Go,
  gomobile, NDK or patch problem while it is one commit old). `ios-sideload.yml` builds the framework.
  `release.yml` builds both.
- **Every Android ABI.** The `.aar` carries arm64-v8a, armeabi-v7a, x86 and x86_64 - every ABI the app
  bundle ships (`reactNativeArchitectures`), and the script fails if one is missing. Google Play requires
  64-bit (arm64-v8a); armeabi-v7a is kept because the bundle ships it, so an older 32-bit phone can
  install the app, and without the Go library there it would install with the transfer silently gone.
  Play splits the bundle per ABI, so each phone downloads only its own (+7.75 MB on arm64, T003).
- **Proof in the build.** `pod install` prints `[025] ObalkaTransferModule: linking
  Obalkatransfer.xcframework` (the step fails without it), and `scripts/check-transfer-linked.sh` checks
  the finished app - the `.app` on iOS, the `.aab` on Android - for croc's code, the native module, and
  the absence of croc's patched-out lookup. On iOS the release also refuses a binary that still carries
  bitcode (gomobile compiles its C half with `-fembed-bitcode`; App Store Connect rejects bitcode with
  ITMS-90482).
- **A repository of its own, later.** The Go side is planned to move to
  `dorhawk-software/obalka-transfer`, whose CI would build and publish both archives; Obálka would then
  download a pinned version and check its SHA-256. The scripts are self-contained for that reason: the Go
  module, `prepare.sh` and one build script per platform move together.

The unsigned **`ios-sideload.yml`** workflow stays for quick sideloaded builds without TestFlight.

## Version and build numbers

- **The version** (what people see) comes from the tag. `npm run release` keeps `package.json` and
  `APP_VERSION` in step, the workflow refuses a tag they disagree with, and
  `__tests__/app/appVersion.test.ts` catches a hand edit in between. The READMEs do not state it.
- **The build number** (what the stores order builds by) is the run number times a hundred plus the
  attempt. It only ever goes up, and re-running a half-finished release (one store uploaded, the other
  failed) cannot reuse a number one store already has.
- **The native files are not edited.** iOS gets both numbers from `xcodebuild` build settings, Android
  from `-PobalkaVersionName` / `-PobalkaVersionCode`; a local Android build shows package.json's version
  with build number 1.

## One-time setup: Apple (TestFlight)

Without a registered company (and its D-U-N-S number) the membership is an **individual** enrolment:
Apple lists the app under the member's own name. It can be converted to an organisation later.

1. **Register the bundle ID** `software.dorhawk.obalka`: developer.apple.com → Certificates, Identifiers &
   Profiles → Identifiers → **+** → App IDs → App. No extra capabilities are needed - no push, no iCloud,
   and no multicast entitlement for the phone-to-phone transfer (025 T022 says why).
2. **Create the app**: App Store Connect → Apps → **+** → New App - iOS, the name (store names are unique
   across the App Store, so "Obálka" may need a suffix), primary language Czech, the bundle ID above, any
   SKU.
3. **Create an API key**: App Store Connect → Users and Access → Integrations → App Store Connect API →
   Team Keys → **+**, role **Admin** (automatic signing needs it to create the distribution certificate).
   Download the `.p8` - Apple offers it once - and note the Key ID and the Issuer ID.
4. **Give them to GitHub** - repository Settings → Secrets and variables → Actions:

   | Kind | Name | Value |
   |---|---|---|
   | variable | `APPLE_TEAM_ID` | Team ID - developer.apple.com → Account → Membership details |
   | secret | `ASC_KEY_ID` | the key's Key ID |
   | secret | `ASC_ISSUER_ID` | the Issuer ID shown above the keys |
   | secret | `ASC_KEY_P8` | the whole text of the `.p8` file |

5. **Add testers**: App Store Connect → the app → TestFlight → Internal Testing. Internal testers (people on
   the team) need no review. External testers need Beta App Review and a privacy policy URL.

**Export compliance.** Each build waits in App Store Connect on one question until the app answers it
itself: does it use encryption? Obálka does, beyond HTTPS - SQLCipher for the archive, XChaCha20-Poly1305
and AES-256-GCM for backups - all standard algorithms. The phone-to-phone transfer (025) adds croc's: a
PAKE key exchange over the NIST P-256 curve (`schollz/pake`), then PBKDF2-SHA256 and AES-256-GCM from
Go's standard library, over a plain TCP connection - standard algorithms again, protecting only the
user's own data in transit. Whether all of that qualifies for an exemption is a legal declaration the
developer makes. Once decided, the key `ITSAppUsesNonExemptEncryption` in
`ios/ObalkaDatovaSchranka/Info.plist` records it and builds stop asking.

## One-time setup: Google Play (internal testing)

Without a company, a **personal** account - an organisation account needs a D-U-N-S number too. Apps can
be transferred to an organisation account later.

1. **Register** at play.google.com/console/signup: personal account, a one-time fee, identity
   verification with a government ID, and a check on an Android phone.
2. **Create the app** in the Play Console with the package name `software.dorhawk.obalka` - permanent once
   anything is published under it.
3. **Make an upload key** on your own computer, and keep the file and its passwords in a password manager:

   ```sh
   keytool -genkeypair -v -storetype PKCS12 -keystore obalka-upload.jks \
     -alias obalka-upload -keyalg RSA -keysize 4096 -validity 10000
   base64 -w0 obalka-upload.jks    # the text for ANDROID_UPLOAD_KEYSTORE_BASE64
   ```

   Secrets: `ANDROID_UPLOAD_KEYSTORE_BASE64`, `ANDROID_UPLOAD_STORE_PASSWORD`, `ANDROID_UPLOAD_KEY_ALIAS`
   (`obalka-upload`), `ANDROID_UPLOAD_KEY_PASSWORD`. Google keeps the real app signing key (Play App
   Signing, the default); the upload key only proves an upload is yours, and Google can reset it if lost.
4. **Upload the first build by hand.** Google's API cannot create the first release of a new app. Cut a
   release with the key set up, download the `obalka-<version>-android-aab` artifact from the workflow
   run, and upload it in the Play Console under Testing → Internal testing.
5. **Then let the workflow upload.** In Google Cloud, create a service account in a project linked to the
   Play Console and give it a JSON key; in the Play Console, invite the service account's e-mail under
   Users and permissions with permission to release to testing tracks. Then add the secret
   `PLAY_SERVICE_ACCOUNT_JSON` (the whole JSON) and the variable `PLAY_UPLOAD` = `true`. Leave
   `PLAY_RELEASE_STATUS` unset (uploads land as drafts) until the app is out of draft in the Console, then
   set it to `completed`.
6. **Before production** - not needed for internal testing - Google requires a new personal account to
   run a closed test with a minimum number of testers (twelve, in 2026) for fourteen days in a row.

## What the stores will ask before a public release

- A **privacy policy** URL - both stores, and Apple's external TestFlight testing.
- Apple's **App Privacy** answers and Google's **Data safety** form, plus Google's content rating and
  target audience questionnaires.
- Screenshots and listing text (the keyword work is in `docs/aso.md`).

What to base the answers on: there is no backend of ours; the app talks to ISDS directly; crash reports
leave the phone only with consent and never carry message content; everything else stays on the phone
except the backups the user makes and a phone-to-phone transfer the user starts, which may cross croc's
public relay encrypted (the privacy policy names it). No bundled SDK reports usage on its own: the QR scanner used to be
Google ML Kit, which sends device, app and usage data to Google with no opt-out and would have had to
be declared here - it was replaced on 2026-09-24 by on-device decoders (Apple's `AVCaptureMetadataOutput`
on iOS, zxing-cpp on Android; 025's amendment of that date). Re-check this whenever a native dependency
is added: `./gradlew :app:dependencies --configuration releaseRuntimeClasspath | grep -i -E
'mlkit|firebase|play-services'` should list only `play-services-auth-api-phone` (021's SMS code) and
what it pulls in.

## Donations

The app has no donation button, and should not get one. Apple requires in-app purchase for tips to a
developer (App Review guideline 3.1.1), so a link to an outside payment page in the iOS app is a common
rejection. Donations live outside the app instead: the READMEs link to https://buymeacoffee.com/software.dorhawk, and
`.github/FUNDING.yml` gives the repository its Sponsor button. A coffee never buys or unlocks anything.

## Keep the repository public

The Settings → *Zdrojový kód* row links to `github.com/dorhawk-software/obalka`, and `LICENSE` is MIT in the
name of "The Obálka contributors" - both assume source anyone can fetch. If the repository ever goes
private again, remove that row (`src/app/appInfo.ts`, `SettingsScreen.tsx`) rather than ship a dead link.

## CI on every push

`.github/workflows/ci.yml` runs on every push to `main`, every pull request, weekly, and by hand: the
`npm run verify` checks, a Trivy secret scan, an unsigned iOS build against the device SDK on Xcode 26 (a
compile check - nothing is installed or run) with the transfer framework built and checked in it, and the
transfer's Android `.aar`. Branches named `wip/*` get the same run on every push, which is the way to
try something on the macOS runner without a pull request. A newer push cancels the run it supersedes. Every
workflow declares read-only permissions; only the release job that creates the GitHub release may write.

## Patched dependencies

`patches/` is applied by patch-package on every `npm ci`. A patch goes away when the package it patches
is upgraded past the fix.

- **`react-native-screens+4.25.2.patch`** (2026-09-24) - upstream PR software-mansion/react-native-screens#4413,
  first released in 4.28.0. On Android, two threads could create the screen-removal listener that Fabric
  calls on every commit at the same time, leaving a freed object registered: a native crash
  (`MountingCoordinator::pullTransaction`, SEGV_ACCERR) in about 1 of 60 cold starts upstream (#4654), seen
  once on the emulator here. Remove the patch when upgrading to 4.28.0 or later.

## Dependency advisories - closed 2026-09-14

Before the repository went public, GitHub's Dependabot listed nine open alerts on `main`, and `npm audit`
reported 10 vulnerable packages (6 moderate, 4 high: the two packages with advisories below plus the
packages that depend on them). After: `npm audit` finds 0 vulnerabilities and `npm run audit:shipped` sees 0 advisory
records.

| Alert | Reached through | Fix |
|---|---|---|
| image-size, 2 high (GHSA-w3rx-r6r6-pgpr, GHSA-5p2g-fcmc-qvqq) | Metro 0.84.4 - build tooling, never shipped | No patched image-size exists. Metro 0.84.5 replaced it with vendored parsers. The lockfile moves the Metro family to 0.84.6, inside the `^0.84.3` ranges React Native already declares, so no override has to be remembered at the next RN upgrade. |
| decode-uri-component, 1 moderate (GHSA-vcc3-ghjq-m6fr) | @react-navigation/core 7 → query-string 7.1.3 - shipped | The fix is 0.5.0, but query-string 7 asks for `^0.2.2`, and no react-navigation 7 release moves off query-string 7. An `overrides` entry in `package.json`, scoped to query-string, forces `^0.5.0`. `patches/query-string+7.1.3.patch` makes query-string take 0.5.0's ESM default export. Overriding query-string to 9.5 instead was ruled out: it exports only a default, and core 7 does `import * as queryString`. |
| concurrent-ruby, 1 high + 2 low; activesupport, 3 moderate | `Gemfile` - the CocoaPods tooling | Floors `>= 1.3.7` and `>= 7.2.3.1` replace the React Native template's `< 1.3.4` cap and `>= 6.1.7.5`. The cap guarded activesupport before 7.1 against concurrent-ruby 1.3.5 no longer loading `logger`; 7.2 loads it itself. activesupport 7.2 needs Ruby 3.1, so the Gemfile now asks for `>= 3.1.0`. The floor also admits activesupport 8.0 before 8.0.4.1 and 8.1 before 8.1.2.1, which the same three advisories cover; no CocoaPods can resolve them, because cocoapods-core requires activesupport `< 8` in every release up to 1.17.0. |

Evidence:

- **Decoder behaviour.** Scratch differential of query-string 7.1.3 with decoder 0.2.2 against the patched 7.1.3 with 0.5.0, over 60,011 generated queries: `parse` and `stringify(…, {sort: false})`, the two calls react-navigation makes, gave identical output on every one. On 2,402 characters of malformed percent-encoding, the old pair took 12.4 s and the patched pair 0.3 ms. 0.3.0 stopped decoding `+` as a space, but that never reaches `parse()`, which replaces `+` itself before decoding.
- **Ruby.** In `ruby:3.3-slim` and `ruby:3.4-slim` containers, `bundle lock` on the new Gemfile resolves activesupport 7.2.3.2, concurrent-ruby 1.3.8, cocoapods 1.15.2 and xcodeproj 1.25.1. Once a compiler is added (`build-essential`; bigdecimal builds a native extension, and the old Gemfile needs it too), `bundle install` succeeds, and cocoapods and active_support load together; the old cap existed to prevent a load-time crash. The review repeated the lock and the load in `ruby:3.3-slim` and got the same versions. As a non-root user, `pod --version` gets past loading and then stops at CocoaPods' own check for a `git` executable, which the slim image lacks. The old Gemfile stops at the same point. No `Gemfile.lock` is committed, as before. CI's `ios-sideload.yml` runs the runner's own `pod`, not `bundle exec`, so it is unaffected.
- **Install path (review re-check, 2026-09-14).** Nothing below ran `npm ci`, Metro or a device:
  - npm's own lockfile check (the arborist comparison `npm ci` runs before installing) finds the lockfile in sync with `package.json`, with the override edge valid.
  - `npm install --package-lock-only` reproduces the committed lockfile byte for byte.
  - Every changed tarball matches its lockfile integrity hash.
  - patch-package 8.0.1 applies the patch to a pristine query-string 7.1.3.
  - The decoder and the patched query-string, run through the project's Babel config, compile with the bundled `hermesc`. The decoder comes out as `exports.default`, the export the patch reads.
- **Guard.** `__tests__/security/dependencyAdvisories.test.ts` fails when any of these happens:
  - a lockfile brings back image-size or a decoder older than 0.5.0;
  - the override or the patch goes missing (the decoder tests run the installed query-string and react-navigation's `getStateFromPath`/`getPathFromState` on hostile input and on Czech text);
  - the Gemfile floors are lost, which React Native's upgrade helper does whenever it copies the template Gemfile back in.

  Every one of its tests fails against the pre-fix lockfile, Gemfile and `node_modules`.
- **Audit gate and licences.** `scripts/audit-shipped.mjs` no longer accepts decode-uri-component. That acceptance argued that nothing could reach the decoder; with the fixed decoder shipping, the argument is no longer needed. The Licence screen list (`src/content/attributions.generated.ts`) now names decode-uri-component 0.5.0 and metro-runtime 0.84.6.

Still open:

- When @react-navigation/core moves to query-string 9.5 or later, delete the override and the patch together. The react-navigation 8 alphas already ask for `^9.4.0`.
- A `node_modules` installed before this change still holds the old Metro, query-string and decoder, and `npm run attributions:check` will then disagree with the committed list. Run `npm ci`.
- Not yet seen on a device: a Metro 0.84.6 release bundle, and the navigator loading the ESM decoder under Hermes.
