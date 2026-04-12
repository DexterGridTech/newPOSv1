# tcp-control-runtime 当前进展

## 已完成

已创建新包：

1. `1-kernel/1.1-base/tcp-control-runtime`

已完成第一轮实现：

1. `tcpIdentity / tcpCredential / tcpBinding / tcpRuntime` 四个 slice
2. field-level 持久化
3. credential 的 protected storage 持久化
4. 公开 commands
5. 公开 selectors
6. HTTP endpoint + service 封装
7. `createTcpControlRuntimeModule(...)`
8. 包内场景测试
9. 真实 `mock-terminal-platform` live harness
10. 真实 roundtrip 场景
11. 真实 restart-recovery 场景

## 当前实现边界

当前 `tcp-control-runtime` 已负责：

1. bootstrap 写入设备前置条件
2. 终端激活
3. credential 刷新
4. 任务结果回报
5. identity / credential / binding 的本地恢复

当前未做：

1. 自动 credential 刷新调度
2. `tcp-control-runtime + tdp-sync-runtime` 的 scene 级联合验证
3. 基于 fault rule 的真实 transport 行为注入

## 当前验证结论

已通过：

1. `./node_modules/.bin/tsc -p 1-kernel/1.1-base/tcp-control-runtime/tsconfig.json --noEmit`
2. `./node_modules/.bin/tsc -p 1-kernel/1.1-base/tcp-control-runtime/test/tsconfig.json --noEmit`
3. `./node_modules/.bin/vitest run 1-kernel/1.1-base/tcp-control-runtime/test/scenarios/*.spec.ts`

当前测试已覆盖：

1. activateTerminal
2. refreshCredential
3. reportTaskResult
4. 持久化恢复
5. runtime-only 状态不恢复
6. 真实 `mock-terminal-platform` 激活闭环
7. 真实 credential refresh 闭环
8. 真实任务结果回报到服务端 trace 闭环
9. 真实重启后的 identity / credential / binding 恢复

## 本次新增 live 测试

新增：

1. `1-kernel/1.1-base/tcp-control-runtime/test/helpers/liveHarness.ts`
2. `1-kernel/1.1-base/tcp-control-runtime/test/scenarios/tcp-control-runtime-live-roundtrip.spec.ts`
3. `1-kernel/1.1-base/tcp-control-runtime/test/scenarios/tcp-control-runtime-live-restart-recovery.spec.ts`

说明：

1. `tcp-control-runtime` 现在已经和 `tdp-sync-runtime` 一样，具备真实 `mock-terminal-platform` 联调能力。
2. live roundtrip 覆盖了：
   1. 真实激活码激活
   2. 真实 refresh token 刷新
   3. 真实发布单创建后，客户端通过 `reportTaskResult` 回写实例结果
   4. admin trace 可直接读到最终结果
3. live restart-recovery 覆盖了：
   1. stateStorage / secureStateStorage 文件持久化
   2. 第二个全新 runtime 的真实 rehydrate
   3. `tcpRuntime` 运行态观测字段不会跨重启复活

## 设计取舍

本轮有两个明确取舍：

1. `resetTcpControl` 仅清理激活结果、凭证、绑定与 runtime 观测，不清理 `deviceInfo / deviceFingerprint`
2. 当前先采用 plain state，而不是继续沿用旧包 `ValueWithUpdatedAt` 结构

原因：

1. `deviceInfo / deviceFingerprint` 更像设备前置条件，不应被“清空控制面身份”顺手清掉
2. 新 `state-runtime` 已支持字段级持久化，plain state 更清晰，也更利于后续业务包消费

额外结论：

1. 当前更值得优先补的是 TCP/TDP/scene 组合联调，而不是先把 `faultRules` 过度接进 transport 层。
2. 原因是 `faultRules` 目前还是 mock 平台的管理数据，不是真正已接入 HTTP/WS 行为的注入器。
3. 先把真实协议闭环和 scene 级场景压实，收益更大，也更符合“不要过度设计”的约束。

## 下一步建议

建议直接进入：

1. `tcp-control-runtime + tdp-sync-runtime` 的 scene 级联合验证
2. 用 `mock-terminal-platform` 的 scene 模板驱动多终端、多实例、多次后台变化的复杂场景
3. 然后再决定是否需要把 fault rule 真的下沉到 transport 行为注入
