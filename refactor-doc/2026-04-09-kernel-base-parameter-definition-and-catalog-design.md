# 核心基础架构参数定义与参数目录设计

## 1. 文档目标

本文档用于明确旧 `systemParameters.ts` 在新架构中的拆分方式，覆盖：

- `1-kernel/1.1-base/contracts`
- `1-kernel/1.1-base/definition-registry`
- `1-kernel/1.1-base/runtime-shell`
- 后续各 runtime 与业务包的参数声明和读取方式

本文档的目标不是延续旧 `systemParameters` 的实现方式，而是保留其“统一声明 + 运行时可覆盖”的能力，并去掉旧设计中的 store 耦合与全局单例。

---

## 2. 对旧设计的判断

旧 `systemParameters` 实际上混合了三层语义：

1. 参数定义
2. 参数定义注册中心
3. 当前运行时参数值快照

旧设计真正做对的地方：

1. 每个包都可以声明自己的参数 key 和默认值。
2. runtime 启动时统一注册参数定义。
3. 运行时可以接收远端下发参数覆盖值。
4. 各运行时 actor 可以统一读取当前参数值，而不需要每个包自己拼配置来源。

旧设计的问题：

1. `DefinedSystemParameter.value` 直接耦合 store 读取。
2. 全局参数定义注册中心依赖单例。
3. 值解析逻辑散落在 actor 中临时 `JSON.parse`。
4. `systemParameters` 这个名字同时指“定义”和“当前值”，语义不够清晰。

一句话判断：

旧设计方向是对的，但参数定义层、注册层、运行时目录层必须拆开，而且这套模型比错误目录更强调类型化与解析校验。

---

## 3. 新架构总体结论

新架构中不再直接保留旧式 `DefinedSystemParameter.value` 模式，而改成四层：

1. `parameterDefinitions`
2. `parameterDefinitionRegistry`
3. `parameterCatalog`
4. `resolveParameter`

对应职责：

1. `parameterDefinitions`：静态声明“这个参数是什么”。
2. `parameterDefinitionRegistry`：runtime-scoped 注册与查询。
3. `parameterCatalog`：运行时可读的参数覆盖目录。
4. `resolveParameter`：把 definition + catalog 解析成最终强类型参数值。

---

## 4. 各层职责

## 4.1 `contracts`：参数协议

`contracts` 中应定义：

1. `ParameterKey`
2. `ParameterValueType`
3. `ParameterDefinition<T>`
4. `ParameterCatalogEntry`
5. `ResolvedParameter<T>`

建议最小结构类似：

```ts
interface ParameterDefinition<T> {
  key: string
  name: string
  defaultValue: T
  valueType: 'string' | 'number' | 'boolean' | 'json'
  decode?: (raw: unknown) => T
  validate?: (value: T) => boolean
}
```

这里的 `ParameterDefinition<T>` 必须是纯协议对象。

它不能：

1. 直接读 store
2. 直接依赖 runtime
3. 暗含全局注册行为

## 4.2 `definition-registry`：参数定义注册中心

`definition-registry` 负责：

1. 注册各模块声明的参数定义
2. 按 key 查询参数定义
3. 校验重复 key

它不负责：

1. 保存当前运行时参数覆盖值
2. 直接生成最终参数值
3. 直接更新 UI/state

## 4.3 `runtime-shell`：参数目录读模型

`runtime-shell` 中应维护一个全局可读的 `parameterCatalog`。

它的语义不是“定义”，而是：

1. 当前 runtime 可用的参数覆盖值
2. 远端下发或宿主注入的参数目录缓存

建议结构类似：

```ts
type ParameterCatalogState = Record<
  ParameterKey,
  {
    rawValue: unknown
    updatedAt: number
    source: 'default' | 'remote' | 'host'
  }
>
```

它的定位是：

1. 全局可读
2. 可持久化缓存
3. 不是参数定义真相

没有它时，系统必须仍可回退到 `ParameterDefinition.defaultValue` 正常工作。

## 4.4 `resolveParameter`：最终解析入口

后续 runtime 和业务不应再直接通过 `parameter.value` 偷读 store。

建议统一通过类似能力拿最终值：

```ts
resolveParameter(parameterDefinition, {
  parameterCatalog,
  parameterDefinitionRegistry,
})
```

解析顺序应明确为：

1. 先找到 `ParameterDefinition`
2. 再查 `parameterCatalog` 中当前覆盖值
3. 若 catalog 没有，则回退 `defaultValue`
4. 对覆盖值执行 `decode`
5. 执行 `validate`
6. 校验失败时回退默认值并产生日志/告警

---

## 5. 为什么不继续用 `DefinedSystemParameter.value`

旧模式的问题不在“可读参数”本身，而在于“定义对象自己直接去读 store”。

这会带来：

1. 定义对象和 runtime 耦合。
2. 调用方看起来像在读常量，实际上在读全局运行时状态。
3. 值解析与校验没有固定位置。

新架构应改成：

1. 定义对象只描述参数。
2. runtime helper 负责解析参数。
3. 消费方通过 resolver 或 scoped helper 取值。

也就是说，后续要保留“读参数很方便”，但不能保留“定义对象自己偷读 store”。

---

## 6. 与 `errorCatalog` 的关系

参数目录和错误目录共享同一种分层方法，但不是同一类对象。

共同点：

1. 都有静态定义。
2. 都有 registry。
3. 都有运行时目录。
4. 都有解析 helper。

差别：

1. `errorCatalog` 主要服务于展示文案解析。
2. `parameterCatalog` 直接影响运行行为。
3. 参数目录更强调强类型解析、默认值回退、校验。

因此：

1. 不应该把它们合成一个“通用 key-value 目录”。
2. 但可以采用相同的架构套路。

---

## 7. 对旧业务场景的继承

旧工程里参数的真实用途主要是：

1. 连接超时
2. 心跳间隔
3. 重连间隔
4. request 清理窗口
5. 启动延迟

这些参数明显属于“运行时配置”，不是纯 UI 展示数据。

新设计必须继续保留：

1. 模块独立声明参数定义。
2. 宿主或远端能够覆盖参数值。
3. runtime 在执行过程中随时可读当前解析值。

新设计升级了：

1. 参数值解析与校验进入统一 helper。
2. 参数定义与当前值彻底分层。
3. 不再依赖定义对象自己读全局 store。

---

## 8. 与主副机和远端同步的关系

参数目录模型非常适合当前场景：

1. 终端、主副机、连接策略参数都可能被远端下发。
2. 本地 runtime 可以把远端覆盖值缓存到 `parameterCatalog`。
3. 重启后可以先用缓存值工作，再等待新一轮同步。

但必须注意：

1. `parameterCatalog` 不是 request 真相源。
2. 参数变化会影响运行策略，但不直接代表 request 结果。
3. 参数目录是配置层，不是执行层。

---

## 9. 对后续实现的直接要求

基于本文结论，后续实现必须满足：

1. `contracts` 中定义纯 `ParameterDefinition<T>` 协议。
2. `definition-registry` 中提供 runtime-scoped 参数定义注册器。
3. `runtime-shell` 中建设 `parameterCatalog` 全局可读 state。
4. 不再提供旧式 `DefinedSystemParameter.value` 作为默认能力。
5. 新接口应更显式，例如：
   - `mergeParameterCatalogEntries(...)`
   - `replaceParameterCatalogEntries(...)`
   - `resolveParameter(...)`
6. 参数值字符串解析、JSON 解析、校验与默认值回退必须统一进入 resolver/helper。

---

## 10. 一句话结论

旧 `systemParameters` 最值得保留的不是类名，而是这条能力链：

1. 模块声明参数定义。
2. runtime 统一注册。
3. 运行时参数可被远端或宿主覆盖。
4. 各运行时组件可以统一拿到当前解析值。

新架构应把这条能力链拆成：

1. `parameterDefinitions`
2. `parameterDefinitionRegistry`
3. `parameterCatalog`
4. `resolveParameter`

从而保留动态配置能力，同时去掉旧设计的 store 耦合与全局单例问题。
