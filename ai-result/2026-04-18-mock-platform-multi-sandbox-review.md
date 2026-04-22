# mock-terminal-platform Multi-Sandbox 设计审查

日期：2026-04-18
审查对象：`docs/superpowers/specs/2026-04-18-mock-platform-multi-sandbox-design.md`

---

## 问题汇总

| 优先级 | 编号 | 问题 |
|--------|------|------|
| 必须修复 | 问题 1 | WebSocket token 验证缺少 sandbox 归属校验的具体时机说明 |
| 必须修复 | 问题 2 | `tcpSandbox` 状态不同步，但 TDP 依赖它，存在跨进程/跨屏读取失效风险 |
| 必须修复 | 问题 3 | `setSandboxContext` 命令清理范围不完整，cursor 重置语义不明确 |
| 应该修复 | 问题 4 | HTTP 规则中 GET 用 query 传 sandboxId，存在日志/代理泄露风险 |
| 应该修复 | 问题 5 | 迁移顺序第 3 步和第 4 步存在窗口期，会导致 admin web 短暂失效 |
| 应该修复 | 问题 6 | 多 sandbox 隔离测试只覆盖 TDP，缺少 TCP command 跨 sandbox 隔离验证 |
| 需要确认 | 问题 7 | `sandboxId` 在 token/refreshToken 中是否已编码，影响 refresh 校验设计 |
| 需要确认 | 问题 8 | `tcpSandbox` 的 `selectedAt` 字段用途未定义，可能成为死字段 |

---

## 详细说明

### 问题 1：WebSocket token 验证缺少 sandbox 归属校验的具体时机说明（必须修复）

**位置**：Server Architecture 第 4 节，TDP WebSocket 部分

设计要求：
> terminal and token must belong to that sandbox

但没有说明这个校验在哪一层做、什么时机做。

当前 TDP WebSocket 握手流程是：
1. 建立连接（query 携带 sandboxId、terminalId、token）
2. 收到 HANDSHAKE 消息（data 携带 sandboxId、terminalId）
3. 校验 query 和 handshake 的 sandboxId 一致

**问题**：token 的 sandbox 归属校验应该在步骤 1 还是步骤 3？如果在步骤 1 就校验，需要在 HTTP upgrade 阶段解析 token；如果在步骤 3 才校验，连接已经建立，攻击者可以用 sandbox A 的 token 连接 sandbox B 的 terminalId，只是最终被拒绝，但连接资源已经消耗。

**建议**：明确规定 token 的 sandbox 归属校验必须在 HANDSHAKE 处理阶段完成，并且校验顺序为：
1. query sandboxId 存在
2. handshake sandboxId 存在且与 query 一致
3. token 解析出的 terminalId 与 handshake terminalId 一致
4. token 解析出的 sandboxId 与 handshake sandboxId 一致

任何一步失败立即关闭连接并返回对应错误码。

---

### 问题 2：tcpSandbox 不同步，但 TDP 依赖它，双屏场景存在读取失效风险（必须修复）

**位置**：Client Runtime Design，`tcp-control-runtime-v2` 和 `tdp-sync-runtime-v2` 部分

设计明确说：
> do not sync it（tcpSandbox 不同步）
> TDP reads sandbox ID from TCP sandbox state

**问题**：本项目是双屏双进程架构（primary/secondary 各自独立 JS runtime）。如果 `tcpSandbox` 不同步，secondary 进程的 TDP 无法从 primary 进程的 TCP sandbox state 读取 sandboxId。

两种可能的后果：
1. secondary 进程的 TDP 连接时 sandboxId 为空，被服务端拒绝
2. secondary 进程需要独立维护自己的 sandboxId，但设计没有说明来源

**建议**：明确 `tcpSandbox` 的同步策略：
- 如果双屏共享同一个 sandboxId（同一个激活环境），则 `tcpSandbox` 应该通过 topology sync 同步到 secondary，或者 secondary 从 primary 读取
- 如果双屏可以属于不同 sandbox（不太可能但需要排除），则需要各自独立激活

这个问题在 Non-goals 中没有被排除，需要在设计中明确。

---

### 问题 3：setSandboxContext 命令清理范围不完整，cursor 重置语义不明确（必须修复）

**位置**：Client Runtime Design，Optional explicit sandbox switch command 部分

设计说 `setSandboxContext` 应该：
1. 更新持久化 sandboxId
2. 清理旧 sandbox 的 terminal identity、credential、binding
3. 重置 TDP session runtime 和 sync cursor
4. 进入"sandbox selected, terminal not activated"状态

**问题 1**：清理范围缺少 task 相关状态。如果当前有 in-flight task（任务执行中），切换 sandbox 时这些 task 的状态如何处理？直接丢弃还是等待完成？

**问题 2**：`reset TDP runtime state and sync cursor` 的语义不明确。cursor 是 TDP 增量同步的位置指针，重置 cursor 意味着下次连接会从头全量同步。但如果新 sandbox 的 TDP 从未连接过，cursor 本来就是空的，这里的"重置"是否包括清除旧 sandbox 的 cursor 持久化记录？

**建议**：
1. 明确 `setSandboxContext` 是否需要等待 in-flight task 完成，或者强制中断
2. 明确 cursor 重置的范围：清除当前 sandbox 的 cursor，还是清除所有 sandbox 的 cursor

---

### 问题 4：GET 接口用 query 传 sandboxId 存在泄露风险（应该修复）

**位置**：API Contract，HTTP rules 部分

设计规定：
> GET APIs carry sandboxId in query

**问题**：`sandboxId` 出现在 URL query string 中，会被：
1. 服务器访问日志记录
2. 浏览器历史记录保存
3. HTTP 代理/CDN 日志记录
4. Referer header 携带到第三方

虽然这是 mock 平台（内部工具），但如果 sandboxId 本身携带业务语义（如客户编号、门店编号），这个设计会带来信息泄露风险。

**建议**：对于 mock 平台内部使用场景，这个风险可以接受，但需要在设计中明确说明这是有意识的权衡，而不是遗漏。如果未来 sandboxId 携带敏感语义，应改为通过自定义 header（如 `X-Sandbox-Id`）传递。

---

### 问题 5：迁移顺序第 3 步和第 4 步存在窗口期（应该修复）

**位置**：Migration Plan 部分

迁移顺序：
1. 重构 server services 接受显式 sandboxId
2. 重构 WebSocket session registry
3. **修改 server HTTP/WS 协议要求显式 sandboxId**
4. **更新 admin web API client 注入显式 sandboxId**

**问题**：步骤 3 完成后，server 开始强制要求 sandboxId；但步骤 4 还没完成，admin web 还在发送不带 sandboxId 的请求。这个窗口期内 admin web 会完全不可用。

**建议**：两种方案选一：
1. 步骤 3 和步骤 4 合并为一个原子发布，同时上线
2. 步骤 3 先做成"有 sandboxId 用显式值，没有 sandboxId 降级到 current sandbox"的兼容模式，等步骤 4 完成后再移除降级逻辑

方案 2 与设计原则有冲突（设计明确要求不允许 fallback），所以推荐方案 1。

---

### 问题 6：多 sandbox 隔离测试缺少 TCP command 跨 sandbox 隔离验证（应该修复）

**位置**：Test Strategy，Multi-sandbox isolation tests 部分

设计的隔离测试场景：
1. 创建 sandbox A 和 B
2. 各自激活客户端
3. 同时连接 TDP
4. 发布相同 topic/item 结构但不同 payload
5. 验证各自只收到自己的数据

**问题**：这个测试只覆盖了 TDP 推送隔离，没有覆盖 TCP command 的 sandbox 隔离。例如：
- sandbox A 的客户端发送 `reportTaskResult`，是否可能影响 sandbox B 的 task 状态？
- sandbox A 的管理员调用 `force-close session`，是否可能关闭 sandbox B 的 session？

这些是 in-memory routing 隔离（问题 1 提到的风险）的直接验证场景。

**建议**：补充一个 TCP command 跨 sandbox 隔离测试：
1. sandbox A 和 B 各有一个激活的 terminal
2. 用 sandbox A 的 admin token 尝试对 sandbox B 的 terminalId 执行 force-close
3. 验证服务端返回 `SANDBOX_TERMINAL_MISMATCH` 而不是成功执行

---

### 问题 7：sandboxId 是否已编码在 token 中，影响 refresh 校验设计（需要确认）

**位置**：Server API Changes，`POST /api/v1/terminals/token/refresh` 部分

设计说：
> Validation must confirm the credential belongs to a terminal in the same sandbox

**问题**：这个校验依赖于 token 本身携带 sandboxId 信息（如 JWT payload 中包含 sandboxId），还是依赖数据库查询（通过 refreshToken 查到 terminal，再查 terminal 的 sandboxId）？

如果是前者，token 格式需要变更，存量 token 会失效，需要迁移策略。
如果是后者，校验逻辑更重，但不需要 token 格式变更。

这个选择会影响 `RefreshTerminalCredentialApiRequest` 的实现复杂度，设计中没有说明。

**建议**：明确 token 的 sandbox 归属校验方式，并在迁移计划中说明存量 token 的处理策略。

---

### 问题 8：tcpSandbox.selectedAt 字段用途未定义（需要确认）

**位置**：Client Runtime Design，`tcp-control-runtime-v2` 部分

设计建议的状态结构：

```ts
type TcpSandboxState = {
  sandboxId?: string
  selectedAt?: number
}
```

**问题**：`selectedAt` 是时间戳，但设计中没有任何地方说明它的用途。可能的用途包括：
1. 用于 UI 显示"上次切换时间"
2. 用于判断 sandbox 选择是否过期（但设计没有提到过期逻辑）
3. 用于 debug/trace

如果没有明确用途，这个字段会成为死字段，增加维护负担。

**建议**：要么明确 `selectedAt` 的用途，要么从第一版设计中移除，等有明确需求时再加。

---

## 总体评价

设计整体方向正确，核心思路（从 server-global current sandbox 改为 request-explicit sandboxId）清晰，架构边界划分合理。

主要问题集中在两个方面：

1. **双屏场景的 sandboxId 同步路径没有说清楚**（问题 2），这是本项目特有的复杂度，通用设计文档容易遗漏。

2. **迁移窗口期的兼容性处理**（问题 5）需要在执行前明确，否则会有一段时间 admin web 完全不可用。

其余问题相对独立，不影响整体架构，可以在实现阶段逐一处理。
