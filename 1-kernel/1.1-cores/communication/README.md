# @impos2/kernel-core-communication

全新通信基础设施包，独立于现有 `ApiManager` / `Api` / `kernel-ws` / `master-ws` 旧模型。

## 设计目标

- 为 HTTP 与 WS 提供统一的通信契约视角
- 为 HTTP 提供结构化 endpoint 定义：`path/query/body/headers`
- 为 WS 提供连接 profile 定义：`handshake/messages/meta`
- 彻底避免复用旧 `Api` 与 `ApiManager` 的接口模型，降低后续迁移心智负担

## 已实现能力

### HTTP

- `HttpEndpointDefinition`
- `defineHttpEndpoint`
- `PathTemplate.compilePath`
- `PathTemplate.matchPath`
- `buildHttpUrl`
- `HttpClient`
- `AxiosHttpTransport`
- `HttpRuntime`
- `HttpServiceRegistry`
- `defineHttpServiceModule`
- `InMemoryHttpMetricsRecorder`
- `ServerResolver`
- `HttpTransportError`
- `HttpBusinessError`
- service-first HTTP runtime / registry 门面
- 基础 failover + retry 执行
- `AbortSignal` 取消语义

### WS

- `SocketConnectionProfile`
- `defineSocketProfile`
- `buildSocketUrl`
- `BaseEventManager`
- `BaseHeartbeatManager`
- `BaseSocketClient`
- `SocketConnectionState`
- `SocketConnectionError`
- 基础消息队列与事件派发
- `SocketConnectionOrchestrator`
- `SocketBootstrapProvider` / `SocketSessionDescriptor`
- 基于断开原因的自动刷新续连
- `refreshOnMessage` / `refreshPredicate` 扩展策略
- `InMemorySocketMetricsRecorder`
- WS trace 注入与 hooks
- 共享 `ServerResolver`

### 共享基础

- `CommunicationMeta`
- `TraceContext`
- `CommunicationServerConfig`
- 新的错误模型与类型模型

## 尚未实现能力

### HTTP

- envelope 自动适配多种服务端格式
- 与旧 `ApiManager` 的兼容桥接
- 更高层的模块装配辅助（自动 wiring / 生命周期）

### WS

- 可插拔的多阶段 bootstrap pipeline
- close code / 状态码驱动的 refresh policy
- `master-ws` / `kernel-ws` 统一迁移适配器
- 更丰富的 WS metrics 聚合与导出

## 当前定位

这是一个 **新基座**，不是旧系统的 1:1 克隆。

它的第一阶段目标是：

- 奠定新的接口模型
- 证明 HTTP / WS 的统一设计方向可行
- 解决旧模型的动态路径表达问题
- 为后续迁移 terminal / interconnection 提供基础设施承接点

## 目标状态

后续持续演进后，目标是整体能力超过旧 `ApiManager`：

- 描述能力更强
- HTTP / WS 边界更清晰
- 动态路径与结构化请求更自然
- 更适合 Monorepo 分层迁移

## HTTP 开发指南

本节重点讲 **HTTP**，即在不同模块中应该如何基于 `communication` 调用服务、组织参数、接入当前工程的 `ServerSpace`、增加拦截器、处理错误、记录 metrics。

### 一、核心概念

HTTP 侧建议分成 4 层理解：

1. **Endpoint 定义层**
   - 用 `defineHttpEndpoint()` 描述一个 HTTP 契约
   - 这里只表达：请求方法、路径模板、参数结构、响应结构

2. **Client 执行层**
   - 用 `HttpClient` 真正执行请求
   - 负责 retry、failover、cancel、metrics、execution policy

3. **Runtime 运行时层**
   - 用 `HttpRuntime` 包装 `ServerResolver + AxiosHttpTransport + HttpClient`
   - 目的是隐藏底层初始化细节

4. **Service 门面层**
   - 用 `defineHttpServiceModule()` + 手写 service methods
   - 业务模块主要应该只面对这一层

### 二、推荐的接入方式

当前推荐的 HTTP 接入方式有 3 种：

#### 1. 低层方式：直接 `HttpClient.call()`

适用场景：

- 做基础设施验证
- 调试 `endpoint`
- 写底层测试
- 暂时还没抽象到 service 层

示例：

```ts
import {
  AxiosHttpTransport,
  defineHttpEndpoint,
  HttpClient,
  ServerResolver,
  typed,
} from '@impos2/kernel-core-communication'

const serverResolver = new ServerResolver()
serverResolver.registerServer({
  serverName: 'demoHttp',
  addresses: [
    {
      addressName: 'local',
      baseURL: 'http://localhost:6190',
      timeout: 3000,
    },
  ],
})

const httpClient = new HttpClient(serverResolver, new AxiosHttpTransport(), {
  unwrapEnvelope: true,
})

const endpoint = defineHttpEndpoint<{deviceId: string}, void, {operatorId: string}, {activated: boolean}>({
  name: 'demo.device.activate',
  serverName: 'demoHttp',
  method: 'POST',
  pathTemplate: '/http/devices/{deviceId}/activate',
  request: {
    path: typed<{deviceId: string}>(),
    body: typed<{operatorId: string}>(),
  },
  response: typed<{activated: boolean}>(),
})

const result = await httpClient.call(endpoint, {
  path: {deviceId: 'D-1'},
  body: {operatorId: 'U-1'},
})
```

#### 2. 中层方式：使用 `HttpRuntime`

适用场景：

- 模块内部已有多条 HTTP 调用
- 不希望每个模块自己手工维护 `ServerResolver`
- 需要统一使用当前环境或 `ServerSpace`

示例：

```ts
import {
  defineHttpEndpoint,
  HttpRuntime,
  typed,
} from '@impos2/kernel-core-communication'

const runtime = new HttpRuntime({
  servers: [
    {
      serverName: 'demoHttp',
      addresses: [
        {
          addressName: 'local',
          baseURL: 'http://localhost:6190',
          timeout: 3000,
        },
      ],
    },
  ],
  unwrapEnvelope: true,
})

const endpoint = defineHttpEndpoint<void, void, {mobile: string}, Record<string, never>>({
  name: 'demo.sendVerifyCode',
  serverName: 'demoHttp',
  method: 'POST',
  pathTemplate: '/api/login/sendVerifyCode',
  request: {
    body: typed<{mobile: string}>(),
  },
  response: typed<Record<string, never>>(),
})

await runtime.call(endpoint, {
  body: {mobile: '13800000000'},
})
```

#### 3. 高层方式：service-first（推荐）

适用场景：

- 正式业务模块
- 多模块复用
- 希望业务代码只面对 `service.methods.xxx()`
- 希望后续迁移时统一风格

示例：

```ts
import {
  defineHttpEndpoint,
  defineHttpServiceModule,
  HttpRuntime,
  typed,
} from '@impos2/kernel-core-communication'

const runtime = new HttpRuntime({
  servers: [...],
  unwrapEnvelope: true,
})

const loginWithPasswordEndpoint = defineHttpEndpoint<void, void, LoginWithPasswordRequest, LoginResponse>({
  name: 'mixc.user.login.loginWithPassword',
  serverName: 'mixcUserApi',
  method: 'POST',
  pathTemplate: '/api/login/withPassword',
  request: {
    body: typed<LoginWithPasswordRequest>(),
  },
  response: typed<LoginResponse>(),
})

export const mixcUserLoginHttpServiceModule = defineHttpServiceModule('mixc-user-login', {
  auth: {
    loginWithPassword(request: LoginWithPasswordRequest) {
      return runtime.call(loginWithPasswordEndpoint, {body: request})
    },
  },
})

export const mixcUserLoginHttpServices = mixcUserLoginHttpServiceModule.services
```

最终业务层调用：

```ts
await mixcUserLoginHttpServices.auth.loginWithPassword({
  deviceId: '123',
  userName: 'boss',
  password: 'boss',
})
```

### 三、参数应该怎么传

`communication` 的 HTTP 参数输入统一是：

- `path`
- `query`
- `body`
- `headers`
- `context`

完整类型：

```ts
interface HttpCallInput<TPath, TQuery, TBody> {
  path?: TPath
  query?: TQuery
  body?: TBody
  headers?: Record<string, string>
  context?: CommunicationRequestContext
}
```

#### 1. `path`

用于路径模板占位符。

例如：

```ts
pathTemplate: '/api/device/{deviceId}/activate'
```

调用时：

```ts
await runtime.call(endpoint, {
  path: {
    deviceId: 'D-1',
  },
})
```

最终 URL：

```ts
/api/device/D-1/activate
```

#### 2. `query`

用于 URL 查询参数。

```ts
await runtime.call(endpoint, {
  query: {
    verbose: true,
    page: 1,
  },
})
```

最终 URL：

```ts
...?verbose=true&page=1
```

#### 3. `body`

用于 POST / PUT / PATCH 等请求体。

```ts
await runtime.call(endpoint, {
  body: {
    mobile: '13800000000',
    verifyCode: '123456',
  },
})
```

#### 4. `headers`

用于单次请求级别的请求头。

```ts
await runtime.call(endpoint, {
  headers: {
    Authorization: 'Bearer token-1',
    'x-tenant-id': 'tenant-A',
  },
})
```

#### 5. `context`

用于传递：

- `trace`
- `extraHeaders`
- `signal`

```ts
await runtime.call(endpoint, {
  body: {...},
  context: {
    trace: {
      traceId: 'trace-1',
      requestId: 'req-1',
      sessionId: 'session-1',
    },
    extraHeaders: {
      'x-trace-id': 'trace-1',
    },
    signal: abortController.signal,
  },
})
```

### 四、不同 HTTP 服务应该如何组织

推荐按“**模块 → 业务域对象 → 方法**”来组织。

例如 `mixc-user-login`：

```ts
mixcUserLoginHttpServices.auth.loginWithPassword(...)
mixcUserLoginHttpServices.auth.sendVerifyCode(...)
mixcUserLoginHttpServices.auth.loginWithMobile(...)
mixcUserLoginHttpServices.auth.logout(...)
```

例如 `terminal`：

```ts
terminalHttpServices.device.activate(...)
terminalHttpServices.device.deactivate(...)
terminalHttpServices.unitData.getByGroup(...)
```

不推荐：

```ts
services.call1()
services.call2()
services.foo()
services.bar()
```

因为这样无法表达业务域边界。

### 五、如何处理多服务器 / 多环境

`communication` 现在有 2 种方式接入服务器地址：

#### 1. 静态传 `servers`

适合：

- 独立测试
- mock server
- 小型 demo
- 不依赖工程环境的场景

```ts
const runtime = new HttpRuntime({
  servers: [
    {
      serverName: 'demoHttp',
      retryCount: 1,
      retryInterval: 100,
      addresses: [
        {
          addressName: 'local',
          baseURL: 'http://localhost:6190',
          timeout: 3000,
        },
      ],
    },
  ],
})
```

#### 2. 动态传 `serverConfigProvider`（推荐）

适合：

- 正式模块
- 需要跟随当前 `ServerSpace`
- 不希望在模块里写死 URL

示例：

```ts
import {getCommunicationServersFromStoreEntry, HttpRuntime} from '@impos2/kernel-core-communication'

const runtime = new HttpRuntime({
  serverConfigProvider: getCommunicationServersFromStoreEntry,
  unwrapEnvelope: true,
})
```

这样每次 `runtime.call()` 前，都会重新从当前 `storeEntry.getServerSpace()` 解析地址。

### 六、如何从旧 `ServerSpace` 接到新 HTTP 体系

当前工程里已经保留了旧的 `ServerSpace` 数据源，因此 `communication` 提供了：

- `mapServerSpaceToCommunicationServers()`
- `getCommunicationServersFromStoreEntry()`

#### 1. 直接从 `ServerSpace` 转换

```ts
import {mapServerSpaceToCommunicationServers} from '@impos2/kernel-core-communication'

const communicationServers = mapServerSpaceToCommunicationServers(serverSpace)
```

#### 2. 直接从 `storeEntry` 读取

```ts
import {getCommunicationServersFromStoreEntry} from '@impos2/kernel-core-communication'

const runtime = new HttpRuntime({
  serverConfigProvider: getCommunicationServersFromStoreEntry,
})
```

### 七、拦截器应该怎么加

拦截器加在 `AxiosHttpTransport` 上，而不是加在 `HttpClient` 上。

原因：

- `HttpClient` 负责策略和执行编排
- `AxiosHttpTransport` 负责底层 HTTP 请求
- 拦截器本质上属于 transport 层能力

#### 1. 请求拦截器

```ts
const runtime = new HttpRuntime({
  serverConfigProvider: getCommunicationServersFromStoreEntry,
  unwrapEnvelope: true,
})

const requestInterceptorId = runtime.transport.addRequestInterceptor(config => {
  config.headers = {
    ...config.headers,
    Authorization: 'Bearer token-1',
    'x-app-version': '1.0.0',
  }
  return config
})
```

#### 2. 响应拦截器

```ts
const responseInterceptorId = runtime.transport.addResponseInterceptor(response => {
  return response
})
```

#### 3. 移除拦截器

```ts
runtime.transport.removeRequestInterceptor(requestInterceptorId)
runtime.transport.removeResponseInterceptor(responseInterceptorId)
```

#### 4. 推荐的拦截器使用方式

- **全局固定请求头**：放请求拦截器
- **单次调用临时请求头**：放 `input.headers`
- **trace/requestId/sessionId**：优先放 `context.extraHeaders`
- **统一 token 注入**：放请求拦截器
- **统一错误上报**：放响应拦截器

### 八、错误处理怎么做

当前 HTTP 侧有两类核心错误：

#### 1. `HttpTransportError`

表示：

- 网络错误
- 超时
- 4xx / 5xx 状态错误
- 请求执行异常
- 取消

#### 2. `HttpBusinessError`

表示：

- 在 `unwrapEnvelope: true` 模式下
- 返回结构中 `code !== 'SUCCESS'`
- 被视为业务失败

#### 3. 推荐写法

service 层不建议吞错，actor / 用例层再做业务翻译：

```ts
try {
  const result = await mixcUserLoginHttpServices.auth.loginWithPassword(request)
  return result
} catch (error) {
  throw normalizeHttpError(error)
}
```

#### 4. `unwrapEnvelope: true` 的语义

当你明确服务端返回的是：

```ts
{
  code: 'SUCCESS',
  message: 'ok',
  data: {...}
}
```

则可开启：

```ts
const runtime = new HttpRuntime({
  serverConfigProvider: getCommunicationServersFromStoreEntry,
  unwrapEnvelope: true,
})
```

此时 service 拿到的是 `data` 本身，而不是整个 envelope。

### 九、取消请求怎么做

通过 `AbortController` + `context.signal`：

```ts
const controller = new AbortController()

const promise = runtime.call(endpoint, {
  body: {...},
  context: {
    signal: controller.signal,
  },
})

controller.abort('user cancelled')
```

当前取消会被转成 `HttpTransportError`。

### 十、retry / failover 怎么配置

#### 1. 服务级 retry

来自 `CommunicationServerConfig`：

```ts
{
  serverName: 'mixcUserApi',
  retryCount: 3,
  retryInterval: 1000,
  addresses: [...],
}
```

#### 2. endpoint 级覆盖

来自 `endpoint.meta.retry` 与 `endpoint.meta.timeoutMs`：

```ts
const endpoint = defineHttpEndpoint({
  ...,
  meta: {
    retry: 1,
    timeoutMs: 1500,
  },
})
```

优先级：

- endpoint.meta 覆盖地址级 timeout
- endpoint.meta.retry 覆盖 serverConfig.retryCount

#### 3. failover 行为

当前 `HttpClient` 会在：

- 同一轮中依次尝试当前服务的所有地址
- 若本轮全部失败，再根据 retry 配置进入下一轮

### 十一、queue / concurrency / rate limit 怎么配

当前这些能力已经在 `HttpExecutionController` 中实现。

#### 1. 并发限制

```ts
const runtime = new HttpRuntime({
  servers: [...],
  executionPolicy: {
    maxConcurrent: 1,
  },
})
```

#### 2. 客户端侧 rate limit

```ts
const runtime = new HttpRuntime({
  servers: [...],
  executionPolicy: {
    rateLimitWindowMs: 1000,
    rateLimitMaxRequests: 2,
  },
})
```

这适合：

- 防止某个模块短时间内狂发请求
- 做前端/客户端自我保护

### 十二、metrics 应该怎么接

#### 1. 创建 recorder

```ts
import {InMemoryHttpMetricsRecorder, HttpRuntime} from '@impos2/kernel-core-communication'

const metricsRecorder = new InMemoryHttpMetricsRecorder()

const runtime = new HttpRuntime({
  serverConfigProvider: getCommunicationServersFromStoreEntry,
  unwrapEnvelope: true,
  metricsRecorder,
})
```

#### 2. 获取结果

```ts
const calls = metricsRecorder.getCalls()
```

每条 `HttpCallMetric` 包含：

- `endpointName`
- `serverName`
- `method`
- `pathTemplate`
- `durationMs`
- `success`
- `attempts`

#### 3. 适用场景

- 调试 retry / failover 是否生效
- 做接口性能观察
- 做测试断言

### 十三、什么时候应该用 registry

`HttpServiceRegistry` 适用于：

- 你希望全工程统一拿 service
- 你希望以“模块”为粒度注册 service
- 你希望业务层只知道：
  - `registry.getModule('terminal')`
  - `registry.getModule('mixc-user-login')`

示例：

```ts
import {httpServiceRegistry} from '@impos2/kernel-core-communication'

httpServiceRegistry.registerModule('mixc-user-login', mixcUserLoginHttpServices)

const loginServices = httpServiceRegistry.getModule<KernelMixcUserLoginHttpServices>('mixc-user-login')
await loginServices.auth.loginWithPassword(request)
```

### 十四、推荐的模块内落地模板

推荐每个模块都按如下组织：

#### 1. `supports/http-services.ts`

- 创建 `HttpRuntime`
- 定义 endpoint
- 定义 service module
- 导出 service 实例

#### 2. `features/actors/*.ts`

- 不直接调用 `HttpClient`
- 不直接拼 path / query / headers
- 只调用 service methods
- 做业务状态处理和错误翻译

#### 3. `index.ts`

- 对外导出 `xxxHttpServices`

### 十五、推荐与不推荐

#### 推荐

- 业务模块使用 service-first
- endpoint 名称写成完整业务路径
- 一个模块一个 `supports/http-services.ts`
- 参数显式拆成 `path/query/body/headers/context`
- 正式模块通过 `serverConfigProvider` 接入 `ServerSpace`

#### 不推荐

- 在业务 actor 中直接创建 `ServerResolver`
- 在业务 actor 中直接创建 `AxiosHttpTransport`
- 在业务 actor 中直接拼 URL 字符串
- 在模块里写死正式 URL
- 把 token、trace、租户等全塞进 `body`

### 十六、常见坑

#### 1. 路径参数没拆到 `path`

错误：

```ts
body: {deviceId: 'D-1'}
```

正确：

```ts
path: {deviceId: 'D-1'}
```

#### 2. 把查询参数塞进 `body`

错误：

```ts
body: {page: 1, pageSize: 20}
```

正确：

```ts
query: {page: 1, pageSize: 20}
```

#### 3. 在正式模块里写死 URL

错误：

```ts
servers: [{serverName: 'mixcUserApi', addresses: [{baseURL: 'http://localhost:10001'}]}]
```

正确：

```ts
serverConfigProvider: getCommunicationServersFromStoreEntry
```

#### 4. 把 dev/mock 分支写进正式 service 方法

如果需要本地兜底逻辑，建议放在：

- actor 层的非生产环境分支
- dev/mock adapter

而不是直接污染正式 HTTP contract。

#### 5. 忘记 `unwrapEnvelope`

如果服务端返回 envelope，但 runtime 没开：

```ts
unwrapEnvelope: true
```

那么你拿到的会是整个 envelope，而不是 `data`。

### 十七、不同阶段怎么选接入方式

#### 初期验证

- 直接 `HttpClient.call()`

#### 模块内部稳定使用

- `HttpRuntime`

#### 正式业务模块

- `HttpRuntime + defineHttpServiceModule + service-first`

#### 全工程统一拿法

- 在 service-first 之上叠加 `HttpServiceRegistry`

### 十八、当前最推荐的标准姿势

对正式业务模块，当前最推荐的姿势是：

1. 在模块内建立 `supports/http-services.ts`
2. 用 `HttpRuntime({ serverConfigProvider: getCommunicationServersFromStoreEntry })`
3. 用 `defineHttpEndpoint()` 定义所有 HTTP 契约
4. 用 `defineHttpServiceModule()` 导出 service-first 方法
5. actor / use-case 只调用 service methods
6. 错误翻译留在 actor / 业务层完成

这就是当前 `mixc-user-login` 打样包采用的方式。


## WS 运行时注册指南

### 一、为什么要注册 `SocketRuntimeAdapter`

`communication` 包里的 WS 客户端核心是跨运行时设计：

- `BaseSocketClient` 负责状态机、消息队列、心跳、重连、hooks、metrics
- 具体“怎么创建 WebSocket 连接”由运行时决定

因此，`communication` 不直接写死：

- `new WebSocket(...)`
- `ws` 包
- React Native 全局 `WebSocket`

而是通过 `SocketRuntimeAdapter` 在集成层注册。

这意味着：

- Node、Web、React Native、Electron 可以共用同一套 WS 核心逻辑
- 平台差异留在集成层解决
- 业务模块不需要每次手传 `SocketFactory`

---

### 二、当前可用 API

现在可以直接从 `@impos2/kernel-core-communication` 使用：

- `registerSocketRuntimeAdapter`
- `getRegisteredSocketRuntimeAdapter`
- `requireRegisteredSocketRuntimeAdapter`
- `createRegisteredSocketFactory`
- `createRegisteredSocketClient`
- `createBasicSocketRuntimeAdapter`

源码位置：

- `src/foundations/adapters/wsRuntime.ts`

---

### 三、推荐在哪一层注册

推荐在最终运行时所在的集成层注册，例如：

- Android RN assembly 的启动阶段
- Electron assembly 的启动阶段
- Web debug 容器启动阶段
- Node mock / server / test 启动阶段

不推荐：

- 在业务模块内部注册
- 在 feature / actor 内注册
- 在每次建 client 时重复注册

推荐原则：

- 每个运行时启动时注册一次
- 后续所有 WS client 统一从注册器获取

---

### 四、最小注册示例

#### 1. Browser / React Native 风格

```ts
import {
  createBasicSocketRuntimeAdapter,
  registerSocketRuntimeAdapter,
  type SocketLike,
} from '@impos2/kernel-core-communication'

class DefaultWebSocketAdapter implements SocketLike {
  private readonly socket: WebSocket

  constructor(url: string) {
    this.socket = new WebSocket(url)
  }

  send(data: string): void {
    this.socket.send(data)
  }

  close(code?: number, reason?: string): void {
    this.socket.close(code, reason)
  }

  addEventListener(event: 'open' | 'close' | 'error' | 'message', listener: (...args: any[]) => void): void {
    this.socket.addEventListener(event as any, listener as any)
  }

  removeEventListener(event: 'open' | 'close' | 'error' | 'message', listener: (...args: any[]) => void): void {
    this.socket.removeEventListener(event as any, listener as any)
  }
}

registerSocketRuntimeAdapter(
  createBasicSocketRuntimeAdapter({
    runtimeName: 'react-native',
    supportsHeaders: false,
    socketCreator: (url: string) => new DefaultWebSocketAdapter(url),
  }),
)
```

说明：

- Web 标准 `WebSocket` 不支持自定义 headers
- React Native 的全局 `WebSocket` 也建议按“query/token 优先”使用
- 所以这类运行时注册时建议：`supportsHeaders: false`

---

#### 2. Node 风格

```ts
import {
  createBasicSocketRuntimeAdapter,
  registerSocketRuntimeAdapter,
  type SocketLike,
} from '@impos2/kernel-core-communication'

class NodeWebSocketAdapter implements SocketLike {
  private readonly socket: WebSocket
  private readonly listeners: Record<string, Set<(...args: any[]) => void>> = {
    open: new Set(),
    close: new Set(),
    error: new Set(),
    message: new Set(),
  }

  constructor(url: string) {
    this.socket = new WebSocket(url)
    this.socket.addEventListener('open', () => this.listeners.open.forEach(listener => listener()))
    this.socket.addEventListener('close', event => this.listeners.close.forEach(listener => listener({reason: event.reason})))
    this.socket.addEventListener('error', event => this.listeners.error.forEach(listener => listener(event)))
    this.socket.addEventListener('message', event => this.listeners.message.forEach(listener => listener({data: String(event.data)})))
  }

  send(data: string): void {
    this.socket.send(data)
  }

  close(code?: number, reason?: string): void {
    this.socket.close(code, reason)
  }

  addEventListener(event: 'open' | 'close' | 'error' | 'message', listener: (...args: any[]) => void): void {
    this.listeners[event].add(listener)
  }

  removeEventListener(event: 'open' | 'close' | 'error' | 'message', listener: (...args: any[]) => void): void {
    this.listeners[event].delete(listener)
  }
}

registerSocketRuntimeAdapter(
  createBasicSocketRuntimeAdapter({
    runtimeName: 'node',
    supportsHeaders: true,
    socketCreator: (url: string) => new NodeWebSocketAdapter(url),
  }),
)
```

说明：

- Node 运行时建议使用显式 adapter
- 不要把 Node 的具体 WS 实现写死进 `communication` 核心

---

### 五、注册后业务怎么拿 client

推荐用：

```ts
import {
  createRegisteredSocketClient,
  ServerResolver,
} from '@impos2/kernel-core-communication'

const serverResolver = new ServerResolver()
const socketClient = createRegisteredSocketClient(serverResolver, {
  metricsRecorder,
  traceExtractor,
  hooks,
})
```

这样可以保证：

- 业务层不关心当前是 Node / Web / RN / Electron
- 当前运行时差异都在 adapter 注册时解决

---

### 六、什么时候不要用注册器

以下场景可以不走全局注册器：

- 单元测试中想手动注入 mock factory
- 某个特定 dev case 想临时替换 socket 行为
- 一次性脚本只想显式控制 `SocketFactory`

这时仍然可以直接：

```ts
new BaseSocketClient(serverResolver, customSocketFactory, options)
```

也就是说：

- 注册器是推荐默认路径
- 不是强制唯一入口

---

### 七、当前推荐规则

1. `communication/ws` 负责通用 WS 核心能力
2. `communication/foundations/adapters/wsRuntime.ts` 负责运行时注册
3. 集成层负责注册 Node / Web / RN / Electron 的具体 adapter
4. 业务层优先使用 `createRegisteredSocketClient()`
5. 跨运行时握手统一优先使用 `query / token`，不要把自定义 headers 当成基础前提

---
## 本轮新增验证结论

- 已新增 `communication-test` 的 session/bootstrap 场景
- 已通过真实 HTTP + WS 集成测试验证 `SocketConnectionOrchestrator`
- 已通过 session 过期场景验证自动刷新续连能力
- 已通过真实 WS 场景验证 metrics / tracing / hooks
- 已通过消息触发与 predicate 触发验证 refresh policy 扩展
- 已通过 service-first registry 用法验证 HTTP 易用门面
- 已修复 `BaseSocketClient` 在 `CONNECTING` 阶段错误直发消息的问题，现统一先入队后 flush
- 已修复测试服务的多路 WS upgrade 路由，真实客户端握手正常
