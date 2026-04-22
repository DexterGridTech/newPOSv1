# Android Assembly Socket E2E Report

Date: 2026-04-20
Device: emulator-5554, Pixel_Tablet
Package: com.impos2.mixcretailassemblyrn84

## Scope

Validated the native/RN assembly flow through the Android automation socket:

1. Restore ADB reverse/forward after emulator reboot.
2. Start host dependencies: Metro and mock-terminal-platform.
3. Verify baseline unactivated UI and runtime state.
4. Activate device.
5. Verify activated primary/secondary UI and runtime state.
6. Deactivate device through the real admin UI flow.
7. Verify unactivated primary/secondary UI and runtime state.
8. Restart app processes.
9. Verify restart recovery UI and persisted state.
10. Activate again.
11. Verify final activated primary/secondary UI and runtime state.
12. Inspect JS/native logs and host service logs for unexpected warnings/errors.

## Environment

- `corepack yarn android:port-forward` restored reverse mappings for Metro `8081`, mock platform `5810`, and Reactotron `9090`.
- mock-terminal-platform started and listened on `127.0.0.1:5810`.
- Metro started and listened on `127.0.0.1:8081`.
- Primary automation socket: `127.0.0.1:18584`.
- Secondary automation socket: `127.0.0.1:18585`.

## Result Summary

PASS: The business flow completed end-to-end.

- Initial baseline was unactivated on both screens.
- First activation succeeded with terminal `terminal_pdiee89wsth0`.
- Admin deactivation succeeded through the real UI path. After closing the admin panel and waiting for idle, state and UI both settled back to unactivated.
- App restart created new app processes and restored the unactivated state correctly.
- Second activation succeeded with terminal `terminal_sdr7x7pazmrq`.
- Final primary screen was `ui.integration.retail-shell.welcome`.
- Final secondary screen was `ui.integration.retail-shell.secondary-welcome`.

## Step Evidence

### Baseline

- Primary screen: `ui.base.terminal.activate-device`.
- Primary identity: `activationStatus=UNACTIVATED`.
- Primary credential: `status=EMPTY`.
- Secondary screen: `ui.base.terminal.activate-device-secondary`.
- Secondary identity: `activationStatus=UNACTIVATED`.

### First Activation

- Activation code: `312058073059`.
- Result: `activationStatus=ACTIVATED`, `terminalId=terminal_pdiee89wsth0`, `sandboxId=sandbox-kernel-base-test`.
- Primary screen: `ui.integration.retail-shell.welcome`.
- Secondary screen: `ui.integration.retail-shell.secondary-welcome`.
- Primary credential: `status=READY`.
- Logs showed `activate-terminal` HTTP `201`, `tcp-activation-state-written`, TDP websocket connect, and master-to-slave state sync.

### Deactivation

- Admin login succeeded with device `J9RZPWR3HK`.
- `deactivate-terminal` request completed with `status=DEACTIVATED`.
- Runtime reset was logged with reason `kernel.base.tcp-control-runtime-v2.deactivateTerminal`.
- After closing admin panel and waiting for idle:
  - Primary screen: `ui.base.terminal.activate-device`.
  - Primary identity: `activationStatus=UNACTIVATED`.
  - Primary credential: `status=EMPTY`.
  - Primary sandbox: `{}`.
  - Secondary screen: `ui.base.terminal.activate-device-secondary`.
  - Secondary identity: `activationStatus=UNACTIVATED`.

Note: an immediate post-deactivation read before the admin panel was closed still returned the previous welcome screen and activated identity. The request log and the settled state prove deactivation completed; the early read was a timing/overlay sequencing artifact.

### Restart Recovery

- Restart changed process IDs:
  - Primary process: `7785`.
  - Secondary process: `7877`.
- Primary and secondary automation hosts became available after restart.
- Primary screen after restart: `ui.base.terminal.activate-device`.
- Primary identity after restart: `activationStatus=UNACTIVATED`.
- Primary credential after restart: `status=EMPTY`.
- Secondary screen after restart: `ui.base.terminal.activate-device-secondary`.
- Secondary identity after restart: `activationStatus=UNACTIVATED`.

### Reactivation

- Activation code: `046067130919`.
- Result: `activationStatus=ACTIVATED`, `terminalId=terminal_sdr7x7pazmrq`, `sandboxId=sandbox-kernel-base-test`.
- Primary screen: `ui.integration.retail-shell.welcome`.
- Secondary screen: `ui.integration.retail-shell.secondary-welcome`.
- Primary credential: `status=READY`.
- Logs showed `activate-terminal` HTTP `201`, `tcp-activation-state-written`, TDP websocket connect, and master-to-slave state sync.

## Log Review

No business-blocking JS/native crash was found.

Observed warnings/errors:

1. Restart phase emitted React Native Bridgeless soft exceptions:
   - `ReactNoCrashSoftException: Tried to access onNewIntent while context is not ready`
   - `ReactNoCrashSoftException: Tried to access onWindowFocusChange while context is not ready`
   - These happened during app restart before React context readiness. The app recovered and both automation hosts came back, but this is worth tracking as a restart hygiene issue.
2. Restart phase emitted Android framework `WindowManager DeadObjectException` while old windows were exiting. This is common around force-stop/restart and did not block recovery.
3. Emulator/system services emitted unrelated warnings:
   - `OneSearchSuggestProvider`
   - `BestClock Missing network time fix`
   - Chromium `Seed missing signature`
   - `adbd timeout expired while flushing socket`
4. mock-terminal-platform and Metro logs did not show application-level failures during the tested flow.

## Artifacts

- Full warning scan: `final-warning-scan.txt`
- State summary: `final-state-summary.txt`
- Stage JSON evidence: `step*.json`
- Stage logcat captures: `step*-logcat.txt`
- Host logs: `mock-platform.log`, `metro.log`

## Conclusion

The activation -> deactivation -> restart -> reactivation business chain is functionally correct in this debug socket test. The main follow-up risk is the restart-time RN Bridgeless `ReactHost` soft exception, which did not break this run but should be monitored or hardened if restart flows are expected to be warning-free.
