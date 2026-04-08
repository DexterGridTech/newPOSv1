# ui-core-runtime-base

`@impos2/ui-core-runtime-base` is the runtime-oriented sibling of `ui-core-base`.

It keeps the same overall scope as the old base package, but its runtime container and overlay behavior is wired to `@impos2/kernel-core-ui-runtime` instead of `@impos2/kernel-core-navigation`.

## Dev

Start the Expo web dev server:

```bash
corepack yarn workspace @impos2/ui-core-runtime-base web
```

Or from the repo root:

```bash
corepack yarn ui:core-runtime-base
```

### Single-screen validation

Open the default dev page:

```text
http://localhost:8081
```

You can verify:

1. primary screen rendering
2. `showScreen`
3. `replaceScreen`
4. `resetScreen`
5. `openOverlay`
6. `closeOverlay`
7. `setUiVariables`
8. `clearUiVariables`

### Dual-screen validation

Start the dual-screen mock server in another terminal:

```bash
corepack yarn B:master-ws-server-dual
```

Then open two browser tabs:

1. primary:

```text
http://localhost:8081?mode=dual-primary&deviceId=runtime-base-dev
```

2. secondary:

```text
http://localhost:8081?mode=dual-secondary&deviceId=runtime-base-dev
```

Notes:

1. both tabs must use the same `deviceId`
2. `mode=dual-secondary` sets `displayCount=2` and `displayIndex=1`
3. `mode=dual-primary` sets `displayCount=2` and `displayIndex=0`
4. the right-side runtime panel shows connection state, peer state, current screen state, overlay count, and synced UI variables
