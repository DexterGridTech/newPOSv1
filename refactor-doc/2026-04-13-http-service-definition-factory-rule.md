# HTTP Service Definition Factory Rule

## 背景

`tcp-control-runtime-v2` 与 `tdp-sync-runtime-v2` 的 `httpService.ts` 存在两类重复样板：

1. endpoint 定义重复维护 `moduleName.localKey`、`serverName`、以及 `typed('...path|query|body|response')` 名称。
2. service 调用重复维护 `runtime.call(...)`、`normalizeTransportError(...)`、`createAppError(...)`、以及常见的 `success/data/error` envelope 解包。

这些内容大部分不是业务差异点。继续让业务开发者手写，会让协议定义显得笨重，而且容易漏掉稳定命名规则。

## 新规则

HTTP 相关 helper 放在 `@impos2/kernel-base-transport-runtime`，仍然遵守“薄工厂”原则：

1. 只减少机械重复。
2. 不隐藏协议边界。
3. 不做完整 DSL。

推荐写法：

```ts
const defineEndpoint = createModuleHttpEndpointFactory(moduleName, serverName)

const getFooEndpoint = defineEndpoint<
    {terminalId: string},
    {cursor?: number},
    void,
    FooResponse
>('get-foo', {
    method: 'GET',
    pathTemplate: '/api/v1/foo/{terminalId}',
    request: {
        path: true,
        query: true,
    },
})
```

调用侧推荐配合薄 helper：

```ts
return callHttpResult(runtime, endpoint, input, {
    errorDefinition: someErrorDefinitions.protocolError,
    fallbackMessage: 'get foo failed',
})
```

如果接口返回 envelope：

```ts
return callHttpEnvelope(runtime, endpoint, input, {
    errorDefinition: someErrorDefinitions.protocolError,
    fallbackMessage: 'get foo failed',
})
```

## 边界

helper 必须保持克制：

1. `localKey` 仍然必须显式传入，不能根据变量名自动推断。
2. `method` 必须显式传入。
3. `pathTemplate` 必须显式传入。
4. `request.path/query/body/headers` 是否存在必须显式声明。
5. 不自动猜业务错误定义。
6. 不自动猜 envelope 结构以外的业务协议。

## 目标收益

业务开发者定义 HTTP service 时，主要只需要关心：

1. endpoint 的业务 localKey。
2. method / pathTemplate。
3. path/query/body/response 的类型边界。
4. transport 失败映射到哪个 `ErrorDefinition`。
5. 如果服务端用了标准 envelope，业务成功数据如何取出。

而不需要重复拼：

1. 完整 endpoint name。
2. 每个 `typed('module.localKey.xxx')` 的 descriptor name。
3. 相同的 `try/catch + normalizeTransportError + createAppError`。

## 额外约束

这套 helper 不是为了让业务“不理解 HTTP”，而是为了让业务只写真正有差异的协议内容。

因此：

1. 底层 `defineHttpEndpoint(...)` 继续保留，作为 transport 层原始能力。
2. 新 helper 面向 kernel / business 包常规使用场景。
3. 如遇特殊协议，允许直接退回到底层 `defineHttpEndpoint(...)` 和 `runtime.call(...)`。
