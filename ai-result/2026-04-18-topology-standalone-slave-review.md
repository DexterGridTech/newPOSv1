# Topology Standalone Slave And Persistence Design Review

> 文档路径：`docs/superpowers/specs/2026-04-18-topology-standalone-slave-design.md`
> Review 日期：2026-04-18

---

## 总体评价

设计思路清晰，分层合理，约束目标明确。但通过核查实际代码，发现整个设计的核心假设与现有 kernel 代码存在根本性冲突，必须在确认设计前解决。

---

## 一、设计缺陷（确认前必须解决）

### 1.1 `deriveTopologyStandalone` 现有逻辑与设计目标根本冲突

设计文档第 6.2 节：

> 单屏设备 B 切成 slave 连接 A 后，B 仍然 `standalone=true`

但实际代码 `1-kernel/1.1-base/topology-runtime-v2/src/foundations/context.ts:18-30`：

```ts
if (instanceMode === 'SLAVE') {
    return false  // standalone 直接变 false
}
```

**只要切成 SLAVE，standalone 就是 false**，不区分单屏独立设备还是内建副屏。

这直接破坏整个设计的核心规则：

- 持久化 gate 条件：`displayMode === 'SECONDARY' && standalone === false`
- 单屏 slave B 切成 SLAVE 后 `standalone=false`
- B 再切到 SECONDARY display，gate 条件满足，storage 被禁用
- 与设计目标"standalone slave 永远保留本地 stateStorage"完全相反

power display switch 的触发条件 `standalone === true && instanceMode === 'SLAVE'` 在现有代码中也永远不成立。

**必须三选一决策**：

1. 修改 `deriveTopologyStandalone` 逻辑（改 kernel，违反约束目标 4.2.1）
2. 在 assembly 层引入独立的 `standaloneDevice` 字段，不复用 kernel 的 `standalone`
3. 重新定义持久化 gate 条件，不依赖 `standalone`，改用 `displayIndex === 0` 或其他字段

---

### 1.2 `masterNodeId` 已存在于 assembly，但文档说它不在 kernel type 中

文档第 11.2 节说 `TopologyV2MasterInfo` 当前只含 `deviceId/serverAddress/addedAt`，需要 assembly 扩展。

但核查 `4-assembly/android/mixc-retail-assembly-rn84/src/platform-ports/topology.ts:126` 发现：

```ts
masterNodeId: topology.masterNodeId,
```

`masterNodeId` 已经在 assembly 中使用。需要确认它的来源：是 assembly 自己的扩展字段，还是已经在 kernel type 中？如果已存在，第 11.2 节的扩展策略描述有误，需要更新。

---

## 二、逻辑模糊（需澄清）

### 2.1 持久化 gate 是静态还是动态响应

第 9.1 节：

```ts
shouldDisablePersistence?: () => boolean
```

问题：

- storage 在 assembly 启动时创建，此时 topology context 尚未初始化
- topology context 会随运行时变化（用户切 slave、切 secondary）
- 文档没有说明 `shouldDisablePersistence` 是启动时静态决定，还是运行时动态响应

如果是动态的，storage wrapper 需要订阅 topology context 变化，这是一个非平凡的实现，需要在设计中明确。

---

### 2.2 `AssemblyTopologyBindingState` 与 `TopologyV2RecoveryState` 的关系未说明

第 10.2 节引入新的 `AssemblyTopologyBindingState`，但 kernel 已有 `TopologyV2RecoveryState`（含 `masterInfo`、`instanceMode` 等），两者有重叠字段。

未说明：

- 两者是并存还是替代关系？
- `masterInfo` 写入 recovery state 后，binding source 如何与之同步？
- 用户 clear masterInfo 时，是清 recovery state、清 binding source，还是两者都清？

---

### 2.3 场景矩阵中"单屏 slave B secondary"的 `standalone=true` 与现有代码不符

矩阵（第 7 节）标注"单屏 slave B secondary"为 `standalone=true`，但根据现有 `deriveTopologyStandalone` 逻辑，`instanceMode=SLAVE` 直接返回 `standalone=false`。

矩阵描述的是"期望状态"还是"当前状态"，需要明确标注，避免实施时产生歧义。

---

### 2.4 `adminConsoleConfig` 中直接创建 storage 的地方未列出

第 9.3 节说"所有直接创建 storage 的地方都必须改为使用同一个 gated storage"，但没有列出具体有哪些地方。如果遗漏某处，managed secondary 仍然可以绕过 gate 读写 MMKV。

---

## 三、遗漏项

### 3.1 `setDisplayMode` command 是否存在未确认

第 6.3 节和第 13.2 节都 dispatch `setDisplayMode({displayMode:'SECONDARY'})`，但未确认 `topology-runtime-v2` 是否已有该 command。

核查 `contextActor.ts` 只看到 `enableSlave` 的处理，未见 `setDisplayMode`。如果该 command 不存在，需要在 kernel 中新增，这违反约束目标"尽量不改 kernel"。

**建议**：在设计确认前核查该 command 是否存在。

---

### 3.2 ticket 过期后的刷新机制缺失

第 10.2 节提到 `hasUsableTicket()`，但没有说明：

- ticket 过期后如何自动刷新？
- 连接断开重连时是否需要重新申请 ticket？
- `expiresAt` 由谁监控、何时触发刷新？

---

### 3.3 `enableSlave` 与外部 master 接入的关系未说明

`topology-runtime-v2` 中 `enableSlave` 控制是否允许接受 SLAVE 连接。单屏 master A 需要 `enableSlave=true` 才能接受 B 的连接，但文档没有说明 A 的 `enableSlave` 如何设置，以及 admin-console 的"enable slave"按钮的语义是控制本机接受连接，还是控制本机作为 slave 连接。

---

## 四、小问题

1. **`AdminTopologyHostSource` 职责边界不清**：第 12.2 节说"UI 仍通过 runtime command 读写标准 topology state；host action 只处理 assembly-specific 动作"，但接口里又包含了 `setInstanceMode` 和 `setDisplayMode`，与 runtime command 重复，职责边界不清晰。

2. **master 分享载荷的 `version` 字段用途未说明**：`"version": "2026.04"` 是协议版本还是格式版本？slave 收到后是否需要校验？

3. **实施阶段 6 的可测试边界不清**：阶段 4（admin-console UI）依赖阶段 2 和 3，但阶段顺序没有说明各阶段的可独立测试边界，建议明确每个阶段完成后可以验证哪些场景。

---

## 五、总结

| 类别 | 数量 | 优先级 |
|------|------|--------|
| 设计缺陷 | 2 | 确认前必须解决 |
| 逻辑模糊 | 4 | 确认前需澄清 |
| 遗漏项 | 3 | 建议补充 |
| 小问题 | 3 | 可顺手修正 |

**最关键的问题**：`deriveTopologyStandalone` 现有逻辑与设计目标冲突（1.1），这是整个持久化 gate 和 power display switch 设计的根基，必须在确认设计前决策如何处理。
