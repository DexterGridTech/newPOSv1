# Admin Mall Tenant Master Data E2E Runbook

This runbook restores and verifies the mock admin mall tenant master-data loop
against the Android RN84 assembly. It covers the current activation-only phase:
after terminal activation, both primary and secondary displays show the
catering master-data workbench and receive TDP-published admin changes.

## What The Smoke Proves

`corepack yarn admin-mall-master-data:smoke` verifies:

1. `mock-terminal-platform` is healthy on `5810`.
2. `mock-admin-mall-tenant-console` is healthy on `5830`.
3. Metro is listening on `8081`.
4. Primary and secondary automation sockets are reachable.
5. Primary screen part is
   `ui.business.catering-master-data-workbench.primary-workbench`.
6. Secondary screen part is
   `ui.business.catering-master-data-workbench.secondary-workbench`.
7. Titles are `餐饮主数据工作台 · PRIMARY` and `餐饮主数据工作台 · SECONDARY`.
8. Primary TDP session status is `READY`.
9. Admin `POST /api/v1/master-data/demo-change` creates a production-shaped
   `catering.product.profile` projection at the product's natural `BRAND`
   scope.
10. Admin `POST /api/v1/projection-outbox/publish` publishes pending
    projections through `mock-terminal-platform`.
11. Both displays update live semantic nodes for the changed product name and
    price.

The smoke intentionally checks UI semantic nodes instead of only HTTP
responses. A successful publish is not enough unless both terminal displays
observe the changed master-data state.

## Fast Path

Use this after a reboot or when the Android app is already installed:

```bash
corepack yarn admin-mall-master-data:restore-clean
corepack yarn admin-mall-master-data:smoke
```

`restore-clean` starts missing services, restores Android reverse/forward
ports, clears stale hot-update boot markers, relaunches the Android app, fixes
dual-emulator topology locator settings when needed, and ensures the terminal
is activated with a fresh mock-platform activation code if the TDP session is
not ready.

For a lighter restore that preserves the current app process and activation
state:

```bash
corepack yarn admin-mall-master-data:restore -- --ensure-activated
corepack yarn admin-mall-master-data:smoke
```

## Topology Rules

The scripts support both current test topologies:

1. Single Android device with primary and secondary automation targets.
2. Two Android devices where each device exposes a primary automation target.

By default the scripts select the first `adb devices` entry as primary and the
second as secondary. Override this when needed:

```bash
corepack yarn admin-mall-master-data:restore-clean -- \
  --primary-serial emulator-5554 \
  --secondary-serial emulator-5556

corepack yarn admin-mall-master-data:smoke -- \
  --primary-serial emulator-5554 \
  --secondary-serial emulator-5556
```

For dual-emulator topology, the secondary device must connect to the topology
host through Android's host loopback alias:

```text
ws://10.0.2.2:18889/mockMasterServer/ws
```

The restore script writes that locator through the secondary automation socket
and waits for topology sync status `active`.

## Manual Building Blocks

The reusable scripts wrap these underlying commands:

```bash
corepack yarn mock:platform:dev
corepack yarn mock:admin-mall-tenant-console:dev
corepack yarn assembly:android-mixc-retail-rn84:metro
ANDROID_TOPOLOGY_HOST_DEVICE_ID=emulator-5554 node scripts/setup-android-port-forwarding.mjs --topology-host
```

Useful direct probes:

```bash
node scripts/android-automation-rpc.mjs call runtime.getInfo \
  --serial emulator-5554 \
  --target primary \
  --params '{"target":"primary"}' \
  --no-start

node scripts/android-automation-rpc.mjs call runtime.getInfo \
  --serial emulator-5556 \
  --target primary \
  --host-port 18586 \
  --device-port 18584 \
  --params '{"target":"primary"}' \
  --no-start
```

Useful admin probes:

```bash
curl -s http://127.0.0.1:5830/health
curl -s -X POST http://127.0.0.1:5830/api/v1/master-data/demo-change
curl -s -X POST http://127.0.0.1:5830/api/v1/projection-outbox/publish
```

## Reboot Recovery Notes

1. Old Android hot-update markers can override the current Metro source bundle.
   If a device stays on an old boot animation or old UI, run
   `corepack yarn admin-mall-master-data:restore-clean`.
2. If `mock-terminal-platform` restarts, the terminal may remain locally
   activated while its TDP session is no longer `READY`. The restore script
   detects this and rebinds by resetting TCP control and activating with a new
   code.
3. If a reset happens before dual-emulator topology reconnects, the secondary
   may not receive the new route immediately. Run restore again after the
   topology host bridge is active.
4. Do not simplify topic or scope data for test convenience. The admin console
   publishes each document at its natural production scope, for example
   brand-owned `catering.product.profile` records at `BRAND` scope and
   store-owned menu/availability records at `STORE` scope.

## Expected Success Output

The smoke script prints a JSON object with:

1. `success: true`
2. selected primary and secondary serials
3. topology kind
4. terminal id
5. TDP session status `READY`
6. primary and secondary workbench part keys
7. updated product name and price observed on both displays
8. publish result returned by the admin console
