#!/usr/bin/env bash
# Hardcoded-color guard (feature 009). Screens must take colors from useTheme() tokens, not raw hex.
# Allowed to hold literals: the palette/token sources, plus two marks whose colours are NOT theme
# colours - the brand mark (brand colours are identity) and the recovery-key QR, which must stay
# black-on-white in both themes or scanners stop reading it.
# Usage: scripts/check-no-raw-hex.sh   (exit 0 = clean; non-zero = offenders listed)
# Used by task T042 as the end-state audit; until screens are ported it will list the remaining work.
set -u
cd "$(dirname "$0")/.." || exit 2

ALLOW='src/theme/theme.ts|src/theme/ObalkaMark.tsx|src/theme/QrCode.tsx|src/theme/avatar.ts|src/theme/chipTone.ts|src/theme/icons.tsx|src/theme/artwork.tsx|src/theme/depth.ts|src/services/notifications/notifeeNotifier.ts'
# Raw 3/6/8-digit hex color literals in TS/TSX under src, excluding the sanctioned palette files.
HITS=$(grep -rnoE "#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?([0-9a-fA-F]{2})?\b" src --include='*.ts' --include='*.tsx' \
  | grep -vE "$ALLOW" || true)

if [ -z "$HITS" ]; then
  echo "✓ No raw hex color literals in screens (outside the sanctioned palette files)."
  exit 0
fi

COUNT=$(printf '%s\n' "$HITS" | wc -l | tr -d ' ')
echo "✗ $COUNT raw hex literal(s) outside the palette files - port these to useTheme() tokens:"
printf '%s\n' "$HITS"
exit 1
