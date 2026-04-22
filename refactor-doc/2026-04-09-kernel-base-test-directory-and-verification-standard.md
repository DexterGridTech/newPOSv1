# 1-kernel/1.1-base 测试目录与验证规范

## 1. 文档目标

本文档用于为 `1-kernel/1.1-base/*` 建立统一的正式测试规范。

本规范用于替代“把验证入口当作临时 `dev` 脚本”的做法。

后续 `1-kernel/1.1-base/*` 中：

1. 正式验证目录统一使用 `test/`
2. `test/` 等同于正式测试，而不是开发临时脚本
3. 允许按场景拆分多个测试文件、辅助 worker、fixture、mock
4. 允许引入专业测试工具包，只要它们真正提升测试质量

---

## 2. 总体结论

`1-kernel/1.1-base/*` 后续不再把核心验证目录视为“调试脚本目录”。

统一规则调整为：

1. 包级正式验证目录命名为 `test/`
2. 包级脚本统一优先提供 `test`
3. 若需要保留 `dev`，只能作为人工联调入口，不再承担正式验收职责

也就是说：

1. `test` 是正式验收入口
2. `dev` 如果存在，只是辅助联调，不是质量门槛

---

## 3. 为什么要从 `dev` 切到 `test`

原因很明确：

1. `dev` 容易被理解成“跑一下看看”的脚本。
2. 当前基础包重构需要的是稳定、可重复、可扩展、可纳入流水线的验证。
3. 仓库根已经有 `turbo run test`，说明仓库天然接受 `test` 作为正式入口。
4. 用户已经明确要求测试要规范、全面、有价值，而不是只有一个 `index.ts`。

因此对 `1-kernel/1.1-base/*` 而言：

1. `test` 比 `dev` 更符合真实语义。
2. `test/` 应成为正式结构的一部分。

---

## 4. 目录规范

`1-kernel/1.1-base/*` 后续统一采用下面结构：

```text
test/
  index.ts
  scenarios/
  fixtures/
  workers/
  helpers/
```

最小要求：

1. `test/index.ts` 作为包级统一测试入口
2. 复杂包允许按场景拆分多个 `test/scenarios/*.ts`
3. 多进程、多节点、多阶段验证允许使用 `test/workers/*.ts`
4. 可复用假实现、fixture、结果解析器放在 `test/fixtures` 或 `test/helpers`

不是每个包都必须拥有全部子目录，但结构语言要统一。

---

## 5. 工具规范

原则是“以价值为准”，不是“必须轻量到只剩 tsx”。

允许做法：

1. 继续用 `tsx` 运行集成场景
2. 引入 `vitest` 做单元测试和断言组织
3. 复杂场景里混合使用：
   1. `vitest` 承担断言组织
   2. `tsx` worker 承担多进程场景执行

推荐结论：

1. `1-kernel/1.1-base/*` 优先采用 `vitest + tsx`
2. `vitest` 负责正式测试编排和断言
3. `tsx` 只用于启动独立 worker 或真实进程

不建议：

1. 继续把所有验证都堆在单个 `dev/index.ts`
2. 只依赖 `console.log + throw` 维持长期测试体系

---

## 6. 验证分层规范

后续基础包测试至少按下面三层思考：

### 6.1 contract 层

验证：

1. 类型和 helper 是否满足声明式 contract
2. 纯函数和纯转换是否稳定

适合：

1. `vitest` 单测

### 6.2 runtime 层

验证：

1. runtime 入口是否正确装配
2. 生命周期、状态机、事件流是否正确
3. selector / projection / catalog 是否可读

适合：

1. `vitest` 集成测试
2. 必要时包内 fake adapter

### 6.3 process / topology 层

验证：

1. 多进程
2. 重启恢复
3. 双节点协同
4. 真实落盘

适合：

1. `test/index.ts`
2. `tsx` worker
3. 文件型 result/summary

补充强制规则：

1. 只要测试目标涉及双屏通讯、主副机通讯、resume、state sync、remote command relay，就必须真实启用 `0-mock-server/dual-topology-host`。
2. 不允许在这类测试里自建临时 WS server 替代 host shell。
3. 不允许只测纯内存消息转发就宣称通过双机通讯验证。
4. `host-runtime` 可以继续保留不经网络的核心逻辑测试，但凡验证“通讯闭环”，就必须把 `dual-topology-host` 拉起来。

---

## 7. 与现有方法论文档的关系

现有 `spec/kernel-core-dev-methodology.md` 与 `spec/kernel-core-ui-runtime-dev-methodology.md` 中大量方法本身仍然有效，尤其是：

1. 真实重启验证
2. 双进程验证
3. selector/state 语义优先
4. 结果文件与摘要校验

但在 `1-kernel/1.1-base/*` 中，后续应把这些方法迁移到 `test/` 语义下，而不是继续绑定到 `dev/` 命名。

也就是说：

1. 方法论保留
2. 目录语义升级

---

## 8. 脚本规范

后续 `1-kernel/1.1-base/*/package.json` 应优先包含：

```json
{
  "scripts": {
    "type-check": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:scenario": "tsx ./test/index.ts"
  }
}
```

说明：

1. `test` 是正式测试入口
2. `test:watch` 用于本地迭代
3. `test:scenario` 用于需要独立进程、重启恢复、双机协同的测试总入口
4. 只要包使用 `vitest`，就必须提供包级 `vitest.config.ts`
5. 包级 `vitest.config.ts` 必须通过仓库根的 `vitest.base.config.ts` 统一生成
6. `cacheDir` 必须统一落到仓库根 `node_modules/.vite/vitest/<workspace-name>`
7. 禁止让 `vitest` 在子包目录生成 `node_modules/.vite` 或其他测试缓存目录

如果某个包暂时没有 `vitest` 单测，也至少应提供：

1. `test:scenario`
2. `test`

其中 `test` 可以先代理到 `test:scenario`，但命名必须统一到 `test`

---

## 9. 推广策略

本轮不要求立刻把整个仓库所有老包全量改名。

当前执行策略：

1. 从 `1-kernel/1.1-base/*` 开始采用新规范
2. `transport-runtime` 作为第一批按新规范落地的包
3. 其余 `contracts / definition-registry / platform-ports / execution-runtime / topology-runtime / runtime-shell` 后续补切到 `test/`
4. 老 `_old_/1-kernel/1.1-cores/*` 暂不强制改名，但其有效方法会逐步迁移

---

## 10. 当前结论

从现在开始：

1. `1-kernel/1.1-base/*` 中所有 HTTP 服务测试，统一通过 `@impos2/kernel-server-config-v2` 提供 serverName 与地址定义。
2. HTTP 测试里禁止再手写 `servers: [{serverName, addresses}]` 这类本地地址数组。
3. HTTP 测试必须覆盖三类核心语义：
4. 地址切换：前序地址失败后能切到后续地址。
5. 失败重试：同一请求在策略允许范围内继续重试。
6. 有效地址保持：找到有效地址后，后续请求优先命中该地址；只有显式替换 server 配置后才重置偏好。

1. `1-kernel/1.1-base/*` 的正式验证目录标准名为 `test/`
2. 可以多文件、多场景、多 worker
3. 可以引入专业测试工具
4. 测试目标是正式验收，而不是开发时顺手跑的脚本
5. 所有双屏通讯相关测试统一走 `0-mock-server/dual-topology-host`
6. `1-kernel/1.1-base/*` 子包内不应再出现测试工具生成的 `node_modules/.vite` 缓存目录
