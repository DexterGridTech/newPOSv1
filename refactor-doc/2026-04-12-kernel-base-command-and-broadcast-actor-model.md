# Kernel Base Command 与 Broadcast Actor 双模型约定

日期：2026-04-12

## 一、结论

新 kernel base 需要同时保留两类运行时协作能力：

1. `command`：单执行者模型。用于明确的能力调用、跨包公开 API、请求生命周期追踪、主副机命令状态同步。
2. `broadcast actor`：广播模型。用于能力事件分发、跨包松耦合订阅、业务扩展点、多个模块同时响应同一事实变化。

这不是二选一。旧工程里 actor 广播能力很有价值，后续业务包会大量依赖“能力事件”而不是直接依赖其他业务包，因此必须作为 runtime-shell 的一等能力保留。

## 二、Command 规则

`command` 继续保持单执行者。

规则：

1. 一个 `commandName` 只能有一个 handler。
2. command 可以跨包调用。
3. command 是包对外暴露能力的主入口。
4. slice action 不跨包 export；其他包想改某个包的 state，必须调用该包公开 command。
5. command 进入 execution/topology/request lifecycle，适合需要 requestId、结果、错误、主副机状态同步的场景。

适用场景：

1. 启动 TDP 连接。
2. 注册 workflow definition。
3. 更新 runtime-shell 的 error catalog / parameter catalog。
4. 执行工作流。
5. 需要明确执行者、明确结果、明确失败语义的能力调用。

## 三、Broadcast Actor 规则

`broadcast actor` 是多消费者广播。

规则：

1. 同一个 `actorName` 可以注册多个 handler。
2. 发布一次 actor event，所有注册 handler 按注册顺序执行。
3. actor handler 不进入 command request lifecycle。
4. actor handler 不表达“业务执行结果”，只表达“我观察到这个事实后做自己的处理”。
5. actor handler 失败时，由 runtime-shell 包装为 `kernel.base.runtime-shell.actor_publish_failed`，不能静默吞掉。
6. actor 不是最小内部 topic 订阅工具，而是 kernel base 的通用扩展点能力。

适用场景：

1. TDP 投影生效变化后，多个业务模块同时响应。
2. 远端配置、菜单、会员、支付、营销、workflow definition 等业务数据下发后，各模块自行消费。
3. 不希望模块之间产生业务依赖，只依赖共同的基础能力事件。

## 四、TDP Topic Data Changed 事件

`tdp-sync-runtime` 统一发布广播 actor：

```ts
tdpSyncActorNames.topicDataChanged
```

payload 固定为：

```ts
{
  topic: string
  changes: Array<{
    operation: 'upsert' | 'delete'
    itemKey: string
    payload?: Record<string, unknown>
    revision?: number
  }>
}
```

语义：

1. `changes` 只包含 scope 优先级计算后的当前生效变化。
2. 普通消费者不关心 `Platform < Project < Brand < Tenant < Store < Terminal` 的计算过程。
3. 如果高优先级数据删除后回退到低优先级数据，消费者收到的是 `upsert + 低优先级 payload`。
4. 如果所有 scope 都删除，消费者收到的是 `delete`。
5. payload 不带 scopeType、scopeId、priority 等内部计算细节。

这样业务包只需要回答一个问题：对我关心的 topic，当前有效数据应该怎么变化。

## 五、System Topic 特例

普通模块应自己注册 actor 监听 `tdpTopicDataChanged`，并通过自己的 command/action 更新自己的 state。

唯独下面两个 topic 是特例：

1. `error.message`
2. `system.parameter`

原因：

1. runtime-shell 是基础包，比 tdp-sync-runtime 更底层。
2. runtime-shell 不能反向依赖 tdp-sync-runtime，也不能自己监听 TDP actor。
3. 因此由 tdp-sync-runtime 在发布通用 actor 后，额外桥接到 runtime-shell 的 catalog command。

边界：

1. 这个特例只允许用于 runtime-shell 的 error catalog / parameter catalog。
2. 后续业务模块不能让 tdp-sync-runtime 直接调用自己的 command。
3. 后续业务模块必须自己监听 `tdpTopicDataChanged`。

## 六、测试约束

已补充的关键验证：

1. runtime-shell：同一个 actorName 注册两个 handler，发布一次后两个 handler 都收到。
2. runtime-shell：actor handler 抛错时包装为 `actor_publish_failed`。
3. tdp-sync-runtime：普通模块监听 `tdpTopicDataChanged`，终端级数据覆盖门店级数据时收到终端有效 payload。
4. tdp-sync-runtime：终端级数据删除后，普通模块收到门店级回退 payload 的 `upsert`。
5. tdp-sync-runtime：所有 scope 都删除后，普通模块收到 `delete`。
6. workflow-runtime：通过监听 `tdpTopicDataChanged` 动态更新 workflow definitions，并执行最新 definition。
7. system catalog：`error.message` / `system.parameter` 仍通过特例桥接更新 runtime-shell catalog。

后续新增业务模块时，需要至少补一类 topic actor 消费测试，证明该模块不依赖 tdp-sync-runtime 内部优先级算法。

