# AGENTS

## Spec 入口

与 `1-kernel/1.1-cores/*` 相关的开发、联调、重启恢复验证，先看：

1. [spec/kernel-core-dev-methodology.md](/Users/dexter/Documents/workspace/idea/newPOSv1/spec/kernel-core-dev-methodology.md)
2. [spec/kernel-core-ui-runtime-dev-methodology.md](/Users/dexter/Documents/workspace/idea/newPOSv1/spec/kernel-core-ui-runtime-dev-methodology.md)
3. [docs/superpowers/specs/2026-04-08-ui-runtime-design.md](/Users/dexter/Documents/workspace/idea/newPOSv1/docs/superpowers/specs/2026-04-08-ui-runtime-design.md)

## 当前约定

处理需要通信、持久化、重启恢复的 core 包时，默认遵守上面的方法论文档，尤其是：

1. 先区分最小持久化真相源和 runtime-only 状态。
2. `dev/index.ts` 必须优先验证 selector/state 语义，不把“请求成功”当成完成。
3. 涉及持久化恢复时，优先采用 `full / seed / verify` 的真实重启验证模式。
4. 需要联调时，同时检查客户端和服务端，不默认把问题归因到单侧实现。
5. 需要服务端配合时，使用仓库根目录脚本 `corepack yarn mock:platform:dev`。

补充说明：

1. `spec/kernel-core-dev-methodology.md` 是通用 core 包方法论，适合 TCP / TDP / 持久化恢复类问题。
2. `spec/kernel-core-ui-runtime-dev-methodology.md` 是 `ui-runtime` 专项方法论，重点覆盖 workspace slice、主副屏同步、本地化状态、双进程 dev 验证。
3. `docs/superpowers/specs/2026-04-08-ui-runtime-design.md` 是 `ui-runtime` 的设计文档，处理包职责、slice 边界、命令设计、兼容策略时先看它。
