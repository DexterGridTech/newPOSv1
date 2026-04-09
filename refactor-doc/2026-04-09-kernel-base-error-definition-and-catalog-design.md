# 核心基础架构错误定义与错误目录设计

## 1. 文档目标

本文档用于明确旧 `errorMessages.ts` 在新架构中的拆分方式，覆盖：

- `1-kernel/1.1-base/contracts`
- `1-kernel/1.1-base/definition-registry`
- `1-kernel/1.1-base/runtime-shell`
- 后续各业务包的错误声明与 UI 使用方式

本文档的目标不是延续旧 `errorMessages` 的名字，而是保留其真正有价值的能力，并把错误定义、运行时文案目录、错误解析职责拆清楚。

---

## 2. 对旧设计的判断

旧 `errorMessages` 实际上混合了三层语义：

1. 错误定义
2. 错误定义注册中心
3. 当前运行时可用的错误文案快照

旧设计真正做对的地方：

1. 每个包都可以声明自己的错误 key、默认文案、category、severity。
2. runtime 可以在启动时统一注册这些错误定义。
3. 运行时可以接收远端下发的错误文案覆盖值。
4. UI 最终看到的是“当前可展示文案”，不是只能写死默认文本。

旧设计的问题：

1. `DefinedErrorMessage` 直接耦合 store 读取。
2. 全局错误定义注册中心依赖单例。
3. `errorMessages` 同时指“定义”和“运行时值”，语义混乱。
4. `updateErrorMessages` 过于像全局字典写入口，不够显式。

一句话判断：

旧设计的方向是对的，但错误定义层、注册层、运行时目录层必须拆开。

---

## 3. 新架构总体结论

新架构不再直接保留一个同名大杂烩 `errorMessages` 模型，而改成四层：

1. `errorDefinitions`
2. `errorDefinitionRegistry`
3. `errorCatalog`
4. `resolveAppError`

对应职责：

1. `errorDefinitions`：静态声明“这个错误是什么”。
2. `errorDefinitionRegistry`：runtime-scoped 注册与查询。
3. `errorCatalog`：运行时可读的错误文案覆盖目录。
4. `resolveAppError`：把 `AppError + definition + catalog` 解析成最终展示视图。

---

## 4. 各层职责

## 4.1 `contracts`：错误协议

`contracts` 中应定义：

1. `ErrorKey`
2. `ErrorCategory`
3. `ErrorSeverity`
4. `ErrorDefinition`
5. `AppError`
6. `ResolvedErrorView`
7. `ErrorCatalogEntry`

这里的 `ErrorDefinition` 是纯协议对象。

它必须只包含：

1. `key`
2. `name`
3. `defaultTemplate`
4. `category`
5. `severity`

它不能：

1. 直接读 store
2. 直接依赖 runtime
3. 暗含全局注册行为

## 4.2 `definition-registry`：错误定义注册中心

`definition-registry` 负责：

1. 注册各模块声明的 `ErrorDefinition`
2. 按 key 查询错误定义
3. 校验重复 key

它不负责：

1. 保存当前运行时文案覆盖值
2. 更新 UI 可读 state
3. 直接生成展示文本

## 4.3 `runtime-shell`：错误目录读模型

`runtime-shell` 中应维护一个全局可读的 `errorCatalog`。

`errorCatalog` 的语义不是“错误定义”，而是：

1. 当前 runtime 可用的错误文案覆盖值
2. 远端下发或宿主注入的错误文本目录缓存

建议结构类似：

```ts
type ErrorCatalogState = Record<
  ErrorKey,
  {
    template: string
    updatedAt: number
    source: 'default' | 'remote' | 'host'
  }
>
```

它的定位是：

1. 全局可读
2. 可持久化缓存
3. 不是系统真相源

没有它时，系统必须仍可回退到 `ErrorDefinition.defaultTemplate` 正常工作。

## 4.4 `resolveAppError`：最终解析入口

后续 UI、logger、任务结果展示，不应直接迷信 `error.message`。

建议统一通过类似能力拿最终展示文本：

```ts
resolveAppError(appError, {
  definitionRegistry,
  errorCatalog,
})
```

解析顺序应明确为：

1. 先找 `ErrorDefinition`
2. 再找 `errorCatalog` 中的当前 template
3. 若 catalog 没有，则回退到 `defaultTemplate`
4. 最后用 args/context 渲染模板

---

## 5. 为什么不再叫 `errorMessages`

新架构建议避免继续把核心对象命名成 `errorMessages`，原因是这个名字在旧工程里语义太混。

建议新命名：

1. 静态声明：`errorDefinitions`
2. 注册中心：`errorDefinitionRegistry`
3. 运行时目录：`errorCatalog`
4. 最终展示：`resolvedError` / `ResolvedErrorView`

这样命名后，职责一眼能分清：

1. definition 是定义
2. registry 是注册
3. catalog 是当前可用目录
4. resolved view 是最终展示结果

---

## 6. 与旧设计相比保留了什么

必须明确，重构不是要把旧能力删掉，而是要继承并升级。

新设计继续保留：

1. 每个包独立声明错误定义。
2. 统一 runtime 注册错误定义。
3. 支持远端或宿主下发文案覆盖。
4. UI 可统一读取当前错误展示文本。

新设计升级了：

1. 错误定义不再耦合 store。
2. 注册中心不再是全局单例。
3. 运行时目录不再和静态定义混为一谈。
4. 展示解析走显式 helper，不再靠定义对象自己偷偷读状态。

---

## 7. 与日志系统的关系

错误系统和 logger 有关联，但不是同一层。

原则：

1. logger 记录错误事件时，应优先记录 `AppError.key / category / severity / context`。
2. logger 不应把运行时目录当成唯一真相。
3. UI 展示错误时，应走 `resolveAppError(...)`，而不是要求 logger 里已经拼出最终文案。

也就是说：

1. logger 负责可观测性。
2. error catalog 负责最终展示文案。

---

## 8. 与主副机和远端同步的关系

这套错误目录模型非常适合当前业务场景：

1. 远端可以下发按设备/实体/模型定制的错误文案模板。
2. 本地 runtime 可把这些模板保存为 `errorCatalog` 缓存。
3. UI 始终读取当前 runtime 可用模板，而不是写死默认文案。

但必须注意：

1. `errorCatalog` 只是目录缓存，不是 request 真相源。
2. request 是否失败，仍然由 `AppError` / owner-ledger / command lifecycle 决定。
3. `errorCatalog` 只参与“怎么展示这类错误”，不参与“这个 request 是否真的失败”。

---

## 9. 对后续实现的直接要求

基于本文结论，后续实现必须满足：

1. `contracts` 中定义纯 `ErrorDefinition` 协议，不得直接读 store。
2. `definition-registry` 中提供 runtime-scoped 错误定义注册器。
3. `runtime-shell` 中建设 `errorCatalog` 全局可读 state。
4. 不再提供旧式泛化 `updateErrorMessages(...)` 作为默认公开写接口。
5. 新接口应更显式，例如：
   - `replaceErrorCatalogEntries(...)`
   - `mergeErrorCatalogEntries(...)`
   - `resolveAppError(...)`
6. UI 和日志后续都应通过统一解析 helper 读取最终错误文本。

---

## 10. 一句话结论

旧 `errorMessages` 最值得保留的不是名字，而是这条能力链：

1. 模块声明错误定义。
2. runtime 统一注册。
3. 运行时目录可被远端覆盖。
4. UI 能统一拿到最终展示文案。

新架构应把这条能力链拆成：

1. `errorDefinitions`
2. `errorDefinitionRegistry`
3. `errorCatalog`
4. `resolveAppError`

从而保留能力，同时去掉旧设计的 store 耦合与全局单例问题。
