# rn84-android-hot-update-e2e

## Summary

On 2026-04-21, the RN84 Android assembly hot-update path was verified end-to-end on `emulator-5554` against mock-terminal-platform sandbox `sandbox-kernel-base-test`.

The validated path was:

1. Install and run a production APK.
2. Use socket automation to run baseline `activate -> deactivate -> force-stop cold restart -> activate -> deactivate`.
3. Package a small visible OTA update.
4. Upload the OTA package to mock-terminal-platform.
5. Create and activate a terminal-scoped TDP hot-update release.
6. Verify download, hash/check, unzip/install, active marker, immediate process relaunch, and new bundle boot.
7. Run post-OTA `activate -> deactivate -> force-stop cold restart -> activate -> deactivate`.

Evidence directory:

`ai-result/hot-update-e2e-20260421/final-run/`

Key files:

- `18-ota9-post-activate-logcat-filtered.txt`
- `18-ota9-primary-hot-update.json`
- `18-ota9-primary-welcome-title.json`
- `21-ota9-restart-logcat-full.txt`
- `23-ota9-after-deactivate-2-terminals.json`
- `24-e2e-summary.json`

## Architecture

`3-adapter/android/adapter-android-v2` owns reusable native hot-update primitives:

- package download
- sha256/hash verification
- zip extraction
- package/marker helper style common logic

`4-assembly/android/mixc-retail-assembly-rn84` owns app-specific integration:

- bundle resolver
- startup audit and boot health
- process-level restart orchestration
- TurboModule/business bridge
- RN runtime and UI wiring

Do not move generic download/hash/unzip/marker logic back into assembly unless the adapter boundary is intentionally redesigned.

## Verified OTA

Baseline embedded bundle:

- `1.0.0+ota.8`

OTA package:

- package id: `pkg_lnfhgby3gc5h`
- release id: `release_igpos0q0gw5h`
- bundle version: `1.0.0+ota.9`
- target terminal before release: `terminal_xo50kc8sfhzz`

Observed device evidence:

- `StartupAudit` logged `hot_update_process_relaunch_requested`.
- New process selected `/data/user/0/com.impos2.mixcretailassemblyrn84/files/hot-updates/packages/pkg_lnfhgby3gc5h/index.android.bundle`.
- `MainApplication.getJSBundleFile()` reported `selectedBundle` pointing at the hot-update bundle.
- Runtime state changed to `source: hot-update`, `bundleVersion: 1.0.0+ota.9`.
- Primary UI title changed to `欢迎进入零售终端 · OTA E2E V9`.
- mock-terminal-platform terminal `currentBundleVersion` and `runtimeInfo.bundleVersion` became `1.0.0+ota.9`.

Cold restart after OTA stayed on:

- `pkg_lnfhgby3gc5h`
- `1.0.0+ota.9`

It did not fall back to embedded.

## Implementation Lessons

Bridgeless release should not rely on `reactHost.setBundleSource()` alone for hot-update apply.

The verified apply path is:

1. Download, verify, and install package.
2. Write active marker.
3. Request process-level relaunch.
4. Let the next process select the active marker via `MainApplication.getJSBundleFile()` and `HotUpdateBundleResolver`.

Startup audit log sequence to look for:

- `restart_requested`
- `hot_update_process_relaunch_requested`
- `bundle_resolved source=primary-boot`
- `getJSBundleFile selectedBundle=.../hot-updates/packages/<packageId>/index.android.bundle`

## Secondary Startup

Managed secondary must not dispatch local topology mode writes during bootstrap, specifically local `set-instance-mode` / `set-display-mode` style commands.

Those writes previously caused stable secondary startup noise:

- `Topology Runtime V3 Action Not Allowed`
- `PARTIAL_FAILED`

After relying on master sync for managed secondary topology/workspace state, cold-start logs were clean and primary-to-secondary sync still worked.

## Automation Rules

Before every cold start in this app, kill stale processes first:

```bash
adb -s emulator-5554 shell am force-stop com.impos2.mixcretailassemblyrn84
adb -s emulator-5554 shell monkey -p com.impos2.mixcretailassemblyrn84 -c android.intent.category.LAUNCHER 1
```

After emulator restart, restore port forwarding:

```bash
yarn android:port-forward
```

Production adb socket debugging is controlled by:

`4-assembly/android/mixc-retail-assembly-rn84/package.json`

Path:

`assembly.adbSocketDebug.enabled`

When true, adb socket automation is available for both test and production builds. When false, it must be unavailable for both.

Activation-code automation is order-sensitive:

1. prepare activation code
2. write/read the exact code
3. activate device

Do not parallelize these dependent steps; stale or missing code files cause false activation failures.

## Platform State Timing

After deactivation, app UI/runtime identity can return to `UNACTIVATED` before mock-terminal-platform terminal list immediately reflects `DEACTIVATED/OFFLINE`.

Observed behavior:

- UI and socket state returned to unactivated.
- Platform initially still showed the newest terminal as `ACTIVE/ONLINE`.
- A short wait followed by another terminal query showed `DEACTIVATED/OFFLINE`.

Do not treat a single immediate platform terminal query after deactivation as definitive failure. Re-check after a short convergence wait.

## Log Expectations

During the verified run, the captured logs did not contain:

- `FATAL EXCEPTION`
- `Topology Runtime V3 Action Not Allowed`
- `PARTIAL_FAILED`

These strings should remain part of future RN84 hot-update E2E log scans.
