#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"
project_dir="$repo_root/4-assembly/android/mixc-retail-rn84v2/android"
apk_path="$project_dir/app/build/outputs/apk/debug/app-debug.apk"

source ~/.zshrc >/dev/null 2>&1 || true

if ! command -v adb >/dev/null 2>&1; then
  echo "adb not found in PATH after loading ~/.zshrc"
  exit 1
fi

if [[ -n "${ANDROID_SERIAL:-}" ]]; then
  target_device="$ANDROID_SERIAL"
else
  target_device="$(adb devices | awk 'NR > 1 && $2 == "device" { print $1; exit }')"
fi

if [[ -z "$target_device" ]]; then
  echo "no connected Android device or emulator found"
  exit 1
fi

echo "using Android device: $target_device"

adb -s "$target_device" reverse tcp:8081 tcp:8081 >/dev/null 2>&1 || true

cd "$project_dir"
./gradlew :app:assembleDebug

if [[ ! -f "$apk_path" ]]; then
  echo "debug apk not found: $apk_path"
  exit 1
fi

adb -s "$target_device" install -r "$apk_path"
adb -s "$target_device" shell am force-stop com.impos2.mixcretailrn84v2 >/dev/null 2>&1 || true
adb -s "$target_device" shell monkey -p com.impos2.mixcretailrn84v2 -c android.intent.category.LAUNCHER 1
