# runtime-shell-v2 initialize 生命周期实现进展

## 本次完成

### 1. runtime-shell-v2

已实现：

1. 内置 `runtimeShellV2CommandDefinitions.initialize`
2. `start()` 时序改为：
   1. hydrate persistence
   2. module install
   3. 广播 initialize
   4. 等待 initialize 完成
3. `start()` 幂等，不重复触发 initialize
4. initialize 失败会让 `start()` reject

额外修复：

1. 修复 actor handler 同步 `throw` 可能绕过 `normalizeError` 的问题
2. 保持原有 actor 执行顺序不变

### 2. tdp-sync-runtime-v2

已实现：

1. 删除 `initializeCommands`
2. 新增 `TdpInitializeActor`
3. 通过监听全局 initialize 触发 `bootstrapTdpSync`

### 3. 文档规范

已明确：

1. `initializeCommands` 视为废弃
2. 新模块自动启动逻辑统一通过 initialize actor
3. `install()` 只负责装配，不负责启动

## 测试结果

已通过：

1. `@impos2/kernel-base-runtime-shell-v2`
   1. `type-check`
   2. `test`
2. `@impos2/kernel-base-tdp-sync-runtime-v2`
   1. `type-check`
   2. `test`
3. `@impos2/kernel-base-workflow-runtime-v2`
   1. `type-check`
   2. `test`
4. `@impos2/kernel-base-tcp-control-runtime-v2`
   1. `type-check`
   2. `test`

## 新增测试覆盖

### runtime-shell-v2

1. initialize 会在 install 后、start 返回前广播
2. start 重复调用不会重复 initialize
3. initialize actor 失败时 start reject，且 request ledger 中保留失败结果

### tdp-sync-runtime-v2

1. runtime start 会通过全局 initialize 自动触发 bootstrap

## 后续建议

后续新增 v2 包时，凡是需要自动连接、自动恢复、自动 bootstrap 的能力，都不要再写模块级 `initializeCommands`，统一监听 `runtimeShellV2CommandDefinitions.initialize`。
