# Communication 包实现状态

## 目标

建立一套全新的 HTTP + WS 通信基础设施模型，独立于旧 `Api` / `ApiManager` / `kernel-ws` / `master-ws` 接口模型，为后续业务包迁移提供承接点。

## 明确原则

- 完全新接口模型
- 不混用旧 `ApiManager` 类型
- 不修改旧包代码
- 先做新基座，再逐步追平并超越旧体系

## 已实现能力

### HTTP 契约层

- `HttpEndpointDefinition`
- `defineHttpEndpoint`
- `path/query/body/headers` 结构化输入模型
- `CommunicationMeta` 元数据模型
- `PathTemplate.compilePath`
- `PathTemplate.matchPath`
- `buildHttpUrl`

### HTTP 执行层

- `HttpTransport` 抽象
- `AxiosHttpTransport`
- `HttpClient.call()`
- 基础 failover + retry
- `AbortSignal` 取消
- `InMemoryHttpMetricsRecorder`
- `HttpTransportError`
- `HttpBusinessError`
- service-first HTTP runtime / registry 门面

### WS 契约层

- `SocketConnectionProfile`
- `defineSocketProfile`
- `handshake/messages/meta` 结构化模型
- `buildSocketUrl`
- `SocketEventType` / `SocketEvent`

### WS 执行层

- `BaseSocketClient`
- `BaseEventManager`
- `BaseHeartbeatManager`
- `SocketConnectionState`
- `SocketConnectionError`
- 基础连接解析与 URL 构造
- 基础消息队列、状态流转与事件派发
- 通用 session/bootstrap 编排骨架
- 基于断开原因的 refresh + reconnect 策略
- 基于消息与 predicate 的 refresh policy 扩展
- 基础 WS metrics / tracing / hooks

### 共享基础设施

- `ServerResolver`
- `CommunicationServerConfig`
- `TraceContext`
- `CommunicationError`

### 演示验证

- `dev/http-endpoint-demo.ts`
- `dev/socket-profile-demo.ts`
- `dev/index.ts`
- `dev/test-ws-session-orchestrator.ts`
- `dev/test-ws-session-refresh.ts`
- `dev/test-ws-observability.ts`
- `dev/test-ws-refresh-policy.ts`
- `dev/test-http-service-registry.ts`

## 尚未实现能力

### HTTP

- request queue / 限流
- interceptor 体系
- envelope 多模式解包策略
- 与旧 server-space 直接桥接
- 自动 service 装配与模块生命周期管理

### WS

- bootstrap 失败后的细粒度恢复策略
- close code / 状态码 / 更复杂事件源的刷新策略
- `kernel-ws` / `master-ws` 迁移适配层
- 更丰富的 WS metrics 聚合与 tracing 扩展

## 当前已优于旧 ApiManager 的点

- 动态路径模板是内建能力，不再靠字符串拼接
- `path/query/body/headers` 显式拆分，语义更清晰
- HTTP 与 WS 在统一通信视角下设计，但协议边界清晰
- WS 不再借用 HTTP `Api` 抽象
- 新命名更准确：endpoint / profile / client / resolver
- 后续迁移路径更自然，适合 Monorepo 分层演进

## 当前仍弱于旧 ApiManager 的点

- 运行时执行策略还未达到旧 `ApiManager` 的完整成熟度
- 仍缺少限流与更细的 server 选择策略
- WS 已进入共享骨架阶段，但还未达到旧 `kernel-ws` / `master-ws` 的完整生产能力

## 结论

这个包当前是“新基座第一期”，不是旧系统的 1:1 完整替代。

但从抽象完整性和迁移友好性来说，它已经为后续做出比 `ApiManager` 更优秀的体系打下了正确基础。

## 本轮新增验证结论

- 已新增 `communication-test` 的 session/bootstrap 场景
- 已通过真实 HTTP + WS 集成测试验证 `SocketConnectionOrchestrator`
- 已通过 session 过期场景验证自动刷新续连能力
- 已通过真实 WS 场景验证 metrics / tracing / hooks
- 已通过消息触发与 predicate 触发验证 refresh policy 扩展
- 已通过 service-first registry 用法验证 HTTP 易用门面
- 已修复 `BaseSocketClient` 在 `CONNECTING` 阶段错误直发消息的问题，现统一先入队后 flush
- 已修复测试服务的多路 WS upgrade 路由，真实客户端握手正常
