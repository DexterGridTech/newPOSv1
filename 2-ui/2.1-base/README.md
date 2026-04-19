# 2-ui/2.1-base

本目录是新的 UI 基础层。
目标不是复刻旧 UI 包，而是基于 `1-kernel/1.1-base` 的运行时能力，重新建立一套边界清晰、可测试、可组合的 RN UI 基础包。

当前已完成第一批收口包：

1. `input-runtime`
2. `admin-console`
3. `terminal-console`

## 总体原则

1. 生产代码只放在各包 `src/` 下，保持纯 React Native，不把 Expo 测试壳导出到生产面。
2. `test-expo/` 和包根 `index.ts` 只服务测试入口，不参与上层集成包导出。
3. UI 组件只负责两件事：
   1. 渲染当前状态
   2. 发出用户意图
4. UI 层不做跨模块业务编排，不把 integration 级流程塞进 base 包 screen。
5. 页面必须有稳定的 `testID`，自动化测试节点不能依赖文案或 DOM 结构猜测。
6. 需要真实后端时，优先直接联调 mock server，而不是在 UI 层伪造成功结果。

## UI 自动化规范

`2-ui/2.1-base/ui-automation-runtime` 是当前 UI 层自动化与运行时调试的统一标准入口。

后续新增或重构 `2-ui` 包时，默认遵守以下规则：

1. 不再为单个包长期维护私有自动化协议；优先接入共享 `ui-automation-runtime`。
2. 自动化主路径统一走：
   1. `ui.queryNodes` / `ui.getNode` / `ui.getTree`
   2. `ui.performAction` / `ui.setValue` / `ui.clearValue` / `ui.submit`
   3. `wait.forNode` / `wait.forScreen` / `wait.forState` / `wait.forRequest` / `wait.forIdle`
3. 对声明为虚拟键盘的输入节点，自动化必须走 `ui.performAction` 打开 `ui-base-virtual-keyboard` 并逐键输入；不得用 `ui.setValue` / `changeText` 直接改值。
4. `scripts.execute` 只作为 escape hatch，不应成为 UI 测试主路径。
5. 新的 rendered UI 测试优先使用共享 automation helper，而不是直接依赖组件内部结构或手写 renderer 遍历逻辑。
6. 业务 rendered/live/assembly 场景测试优先调用共享 helper 的高层能力（如 `press` / `typeVirtualValue` / `dispatchCommand` / `waitFor*`），不要在 spec 中直接包 `react-test-renderer act(...)`。
7. 新的 `test-expo/runAutomation.mjs` 优先复用共享 browser automation harness，不再重复定义每包自己的浏览器消息协议。
8. `primary` 与 `secondary` 必须视为两个独立 target；双屏断言要显式分别等待，不做隐式 `all` 聚合。
9. Product 可以编入自动化代码，但 Product 运行时不得主动启动 automation runtime / host / trace / target registration。
10. Android 真机 / 模拟器接入统一走 assembly 的 localhost automation host + `adb forward`；不要在 UI 包里单独发明新的 Android 调试 socket。
11. RN84 当前约定的真机 automation 端口是：
   1. `primary` -> `127.0.0.1:18584`
   2. `secondary` -> `127.0.0.1:18585`
12. 真机 smoke 与日常排障优先复用仓库根命令：
   1. `node scripts/android-automation-rpc.mjs smoke --target primary`
   2. `node scripts/android-automation-rpc.mjs smoke --target secondary`
   3. `node scripts/android-automation-rpc.mjs type-virtual <fieldNodeId> <value> --target <primary|secondary>`
   4. `node scripts/android-automation-rpc.mjs activate-device <sandboxId> <activationCode> --target primary`
   5. `node scripts/android-automation-rpc.mjs wait-activated [sandboxId] --target primary`
   6. `node scripts/android-automation-rpc.mjs call <method> --target <primary|secondary>`

### Topology-aware UI automation

涉及主副机、standalone slave、双屏与持久化语义的 UI 测试，默认还要遵守以下规则：

1. topology 流程优先通过 `admin-console` + `ui-automation-runtime` 驱动，不再为某个 UI 包单独发明 topology 测试协议。
2. managed secondary 必须视为 remote-synced 运行态；测试不得假设它有本地业务 stateStorage。
3. standalone slave 即使 `displayMode === 'SECONDARY'`，仍然是 locally persistent；测试不得把“secondary”直接等同于“无本地持久化”。
4. 外部 master 接入的标准路径是：
   1. 导入 share payload；
   2. 写入 masterInfo；
   3. 请求 `/tickets`；
   4. 更新 dynamic topology binding；
   5. 重启 topology connection。
5. 通电切屏只属于 `standalone && instanceMode === 'SLAVE'`；managed secondary 与 master 不应响应这条规则。

### UI 节点约定

1. 所有关键 screen、modal、overlay、alert、input、action button、summary field 都应提供稳定 `testID`。
2. 自动化需要读取或操作的重要节点，应通过共享 automation bridge 注册到 semantic registry。
3. screen 切换后，旧 screen 的语义节点必须及时失效；测试不得依赖幽灵节点。
4. 优先新增稳定语义节点，而不是退回坐标点击或 fragile text-match。

## 包职责

### input-runtime

职责：

1. 定义统一输入模型。
2. 管理系统键盘和虚拟键盘的切换。
3. 提供 `InputField`、`VirtualKeyboardOverlay`、`InputRuntimeProvider` 等基础组件。

规则：

1. 程序显式指定虚拟键盘时，必须走虚拟键盘。
2. 程序未指定时，默认走系统键盘。
3. 虚拟键盘字段在自动化语义上只暴露 `press`；字符录入必须通过 `VirtualKeyboardOverlay` 的 key 节点完成。
4. 输入状态不直接承担业务编排职责。

### admin-console

职责：

1. 提供管理员登录入口和工作台容器。
2. 聚合管理员常用 section。
3. 调用底层 runtime command，执行宿主级诊断和控制动作。

规则：

1. `admin-console` 负责“触发操作”，不负责“全局恢复编排”。
2. 解除激活、宿主控制等动作由下层 runtime 自己收口副作用，UI 不知道全局流程细节。
3. 页面结构要统一，section 统一用壳层组件，不混用裸 `View` 和随意风格。

### terminal-console

职责：

1. 提供终端激活页。
2. 提供终端摘要页。
3. 对外暴露稳定的终端 screen part 和导航意图。

规则：

1. `terminal-console` 只表达终端接入状态，不承接欢迎页、品牌页等 integration 级页面切换。
2. 激活页显式使用虚拟激活码键盘。
3. 摘要页只展示终端状态、设备信息、凭证摘要等基础上下文。

## 测试标准

每个 UI base 包必须同时具备三层验证：

1. `type-check`
2. `test`
3. `test-expo`

### test

`test/` 至少分三类：

1. headless 语义测试
2. rendered 组件测试
3. 真实联调测试

规则：

1. headless 测试验证 hook、selector、command intent。
2. rendered 测试验证 screen/component 的结构、状态映射和稳定测试节点。
3. 真实联调测试必须直接打到真实 mock server，不允许 UI 层伪造成功。
4. 对虚拟键盘输入的 rendered/live/assembly 测试，必须逐键点击 `ui-base-virtual-keyboard:key:*`；不允许用 `ui.setValue` 或测试 renderer 的 `changeText` 绕过。
5. 对用户可见行为的 rendered 测试，优先通过共享 automation runtime 发起查询、动作和等待，而不是只断言内部 props。
6. 新测试默认要能迁移到 assembly / Expo / Android 真机同一套协议上，避免形成只能在单测里使用的私有 helper 语义。

当前实践：

1. `terminal-console` 的 live 测试直接使用 `0-mock-server/mock-terminal-platform`。
2. 激活成功后，直接验证 TCP identity state 已进入 `ACTIVATED`。

### test-expo

`test-expo/` 是每个包的真实页面自动化壳。

统一结构：

1. `index.ts`
2. `test-expo/App.tsx`
3. `test-expo/*ExpoShell.tsx`
4. `test-expo/runAutomation.mjs`
5. `test-expo/tsconfig.json`
6. `test-expo/README.md`

规则：

1. `runAutomation.mjs` 必须自己起 Expo Web。
2. 端口冲突必须显式识别，不能误连到别的包页面。
3. 浏览器自动化优先通过共享 automation runtime + 稳定节点操作，而不是直接耦合 DOM 结构。
4. 真实后端联调时，由 Node 侧先准备 mock server，再把 URL 传给 Expo 页面。

当前实践：

1. `input-runtime` 验证系统输入、虚拟 PIN、金额、激活码键盘。
2. `admin-console` 验证管理员登录、多击唤起、tab 切换和代表性 section。
3. `terminal-console` 验证真实激活码读取、虚拟键盘输入、终端激活成功和摘要页更新。

## 开发建议

后续继续新增 `2-ui/2.1-base` 包时，默认遵守以下做法：

1. 先定义包职责，再决定 screen part、hook、support 的边界。
2. 不要把 integration 级判断提前塞进 base 包。
3. 先保证 `src/index.ts` 的导出简短清晰，再开始加实现。
4. 避免 barrel 循环依赖，screen、support、foundations 之间优先单文件直连。
5. 任何“真实成功”的 UI，都至少要有一条真实 mock server 测试闭环。
