#!/usr/bin/env bash
# Proves the phone-to-phone transfer is INSIDE a built app, not just built beside it (025 T022).
#
# FR-013 makes a missing Go archive quiet on purpose - the app hides the transfer - and that is right
# on a developer's machine and wrong in anything CI hands to a person. The build scripts check the
# archives they produce; this checks what the app build did with them:
#
#   * croc's Go code is there. Go keeps every function's full name in the runtime's own tables, which
#     no symbol stripping removes, so `github.com/schollz/croc/v10/src/croc` is findable in a Release
#     binary too;
#   * croc's load-time relay lookup is NOT there (`models.lookup`) - native/transfer/prepare.sh
#     patches it out, and an archive built some other way would bring it back;
#   * iOS: the native module class, ObalkaTransferModule, which is compiled only with the framework;
#   * Android: libgojni.so for every ABI the bundle ships (android/gradle.properties).
#
#   ./scripts/check-transfer-linked.sh path/to/ObalkaDatovaSchranka.app   # iOS, a directory
#   ./scripts/check-transfer-linked.sh path/to/app-release.aab            # Android, a .aab or .apk
set -euo pipefail

TARGET="${1:?usage: check-transfer-linked.sh <.app directory | .aab | .apk>}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CROC='github.com/schollz/croc/v10/src/croc'
LOOKUP='schollz/croc/v10/src/models.lookup'

fail() {
  echo "::error::check-transfer-linked: $*" >&2
  exit 1
}

# One file or a whole tree, as bytes.
has() {
  grep -rqaF -- "$1" "$2"
}

if [ -d "$TARGET" ]; then
  has "$CROC" "$TARGET" || fail "no croc code in $TARGET - the app was built without the transfer framework."
  has "ObalkaTransferModule" "$TARGET" || fail "no ObalkaTransferModule in $TARGET - the native module was compiled out."
  if has "$LOOKUP" "$TARGET"; then
    fail "$TARGET carries croc's load-time relay lookup - the framework was not built through prepare.sh."
  fi
  echo "check-transfer-linked: croc and ObalkaTransferModule are in $(basename "$TARGET"); croc's load-time lookup is not."
  exit 0
fi

[ -f "$TARGET" ] || fail "$TARGET does not exist."
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
unzip -q "$TARGET" -d "$WORK"
abis="$(sed -n 's/^reactNativeArchitectures=//p' "$ROOT/android/gradle.properties" | tr ',' ' ')"
[ -n "$abis" ] || fail "no reactNativeArchitectures in android/gradle.properties."
for abi in $abis; do
  # base/lib/<abi>/ in an app bundle, lib/<abi>/ in an APK.
  lib="$(find "$WORK" -path "*lib/$abi/libgojni.so" -print -quit)"
  [ -n "$lib" ] || fail "$(basename "$TARGET") has no lib/$abi/libgojni.so, and the app ships $abi."
  has "$CROC" "$lib" || fail "$lib holds no croc code."
  if has "$LOOKUP" "$lib"; then
    fail "$lib carries croc's load-time relay lookup - the .aar was not built through prepare.sh."
  fi
  echo "check-transfer-linked: lib/$abi/libgojni.so carries croc, without the load-time lookup."
done
has "obalkatransfer/Obalkatransfer" "$WORK" || fail "the Go binding's Java class is not in $(basename "$TARGET")."
echo "check-transfer-linked: the transfer is in $(basename "$TARGET") for: $abis"
