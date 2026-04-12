# 核心基础包后续开发规范：稳定 errors / parameters 必须同步抽出

## 1. 规则目标

后续开发新的 kernel 模块逻辑时，不允许再回到“内联错误字符串 + 散落运行数字”的写法。

要继承旧工程真正做对的事：

1. 稳定错误语义不能散落
2. 稳定运行参数不能散落

但不恢复旧式全局单例与定义对象偷读 store 的实现。

---

## 2. 强制规则

写后续模块逻辑时，只要出现下面两类要素，就必须同步评估并抽出公开定义：

1. 稳定错误语义
2. 稳定运行参数

这里的“稳定”指：

1. 会被复用
2. 未来可能被 UI、日志、宿主、远端覆盖或测试显式引用
3. 不是一次性局部临时判断

---

## 3. 哪些错误必须抽出

以下情况必须抽为 `ErrorDefinition`：

1. 有稳定 key 的正式运行时失败语义
2. 跨函数、跨文件、跨包会重复使用
3. 需要被 logger、UI、catalog、协议、测试识别
4. 未来可能需要被错误文案覆盖

推荐落点：

1. `src/supports/errors.ts`
2. `src/supports/index.ts`
3. 若该包接入 `runtime-shell` 模块 manifest，则同步进入 `errorDefinitions`

---

## 4. 哪些参数必须抽出

以下情况必须抽为 `ParameterDefinition`：

1. 该值会直接影响运行行为
2. 该值可能按环境、宿主、设备或远端配置被覆盖
3. 该值需要在多个实现点共享同一默认值
4. 未来可能进入 `runtime-shell parameterCatalog`

推荐落点：

1. `src/supports/parameters.ts`
2. `src/supports/index.ts`
3. 若该包接入 `runtime-shell`，同步进入 `parameterDefinitions`
4. 若该包是独立 runtime，至少也要让默认值从公开 parameter definition 读取

---

## 5. 明确不要求抽出的内容

下面这些不需要强行抽成公共定义：

1. 纯内部编程期断言
2. 单函数局部一次性错误
3. 没有长期稳定语义的局部数字常量
4. 纯算法中间值

典型例子：

1. `Duplicated handler`
2. `Circular module dependency detected`
3. middleware 防重入这类开发期保护

---

## 6. 新架构中的正式表达

旧工程的表达是：

1. 写后续模块逻辑的同时需要抽出 `errorMessages / systemParameters`

在新架构里，这条规则的正式表达改为：

1. 写后续模块逻辑的同时，需要同步抽出稳定 `ErrorDefinition`
2. 写后续模块逻辑的同时，需要同步抽出稳定 `ParameterDefinition`

统一模型为：

1. `ErrorDefinition + registry + catalog + resolver`
2. `ParameterDefinition + registry + catalog + resolver`

---

## 7. 验证要求

一旦抽出新的错误或参数，至少满足下面一条：

1. 包内类型检查通过
2. 测试能断言默认值或错误 key
3. 若已进入真实运行行为，必须补真实行为测试

不允许出现：

1. 只建了 `errors.ts / parameters.ts`
2. 实现完全没用
3. 测试也完全没覆盖

---

## 8. 现有示范包

当前已完成示范落地的基础包：

1. `topology-client-runtime`
2. `execution-runtime`
3. `runtime-shell`
4. `topology-runtime`
5. `transport-runtime`
6. `host-runtime`
7. `state-runtime`

后续继续扩展基础包或迁移业务包时，应直接参考这些包当前的 `src/supports/*`、运行时接线方式和测试写法。

补充约束：

1. `state-runtime` 这类通用基础设施包也要抽出稳定错误和稳定参数，但不能因此引入业务语义。
2. `protected` 持久化缺失安全存储属于稳定运行错误，必须结构化，不能降级写入明文存储。
3. 自动持久化默认节流参数属于稳定运行参数，默认值必须来自公开 `ParameterDefinition`。
