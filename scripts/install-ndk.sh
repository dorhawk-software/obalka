#!/usr/bin/env bash
# Installs the Android NDK the app is built with, for gomobile (025 T022), and exports its path.
#
# The version is read from android/build.gradle (`ndkVersion`), so the Go library and the app's own
# native code are always compiled by the same NDK. For CI: it needs the runner's Android SDK
# (ANDROID_HOME, with cmdline-tools), and it writes ANDROID_NDK_HOME to $GITHUB_ENV for later steps.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NDK="$(sed -n 's/.*ndkVersion = "\([0-9.]*\)".*/\1/p' "$ROOT/android/build.gradle" | head -n 1)"
: "${NDK:?could not read ndkVersion from android/build.gradle}"
: "${ANDROID_HOME:?set ANDROID_HOME to the Android SDK}"

SDKMANAGER="$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager"
[ -x "$SDKMANAGER" ] || SDKMANAGER="$(command -v sdkmanager)"
if [ ! -d "$ANDROID_HOME/ndk/$NDK" ]; then
  # `yes` is killed by SIGPIPE once sdkmanager stops reading, which pipefail turns into a failed
  # step even when the install worked (CI, 2026-09-24). The check below is what decides.
  (set +o pipefail; yes | "$SDKMANAGER" --install "ndk;$NDK" >/dev/null)
fi
[ -d "$ANDROID_HOME/ndk/$NDK" ] || { echo "install-ndk: NDK $NDK did not install." >&2; exit 1; }

if [ -n "${GITHUB_ENV:-}" ]; then
  echo "ANDROID_NDK_HOME=$ANDROID_HOME/ndk/$NDK" >> "$GITHUB_ENV"
fi
echo "install-ndk: NDK $NDK at $ANDROID_HOME/ndk/$NDK"
