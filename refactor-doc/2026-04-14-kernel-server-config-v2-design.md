# 2026-04-14 kernel-server-config-v2 设计

## 1. 定位

`_old_/1-kernel/server-config-v2` 是服务器配置包，不是 kernel module，也不是 runtime。

它只负责表达：

1. 服务器名称。
2. `1-kernel/1.1-base` 所需的服务器地址配置。
3. 将配置空间解析成 `transport-runtime` 可直接消费的 `TransportServerDefinition[]`。
4. 测试环境下的地址覆盖与 server 覆盖。

它不负责：

1. HTTP 请求执行。
2. WebSocket 连接执行。
3. 地址失败重试。
4. 有效地址记忆。
5. server space 持久化。
6. runtime 初始化。
7. 业务模块声明。

因此它不应该有 `moduleName`，也不应该暴露运行时 `packageVersion`。

`package.json.version` 只是 workspace 包元数据，不进入运行时协议。

---

## 2. 从旧包继承的正确点

旧 `_old_/1-kernel/server-config` 有几个值得继承的设计点：

1. serverName 是统一常量，不允许业务和测试到处手写散落字符串。
2. 服务器配置独立成包，不塞进 HTTP runtime 或业务模块。
3. 上层模块只关心 serverName，不关心地址列表来自哪里。

新包继续继承这些点，但不兼容旧 `server-config` 的完整服务器集合，也不复刻旧 `dev/product` 结构。

---

## 3. 当前包结构

```text
_old_/1-kernel/server-config-v2/
  package.json
  tsconfig.json
  src/
    index.ts
    serverName.ts
    test.ts
```

说明：

1. 不使用 `application / features / slices / selectors / hooks`。
2. 不生成 `src/moduleName.ts`。
3. 不生成 `src/generated/packageVersion.ts`。
4. 不引入 Redux。
5. 不引入 React。

原因是它不是模块，只是配置来源。

---

## 4. 核心配置类型

`src/test.ts` 内只保留当前配置对象需要的最小类型：

```ts
export interface KernelBaseServerConfig {
    readonly selectedSpace: string
    readonly spaces: readonly KernelBaseServerConfigSpace[]
}
```

`KernelBaseServerConfigSpace` 表达一个配置空间：

```ts
export interface KernelBaseServerConfigSpace {
    readonly name: string
    readonly servers: readonly TransportServerDefinition[]
}
```

`TransportServerDefinition` 直接来自 `@impos2/kernel-base-transport-runtime`。

这样做的原因：

1. `server-config-v2` 不重新定义传输层服务器结构。
2. `transport-runtime` 是地址执行方，服务器地址结构以它为准。
3. 配置包只提供数据，不增加额外转换模型。

---

## 5. 与测试解析逻辑的边界

`server-config-v2` 本身不再包含解析逻辑。

测试与联调场景下如果需要：

1. 选择配置空间。
2. 注入动态 baseUrl。
3. 覆盖地址列表。

这些逻辑统一放在：

`1-kernel/test-support/serverConfig.ts`

原因：

1. 这些是测试支撑能力，不是配置包职责。
2. 配置包保持纯对象后，不再需要 `vitest`。
3. `1.1-base` 的测试仍然可以复用同一份配置源。

---

## 6. 正式 serverName 与测试 serverName

`src/serverName.ts` 只放正式可复用服务器名：

1. `SERVER_NAME_MOCK_TERMINAL_PLATFORM`
2. `SERVER_NAME_DUAL_TOPOLOGY_HOST`

纯测试用 serverName 放在 `src/test.ts`：

1. `SERVER_NAME_KERNEL_BASE_HTTP_FAILOVER_TEST`
2. `SERVER_NAME_KERNEL_BASE_HTTP_DEMO_TEST`

原因：

1. 测试 serverName 是测试配置的一部分，不应该污染正式 serverName 语义。
2. `transport-runtime` 的 HTTP service factory 测试需要一个名为 `demo` 的 server，所以测试配置里显式提供 `demo`。
3. `server-config-v2` 只覆盖 `1-kernel/1.1-base` 使用到的地址，不覆盖旧 `server-config` 的业务服务器地址。
4. 测试可以从 `test.ts` 使用测试 serverName。

---

## 7. 与 transport-runtime 的边界

`server-config-v2` 只提供服务器配置。

`transport-runtime` 负责：

1. 根据 endpoint.serverName 找到 server。
2. 按地址顺序执行请求。
3. 按策略做 failover。
4. 按参数做 retry。
5. 记住最近成功地址。
6. `replaceServers()` 后清空旧的成功地址记忆。
7. 将配置错误、传输错误、业务 envelope 错误统一映射。

所以 HTTP 服务测试必须使用 `server-config-v2` 提供配置，但断言行为属于 `transport-runtime`。

---

## 8. 当前测试约束

所有 `1-kernel/1.1-base` 内的 HTTP 服务测试应遵守：

1. 不在测试文件里手写完整 servers 数组。
2. 统一从 `@impos2/kernel-server-config-v2` 引入配置对象。
3. 需要动态端口或地址覆盖时，通过 `1-kernel/test-support/serverConfig.ts` 解析。
4. 需要验证失败重试、有效地址保持时，让 `transport-runtime` 使用同一个 runtime 连续发起请求。

这保证测试既验证 HTTP runtime，又验证 server config 注入方式。

---

## 9. 已验证场景

当前已验证：

1. `server-config-v2` 作为纯配置对象可被 `1.1-base` 测试统一引用。
2. `test-support/serverConfig.ts` 可以选择配置空间、注入动态 baseUrl、覆盖地址列表。
3. `transport-runtime` 可以使用该配置完成 HTTP failover。
4. `transport-runtime` 可以 retry 后记住最近成功地址。
5. `transport-runtime.replaceServers()` 后会使用新地址顺序。
6. HTTP service factory 生成的 serverName 可以通过测试配置解析到真实 server。
7. envelope 错误和 transport 错误可以继续映射成业务错误。

验证命令：

```bash
corepack yarn workspace @impos2/kernel-server-config-v2 type-check
corepack yarn workspace @impos2/kernel-base-transport-runtime test
```

---

## 10. 结论

`server-config-v2` 的专业边界是“服务器配置来源”，不是“测试 helper 包”，也不是“runtime module”。

最终约束：

1. 有 `1.1-base` 所需配置空间。
2. 有 `1.1-base` 所需正式 serverName。
3. 有测试配置。
4. 没有解析和覆盖行为。
5. 没有旧 `server-config` 兼容目标。
6. 没有 moduleName。
7. 没有运行时 packageVersion。
8. 没有包内测试逻辑。
9. 没有 HTTP/WS 执行逻辑。
