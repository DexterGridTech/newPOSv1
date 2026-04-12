# 2026-04-11 topology-client-runtime live state-sync 进展

## 1. 本次完成内容

已将 `topology-client-runtime` 里最关键的双屏真实 state-sync 场景，从超大测试文件中正式拆出。

本次完成：

1. 通用测试辅助从 `test/scenarios/helpers.ts` 调整为 `test/helpers/topologyClientHarness.ts`
2. 新增 `test/helpers/liveHarness.ts`
3. 新增独立真实场景：
   1. `test/scenarios/topology-client-runtime-live-state-sync-master-to-slave.spec.ts`
   2. `test/scenarios/topology-client-runtime-live-state-sync-slave-to-master.spec.ts`
4. `dispatch-runtime.spec.ts` 中重复的两条真实 state-sync 场景已删除，保留 dispatch / projection / resume 主逻辑测试

结果：

1. `dispatch-runtime.spec.ts` 从 `1830` 行降到 `1295` 行
2. topology 双屏 state-sync 不再埋在大文件内部
3. 后续要继续补 topology live 场景时，可以直接复用 `liveHarness.ts`

---

## 2. 这次拆分后的测试边界

### 2.1 `topologyClientHarness.ts`

只保留通用辅助：

1. `waitFor`
2. `createRuntimeInfo`
3. `createHello`
4. `createEchoModule`
5. `createBlockingEchoModule`
6. test server cleanup

它不再承载 state-sync 专用 slice 定义。

### 2.2 `liveHarness.ts`

只承载 topology 真实 host 联调需要的最小公共能力：

1. 启动 `dual-topology-host`
2. 创建 ticket
3. 创建 master / slave socket runtime
4. 创建最小 `syncValue` slice/module
5. 创建 master / slave kernel runtime
6. 配置 topology pair
7. 启动双端连接并等待 `CONNECTED`
8. 提供 `disconnect()`

这个 harness 没有继续抽象成“通用拓扑测试框架”，保持够用即可。

### 2.3 独立 spec 的职责

两个新 spec 只验证真实 state-sync 语义：

1. `master-to-slave`
2. `slave-to-master`

每个 spec 都验证两段：

1. 首次同步
2. 连续变更后的增量同步

---

## 3. 当前验证结果

已通过：

1. `./node_modules/.bin/tsc -p 1-kernel/1.1-base/topology-client-runtime/tsconfig.json --noEmit`
2. `./node_modules/.bin/tsc -p 1-kernel/1.1-base/topology-client-runtime/test/tsconfig.json --noEmit`
3. `./node_modules/.bin/vitest run 1-kernel/1.1-base/topology-client-runtime/test/scenarios/topology-client-runtime-live-state-sync-master-to-slave.spec.ts 1-kernel/1.1-base/topology-client-runtime/test/scenarios/topology-client-runtime-live-state-sync-slave-to-master.spec.ts`
4. `./node_modules/.bin/vitest run 1-kernel/1.1-base/topology-client-runtime/test/scenarios/dispatch-runtime.spec.ts`
5. `./node_modules/.bin/vitest run 1-kernel/1.1-base/topology-client-runtime/test/scenarios/*.spec.ts`

全量 topology-client-runtime 场景结果：

1. `5` 个 test files
2. `16` 条测试
3. 全部通过

---

## 4. 这次拆分带来的价值

### 4.1 topology 双屏同步主能力已经独立成正式基线

现在已经有两条正式的真实 host 基线：

1. master 改 state，slave 收到 diff 并持续同步
2. slave 改 state，master 收到 diff 并持续同步

这两条已经足够支撑后续双屏业务模块迁移时验证 state-sync 主语义。

### 4.2 dispatch / resume 测试重新聚焦

`dispatch-runtime.spec.ts` 现在主要保留：

1. request snapshot resume
2. projection mirror
3. remote command dispatch
4. started barrier
5. owner tracked request auto resume

也就是把“请求/命令/投影恢复”和“state-sync”重新分开了。

### 4.3 后续继续补 topology live 场景会更稳

后面如果继续补：

1. reconnect 后 state-sync 恢复
2. topology 与 terminal / scene / TDP 的联动
3. 多轮主副切换后的同步一致性

都可以先走 `liveHarness.ts`，不用再从 `dispatch-runtime.spec.ts` 里复制整段搭建代码。

---

## 5. 观察到的现象

本次真实联调里，`dual-topology-host` 仍会打印：

1. `runtimeVersion mismatch`
2. `compatibilityLevel: degraded`

这不是当前 blocker。

原因：

1. 之前已经确认 `runtimeVersion` 不需要强制匹配
2. 当前真实联调场景仍然完整通过
3. 所以这个现象目前只作为日志观察项保留，不单独为它做兼容性改造

---

## 6. 下一步建议

建议下一步按这个顺序继续：

1. 继续收缩 `topology-client-runtime` 测试结构
   1. 视情况再把 `connection-runtime.spec.ts` 里的真实 host 组网重复逻辑继续下沉到 helper
   2. 但不要为了“抽象而抽象”，只收已经明显重复的部分
2. 然后开始评估 topology 与 terminal 数据面的联动验证入口
   1. 优先考虑真实双屏同步会依赖的 terminal 状态镜像
   2. 暂时不要直接把 topology / TDP / scene 全揉进一个超大测试里
3. 在联动前，先保持当前原则：
   1. topology 的请求恢复、state-sync、重连语义分别有独立测试基线
   2. 再做跨 runtime 的组合验证

当前结论：

1. `topology-client-runtime` 已经不再只是“能连上”
2. 它的双屏 state-sync 主链路，已经有正式、可复用、可单独回归的真实 host 测试基线
