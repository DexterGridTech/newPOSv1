# Terminal TS Hot Update Implementation Plan Review

> 文档路径：`docs/superpowers/plans/2026-04-18-terminal-ts-hot-update-implementation.md`
> Review 日期：2026-04-18

---

## 总体评价

计划结构清晰，TDD 节奏正确（先写失败测试，再实现，再验证），Slice 1 的步骤粒度合理。但存在若干与现有代码不符的假设、文件路径冲突和遗漏项，需要在执行前解决。

---

## 一、设计缺陷（执行前必须解决）

### 1.1 Slice 5 的 `service.ts` 路径与 Slice 2 完全相同，存在覆盖冲突

File Map 中：

- Slice 2：`Create: 0-mock-server/mock-terminal-platform/server/src/modules/hot-update/service.ts`
- Slice 5：`Create: 0-mock-server/mock-terminal-platform/server/src/modules/hot-update/service.ts`

两个 Slice 都声明"Create"同一个文件，但 Slice 5 的描述是"终端 version report 持久化、版本历史、drift 查询"，与 Slice 2 的"上传解析、包列表、下载 URL、发布 desired、版本历史查询"不同。

**建议**：Slice 5 应该是 Modify 而非 Create，或者将 version report 相关逻辑拆分到独立文件 `versionReportService.ts`，避免 Slice 2 实现后 Slice 5 直接覆盖。

---

### 1.2 Task 3 提到 `hotUpdateReadModelModule.ts` 但 File Map 未列出

Task 3 Step 1 注释：

> `Possibly create: 1-kernel/1.1-base/tdp-sync-runtime-v2/test/helpers/hotUpdateReadModelModule.ts`

但该文件未出现在 File Map 的 Slice 1 文件列表中。如果 master-slave live 测试需要它，执行时会发现缺口。

**建议**：在 File Map 的 Slice 1 或 Task 3 文件列表中明确列出该文件，或说明它是可选的。

---

### 1.3 `selectors/index.ts` 未出现在 File Map 中，但 Task 1 Step 8 要求修改它

Task 1 Step 8 明确要求修改 `1-kernel/1.1-base/tdp-sync-runtime-v2/src/selectors/index.ts`，但 File Map 的 Slice 1 文件列表中没有这个文件。

**建议**：在 File Map 中补充 `Modify: src/selectors/index.ts`。

---

## 二、逻辑模糊（需澄清）

### 2.1 `reduceHotUpdateDesired` 骨架代码直接返回 `state`，但 Step 9 要求测试 PASS

Task 1 Step 7 提供的骨架代码：

```ts
export const reduceHotUpdateDesired = (...) => {
  // 纯函数：active -> pending/rejected；paused -> paused history；desired removed -> clear candidate
  return state  // ← 直接返回原始 state，未实现
}
```

但 Step 9 要求运行 `tdp-sync-runtime-v2-hot-update-state.spec.ts` 并期望 PASS。

Step 6 的状态机测试断言 `candidate.status === 'download-pending'` 和 `candidate === undefined`，这两个断言在骨架代码下必然失败。

**问题**：Step 7 的骨架是"先写骨架让类型通过"，还是"完整实现"？如果是前者，Step 9 的 Expected: PASS 是错误的，应该是 FAIL（等待 Step 7 完整实现后才能 PASS）。

**建议**：明确 Step 7 是完整实现（骨架注释只是提示），并补充完整的 `reduceHotUpdateDesired` 实现逻辑，而不是留一个 `return state` 的空壳。

---

### 2.2 `reconcileDesired` action 的 `currentFacts` 推导逻辑未说明

Task 2 Step 3 说：

> 如果 `currentFacts` 未提供，先从 `state.current` 推导最小事实

但 `state.current` 是 `HotUpdateAppliedVersion`，它没有 `channel` 和 `capabilities` 字段，而 `HotUpdateCurrentFacts` 需要这两个字段做兼容性判定（`allowedChannels`、`requiredCapabilities`）。

**问题**：从 `state.current` 推导时，`channel` 和 `capabilities` 如何处理？默认空数组？还是跳过这两项检查？

**建议**：明确推导规则：`channel` 默认 `undefined`（跳过 channel 检查），`capabilities` 默认 `[]`（跳过 capability 检查）。

---

### 2.3 live restart recovery 测试中 `createLiveFileStoragePair` 的参数语义未说明

Task 2 Step 1 的测试骨架：

```ts
const storagePair = createLiveFileStoragePair('tdp-hot-update-restart')
```

但现有 `createLiveFileStoragePair` 的签名是 `(prefix?: string)`，返回的是基于文件系统的 storage pair。

**问题**：两个 runtime 实例共享同一个 `storagePair`，但 `createLiveRuntime` 接受的是 `stateStorage` 和 `secureStateStorage` 对象。需要确认 `storagePair.stateStorage` 和 `storagePair.secureStateStorage` 是否是 `createLiveRuntime` 期望的格式。

核查 `liveHarness.ts` 可知 `createLiveFileStoragePair` 返回 `{ stateStorage: {storage: ...}, secureStateStorage: {storage: ...} }`，与 `createLiveRuntime` 的参数类型一致，这一点没有问题。但计划文档没有说明这一点，执行者可能不清楚。

**建议**：在测试骨架注释中说明 `storagePair` 的结构，避免执行者误用。

---

### 2.4 Task 2 Step 2 的 `topicChangePublisher.ts` 修改方式过于简略

计划提供的修改片段：

```ts
if (changedTopics.includes(TDP_HOT_UPDATE_TOPIC) || changedTopics.includes('terminal.group.membership')) {
  await reconcileHotUpdateDesiredFromResolvedProjection(runtime)
}
```

但没有说明：
- `changedTopics` 变量在 `topicChangePublisher.ts` 中是否已存在，还是需要新增
- 这段代码插入在 topic loop 的哪个位置（loop 内还是 loop 后）
- `runtime` 参数如何传入（`topicChangePublisher` 当前是否已接受 runtime 参数）

**建议**：补充 `topicChangePublisher.ts` 的当前函数签名，以及修改后的完整函数骨架，避免执行者需要自行推断插入位置。

---

## 三、遗漏项

### 3.1 `tdpHotUpdate` slice 的 `syncIntent` 和 `sync` descriptor 骨架未提供

Task 1 Step 7 说明了 `syncIntent: 'master-to-slave'` 和 `sync` 描述的要求，但骨架代码中没有包含这部分。Task 3 Step 2 才提到 sync descriptor 的具体写法。

**问题**：如果 Task 1 Step 7 实现时没有加 `syncIntent`，Task 3 的 master-slave live 测试会因为 slice 未注册为可同步而失败，且错误信息不直观。

**建议**：在 Task 1 Step 7 的骨架中直接包含 `syncIntent: 'master-to-slave'` 和最小 `sync` descriptor，而不是推迟到 Task 3。

---

### 3.2 `createTdpHotUpdateStateForTests` 中 `current` 的 `appId` 硬编码为 Android assembly

骨架代码：

```ts
export const createTdpHotUpdateStateForTests = (overrides = {}): HotUpdateState => ({
  current: {
    source: 'embedded',
    appId: 'assembly-android-mixc-retail-rn84',
    ...
  },
  ...
})
```

`appId` 硬编码为 `'assembly-android-mixc-retail-rn84'`，这意味着所有使用该 helper 的测试都绑定了这个 appId。

**问题**：如果未来需要测试 Electron 或其他 assembly，需要修改 helper 或每次都传 overrides。

**建议**：将 `current` 也放入 `overrides` 的可覆盖范围（已经是，因为 `...overrides` 在最后），但文档应说明测试中如何覆盖 `current.appId`，避免执行者误以为 appId 是固定的。

---

### 3.3 Slice 1 没有覆盖 `rollout.mode === 'paused'` 的状态机测试

Task 1 Step 6 的状态机测试只覆盖了：
- compatible desired → download-pending
- desired removed → candidate cleared

但设计文档第 7.4 节明确要求 `rollout.mode = paused` 时终端有特定行为（不开始新下载，已 pending 的任务暂停）。

**问题**：Slice 1 的状态机测试没有锁定 `paused` 语义，执行者可能遗漏这个分支。

**建议**：在 Task 1 Step 6 的测试中补充一个 `paused` 测试用例：

```ts
it('records paused event when rollout is paused', () => {
  const state = reduceHotUpdateDesired(createTdpHotUpdateStateForTests(), {
    desired: { ...baseDesired, rollout: { mode: 'paused', publishedAt: '...' } },
    currentFacts: { ... },
    now: 100,
  })
  expect(state.candidate).toBeUndefined()
  expect(state.history.at(-1)?.event).toBe('paused')
})
```

---

### 3.4 Task 4 Step 2 要求更新设计文档，但没有说明更新哪些具体字段

Task 4 Step 2：

> 在设计文档 `docs/superpowers/specs/2026-04-18-terminal-ts-hot-update-design.md` 的 `15. 最小落地切片` 下补一段 `Slice 1 implementation notes`

但没有说明 implementation notes 应包含哪些字段，执行者需要自行判断。

**建议**：明确 implementation notes 的模板，例如：
- 已落地的状态字段列表
- 尚未落地的能力（下载/ready/apply）
- 主副屏同步当前只同步摘要状态的说明
- 与设计文档的偏差（如有）

---

## 四、小问题

1. **Task 1 Step 3 中 `hotUpdateTopic.ts` 的 `HOT_UPDATE_REJECT_REASONS` 使用 `as const`，但 `hotUpdateCompatibility.ts` 中通过 `HOT_UPDATE_REJECT_REASONS.runtimeVersionMismatch` 访问**：这要求 `HOT_UPDATE_REJECT_REASONS` 的 key 与 `HotUpdateCompatibility` 的 reject reason 字符串完全对应。计划中两者是一致的，但没有显式说明这个约束，执行者可能在添加新 reason 时忘记同步。

2. **`HotUpdateState` 类型中 `ready?: undefined` 和 `applying?: undefined`**：Task 1 Step 3 的类型定义中这两个字段被显式声明为 `undefined`，这在 Slice 1 是合理的（表示尚未实现），但会导致 TypeScript 类型检查时这两个字段永远不可赋值。建议改为注释说明，或使用 `// Slice 3 will add: ready?: HotUpdateReadyState`。

3. **Verification Commands by Slice 中 Slice 1 缺少 `selectors/index.ts` 的 type-check 验证**：`type-check` 命令会覆盖整个包，所以这不是实质性问题，但文档中没有说明 selectors 导出是否会被 type-check 覆盖。

---

## 五、总结

| 类别 | 数量 | 优先级 |
|------|------|--------|
| 设计缺陷 | 3 | 执行前必须解决 |
| 逻辑模糊 | 4 | 执行前需澄清 |
| 遗漏项 | 4 | 建议补充 |
| 小问题 | 3 | 可顺手修正 |

**最需要优先处理的**：

1. **Slice 5 `service.ts` 路径冲突**（1.1）——直接导致 Slice 5 覆盖 Slice 2 的实现
2. **`reduceHotUpdateDesired` 骨架与 Step 9 PASS 期望矛盾**（2.1）——执行者会困惑为什么骨架代码能让测试通过
3. **`syncIntent` 推迟到 Task 3**（3.1）——会导致 Task 3 的 master-slave 测试失败原因不直观
