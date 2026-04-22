# adapter-android-v2

`adapter-android-v2` 是 Android 原生适配层，职责是沉淀可复用的设备能力与宿主无关的 manager / service，不承载 RN84 业务编排。

当前包已经不是“纯骨架”：

1. 提供可复用的 native managers / services，供 assembly 通过 TurboModule 或 bridge 组合暴露；
2. 承接 `topologyHost`、存储、设备、日志、连接器等底层能力实现；
3. 为后续 `dev-app` / automation diagnostics 提供可复用的原生调试基础。

分层约束：

1. adapter 只提供原生能力与事实，不决定 RN84 的拓扑、激活、热更新、serverSpace 等业务流程；
2. 业务状态机、public command / actor、UI bridge 应继续放在 kernel / ui-base / assembly wiring；
3. assembly 应作为 “RN84 bridge over adapter managers”，而不是把 adapter 反向包进 assembly 业务层。
