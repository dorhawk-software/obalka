#!/usr/bin/env bash
# Stages the tree both transfer builds bind from, tests it, and prints where it is (025 T022).
#
# Two changes to croc go in first. Its `models` package resolves the relay host names in an `init`,
# which runs when the library LOADS: on Android that is the first transfer, but on iOS the Go runtime
# starts with the process, so it was every app launch - a DNS question about the relay with nobody
# transferring anything - and a launch offline pinned an empty relay address until the app was
# restarted. `patches/croc-v10.7.0-no-lookup-at-load.patch` takes the lookup out; `relayAddress` in
# transfer.go adds the port to the bare names instead, and they are resolved when a transfer connects.
# And a run waits in blocking reads that ignore the context it is given, so a cancelled run went on
# waiting at the relay - and held the one thread transfers run on, so every later transfer queued
# behind it (found on the 025 T027 walk). `patches/croc-v10.7.0-close-on-stop.patch` hands transfer.go
# every connection croc opens, and a stop closes them.
#
# Go refuses an `-overlay` for a file in the module cache, so the patched croc is a COPY in the work
# directory, and the staged module points at it with a `replace`. native/transfer itself is never
# edited. Each original file is checked against a pinned SHA-256 before it is patched, so bumping croc
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
# Each patch with the file it changes and that file's `sha256sum` / `shasum -a 256` in croc v10.7.0,
# as published.
PATCHES=(
  "croc-v10.7.0-no-lookup-at-load.patch src/models/constants.go 1dee1d42709d5530ef3075746f89123e815e938ce4ddbdd2fb73514895ea5be4"
  "croc-v10.7.0-close-on-stop.patch src/comm/comm.go 5d88e78bc980ca2f780e5ee3eab8048d0776b40b6a7f9b99052d83e22d72c5be"
)

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
for entry in "${PATCHES[@]}"; do
  read -r patch file pin <<<"$entry"
  if [ "$(sha256 "$ORIG/$file")" != "$pin" ]; then
    echo "prepare.sh: croc's $file is not the file $patch was written against." >&2
    echo "prepare.sh: croc was bumped - re-read it, redo the patch and its pin above." >&2
    exit 1
  fi
done

cp -R "$ORIG" "$WORK/croc"
chmod -R u+w "$WORK/croc"
for entry in "${PATCHES[@]}"; do
  read -r patch _ _ <<<"$entry"
  # Short options only: macOS ships BSD patch, Linux GNU patch; -F0 allows no fuzz at all.
  patch -s -N -F0 -p1 -d "$WORK/croc" < "$HERE/patches/$patch" >&2
done

mkdir -p "$WORK/module"
cp "$HERE"/go.mod "$HERE"/go.sum "$HERE"/*.go "$WORK/module/"
cd "$WORK/module"
go mod edit -replace "$CROC=$WORK/croc"

# Tested as it will be bound. `TestRelaysAreNotResolvedWhileTheLibraryLoads` and
# `TestEveryConnectionCrocOpensIsTracked` fail if a patch did not take, so no archive is ever built
# from a tree whose relay handling or stop was not checked.
go vet . >&2
go test -count=1 . >&2

echo "$WORK/module"
