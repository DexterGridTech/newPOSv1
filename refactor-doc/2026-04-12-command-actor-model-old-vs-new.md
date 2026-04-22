# 新旧 Command / Actor 模型对比

日期：2026-04-12

## 一、结论

新模型不是否定旧模型，而是继承旧模型里最有价值的部分，再把原来混在一起的几层语义拆开。

旧模型真正优秀的地方有两点：

1. 全仓库统一使用 command 驱动跨包流程，而不是 service 直连。
2. actor 广播思想很强，天然适合 POS 终端这种多模块联动、多屏协同的场景。

新模型保留了这两点，但做了一个关键重构：

1. `command` 回归为“单执行者的能力调用”。
2. `actor` 回归为“多执行者的广播事件”。

也就是说，新模型把旧模型里混在一起的两种语义拆开了。

## 二、旧模型是什么

参考：

1. [actor.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/_old_/1-kernel/1.1-cores/base/src/foundations/actor.ts)
2. [command.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/_old_/1-kernel/1.1-cores/base/src/foundations/command.ts)
3. [registerActorSystem.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/_old_/1-kernel/1.1-cores/interconnection/src/foundations/registerActorSystem.ts)
4. [commandConverter.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/_old_/1-kernel/1.1-cores/interconnection/src/foundations/commandConverter.ts)

旧模型的运行路径本质上是：

```text
Command -> 全局 commandBus -> 全局 ActorSystem -> 所有 Actor 广播扫描 -> 命中 handler 的 actor 执行
```

特点：

1. `commandBus` 是全局单例。
2. `ActorSystem` 是全局单例。
3. 所有 actor 都订阅同一个 command 流。
4. command 发出去后，ActorSystem 会把它广播给所有 actor，谁声明了 handler 谁执行。
5. request lifecycle 不是 command runtime 自己维护，而是通过 ActorSystem lifecycle listener 旁路监听出来。
6. interconnection 再在 command 进入 ActorSystem 前，通过 converter 隐式补 `workspace / instanceMode`，甚至自动改写成远程命令。

这就是为什么旧模型一方面很灵活，另一方面又很“重运行时魔法”。

## 三、新模型是什么

现在的新模型是：

```text
command: 单执行者能力调用
actor: 多执行者广播事件
```

具体是：

1. `runtime-shell` 内部有实例化的 execution runtime。
2. 一个 `commandName` 只注册一个 handler。
3. command 进入明确的 request lifecycle / topology / remote event 处理链。
4. `publishActor(actorName, payload)` 是独立的广播通道。
5. 一个 `actorName` 可以注册多个 handler。
6. actor 不负责“返回业务结果”，只负责“广播事实，多个模块各自消费”。

也就是把原来旧模型里：

1. “谁来执行能力”
2. “谁来旁路监听事实”

这两个问题拆成两套机制。

## 四、最核心的差异点

## 4.1 执行者模型不同

### 旧模型

旧模型里 command 是广播到所有 actor 的。

虽然一个 command 通常只有一个 actor handler 真正命中，但运行时层面并没有“command 天生单执行者”的明确约束，它本质是：

1. 全量广播
2. actor 自己判断自己有没有 handler

这使它更像“全局事件驱动命令系统”。

### 新模型

新模型里 command 明确是单执行者。

优点：

1. 能力边界更清楚。
2. handler 唯一，结果语义更稳定。
3. request lifecycle 更容易做强约束。
4. 主副机远程命令回传时，不容易出现“到底谁是执行者”的歧义。

## 4.2 Actor 语义不同

### 旧模型

旧模型里的 actor 同时承担两件事：

1. 命令执行者。
2. lifecycle 广播来源。

所以“actor”这个名字其实背着两层职责：

1. 业务处理者
2. 系统事件总线节点

### 新模型

新模型里 actor 只保留广播语义。

command handler 和 actor handler 是两套接口。

优点：

1. 名字和职责一致。
2. 后续业务包要广播某个事实时，不会误伤 request lifecycle。
3. 广播不再伪装成 command。
4. 监听事实变化的模块，不必伪装成 command 执行者。

## 4.3 运行时边界不同

### 旧模型

旧模型是全局单例：

1. `commandBus`
2. `ActorSystem`
3. 生命周期 listener
4. converter

这些都挂在全局。

问题：

1. 不容易做实例隔离。
2. 不容易做并行 runtime。
3. 启动顺序和注册顺序的影响很大。
4. 很多语义通过“全局已经注册好了某个东西”来成立。

### 新模型

新模型是实例化 runtime：

1. 一个 `createKernelRuntime(...)` 对应一个 runtime 实例。
2. handler / actor / state / topology 都绑定在 runtime 实例里。
3. 广播和 command 都在实例内部运行。

优点：

1. 更适合主机 / 副机 / mock / test 并行存在。
2. 更适合真实测试。
3. 行为更容易推导。
4. 后续替换 transport / topology / state 都更自然。

## 4.4 路由语义不同

### 旧模型

旧模型的路由是强隐式的。

典型例子：

1. `commandWithExtra` 自动补 `workspace / instanceMode`
2. `remoteCommandConverter` 自动把命令改成 `sendToRemoteExecute`

优点：

1. 使用很顺手。
2. 业务方少写很多模板代码。

问题：

1. 路由决定点不够显式。
2. 很多行为只能通过“理解 converter 链”才能知道。
3. command 的业务语义和 transport 语义缠在一起。

### 新模型

新模型把路由责任拉回 runtime / topology 协议层：

1. command 就是 command。
2. 远程分发通过显式 envelope / remote dispatch / remote event 完成。
3. broadcast actor 不参与路由。

优点：

1. 能力调用与远程传输分层更清楚。
2. request 状态更容易保持一致。
3. 远程确认和业务完成更容易分开建模。

## 4.5 结果语义不同

### 旧模型

旧模型里 command 的结果是旁路观察出来的：

1. Actor 执行完成后触发 lifecycle listener。
2. listener 再去维护 request status。
3. 远端命令回传也要靠额外机制接起来。

这套设计实用，但结果链路不够收束。

### 新模型

新模型里 command 执行结果在 execution runtime 内就已经是第一等语义：

1. started
2. completed
3. failed
4. child dispatch
5. remote dispatch event

优点：

1. request lifecycle 更稳定。
2. 主副机 request 状态更容易保持一致。
3. workflow 这种上层运行时可以更可靠地复用 command 结果。

## 4.6 扩展方式不同

### 旧模型

旧模型要做跨模块通知，通常还是沿着 command / actor / lifecycle listener 这一套走。

这导致一个问题：

很多其实只是“事实广播”的东西，也被迫包装成 command。

### 新模型

新模型多了一条明确的扩展通道：

1. command 用于调用能力。
2. actor 用于广播事实。

例如：

1. `tdpTopicDataChanged` 就不再伪装成 command。
2. workflow、后续业务模块都可以直接监听这个广播。
3. 各模块只依赖“topic change 能力”，不依赖彼此的业务 command。

这正符合你希望的“能力依赖，而不是业务依赖”。

## 五、新模型的主要优势

## 5.1 语义更干净

旧模型最大的问题不是不好用，而是语义混用：

1. command 像能力调用，又像广播事件。
2. actor 像执行者，又像事件系统。

新模型把这两层语义拆开后，系统更专业，也更容易长期维护。

## 5.2 更适合主副机协议演进

你现在重构的重点之一，是把：

1. request lifecycle
2. topology
3. state sync
4. workflow
5. TDP topic 下发

都做成清晰协议。

这件事在新模型下更自然，因为：

1. command 链是收束的。
2. actor 广播是独立的。
3. transport 和业务完成语义更容易拆开。

## 5.3 更适合后续业务包迁移

后续业务包大概率需要两种协作方式：

1. 调别人的能力。
2. 监听某种系统事实。

新模型刚好一一对应：

1. 调能力 -> command
2. 监听事实 -> actor

业务包不用再绕着旧模型的隐式约定走。

## 5.4 测试更强

旧模型很多能力只能通过全局注册后一起跑才能看出效果。

新模型因为 runtime 是实例化的，所以：

1. command 可以独立测。
2. actor 广播可以独立测。
3. remote dispatch 可以独立测。
4. topic change pipeline 可以独立测。

这对你后面“先把 old core 全部迁完，再迁业务包”非常重要。

## 六、哪些旧优点被保留了

新模型并没有丢掉旧模型里真正好的东西。

保留的点：

1. command 仍然是跨包能力调用的统一语言。
2. actor 广播思想被保留，而且比旧模型更纯粹。
3. parent-child command chain 仍然保留。
4. requestId / sessionId / remote roundtrip 仍然保留。
5. 远程命令仍然走 command 风格，而不是散落成 websocket 直接调用。
6. 多模块围绕统一 runtime 协议协作，这个哲学没有变。

## 七、当前阶段的判断

如果用一句话总结：

1. 旧模型是“很好用但语义混合的全局 command/actor 运行时”。
2. 新模型是“语义拆分后的实例化 command runtime + broadcast actor runtime”。

我认为新模型更专业，原因不在于它更复杂，而在于：

1. 谁负责执行能力，明确了。
2. 谁负责广播事实，明确了。
3. 哪些进入 request lifecycle，明确了。
4. 哪些只是扩展点事件，明确了。
5. 主副机和 TDP 这种跨边界协议，更容易长期演进。

