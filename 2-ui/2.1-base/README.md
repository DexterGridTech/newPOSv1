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

## 包职责

### input-runtime

职责：

1. 定义统一输入模型。
2. 管理系统键盘和虚拟键盘的切换。
3. 提供 `InputField`、`VirtualKeyboardOverlay`、`InputRuntimeProvider` 等基础组件。

规则：

1. 程序显式指定虚拟键盘时，必须走虚拟键盘。
2. 程序未指定时，默认走系统键盘。
3. 输入状态不直接承担业务编排职责。

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
3. 浏览器自动化优先通过 `data-testid` 操作。
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
