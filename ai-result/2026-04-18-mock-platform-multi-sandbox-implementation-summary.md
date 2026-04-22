# Mock Platform Multi-Sandbox 修改总结报告

日期：2026-04-18

## 1. 目标与结论

本次修改围绕以下最终目标落地：

1. `0-mock-server/mock-terminal-platform` 服务器支持多沙箱并发独立生效，互不影响
2. 所有服务器业务 API（含 WS）都显式携带 `sandboxId`
3. 管理后台保留“当前沙箱”操作体验，但本质上每个业务请求都显式附带 `sandboxId`
4. 终端客户端激活时要求用户填写 `sandboxId`，并持久化到客户端 state
5. TCP / TDP 重启恢复、联调和测试链路均以显式 `sandboxId` 为真相源

结论：

1. 服务器、管理后台、TCP 客户端、TDP 客户端均已改完
2. 关键测试与构建验证均已通过
3. 当前保留的“当前沙箱”只属于沙箱管理/runtime context 体验层，不再是业务接口真相源

## 2. 设计决策摘要

本次实现采用“显式 `sandboxId` 多沙箱方案”，核心原则如下：

1. 业务入口从“服务器当前沙箱”切换为“请求/连接显式携带 `sandboxId`”
2. TCP/TDP/master-data/fault/export/import/scene/admin 业务服务层不再通过 `getCurrentSandboxId()` 隐式解析业务沙箱
3. TDP WS 连接在 query 与 handshake payload 都必须带 `sandboxId`
4. WS session 必须在 `sandboxId + terminalId + token` 校验通过后才注册到在线会话表
5. 管理后台 `current sandbox` 只是前端请求默认值，不是服务端业务真相
6. 客户端持久化 `sandboxId`，并作为 TCP/TDP 恢复链路的一部分

## 3. 服务器改动总结

### 3.1 已完成的模块

以下服务端模块已经改为显式 `sandboxId`：

1. `0-mock-server/mock-terminal-platform/server/src/modules/tcp/service.ts`
2. `0-mock-server/mock-terminal-platform/server/src/modules/tdp/service.ts`
3. `0-mock-server/mock-terminal-platform/server/src/modules/tdp/wsServer.ts`
4. `0-mock-server/mock-terminal-platform/server/src/modules/tdp/wsSessionRegistry.ts`
5. `0-mock-server/mock-terminal-platform/server/src/modules/tdp/wsProtocol.ts`
6. `0-mock-server/mock-terminal-platform/server/src/modules/master-data/service.ts`
7. `0-mock-server/mock-terminal-platform/server/src/modules/fault/service.ts`
8. `0-mock-server/mock-terminal-platform/server/src/modules/export/service.ts`
9. `0-mock-server/mock-terminal-platform/server/src/modules/export/importService.ts`
10. `0-mock-server/mock-terminal-platform/server/src/modules/scene/service.ts`
11. `0-mock-server/mock-terminal-platform/server/src/modules/admin/routes.ts`

### 3.2 路由与 API 契约

服务端契约调整为：

1. `GET` / `DELETE` 业务请求通过 query 传 `sandboxId`
2. `POST` / `PUT` 业务请求通过 body 传 `sandboxId`
3. 路由层统一通过 `requireQuerySandboxId` / `requireBodySandboxId` 校验
4. 缺少 `sandboxId` 的关键接口统一返回 JSON 400，而不是落成 HTML 错误页

### 3.3 WebSocket 改动

TDP WebSocket 已完成以下约束：

1. 连接 query 必须带 `sandboxId`
2. handshake payload 必须带同一个 `sandboxId`
3. query 与 handshake 不一致会直接拒绝
4. 只有校验通过后才会把 session 注册到在线 registry
5. 在线 session 过滤已改为 `sandboxId + terminalId`

### 3.4 仍保留全局当前沙箱的范围

`0-mock-server/mock-terminal-platform/server/src/modules/sandbox/service.ts` 仍保留 `getCurrentSandboxId()`，但仅用于：

1. runtime context 展示
2. 沙箱管理自身逻辑
3. 审计默认值

它不再作为 TCP/TDP/master-data/fault/export/import 的业务真相源。

## 4. 管理后台改动总结

### 4.1 API 自动注入

已重写：

1. `0-mock-server/mock-terminal-platform/web/src/api.ts`

实现方式：

1. 内部维护 `currentSandboxId`
2. 暴露 `setCurrentSandboxId()` / `getCurrentSandboxId()`
3. `GET` / `DELETE` 自动在 URL query 注入 `sandboxId`
4. JSON body 请求自动 merge `sandboxId`
5. 导出下载通过 `buildExportDownloadUrl()` 自动附带 `sandboxId`

### 4.2 App 行为

已修改：

1. `0-mock-server/mock-terminal-platform/web/src/App.tsx`

完成行为：

1. `reloadAll()` 读取 `runtimeContext.currentSandboxId` 后同步到 `api.setCurrentSandboxId(...)`
2. 切换当前沙箱后同步更新 `api` 当前沙箱
3. 切换沙箱时清理详情态，避免跨沙箱脏数据展示
4. 后台用户仍然感觉是在操作“当前沙箱”，但底层所有业务请求已经显式带 `sandboxId`

## 5. TCP 客户端改动总结

已完成显式 `sandboxId` state 与命令链路改造。

### 5.1 关键文件

1. `1-kernel/1.1-base/tcp-control-runtime-v2/src/features/slices/tcpSandbox.ts`
2. `1-kernel/1.1-base/tcp-control-runtime-v2/src/features/actors/activationActor.ts`
3. `1-kernel/1.1-base/tcp-control-runtime-v2/src/features/actors/credentialActor.ts`
4. `1-kernel/1.1-base/tcp-control-runtime-v2/src/features/actors/deactivationActor.ts`
5. `1-kernel/1.1-base/tcp-control-runtime-v2/src/features/actors/taskReportActor.ts`
6. `1-kernel/1.1-base/tcp-control-runtime-v2/src/selectors/tcpControl.ts`
7. `1-kernel/1.1-base/tcp-control-runtime-v2/src/types/api.ts`
8. `1-kernel/1.1-base/tcp-control-runtime-v2/src/types/state.ts`

### 5.2 完成行为

1. 激活命令要求用户填写 `sandboxId`
2. 激活成功后把 `sandboxId` 持久化到 state
3. refresh token、deactivate、task result report 自动从 state 读取并发送 `sandboxId`
4. reset 时清空 sandbox state
5. live harness 与场景测试已切到显式 `sandboxId`

## 6. TDP 客户端改动总结

已完成从 TCP state 读取 `sandboxId` 并用于 HTTP/WS 全链路。

### 6.1 关键文件

1. `1-kernel/1.1-base/tdp-sync-runtime-v2/src/foundations/sessionConnectionRuntime.ts`
2. `1-kernel/1.1-base/tdp-sync-runtime-v2/src/foundations/httpService.ts`
3. `1-kernel/1.1-base/tdp-sync-runtime-v2/src/foundations/socketBinding.ts`
4. `1-kernel/1.1-base/tdp-sync-runtime-v2/src/features/actors/bootstrapActor.ts`
5. `1-kernel/1.1-base/tdp-sync-runtime-v2/src/types/protocol.ts`
6. `1-kernel/1.1-base/tdp-sync-runtime-v2/src/types/runtime.ts`

### 6.2 完成行为

1. TDP handshake payload 增加 `sandboxId`
2. WS connect query 增加 `sandboxId`
3. snapshot / changes HTTP 请求增加 `sandboxId`
4. TDP runtime 从 TCP runtime state 读取 sandbox 真相
5. 若已有 terminal/accessToken 但缺少 `sandboxId`，bootstrap 会失败而不是模糊恢复

## 7. 测试与验证

### 7.1 服务端

执行结果：

1. `cd 0-mock-server/mock-terminal-platform/server && corepack yarn type-check` ✅
2. `cd 0-mock-server/mock-terminal-platform/server && corepack yarn dlx vitest run --config vitest.config.ts src/test/sandbox-api.spec.ts` ✅

当前回归测试覆盖了以下缺失 `sandboxId` 场景：

1. terminal activate
2. TDP snapshot
3. TDP WebSocket handshake
4. master-data platforms list
5. export
6. fault rule list

### 7.2 管理后台

执行结果：

1. `cd 0-mock-server/mock-terminal-platform/web && corepack yarn build` ✅

### 7.3 TCP 客户端

执行结果：

1. `cd 1-kernel/1.1-base/tcp-control-runtime-v2 && corepack yarn type-check && corepack yarn test` ✅

### 7.4 TDP 客户端

执行结果：

1. `cd 1-kernel/1.1-base/tdp-sync-runtime-v2 && corepack yarn type-check && corepack yarn test` ✅

## 8. 改动文件范围摘要

### 8.1 服务器

1. `0-mock-server/mock-terminal-platform/server/src/modules/admin/routes.ts`
2. `0-mock-server/mock-terminal-platform/server/src/modules/export/importService.ts`
3. `0-mock-server/mock-terminal-platform/server/src/modules/export/service.ts`
4. `0-mock-server/mock-terminal-platform/server/src/modules/fault/service.ts`
5. `0-mock-server/mock-terminal-platform/server/src/modules/master-data/service.ts`
6. `0-mock-server/mock-terminal-platform/server/src/modules/sandbox/service.ts`
7. `0-mock-server/mock-terminal-platform/server/src/modules/scene/service.ts`
8. `0-mock-server/mock-terminal-platform/server/src/modules/tcp/service.ts`
9. `0-mock-server/mock-terminal-platform/server/src/modules/tdp/service.ts`
10. `0-mock-server/mock-terminal-platform/server/src/modules/tdp/wsProtocol.ts`
11. `0-mock-server/mock-terminal-platform/server/src/modules/tdp/wsServer.ts`
12. `0-mock-server/mock-terminal-platform/server/src/modules/tdp/wsSessionRegistry.ts`
13. `0-mock-server/mock-terminal-platform/server/src/test/sandbox-api.spec.ts`
14. `0-mock-server/mock-terminal-platform/server/vitest.config.ts`

### 8.2 管理后台

1. `0-mock-server/mock-terminal-platform/web/src/App.tsx`
2. `0-mock-server/mock-terminal-platform/web/src/api.ts`

### 8.3 TCP 客户端

1. `1-kernel/1.1-base/tcp-control-runtime-v2/src/features/actors/activationActor.ts`
2. `1-kernel/1.1-base/tcp-control-runtime-v2/src/features/actors/credentialActor.ts`
3. `1-kernel/1.1-base/tcp-control-runtime-v2/src/features/actors/deactivationActor.ts`
4. `1-kernel/1.1-base/tcp-control-runtime-v2/src/features/actors/stateMutationActor.ts`
5. `1-kernel/1.1-base/tcp-control-runtime-v2/src/features/actors/taskReportActor.ts`
6. `1-kernel/1.1-base/tcp-control-runtime-v2/src/features/commands/index.ts`
7. `1-kernel/1.1-base/tcp-control-runtime-v2/src/features/slices/index.ts`
8. `1-kernel/1.1-base/tcp-control-runtime-v2/src/features/slices/tcpSandbox.ts`
9. `1-kernel/1.1-base/tcp-control-runtime-v2/src/foundations/stateKeys.ts`
10. `1-kernel/1.1-base/tcp-control-runtime-v2/src/index.ts`
11. `1-kernel/1.1-base/tcp-control-runtime-v2/src/selectors/tcpControl.ts`
12. `1-kernel/1.1-base/tcp-control-runtime-v2/src/types/api.ts`
13. `1-kernel/1.1-base/tcp-control-runtime-v2/src/types/state.ts`
14. `1-kernel/1.1-base/tcp-control-runtime-v2/test/helpers/liveHarness.ts`
15. `1-kernel/1.1-base/tcp-control-runtime-v2/test/scenarios/tcp-control-runtime-v2-live-restart-recovery.spec.ts`
16. `1-kernel/1.1-base/tcp-control-runtime-v2/test/scenarios/tcp-control-runtime-v2-live-roundtrip.spec.ts`
17. `1-kernel/1.1-base/tcp-control-runtime-v2/test/scenarios/tcp-control-runtime-v2.spec.ts`

### 8.4 TDP 客户端

1. `1-kernel/1.1-base/tdp-sync-runtime-v2/src/features/actors/bootstrapActor.ts`
2. `1-kernel/1.1-base/tdp-sync-runtime-v2/src/foundations/httpService.ts`
3. `1-kernel/1.1-base/tdp-sync-runtime-v2/src/foundations/sessionConnectionRuntime.ts`
4. `1-kernel/1.1-base/tdp-sync-runtime-v2/src/foundations/socketBinding.ts`
5. `1-kernel/1.1-base/tdp-sync-runtime-v2/src/types/protocol.ts`
6. `1-kernel/1.1-base/tdp-sync-runtime-v2/src/types/runtime.ts`
7. `1-kernel/1.1-base/tdp-sync-runtime-v2/test/helpers/liveHarness.ts`
8. `1-kernel/1.1-base/tdp-sync-runtime-v2/test/scenarios/tdp-sync-runtime-v2-live-command-roundtrip.spec.ts`
9. `1-kernel/1.1-base/tdp-sync-runtime-v2/test/scenarios/tdp-sync-runtime-v2-live-control-signals.spec.ts`
10. `1-kernel/1.1-base/tdp-sync-runtime-v2/test/scenarios/tdp-sync-runtime-v2-live-projection-feedback.spec.ts`
11. `1-kernel/1.1-base/tdp-sync-runtime-v2/test/scenarios/tdp-sync-runtime-v2-live-reconnect.spec.ts`
12. `1-kernel/1.1-base/tdp-sync-runtime-v2/test/scenarios/tdp-sync-runtime-v2-live-restart-recovery.spec.ts`
13. `1-kernel/1.1-base/tdp-sync-runtime-v2/test/scenarios/tdp-sync-runtime-v2-live-roundtrip.spec.ts`
14. `1-kernel/1.1-base/tdp-sync-runtime-v2/test/scenarios/tdp-sync-runtime-v2-live-system-catalog.spec.ts`
15. `1-kernel/1.1-base/tdp-sync-runtime-v2/test/scenarios/tdp-sync-runtime-v2.spec.ts`

## 9. 风险与注意事项

### 9.1 当前剩余风险

1. `server/data/mock-terminal-platform.sqlite-shm`
2. `server/data/mock-terminal-platform.sqlite-wal`

这些是本地运行验证产生的数据库临时文件，不是功能改动的一部分。

### 9.2 后续维护注意点

后续新增任何业务接口时，必须遵守以下规则：

1. 不允许通过 `getCurrentSandboxId()` 推断业务沙箱
2. HTTP/WS 新接口必须显式传 `sandboxId`
3. 路由层必须先校验 `sandboxId`，再调用 service
4. 前台或后台如保留“当前沙箱”UI，也只能作为请求默认值，不能作为服务端业务真相

## 10. 最终判断

本次多沙箱改造已经达到原始目标：

1. 每个沙箱都可独立生效
2. 互不影响
3. 所有业务 API（含 WS）都显式带 `sandboxId`
4. 管理后台保持当前体验但底层已显式化
5. 客户端激活与恢复链路都绑定到持久化 `sandboxId`
6. 关键验证全部通过
