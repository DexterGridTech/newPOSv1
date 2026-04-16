# Kernel Core UI Runtime 开发与调试方法论

## 目的

本文沉淀本次 `1-kernel/1.1-cores/ui-runtime` 设计、实现、调试过程中已经验证有效的方法，供后续同类 runtime core 包复用。

重点不是某个 API 细节，而是以下几类方法：

1. 如何拆分 UI runtime state，而不是把 screen / overlay / uiVariables 混在一个 slice。
2. 如何验证“命令 -> actor -> workspace slice -> selector”的真实运行链路。
3. 如何验证本地持久化与主副屏同步，不停留在 reducer 级假设。
4. 如何搭建可复用的主副屏双进程 dev 场景。

## 适用范围

适用于满足下面任一条件的 `1-kernel/1.1-cores/*` 包：

1. 包内 state 同时承载本地持久化和主副端同步语义。
2. 包的真实行为依赖 `ApplicationManager`、workspace slice、command actor、interconnection。
3. 包需要在 `dev` 中验证多进程、多 displayIndex、多 workspace 的协同行为。

## 一、状态建模方法

### 0. UI 层只消费状态并触发指令，不承接业务编排

后续所有 UI runtime / UI base / integration shell 开发，默认遵守这条边界：

1. UI 组件负责把 state/selectors 映射成界面
2. UI 组件负责响应用户输入并发出 command
3. UI 组件可以根据已有 state 做页面切换、overlay 切换
4. UI 组件不负责“调用 A -> 等待 B -> 清理 C -> 再跳 D”这类业务编排
5. 激活、注销、恢复、本地清空、主副屏协同、远端同步等流程，统一放在 kernel/runtime actor 或其他非 UI orchestration 层

这样做的原因：

1. React 组件更容易测试，只需要验证“给定状态显示什么、点击后发什么 command”
2. 业务时序集中在 runtime 层，更容易复用、联调和排障
3. 避免 integration root / page hook 逐渐长成新的 `ApplicationManager`

### 1. 按运行职责拆 slice，不按“都属于 UI”硬塞到一起

`ui-runtime` 这次验证下来的合理拆分是：

1. `screen`：容器当前 screen。
2. `overlay`：主副屏 overlay stack。
3. `uiVariables`：通用 UI 临时变量。

原因：

1. 这三类状态的语义不同。
2. 读写命令不同。
3. selector 不同。
4. 后续扩展和排障时，职责边界更清晰。

实践结论：

1. 不要为了“都和界面相关”就合并成一个大状态桶。
2. 也不要把包拆得过碎，导致 screen / overlay / ui variable 之间失去统一 runtime 入口。

### 2. workspace slice 的顶层值必须可同步

这次实现里，所有需要跨端同步的顶层字段都遵守同一个约束：

1. 顶层值使用 `ValueWithUpdatedAt<T>` 包装。
2. 对应 slice 必须实现 `batchUpdateState`。

原因：

1. 当前同步中间件按顶层字段比较 `updatedAt`。
2. 远端写回也是通过 `<slice>/batchUpdateState` 合并。
3. 如果顶层直接存 raw value，同步会失去可比较时间戳。

这条约束适用于：

1. `screen[containerKey]`
2. `overlay.primaryOverlays`
3. `overlay.secondaryOverlays`
4. `uiVariables[key]`

### 3. 清理语义要兼容同步，不要直接 delete

本次验证的结论是：

1. 对需要同步的字段做“清空”时，应写入 `value: null` 并更新时间戳。
2. 不要直接 `delete` 顶层字段。

原因：

1. `delete` 会让另一端缺少明确的覆盖事件。
2. `null + updatedAt` 才能被同步中间件识别为一次新的状态写入。

这条规则对 `clearUiVariables`、`resetScreen`、`closeOverlay` 这类动作尤其重要。

## 二、开发验证方法

### 1. 不要只测 reducer，要测真实命令链路

`ui-runtime` 的这次开发里，真正有价值的断言对象不是 reducer 输入输出，而是：

1. command 是否正确驱动 actor。
2. actor 是否正确写入 workspace slice。
3. selector 读出来的最终状态是否符合语义。

因此 `dev` 测试的最小闭环应是：

1. 初始化真实 `ApplicationManager`。
2. 注册真实模块。
3. 发送真实 command。
4. 通过 selector 或 state snapshot 断言结果。

如果只测 reducer，很容易漏掉：

1. actor 没注册。
2. command type 对不上。
3. workspace 配置不对。
4. 同步中间件没有真正生效。

### 2. 持久化与同步要拆成两层验证

这次实践后，最有效的测试拆分是两层：

1. 单进程状态语义验证。
2. 双进程主副屏同步验证。

对应到当前 `ui-runtime/dev`：

1. `test-state-single.ts`：验证本地命令是否正确驱动 `screen` / `overlay` / `uiVariables`。
2. `test-state-dual.ts`：验证主副进程是否正确建立连接并同步主屏状态到副屏。

这样拆的原因：

1. 单进程测试负责快速定位 slice/actor/selector 语义问题。
2. 双进程测试负责验证 interconnection、workspace、displayIndex、同步方向是否正确。

### 3. 双进程测试必须是真双进程

主副屏同步不能在一个 Node 进程里伪造两个 store 就算完成。

这次已验证可复用的方式是：

1. 启动 `0-mock-server/master-ws-server-dual` 作为主副屏通信服务。
2. 分别启动两个独立 Node 子进程。
3. 两个进程分别创建自己的 `ApplicationManager`。
4. 通过不同 `displayIndex` 让 `interconnection` 自动判断主屏和副屏。

对应结论：

1. 主屏进程写入 `Workspace.MAIN` 状态。
2. 副屏进程在 `displayMode=secondary` 下接收同步后的主屏状态。
3. 这比单进程 mock 更接近真实联调。

### 4. 用结果文件做跨进程断言

双进程场景里，最稳妥的断言方式不是依赖 stdout 文本，而是：

1. 每个子进程各自写一个 result JSON 文件。
2. 父进程等待两个文件出现。
3. 父进程统一读取并做最终断言。

当前已验证的路径：

1. `ai-result/dev-storage/ui-runtime-dual/master.result.json`
2. `ai-result/dev-storage/ui-runtime-dual/slave.result.json`

这个方式的优点是：

1. 结构化。
2. 易复查。
3. 适合后续扩展更多断言字段。

## 三、主副屏与本地化的调试技巧

### 1. 运行时缩短系统超时参数，加快测试反馈

`interconnection` 相关测试如果使用默认超时，反馈会很慢。

本次可复用的做法是：

1. 在 dev 场景里通过 `kernelCoreBaseCommands.updateSystemParameters(...)` 临时调小启动、连接、重连相关超时。

这样做的目的不是改变产品语义，而是：

1. 缩短本地开发等待时间。
2. 提高双进程测试的执行效率。

### 2. 优先核对几个关键事实，避免误判

这次调试过程中有几个容易误判的点，后续应直接先确认：

1. `ServerConnectionStatus` 枚举值是大写，例如 `CONNECTED`。
2. 副屏进程即使是 secondary display，workspace 仍可能是 `main`，这是当前架构语义，不是异常。
3. teardown 后出现 reconnect 尝试日志，不一定代表断言失败。
4. mock server 停止后如果出现 `http://localhost:8888/localServer/register` 404，也可能只是收尾阶段噪音。

这些现象在本次测试里都出现过，但不影响断言通过。

### 3. 排障顺序应固定

涉及主副屏状态不一致时，建议按以下顺序检查：

1. mock server 是否已启动并通过健康检查。
2. 主屏进程是否成功连接。
3. 副屏进程是否成功连接。
4. 主屏本地 state 是否已经写入。
5. 副屏是否收到了同步结果。

本次双进程 dev 场景采用的健康检查地址是：

1. `http://127.0.0.1:8888/mockMasterServer/health`

## 四、当前可复用模板

后续新增同类型 core 包时，建议优先参考以下文件：

1. `1-kernel/1.1-cores/ui-runtime/dev/index.ts`
2. `1-kernel/1.1-cores/ui-runtime/dev/test-state-single.ts`
3. `1-kernel/1.1-cores/ui-runtime/dev/test-state-dual.ts`
4. `1-kernel/1.1-cores/ui-runtime/dev/worker.ts`
5. `0-mock-server/master-ws-server-dual/src/index.ts`

如果要快速回归当前 `ui-runtime` dev 测试，可使用：

```bash
node $(node -p "require.resolve('tsx/cli')") 1-kernel/1.1-cores/ui-runtime/dev/index.ts
```

如果要先做类型检查，可使用：

```bash
./node_modules/typescript/bin/tsc --noEmit -p 1-kernel/1.1-cores/ui-runtime/tsconfig.json
```

## 五、落地建议

后续凡是涉及“本地状态 + 主副屏同步 + workspace slice”的 core 包，建议默认按下面顺序推进：

1. 先按运行职责拆 slice。
2. 先确认哪些顶层字段必须具备 `updatedAt`。
3. 先补 `batchUpdateState`，再接同步。
4. 先写单进程状态语义验证。
5. 再写双进程同步验证。
6. 最后再做更高层业务联调。

这套顺序的价值在于：

1. 先验证包内语义。
2. 再验证跨进程同步。
3. 最后再接业务系统，能显著减少误判范围。
