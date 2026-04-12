# Kernel Base Definition Factory Rule

## 背景

`errorDefinitions` 和 `parameterDefinitions` 是 kernel 基础能力的一部分，后续业务包会大量定义。

原始写法需要每条定义重复维护：

1. `key: \`${moduleName}.xxx\``
2. `moduleName`
3. parameter 的 `valueType`
4. `satisfies ErrorDefinition / ParameterDefinition`
5. `Object.values(...)` 导出列表

这些字段不是业务差异点，应该由轻量工厂统一生成。

---

## 新规则

新模块优先使用 `@impos2/kernel-base-contracts` 提供的薄工厂：

```ts
const defineError = createModuleErrorFactory(moduleName)
const defineParameter = createModuleParameterFactory(moduleName)
```

错误定义：

```ts
export const someErrorDefinitions = {
    networkFailed: defineError('network_failed', {
        name: 'Network Failed',
        defaultTemplate: 'Network failed: ${error}',
        category: 'NETWORK',
        severity: 'HIGH',
    }),
} as const

export const someErrorDefinitionList = listDefinitions(someErrorDefinitions)
```

参数定义：

```ts
export const someParameterDefinitions = {
    reconnectIntervalMs: defineParameter.number('reconnect-interval-ms', {
        name: 'Reconnect interval in milliseconds',
        defaultValue: 20_000,
        validate: value => Number.isFinite(value) && value > 0,
    }),
} as const

export const someParameterDefinitionList = listDefinitions(someParameterDefinitions)
```

---

## 边界

工厂只减少机械重复，不隐藏协议字段：

1. `localKey` 必须显式传入。
2. 不根据对象属性名自动生成 key。
3. 不自动生成 name。
4. 不自动决定 category/severity。

原因：

1. error key / parameter key 是稳定协议，不应由变量名隐式决定。
2. category / severity 是业务语义，不能靠规则猜。
3. 这套 helper 只解决重复样板，不做重 DSL。

---

## 当前落地范围

已迁移：

1. `tdp-sync-runtime-v2`
2. `tcp-control-runtime-v2`
3. `workflow-runtime-v2`

已新增公共 helper：

1. `createModuleErrorFactory`
2. `createModuleParameterFactory`
3. `listDefinitions`

同时调整：

1. `AppModule.parameterDefinitions` 改为 `readonly ParameterDefinition<any>[]`
2. 原因是一个模块内天然允许不同类型参数并存，且 `validate(number)` 不能被窄化成 `validate(unknown)`

---

## 验证

已通过：

1. `@impos2/kernel-base-contracts` `type-check` / `test`
2. `@impos2/kernel-base-tdp-sync-runtime-v2` `type-check` / `test`
3. `@impos2/kernel-base-tcp-control-runtime-v2` `type-check` / `test`
4. `@impos2/kernel-base-workflow-runtime-v2` `type-check` / `test`
