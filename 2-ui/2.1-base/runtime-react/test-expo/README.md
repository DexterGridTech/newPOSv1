# test-expo

This folder is test-only.
Production code under `src/` must not import Expo.

## Purpose

`runtime-react` uses `test/` for headless and rendered Vitest coverage.
`test-expo/` adds a real RN/Expo surface for browser or device automation.

The current page validates:

1. real kernel runtime boot
2. primary and secondary root shell rendering
3. screen-part registration from the test scenario module
4. runtime state panel visibility
5. parameterized display boot via query string
6. real dual-topology host boot and browser-side WS connectivity

## Start

```bash
corepack yarn workspace @next/ui-base-runtime-react expo:web
```

## Automation

`test-expo` has a self-contained browser automation script. It starts Expo Web on a free localhost port, opens the page with `agent-browser`, clicks the real RN Web controls, asserts state through `data-testid`, checks that the browser console has no require-cycle warning, then shuts everything down.

The default command is CI/headless style. You usually will not see a browser window or page changes on the desktop.

```bash
corepack yarn workspace @next/ui-base-runtime-react test-expo
```

Covered flows:

1. runtime boot with real kernel modules
2. primary and secondary root rendering
3. navigate and replace screen commands
4. modal open and close commands
5. UI variable update command
6. topology display mode command
7. two independent browser pages using `displayIndex=0` and `displayIndex=1`
8. real `0-mock-server/dual-topology-host-v3` startup, no-ticket master/slave hello, and connected-state convergence

### Visible automation

Use this when you want to watch the page change:

```bash
corepack yarn workspace @next/ui-base-runtime-react test-expo:visible
```

Use this when you only want to watch the two-display smoke test:

```bash
corepack yarn workspace @next/ui-base-runtime-react test-expo:dual-pages:visible
```

Use this when you only want to watch the real topology host scenario:

```bash
corepack yarn workspace @next/ui-base-runtime-react test-expo:topology-host:visible
```

Important:

1. `test-expo:dual-pages` is still the light smoke that only validates display context and primary/secondary rendering in two browser pages.
2. `test-expo` default flow now also starts a real `dual-topology-host-v3`, opens two Expo pages, and validates no-ticket topology WS connectivity through the browser-side transport assembly.

## Query Parameters

Use the browser URL query string to switch topology-like display context:

1. `displayIndex=0&displayCount=1`
2. `displayIndex=0&displayCount=2`
3. `displayIndex=1&displayCount=2`
4. `topology=dual`
5. `topology=host`
6. `topologyRole=master|slave`
7. `topologyHostBaseUrl=<http base>`
8. `topologyWsUrl=<ws url>`
9. `topologyMasterNodeId=<master node id>`
10. `topologyMasterDeviceId=<master device id>`
11. `topologyNodeId=<node id>`

Example:

```text
http://localhost:8081?displayIndex=1&displayCount=2&topology=dual
```

`topology=dual` means dual-root display preview in this package. It is intentionally named out in the page as `dual-root-preview-no-host` so it is not confused with real `dual-topology-host-v3` connectivity.

Example of real topology host mode:

```text
http://localhost:8081?displayIndex=1&displayCount=2&topology=host&topologyRole=slave
```
