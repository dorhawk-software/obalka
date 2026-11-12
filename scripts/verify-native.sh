#!/usr/bin/env bash
# Builds both apps on this Mac before a release is tagged (owner, 2026-11-12). `npm run release` runs it
# after `npm run verify`, so nothing is tagged that doesn't compile here. Until then the only native
# check was CI's, after the push: development had been on Linux, where iOS can't build at all.
#
#   iOS:     the transfer framework, CocoaPods, a Debug build for the device SDK, unsigned (what ci.yml
#            builds), and check-transfer-linked.sh on the .app.
#   Android: the transfer .aar for every ABI, then a Release build (debug-signed without the upload key),
#            which also bundles the JS with Hermes - something no push build checks - and
#            check-transfer-linked.sh on the .apk.
#
#   ./scripts/verify-native.sh            # both
#   ./scripts/verify-native.sh ios        # one platform
#   ./scripts/verify-native.sh android
#
# Needs what docs/release-ci.md lists for the release jobs: Xcode, CocoaPods, Go (native/transfer/go.mod),
# a JDK 17, the Android SDK and the NDK android/build.gradle names. Takes minutes: run it at low priority.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
WHICH="${1:-all}"

fail() {
  echo "verify-native: $*" >&2
  exit 1
}

[ "$(uname -s)" = Darwin ] || fail "a release is tagged on a Mac: the iOS app must compile first."

# These builds are checks, not releases: nothing goes to Sentry. A Release build otherwise uploads its
# source maps with the token a local sentry.properties holds (it did, on this script's first run).
export SENTRY_DISABLE_AUTO_UPLOAD=true

ios() {
  echo "verify-native: iOS"
  ./scripts/build-transfer-xcframework.sh
  local log
  log="$(mktemp)"
  (cd ios && RCT_NEW_ARCH_ENABLED=1 pod install | tee "$log")
  grep -q "\[025\] ObalkaTransferModule: linking Obalkatransfer.xcframework" "$log" ||
    fail "CocoaPods did not link Obalkatransfer.xcframework: the app would have no phone-to-phone transfer."
  # Outside the repository, reused between runs (a build folder in the repo would put a full build on
  # the internal disk).
  local derived="$HOME/Library/Developer/Xcode/DerivedData/Obalka-verify"
  (cd ios && xcodebuild -quiet \
    -workspace ObalkaDatovaSchranka.xcworkspace \
    -scheme ObalkaDatovaSchranka \
    -configuration Debug \
    -sdk iphoneos \
    -derivedDataPath "$derived" \
    -destination 'generic/platform=iOS' \
    CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY="" \
    build)
  ./scripts/check-transfer-linked.sh "$derived/Build/Products/Debug-iphoneos/ObalkaDatovaSchranka.app"
}

android() {
  echo "verify-native: Android"
  local ndk jdk
  ndk="$(sed -n 's/.*ndkVersion *= *"\(.*\)".*/\1/p' android/build.gradle)"
  export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
  export ANDROID_NDK_HOME="$ANDROID_HOME/ndk/$ndk"
  [ -d "$ANDROID_NDK_HOME" ] || fail "the NDK $ndk (android/build.gradle) isn't in $ANDROID_HOME/ndk."
  # Gradle needs JDK 17; a newer default JDK fails in op-sqlite's CMake step with a message that names
  # nothing about the JDK.
  if [ -z "${OBALKA_JAVA_HOME:-}" ]; then
    for jdk in "$HOME"/.sdkman/candidates/java/17.*; do
      [ -d "$jdk" ] && OBALKA_JAVA_HOME="$jdk"
    done
  fi
  [ -n "${OBALKA_JAVA_HOME:-}" ] || fail "no JDK 17 found: set OBALKA_JAVA_HOME."
  export JAVA_HOME="$OBALKA_JAVA_HOME"
  ./scripts/build-transfer-aar.sh
  (cd android && ./gradlew --quiet :app:assembleRelease)
  ./scripts/check-transfer-linked.sh android/app/build/outputs/apk/release/app-release.apk
}

case "$WHICH" in
  ios) ios ;;
  android) android ;;
  all) ios && android ;;
  *) fail "usage: verify-native.sh [ios|android]" ;;
esac
echo "verify-native: $WHICH built and checked."
