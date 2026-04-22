# AGENTS

## Spec 入口

与 `1-kernel/1.1-base/*`、`2-ui/2.1-base/*`、Android adapter / assembly 分层、跨层通信、联调、重启恢复验证相关的开发，先看：

1. [spec/layered-runtime-communication-standard.md](/Users/dexter/Documents/workspace/idea/newPOSv1/spec/layered-runtime-communication-standard.md)
2. [spec/kernel-core-dev-methodology.md](/Users/dexter/Documents/workspace/idea/newPOSv1/spec/kernel-core-dev-methodology.md)
3. [spec/kernel-core-ui-runtime-dev-methodology.md](/Users/dexter/Documents/workspace/idea/newPOSv1/spec/kernel-core-ui-runtime-dev-methodology.md)
4. [docs/superpowers/specs/2026-04-08-ui-runtime-design.md](/Users/dexter/Documents/workspace/idea/newPOSv1/docs/superpowers/specs/2026-04-08-ui-runtime-design.md)

## 当前约定

处理需要通信、持久化、重启恢复的 core 包时，默认遵守上面的方法论文档，尤其是：

1. 先区分最小持久化真相源和 runtime-only 状态。
2. `dev/index.ts` 必须优先验证 selector/state 语义，不把“请求成功”当成完成。
3. 涉及持久化恢复时，优先采用 `full / seed / verify` 的真实重启验证模式。
4. 需要联调时，同时检查客户端和服务端，不默认把问题归因到单侧实现。
5. 需要服务端配合时，使用仓库根目录脚本 `corepack yarn mock:platform:dev`。
6. 跨层写操作统一走 public command；平台事实统一走 `platform-ports`；需要用户确认的 domain 行为必须拆成“请求确认 command -> UI bridge/modal -> 执行 command”，不要让 assembly 或 UI 直接拼完整业务链路。
7. Android assembly 以“应迁尽迁、越薄越好”为硬约束；如果 `platform-ports`、kernel command/actor、UI bridge 或 adapter 能力不够，优先补对应层能力再迁移，不把缺口沉淀成 assembly 业务逻辑。

补充说明：

1. `spec/layered-runtime-communication-standard.md` 是新工程跨层通信和职责边界的总规范，处理 adapter / assembly / kernel / UI 分层时先看它。
2. `spec/kernel-core-dev-methodology.md` 是通用 core 包方法论，适合 TCP / TDP / 持久化恢复类问题。
3. `spec/kernel-core-ui-runtime-dev-methodology.md` 是 `ui-runtime` 专项方法论，重点覆盖 workspace slice、主副屏同步、本地化状态、双进程 dev 验证。
4. `docs/superpowers/specs/2026-04-08-ui-runtime-design.md` 是 `ui-runtime` 的设计文档，处理包职责、slice 边界、命令设计、兼容策略时先看它。
