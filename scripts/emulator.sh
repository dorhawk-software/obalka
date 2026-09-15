#!/usr/bin/env bash
# Launch the Android emulator for the dev loop.
#
# Notes:
# - `-no-audio`: do NOT grab the host audio device (otherwise the emulator blocks YouTube / other
#   audio playback on the host while it runs).
# - `-gpu swiftshader_indirect`: software GPU - the host Mesa GPU path crashed the emulator here.
# - `-no-snapshot-load -no-boot-anim`: fast, clean boots for an automated dev loop.
set -euo pipefail

AVD="${1:-Medium_Phone_API_36.0}"
EMULATOR="${ANDROID_SDK_ROOT:-$HOME/Android/Sdk}/emulator/emulator"

exec "$EMULATOR" -avd "$AVD" \
  -no-audio \
  -gpu swiftshader_indirect \
  -no-snapshot-load \
  -no-boot-anim \
  -netdelay none -netspeed full
