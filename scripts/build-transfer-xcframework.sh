#!/usr/bin/env bash
# Build native/transfer into the iOS .xcframework the app links (025 T022).
#
# The iOS half of scripts/build-transfer-aar.sh, with the same rules: not run by the normal build,
# the artefact is gitignored, and a build without it runs with no phone-to-phone transfer (FR-013) -
# `ios/ObalkaTransferModule/ObalkaTransferModule.podspec` compiles the native module only when the
# framework is there. CI, the sideload build and a release all run this and fail when it is missing.
#
# macOS only: gomobile drives Xcode (`xcrun`, `xcodebuild -create-xcframework`). The version of every
# tool is pinned by native/transfer/go.mod - the `go` line, and gomobile and gobind as `tool`
# directives, installed with `go install tool`. `gomobile init` is deliberately NOT run: it installs
# `gobind@latest`. Xcode is whatever DEVELOPER_DIR selects; the workflows pin the one the app is
# built with.
#
# Self-contained on purpose (Go module + prepare.sh + this script): the plan is to move the Go side
# to a repository of its own, dorhawk-software/obalka-transfer, with little more than a path change.
#
#   ./scripts/build-transfer-xcframework.sh                    # iPhone (arm64): what ships
#   ./scripts/build-transfer-xcframework.sh ios,iossimulator   # plus the simulator slices
set -euo pipefail

TARGET="${1:-ios}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NAME=Obalkatransfer
OUT="$ROOT/ios/ObalkaTransferModule/$NAME.xcframework"

[ "$(uname -s)" = "Darwin" ] || { echo "build-transfer-xcframework: needs macOS and Xcode (gomobile runs xcrun)."; exit 1; }
command -v go >/dev/null || { echo "go is not installed - see specs/025-phone-to-phone-transfer/tasks.md (T022)"; exit 1; }
command -v xcrun >/dev/null || { echo "build-transfer-xcframework: Xcode's command-line tools are missing."; exit 1; }

# The app's own floor, read from the Xcode project, so the Go archive never targets an older iOS
# than the app and never demands a newer one.
IOS_MIN="$(sed -n 's/.*IPHONEOS_DEPLOYMENT_TARGET = \([0-9.]*\);.*/\1/p' \
  "$ROOT/ios/ObalkaDatovaSchranka.xcodeproj/project.pbxproj" | sort -u | head -n 1)"
: "${IOS_MIN:?could not read IPHONEOS_DEPLOYMENT_TARGET from the Xcode project}"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

MODULE="$("$ROOT/native/transfer/prepare.sh" "$WORK")"
cd "$MODULE"
GOBIN="$WORK/bin" go install tool
export PATH="$WORK/bin:$PATH"

# The file name makes the framework's name, and with it the header the module imports
# (<Obalkatransfer/Obalkatransfer.h>). The package name makes the Objective-C prefix: `ObalkatransferSend`,
# `ObalkatransferProgress`. -trimpath keeps the build machine's paths out of the archive.
gomobile bind -target="$TARGET" -iosversion "$IOS_MIN" -trimpath -o "$WORK/$NAME.xcframework" .

rm -rf "$OUT"
mkdir -p "$(dirname "$OUT")"
mv "$WORK/$NAME.xcframework" "$OUT"

# What the native module needs from it, checked here rather than twenty minutes into an app build.
DEVICE="$OUT/ios-arm64/$NAME.framework"
for f in "$DEVICE/$NAME" "$DEVICE/Headers/$NAME.h" "$DEVICE/Headers/$NAME.objc.h"; do
  [ -f "$f" ] || { echo "build-transfer-xcframework: $f is missing." >&2; exit 1; }
done
for symbol in ObalkatransferSend ObalkatransferReceive ObalkatransferProgress ObalkatransferCanceller; do
  grep -q "$symbol" "$DEVICE/Headers/$NAME.objc.h" || {
    echo "build-transfer-xcframework: $symbol is not in the generated header." >&2
    exit 1
  }
done
echo "build-transfer-xcframework: $NAME.xcframework built for iOS $IOS_MIN+ ($TARGET)"
du -sh "$OUT"
