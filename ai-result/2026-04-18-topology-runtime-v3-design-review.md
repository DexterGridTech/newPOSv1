# Topology Runtime V3 Design Review

> 文档路径：`docs/superpowers/specs/2026-04-18-topology-runtime-v3-design.md`
> Review 日期：2026-04-19

---

## 总体评价

设计方向正确，核心判断（一主一副配对、双向同步但单 authority、稳定 locator 与临时材料分离）都有充分的代码事实支撑。与 v2 的对比分析清晰，删减理由充分。

但存在若干与现有代码不符的假设、逻辑缺口和遗漏项，需要在进入实施计划前解决。

---

## 一、设计缺陷（实施前必须解决）

### 1.1 `deriveTopologyStandalone` 的优先级规则与文档描述不完全一致

文档第 6.3 节：

> V3 沿用当前正确规则：如果有 display context，就优先以 `displayIndex === 0` 推导 `standalone`

这个描述是正确的，但不完整。核查 `context.ts:18-30` 的实际逻辑：

```ts
if (typeof displayIndex === 'number') {
    return displayIndex === 0
}
if (instanceMode === 'SLAVE') {
    return false  // ← 没有 displayIndex 时，SLAVE 直接返回 false
}
return masterInfo == null
```

**关键问题**：当 `displayIndex` 未提供时（例如 standalone slave 的某些启动路径），`instanceMode === 'SLAVE'` 仍然会导致 `standalone=false`。

文档第 10.7.5 节说"standalone slave 不会因为 `instanceMode=SLAVE` 就丢失本地持久化资格"，但这个保证依赖于 assembly 层**必须**传入 `displayIndex`。如果 assembly 某个路径没有传 `displayIndex`，standalone slave 就会被误判为 `standalone=false`，进而触发 storage gate 禁用。

**建议**：在设计中明确说明 assembly 层必须始终传入 `displayIndex`，并在 assembly 的 topology binding 初始化中加入断言或 guard，防止 `displayIndex` 缺失。

---

### 1.2 `TopologyV3SyncDescriptor` 与现有 `StateRuntimeSyncDescriptor` 的关系未说明

文档第 9.1 节定义了新的 `TopologyV3SyncDescriptor`：

```ts
interface TopologyV3SyncDescriptor {
  sliceName: string
  authority: 'MASTER' | 'SLAVE'
  mode: 'snapshot-only' | 'snapshot-and-update'
  getRevision(state: RootState): string | number
  exportSnapshot(state: RootState): unknown
  applySnapshot(state: RootState, payload: unknown): RootState
  exportUpdate?(...)
  applyUpdate?(...)
}
```

但核查 `state-runtime` 包的 `StateRuntimeSliceDescriptor` 类型：

```ts
interface StateRuntimeSliceDescriptor<State> {
  name: string
  persistIntent: PersistIntent
  syncIntent?: SyncIntent
  sync?: StateRuntimeSyncDescriptor<State>
}
```

**问题**：
1. V3 的 `TopologyV3SyncDescriptor` 是替换 `StateRuntimeSyncDescriptor`，还是在其之上扩展？
2. `authority: 'MASTER' | 'SLAVE'` 字段在现有 `StateRuntimeSyncDescriptor` 中不存在，V3 是要修改 `state-runtime` 包，还是在 `topology-runtime-v3` 层自己维护一套 registry？
3. 现有 topology-runtime-v2 的所有 slice 的 `syncIntent` 均为 `'isolated'`，V3 是否需要修改这些 slice 的描述符？

**建议**：明确 `TopologyV3SyncDescriptor` 的归属层（是 `state-runtime` 扩展还是 `topology-runtime-v3` 内部），以及与现有 `StateRuntimeSliceDescriptor.sync` 的关系。

---

### 1.3 `resumeTopologySession` command 在 V3 中的处置未说明

核查 `topology-runtime-v2/src/features/commands/index.ts`，现有 commands 包含：

- `resumeTopologySession`

文档第 8.2 节明确移除了 `resume-begin / resume-complete`，但没有说明 `resumeTopologySession` command 是否也一并移除，还是保留但语义变化。

**建议**：在"明确移除"列表中补充 `resumeTopologySession` command 的处置方式。

---

## 二、逻辑模糊（需澄清）

### 2.1 `state-snapshot` 中 `revision` 字段的生成规则未定义

文档第 8.1 节 `state-snapshot` 消息：

```ts
entries: Array<{
  sliceName: string
  revision: string | number
  payload: unknown
}>
```

但没有说明：
- `revision` 由谁生成？authoritative side 的 slice 自己维护，还是 topology runtime 统一分配？
- reconnect 后 authoritative side 重发 snapshot 时，`revision` 是递增的新值，还是保持上次的值？
- 如果 `revision` 不变，接收方如何判断这是"重连后的修复 snapshot"而不是"重复消息"？

---

### 2.2 `state-update` 与 `state-snapshot` 的幂等性保证未说明

文档第 4.4 节说 reconnect 后 authoritative side 发 snapshot，但没有说明：
- 如果 snapshot 在传输中丢失，接收方如何感知并重新请求？
- `state-update` 是否有序号保证？乱序到达时如何处理？

V3 简化了 barrier，但这些基础可靠性问题仍然存在，只是被推迟了。

**建议**：明确 V3 第一版对消息可靠性的假设（例如"依赖 WS 的有序可靠传输，不做额外序号"），避免实施时各自猜测。

---

### 2.3 `TopologyLaunchCoordinator` 的 V3 改造范围不清

文档第 10.7.3 节：

> `TopologyLaunchCoordinator` 的 V3 目标应该改成：确保 primary host 已启动、生成主端 `masterNodeId`、返回 locator、secondary 依此直接建链

但没有说明：
- `TopologyLaunchCoordinator` 当前在哪个文件？是否已存在？
- V3 是修改现有实现，还是新建？
- 如果 primary host 启动失败，secondary 的 fallback 是什么？

---

### 2.4 `enableSlave` 与 host 生命周期绑定的实现层未明确

文档第 6.5 节和第 10.4 节都提到：

> `setEnableSlave(true/false)` 需要同步驱动 host start/stop，而不是只改 store

但没有说明这个绑定在哪一层实现：
- 是 `topology-runtime-v3` 的 actor 负责调用 host start/stop？
- 还是 assembly 层监听 `enableSlave` 变化后自己驱动？

如果是 assembly 层，那 core topology 就不依赖 host 接口，职责边界清晰。如果是 core actor，那 core 就需要注入 host 接口，增加了耦合。

**建议**：明确这个绑定属于 assembly 层（推荐），并说明 assembly 如何订阅 `enableSlave` 变化。

---

## 三、遗漏项

### 3.1 缺少从 v2 到 v3 的迁移策略

文档描述了 V3 的目标状态，但没有说明：
- v2 和 v3 是否并行存在？
- 现有使用 `topology-runtime-v2` 的 assembly 如何迁移？
- `tdp-sync-runtime-v2` 依赖 `topology-runtime-v2` 的哪些接口？这些接口在 v3 中是否兼容？

这不是小问题——如果 `tdp-sync-runtime-v2` 依赖 v2 的特定 slice 或 command，v3 的重构可能需要同步修改 tdp 层。

---

### 3.2 `dual-topology-host-v3` 的 WS 路径与现有 mock server 的关系未说明

文档第 10.5 节说新建 `0-mock-server/dual-topology-host-v3`，但没有说明：
- 它是独立的 Node.js 服务，还是集成到现有 `mock-terminal-platform` 中？
- 端口如何分配？与现有 mock server 是否冲突？
- live test 中如何启动和关闭它？

---

### 3.3 `peerState` slice 在 V3 中的定位未说明

核查发现 `topology-runtime-v2` 已有 `peerState.ts`（`syncIntent: 'isolated'`），存储对端节点信息。

文档第 11 节的包结构中有 `peerState.ts`，但没有说明：
- V3 的 `peerState` 与 v2 的 `peerState` 有何区别？
- `peerState` 的 `syncIntent` 在 V3 中是否仍为 `'isolated'`？（对端信息通过 `hello-ack` 获取，不需要 sync，这是合理的）

---

### 3.4 测试矩阵中缺少"managed secondary 不读写 stateStorage"的具体验证方式

文档第 13 节测试矩阵第 1 条：

> slave 不读本地业务 storage

但没有说明如何在 live test 中验证这一点——是通过 mock storage 记录调用次数，还是通过 storage gate 的单元测试覆盖？

这个测试在 topology-standalone-slave 设计中已经有详细矩阵，V3 设计文档应该引用或复用，而不是重新描述。

---

## 四、小问题

1. **第 5 节标题格式不一致**：`## 5. 场景统一模型` 下的子节用了 `## 5.1`（两个 `#`），而其他章节的子节用 `### X.X`（三个 `#`）。第 6、7、8、9、10 节也有同样问题。

2. **`TopologyV3ConfigState.masterLocator.serverAddress` 类型为 `Array<{address: string}>`**，但 `AdminTopologySharePayloadV3.serverAddress` 也是 `Array<{address: string}>`。两者结构一致，但没有说明是否共用同一个类型，还是各自独立定义。建议统一为一个 `TopologyServerAddress` 类型。

3. **文档第 7.2 节说"V3 默认不使用 ticket"，但第 12 节第一版范围中没有明确说明"ticket 兼容模式"的实现边界**。如果迁移期需要兼容旧 ticket host，应该在第一版范围中明确"兼容模式不进入 core，由 transport adapter 层处理"。

---

## 五、总结

| 类别 | 数量 | 优先级 |
|------|------|--------|
| 设计缺陷 | 3 | 实施前必须解决 |
| 逻辑模糊 | 4 | 实施前需澄清 |
| 遗漏项 | 4 | 建议补充 |
| 小问题 | 3 | 可顺手修正 |

**最需要优先处理的**：

1. **`displayIndex` 缺失时 standalone slave 被误判**（1.1）——这是 storage gate 正确性的根基，assembly 层必须有明确 guard
2. **`TopologyV3SyncDescriptor` 与 `StateRuntimeSyncDescriptor` 的关系**（1.2）——决定 V3 是否需要修改 `state-runtime` 包，影响范围评估
3. **v2 到 v3 的迁移策略**（3.1）——`tdp-sync-runtime-v2` 对 v2 的依赖可能是 V3 实施的最大阻力
