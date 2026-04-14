# 2026-04-14 ui-runtime-v2 实现计划

## 1. 实施范围

本轮直接创建并实现：

`1-kernel/1.1-base/ui-runtime-v2`

目标是完成基础闭环：

1. 包结构符合 `1-kernel/1.1-base` 规范。
2. 不依赖 React。
3. 接入 `runtime-shell-v2` module 模型。
4. 使用 `state-runtime` 管理 state、持久化与 sync descriptor。
5. 从 `topology-runtime-v2` selector 读取 workspace / displayMode / instanceMode。
6. 覆盖 screen definition registry、screen runtime、overlay runtime、ui variable runtime。
7. 补充单进程测试和基础 state sync 测试。

## 2. 文件结构

计划创建：

1. `package.json`
2. `tsconfig.json`
3. `src/moduleName.ts`
4. `src/index.ts`
5. `src/generated/packageVersion.ts`
6. `src/application/index.ts`
7. `src/features/commands/index.ts`
8. `src/features/actors/index.ts`
9. `src/features/actors/screenRegistryActor.ts`
10. `src/features/actors/screenRuntimeActor.ts`
11. `src/features/actors/overlayRuntimeActor.ts`
12. `src/features/actors/uiVariableRuntimeActor.ts`
13. `src/features/slices/index.ts`
14. `src/features/slices/screenState.ts`
15. `src/features/slices/overlayState.ts`
16. `src/features/slices/uiVariableState.ts`
17. `src/foundations/index.ts`
18. `src/foundations/module.ts`
19. `src/foundations/screenRegistry.ts`
20. `src/foundations/screenFactory.ts`
21. `src/selectors/index.ts`
22. `src/hooks/index.ts`
23. `src/supports/index.ts`
24. `src/supports/errors.ts`
25. `src/supports/parameters.ts`
26. `src/types/index.ts`
27. `src/types/screen.ts`
28. `src/types/state.ts`
29. `src/types/runtime.ts`
30. `test/index.ts`
31. `test/scenarios/ui-runtime-v2.spec.ts`
32. `test/scenarios/ui-runtime-v2-state-sync.spec.ts`

## 3. 测试目标

### 3.1 单进程语义测试

覆盖：

1. 注册 screen definitions 后可按 context 查找。
2. duplicate partKey 在同 screenMode 下报错。
3. `showScreen` 写入当前 workspace 的 container entry。
4. `replaceScreen` 更新 operation。
5. `resetScreen` 写入 `value: null`，不直接删除。
6. `openOverlay / closeOverlay / clearOverlays` 只影响当前 displayMode。
7. `setUiVariables / clearUiVariables` 写入和清理变量。
8. selector 返回默认值行为正确。

### 3.2 同步语义测试

覆盖：

1. 两个 runtime 分别启动 `topology-runtime-v2 + ui-runtime-v2`。
2. runtime A 写 screen/overlay/uiVariables。
3. 通过 `createSliceSyncSummary / createSliceSyncDiff / applyStateSyncDiff` 模拟 topology sync。
4. runtime B selector 能读到同步后的值。
5. 清理操作也能同步为 null/tombstone 语义。

## 4. 验证命令

实现完成后运行：

```bash
corepack yarn workspace @impos2/kernel-base-ui-runtime-v2 test
corepack yarn workspace @impos2/kernel-base-ui-runtime-v2 type-check
```

如涉及跨包类型变化，再运行：

```bash
corepack yarn workspace @impos2/kernel-base-topology-runtime-v2 type-check
corepack yarn workspace @impos2/kernel-base-state-runtime type-check
```

