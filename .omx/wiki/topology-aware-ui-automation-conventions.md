---
title: "topology-aware-ui-automation-conventions"
tags: ["ui-automation", "topology", "assembly", "admin-console", "android"]
created: 2026-04-18T10:31:41.860Z
updated: 2026-04-18T10:31:41.860Z
sources: ["docs/superpowers/specs/2026-04-18-topology-standalone-slave-design.md", "docs/superpowers/specs/2026-04-18-ui-automation-runtime-design.md", "2-ui/2.1-base/README.md"]
links: []
category: convention
confidence: high
schemaVersion: 1
---

# topology-aware-ui-automation-conventions

# topology-aware-ui-automation-conventions

## Core rules

1. Managed secondary disables local business state persistence only when `displayMode === 'SECONDARY' && standalone === false`.
2. Standalone slave remains locally persistent even when `displayMode === 'SECONDARY'`.
3. External master attach flows should be driven through shared UI automation and admin-console topology actions, not package-private test protocols.
4. The canonical attach flow is: import share payload -> write masterInfo -> request `/tickets` -> update dynamic topology binding -> restart topology connection.
5. Power-triggered display switching belongs to assembly and only applies to `standalone && instanceMode === 'SLAVE'`.
6. Topology-aware dual-screen tests must explicitly target `primary` and `secondary`; do not rely on implicit `all` aggregation.

## Testing lane

- UI packages should use `ui-automation-runtime` as the shared automation/runtime-inspection lane.
- Topology flows should be driven through `admin-console` where possible so assembly/admin behavior is exercised together.
- Product may compile these capabilities, but Product runtime must not auto-start automation runtime, host, trace, or target registration.
