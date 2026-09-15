#!/usr/bin/env bash
# Build native/transfer into the Android .aar the app links (025 T009, T022).
#
# Not run by the normal build, and the artefact is gitignored. This is the second toolchain 025's
# gate warned about: it needs Go, a JDK and the Android SDK + NDK, and a developer who never touches
# the transfer feature never has to install any of it - the app builds and runs without the .aar,
# minus this one feature (FR-013). A RELEASE never does: release.yml runs this script and fails when
# the .aar or any ABI in it is missing.
#
# Every tool version is pinned by native/transfer/go.mod: the `go` line, and gomobile and gobind as
# `tool` directives, installed with `go install tool` below. `gomobile init` is deliberately NOT run:
# it installs `gobind@latest`, which is the unpinned tool this used to build with.
#
# Self-contained on purpose (Go module + prepare.sh + this script): the plan is to move the Go side
# to a repository of its own, dorhawk-software/obalka-transfer, with little more than a path change.
#
#   ./scripts/build-transfer-aar.sh                # every ABI the app ships (gradle.properties)
#   ./scripts/build-transfer-aar.sh android/arm64  # one ABI, for a quicker local build
#
# Needs: Go (the version in native/transfer/go.mod), ANDROID_HOME (gomobile compiles the Java half
# against the SDK platform), ANDROID_NDK_HOME (the NDK android/build.gradle names), javac.
set -euo pipefail

TARGET="${1:-android}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/android/app/libs/obalkatransfer.aar"

command -v go >/dev/null || { echo "go is not installed - see specs/025-phone-to-phone-transfer/tasks.md (T022)"; exit 1; }
: "${ANDROID_NDK_HOME:?set ANDROID_NDK_HOME to the NDK android/build.gradle names (ndkVersion)}"
export ANDROID_HOME="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
: "${ANDROID_HOME:?set ANDROID_HOME to the Android SDK}"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

MODULE="$("$ROOT/native/transfer/prepare.sh" "$WORK")"
cd "$MODULE"
GOBIN="$WORK/bin" go install tool
export PATH="$WORK/bin:$PATH"

mkdir -p "$(dirname "$OUT")"
rm -f "$OUT"
# -androidapi matches minSdkVersion (android/build.gradle). -trimpath keeps the build machine's
# paths out of the library.
gomobile bind -target="$TARGET" -androidapi 24 -trimpath -o "$OUT" .

# The whole-platform build must carry every ABI the app bundle ships. An ABI missing here is an app
# that installs on that phone and silently has no transfer (FR-013 hides it), which a release must
# not do - so it stops here instead.
if [ "$TARGET" = "android" ]; then
  abis="$(sed -n 's/^reactNativeArchitectures=//p' "$ROOT/android/gradle.properties" | tr ',' ' ')"
  listing="$(unzip -l "$OUT")"
  for abi in $abis; do
    if ! grep -q "jni/$abi/libgojni.so" <<<"$listing"; then
      echo "build-transfer-aar: $OUT has no jni/$abi/libgojni.so, and the app ships $abi." >&2
      exit 1
    fi
    echo "build-transfer-aar: jni/$abi/libgojni.so present"
  done
fi
ls -l "$OUT"
