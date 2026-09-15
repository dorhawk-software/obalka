#!/usr/bin/env bash
# Install a Sentry org auth token into the two gitignored `sentry.properties` files, after checking
# that it actually works against the org those files name.
#
# Why a script: the token goes in three places (ios/, android/, and the SENTRY_AUTH_TOKEN secret in
# GitHub Actions), and every way of getting it wrong is SILENT - sentry-cli warns and continues, so
# a bad token looks exactly like a successful build until a crash arrives unsymbolicated.
#
# Usage:  scripts/sentry-token.sh sntrys_...
#         scripts/sentry-token.sh            # reads the token from stdin, so it stays out of $HISTFILE
set -euo pipefail
cd "$(dirname "$0")/.."

token="${1:-}"
if [ -z "$token" ]; then
  printf 'Paste the org auth token (input hidden): ' >&2
  read -rs token
  printf '\n' >&2
fi
[ -n "$token" ] || { echo "No token given." >&2; exit 1; }

org=$(grep -m1 '^defaults.org=' ios/sentry.properties 2>/dev/null | cut -d= -f2-)
org="${org:-dorhawk-software}"

# The exact endpoint dSYM and source-map uploads call, and `org:ci` is enough to reach it.
code=$(curl -s -o /dev/null -w '%{http_code}' \
  -H "Authorization: Bearer $token" \
  "https://sentry.io/api/0/organizations/$org/chunk-upload/")
case "$code" in
  200) ;;
  401|403) echo "Token rejected by '$org' (HTTP $code)." >&2
           echo "An org auth token only works for the org that issued it. Create one AT $org." >&2
           exit 1 ;;
  404) echo "No org '$org' visible to this token (HTTP 404). Check defaults.org." >&2; exit 1 ;;
  *)   echo "Unexpected HTTP $code from Sentry; not writing anything." >&2; exit 1 ;;
esac

for f in ios/sentry.properties android/sentry.properties; do
  [ -f "$f" ] || { printf 'defaults.org=%s\ndefaults.project=obalka\ndefaults.url=https://sentry.io/\n' "$org" > "$f"; }
  # Rewrite in place without ever echoing the token.
  grep -v '^auth.token=' "$f" > "$f.tmp"
  printf 'auth.token=%s\n' "$token" >> "$f.tmp"
  mv "$f.tmp" "$f"
  chmod 600 "$f"
  echo "wrote $f"
done

echo
echo "Verified against $org. Now put the SAME token in GitHub Actions:"
echo "  gh secret set SENTRY_AUTH_TOKEN --repo dorhawk-software/obalka"
echo "(it prompts for the value, so the token stays out of your shell history)"
