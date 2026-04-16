# UI Base Three Packages Closure Plan

目标：先完整收口 `2-ui/2.1-base/input-runtime`、`2-ui/2.1-base/admin-console`、`2-ui/2.1-base/terminal-console`，形成统一的开发、设计、测试标准；`retail-shell` 后置。

## 统一标准

1. 生产代码只放在 `src/`，保持纯 React Native，不引入 Expo。
2. 每个包都必须同时具备三层验证：
   1. `test/` 里的 headless 语义测试
   2. `test/` 里的 rendered 组件测试
   3. `test-expo/` 里的 Expo Web 自动化测试
3. `test-expo/` 只能作为测试壳，不得污染生产导出。
4. UI 组件只负责渲染状态和发出意图，不承接跨模块业务编排。
5. 页面设计允许有明显风格，但必须保持：
   1. 主信息层级清晰
   2. 桌面和窄屏都可读
   3. 测试节点稳定
6. 真实联调优先：
   1. `terminal-console` 使用 `0-mock-server/mock-terminal-platform`
   2. `admin-console` 先完成本包内宿主工具和登录工作台闭环
   3. `retail-shell` 再承担完整业务环路闭环

## input-runtime

### 要补齐

1. 真正的 `InputRuntimeProvider`，管理虚拟键盘活动输入上下文。
2. `InputField` 区分：
   1. 显式 virtual 模式走虚拟键盘
   2. 默认 system 模式走系统键盘
3. `VirtualKeyboardOverlay` 不再只是静态按钮，要能驱动当前活动输入。
4. 为 number / pin / amount / activation-code 形成可复用键盘布局。
5. 补充 Expo 壳，验证：
   1. system 输入
   2. virtual PIN
   3. virtual amount
   4. overlay 开关和按键生效

### 不做

1. 不把输入状态写进 Redux。
2. 不做和业务模块耦合的表单编排。

## admin-console

### 要补齐

1. 管理员登录页与工作台页做成清晰的两段式 UI。
2. Section 统一使用一致的壳层，不再有一半是裸 `View` 一半是 section shell。
3. 登录、tab、宿主工具、适配器测试要有完整渲染与交互链路。
4. Expo 壳至少覆盖：
   1. 左上角多击唤起
   2. 动态密码登录
   3. tab 切换
   4. 设备 / 日志 / 控制 / 连接器 / 适配器测试几个代表性 section

### 不做

1. 不在 `admin-console` 内部做终端注销后的全局恢复编排。
2. 不把 integration 级欢迎页/激活页切换逻辑塞到这里。

## terminal-console

### 要补齐

1. 激活页和摘要页做成完整可用的终端 UI，而不是占位文本。
2. headless 测试覆盖：
   1. 激活 hook
   2. screen definitions
   3. navigation helper
3. rendered 测试覆盖激活页和摘要页。
4. Expo 壳接真实 `mock-terminal-platform`，验证：
   1. 启动
   2. 真实 activation code 激活
   3. 激活成功后的 terminal summary

### 不做

1. 不在 `terminal-console` 本包里承接 integration 级欢迎页跳转。
2. 不为了测试通过而把业务 actor 逻辑搬进 screen。

## 输出物

1. 三个包都具备统一 `test-expo/` 目录结构与脚本。
2. `2-ui/2.1-base/README.md` 补充这三个包的开发与测试标准。
3. 三个包的 `package.json` 都补齐 `test-expo` 相关脚本。
4. 三个包全部通过：
   1. `type-check`
   2. `test`
   3. `test-expo`
