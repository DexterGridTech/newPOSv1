# 2026-04-07 HTTP Service Registry 设计说明

## 背景

当前 `1-kernel/1.1-cores/communication` 已具备较完整的 HTTP foundation：

- `HttpEndpointDefinition`
- `HttpClient`
- `AxiosHttpTransport`
- `ServerResolver`
- retry / failover / cancel / metrics / execution policy

但对其他业务模块来说，接入仍偏底层：

- 需要自己创建 `ServerResolver`
- 需要自己创建 `AxiosHttpTransport`
- 需要自己创建 `HttpClient`
- 需要自行组织 endpoint 和 runtime

因此当前更适合基建层使用，还未达到“业务模块非常顺手接入”的状态。

## 本轮目标

在不修改旧代码、不混用旧 `ApiManager` 模型的前提下，为 `communication` 增加一层 **HTTP 易用门面**，让其他模块以 service-first 的方式接入 HTTP。

## 用户已确认的设计选择

- 风格：`service-first`
- 调用方式：对象方法风格
- service 方法：手写声明
- 获取方式：全局 registry
- 注册粒度：按模块注册

## 目标用法

业务模块希望最终以如下方式调用：

```ts
const terminal = httpServiceRegistry.getModule<TerminalHttpServices>('terminal')
await terminal.device.activate({deviceId: 'D-1', body: {operatorId: 'U-1'}})
```

而不是业务模块自己去接触：

- `ServerResolver`
- `AxiosHttpTransport`
- `HttpClient`
- transport / endpoint wiring

## 设计方案

### 1. HttpRuntime

封装 HTTP foundation 的底层运行时：

- `ServerResolver`
- `AxiosHttpTransport`
- `HttpClient`

职责：

- 统一底层初始化
- 统一暴露 `call()` 能力
- 为 service 层提供稳定依赖

### 2. HttpServiceRegistry

提供全局模块级 service 获取方式：

- `registerModule(moduleName, services)`
- `getModule(moduleName)`
- `hasModule(moduleName)`
- `clear()`

职责：

- 让全工程统一通过 registry 获取 HTTP service
- 保持注册粒度为“模块”而不是“单个 service”

### 3. defineHttpServiceModule

帮助模块声明 service 集合，保留强类型：

- 输入：模块名 + service 实例集合
- 输出：结构化模块定义

职责：

- 统一模块级声明方式
- 降低 registry 注册时的样板代码

## 边界约束

本轮 **不会做**：

- 不修改旧模块代码
- 不接入旧 `ApiManager`
- 不做自动代码生成
- 不引入 decorator / string-based method lookup
- 不处理 WS

## 最小交付

本轮交付将包括：

1. `HttpRuntime`
2. `HttpServiceRegistry`
3. `defineHttpServiceModule`
4. dev 示例：`terminal.device.activate(...)`
5. dev 测试：验证注册、获取、调用、类型与运行链路

## 预期收益

完成后，其他模块接入 HTTP 时：

- 不再感知底层 `HttpClient` 初始化
- 不再感知 transport 细节
- 只关注 service 方法本身
- 获取方式统一
- 更适合后续按模块逐步迁移旧体系
