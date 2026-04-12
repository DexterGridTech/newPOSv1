# 2026-04-13 kernel-base v2 夜间执行计划

## 1. 本轮目标

在不再中途确认的前提下，连续完成下面五件事：

1. 把常用 validator 抽到 `1-kernel/1.1-base/contracts`。
2. 完成 `tcp-control-runtime-v2` 迁移收尾。
3. 完成 `tdp-sync-runtime-v2` 迁移收尾。
4. 完成 `workflow-runtime-v2` 迁移收尾。
5. 新建并落地 `topology-runtime-v2`，合并旧 `topology-runtime` 与 `topology-client-runtime` 的职责。

## 2. 执行顺序

按下面顺序推进，避免后置包反复返工：

1. `contracts` validator 与 definition helper 收口。
2. `tcp-control-runtime-v2` actor 结构与 live harness 收口。
3. `tdp-sync-runtime-v2` projection 仓库、topic 广播、system catalog bridge、live/restart/reconnect 验证收口。
4. `workflow-runtime-v2` 动态 definition / queue / observation / TDP 联动收口。
5. `topology-runtime-v2` 包骨架、控制面、客户端编排、持久化恢复、dual-topology-host 联调。

## 3. 结构约束

继续执行已经确认的约束：

1. `1-kernel` 不依赖 React。
2. `hooks/index.ts` 仅做规则说明文件。
3. 不再创建 `features/middlewares` / `features/epics`。
4. `moduleName` 是所有包的结构要素。
5. `state` 全局可读，跨包写入必须走 command。
6. `test` 目录作为统一测试入口，不再使用 `dev`。
7. 时间存储统一用 long 毫秒值。
8. 运行时 ID 统一走 kernel base 的 ID 生成器。

## 4. 验证要求

本轮收尾必须包含：

1. `type-check`
2. `vitest`
3. 关键 live/mock 联调
4. 必要的 restart/persistence 场景验证

其中：

1. TCP/TDP 联调优先走 `0-mock-server/mock-terminal-platform`。
2. topology 联调优先走 `0-mock-server/dual-topology-host`。
3. 如果需要真实服务配合，优先使用仓库现有测试 server / harness，而不是手搓伪 mock。

## 5. 交付物

本轮结束后统一输出：

1. 代码改动
2. 测试结果
3. 剩余风险
4. 下一步建议
