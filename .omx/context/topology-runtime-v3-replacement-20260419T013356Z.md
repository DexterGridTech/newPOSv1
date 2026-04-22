# Context Snapshot

- task statement: Execute the approved topology-runtime-v3 replacement plan step by step, starting with Task 1 for `0-mock-server/dual-topology-host-v3`.
- desired outcome: Build and verify the V3 host baseline incrementally, with fresh test evidence after each meaningful slice.
- known facts/evidence:
  - Plan exists at `docs/superpowers/plans/2026-04-19-topology-runtime-v3-replacement-implementation.md`.
  - Task 1 first slice is done: minimal package shell + HTTP `/status` and `/stats` + passing smoke test.
  - `corepack yarn workspace ...` cannot yet run for the new package until workspace install state/lock refreshes; direct `./node_modules/.bin/vitest` and `./node_modules/.bin/tsc` do work.
- constraints:
  - Proceed autonomously.
  - Keep changes small and verifiable.
  - Do not commit unless user explicitly asks.
  - Old V2 packages stay until all migration gates pass.
- unknowns/open questions:
  - Exact final V3 wire protocol details beyond the first hello/ack slice.
  - When to refresh Yarn workspace install state for the new package.
- likely codebase touchpoints:
  - `0-mock-server/dual-topology-host-v3/**`
  - `docs/superpowers/specs/2026-04-18-topology-runtime-v3-design.md`
  - `docs/superpowers/plans/2026-04-19-topology-runtime-v3-replacement-implementation.md`
