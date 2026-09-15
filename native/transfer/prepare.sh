#!/usr/bin/env bash
# Stages the tree both transfer builds bind from, tests it, and prints where it is (025 T022).
#
# One change to croc goes in first. Its `models` package resolves the relay host names in an `init`,
# which runs when the library LOADS: on Android that is the first transfer, but on iOS the Go runtime
# starts with the process, so it was every app launch - a DNS question about the relay with nobody
# transferring anything - and a launch offline pinned an empty relay address until the app was
# restarted. `patches/croc-v10.7.0-no-lookup-at-load.patch` takes the lookup out; `relayAddress` in
# transfer.go adds the port to the bare names instead, and they are resolved when a transfer connects.
#
# Go refuses an `-overlay` for a file in the module cache, so the patched croc is a COPY in the work
# directory, and the staged module points at it with a `replace`. native/transfer itself is never
# edited. The original file is checked against a pinned SHA-256 before it is patched, so bumping croc
# stops the build here until somebody has read the new file and redone the patch and the pin.
#
# Everything this needs is Go; the version of every tool comes from go.mod (`go` line and `tool`
# directives), so the result does not depend on what else is installed.
#
#   ./native/transfer/prepare.sh <work dir>    # prints <work dir>/module
set -euo pipefail

WORK="${1:?usage: prepare.sh <work dir>}"
HERE="$(cd "$(dirname "$0")" && pwd)"
CROC=github.com/schollz/croc/v10
# `sha256sum` / `shasum -a 256` of croc v10.7.0's src/models/constants.go, as published.
CROC_CONSTANTS_SHA256=1dee1d42709d5530ef3075746f89123e815e938ce4ddbdd2fb73514895ea5be4
PATCH="$HERE/patches/croc-v10.7.0-no-lookup-at-load.patch"

sha256() {
  if command -v sha256sum >/dev/null; then
    sha256sum "$1" | cut -d' ' -f1
  else
    shasum -a 256 "$1" | cut -d' ' -f1
  fi
}

mkdir -p "$WORK"
WORK="$(cd "$WORK" && pwd)"
rm -rf "$WORK/croc" "$WORK/module"

cd "$HERE"
go mod download "$CROC" >&2
ORIG="$(go list -m -f '{{.Dir}}' "$CROC")"
if [ "$(sha256 "$ORIG/src/models/constants.go")" != "$CROC_CONSTANTS_SHA256" ]; then
  echo "prepare.sh: croc's src/models/constants.go is not the file the patch was written against." >&2
  echo "prepare.sh: croc was bumped - re-read it, redo $PATCH and the pin above." >&2
  exit 1
fi

cp -R "$ORIG" "$WORK/croc"
chmod -R u+w "$WORK/croc"
# Short options only: macOS ships BSD patch, Linux GNU patch; -F0 allows no fuzz at all.
patch -s -N -F0 -p1 -d "$WORK/croc" < "$PATCH" >&2

mkdir -p "$WORK/module"
cp "$HERE"/go.mod "$HERE"/go.sum "$HERE"/*.go "$WORK/module/"
cd "$WORK/module"
go mod edit -replace "$CROC=$WORK/croc"

# Tested as it will be bound. `TestRelaysAreNotResolvedWhileTheLibraryLoads` fails if the patch did
# not take, so no archive is ever built from a tree whose relay handling was not checked.
go vet . >&2
go test -count=1 . >&2

echo "$WORK/module"
