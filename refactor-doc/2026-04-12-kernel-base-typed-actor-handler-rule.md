# Kernel Base Typed Actor Handler Rule

## 背景

`runtime-shell-v2` 的 `CommandDefinition<TPayload>` 已经包含命令 payload 类型，但旧 actor 写法只声明 `commandName: string`。这会在 actor handler 边界擦除类型，导致业务代码必须写：

```ts
const payload = context.command.payload as XxxPayload
```

这种写法容易遗漏字段变更，也会让业务开发者承担重复类型维护成本。

## 新规则

以后 `runtime-shell-v2` 体系内的 actor handler 一律优先使用：

```ts
onCommand(commandDefinition, context => {
    const payload = context.command.payload
})
```

不要再优先使用：

```ts
{
    commandName: someCommand.commandName,
    handle(context) {
        const payload = context.command.payload as SomePayload
    },
}
```

## 类型语义

`onCommand` 以 `CommandDefinition<TPayload>` 为输入，自动把 `TPayload` 传递到 `ActorExecutionContext<TPayload>`。因此 handler 内：

1. `context.command.payload` 自动推断为命令定义中的 payload 类型。
2. `createCommand(commandDefinition, payload)` 与 `onCommand(commandDefinition, handler)` 共享同一个类型来源。
3. actor 注册运行时仍然只按 `commandName` 匹配，不改变当前广播执行模型。

## 运行时边界

`ActorDefinition.handlers` 在运行时集合层使用擦除型 handler definition 存储，避免 TypeScript 函数参数逆变导致不同 payload 的 handler 无法放入同一个数组。

这个擦除只发生在 runtime 内部容器边界；业务声明层仍然由 `onCommand` 提供强类型。

## 示例

```ts
export const createSomeActor = (): ActorDefinition => ({
    moduleName,
    actorName: 'SomeActor',
    handlers: [
        onCommand(someCommandDefinitions.someCommand, async context => {
            const payload = context.command.payload
            await context.dispatchCommand(createCommand(otherCommandDefinitions.otherCommand, {
                id: payload.id,
            }))
            return {
                id: payload.id,
            }
        }),
    ],
})
```

## 当前落地范围

已落地到：

1. `runtime-shell-v2` internal catalog actor。
2. `tdp-sync-runtime-v2` actors。
3. `workflow-runtime-v2` actors。

`tcp-control-runtime-v2` 会继续迁移到同一写法；当前类型检查和测试已确认该 helper 不改变运行时行为。
