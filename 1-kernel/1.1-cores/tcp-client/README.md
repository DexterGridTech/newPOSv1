# @impos2/kernel-core-tcp-client

`tcp-client` 是终端和 `mock-terminal-platform` 控制面之间的轻量客户端 core 包。

它只处理三类事情：

- 终端激活：用一次性 `activationCode` 换取 `terminalId + accessToken + refreshToken`
- 控制面凭证续签：用 `refreshToken` 刷新 `accessToken`
- 任务结果回报：把终端执行结果回写到控制面

它不负责实时数据订阅，不负责 WebSocket，会话类能力由 `@impos2/kernel-core-tdp-client` 承担。

## 1. 包定位

这个包是一个标准 `AppModule`：

- 模块名：`kernel.core.tcpClient`
- 依赖：
  - `@impos2/kernel-core-base`
  - `@impos2/kernel-core-communication`

导出入口在 [src/index.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/tcp-client/src/index.ts)。

## 2. 职责边界

### 负责

- 初始化时采集设备信息和设备指纹
- 调用控制面 HTTP 接口完成激活
- 管理本地终端身份、控制面凭证、业务绑定上下文
- 提供统一的 selector / repository / service 给上层模块消费
- 在重启后恢复最小必要控制面身份
- 向服务端回报任务实例执行结果

### 不负责

- 实时 projection 同步
- 命令下发收件箱
- socket 生命周期和重连
- 业务对象建模，例如订单、用户、通知等

## 3. 当前状态设计

### 持久化 slice

`tcp-client` 当前把真正需要跨重启保留的信息拆成 3 个 slice，并分别持久化：

- `tcpIdentity`
- `tcpCredential`
- `tcpBinding`

这样做的目的，是把“身份”“凭证”“业务绑定”拆开，避免一个大对象把所有字段耦合到一个存储 key。

#### `tcpIdentity`

定义见 [src/types/state/tcpIdentity.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/tcp-client/src/types/state/tcpIdentity.ts)。

关键字段：

- `deviceFingerprint`：设备稳定指纹
- `deviceInfo`：设备描述信息，来自 `base.device`
- `terminalId`：控制面分配的终端身份
- `activationStatus`：`UNACTIVATED | ACTIVATING | ACTIVATED | FAILED`
- `activatedAt`：本地激活完成时间

#### `tcpCredential`

定义见 [src/types/state/tcpCredential.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/tcp-client/src/types/state/tcpCredential.ts)。

关键字段：

- `accessToken`
- `refreshToken`
- `expiresAt`
- `refreshExpiresAt`
- `status`：`EMPTY | READY | REFRESHING | EXPIRED`
- `updatedAt`

#### `tcpBinding`

定义见 [src/types/state/tcpBinding.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/tcp-client/src/types/state/tcpBinding.ts)。

关键字段都是从服务端激活响应里带回来的业务上下文：

- `platformId`
- `tenantId`
- `brandId`
- `projectId`
- `storeId`
- `profileId`
- `templateId`

### runtime-only slice

`tcpRuntime` 不持久化，只保留当前进程的运行态观测信息。

定义见 [src/types/state/tcpRuntime.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/tcp-client/src/types/state/tcpRuntime.ts)。

关键字段：

- `bootstrapped`
- `lastActivationRequestId`
- `lastRefreshRequestId`
- `lastTaskReportRequestId`
- `lastError`

重启后这些字段应当重新构建，而不是从本地恢复。对应实现见 [src/features/slices/tcpRuntime.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/tcp-client/src/features/slices/tcpRuntime.ts)。

## 4. 对外公开的能力

### 模块导出

包入口会导出：

- `kernelCoreTcpClientModule`
- `kernelCoreTcpClientCommands`
- `kernelCoreTcpClientSlice`
- `kernelCoreTcpClientApis`
- `kernelCoreTcpClientErrorMessages`
- `kernelCoreTcpClientParameters`
- 所有 `types / selectors / foundations`

### Commands

定义见 [src/features/commands/index.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/tcp-client/src/features/commands/index.ts)。

核心命令如下：

- `bootstrapTcpClient`
- `activateTerminal`
- `activateTerminalSucceeded`
- `refreshCredential`
- `credentialRefreshed`
- `reportTaskResult`
- `taskResultReported`
- `resetTcpClient`

其中真正给业务层主动使用的，一般只有：

- `activateTerminal`
- `refreshCredential`
- `reportTaskResult`
- `resetTcpClient`

### Selectors

定义见 [src/selectors/index.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/tcp-client/src/selectors/index.ts)。

最常用的是：

- `selectTcpIdentitySnapshot`
- `selectTcpCredentialSnapshot`
- `selectTcpBindingSnapshot`
- `selectTcpRuntimeState`
- `selectTcpTerminalId`
- `selectTcpAccessToken`
- `selectTcpRefreshToken`
- `selectTcpIsActivated`

这里已经把 `ValueWithUpdatedAt<T>` 扁平化成 snapshot，业务层可以直接消费。

### Foundations

对外可直接引用的基础封装在 [src/foundations/index.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/tcp-client/src/foundations/index.ts)：

- `TcpHttpService`
- `tcpHttpService`
- `TcpIdentityRepository`
- `tcpIdentityRepository`
- `TcpCredentialRepository`
- `tcpCredentialRepository`
- `TcpActivationCoordinator`
- `tcpActivationCoordinator`
- `TcpCredentialCoordinator`
- `TcpTaskReportCoordinator`

其中：

- `service` 负责通信调用
- `repository` 负责从当前 store 读取快照
- `coordinator` 负责把一次业务流程串起来

## 5. 与 communication 的关系

这个包完全基于 `@impos2/kernel-core-communication` 的 HTTP 基础设施，不再走旧 `ApiManager` 模型。

接口定义见 [src/supports/apis/index.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/tcp-client/src/supports/apis/index.ts)：

- `POST /api/v1/terminals/activate`
- `POST /api/v1/terminals/token/refresh`
- `POST /api/v1/terminals/{terminalId}/tasks/{instanceId}/result`

`TcpHttpService` 负责：

- 通过 `HttpRuntime` 调用 endpoint
- 保留服务端 envelope
- 统一解包 `{ success, data, error }`

实现见 [src/foundations/services/TcpHttpService.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/tcp-client/src/foundations/services/TcpHttpService.ts)。

## 6. 初始化与命令流

### 初始化

初始化链路如下：

1. `kernelCoreBaseCommands.initialize`
2. `InitializeActor` 读取 `deviceInfo`
3. 写入 `tcpIdentity.deviceInfo` 和 `tcpIdentity.deviceFingerprint`
4. 触发 `bootstrapTcpClient`
5. `BootstrapActor` 把 `tcpRuntime.bootstrapped` 置为 `true`

相关实现：

- [src/features/actors/initialize.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/tcp-client/src/features/actors/initialize.ts)
- [src/features/actors/bootstrap.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/tcp-client/src/features/actors/bootstrap.ts)

### 激活

激活链路如下：

1. 调用 `kernelCoreTcpClientCommands.activateTerminal({ activationCode })`
2. `IdentityActor` 校验本地 `deviceInfo/deviceFingerprint`
3. 调用 `TcpActivationCoordinator`
4. `TcpActivationCoordinator` 调用 `tcpHttpService.activateTerminal`
5. 成功后分别写入：
   - `tcpIdentity`
   - `tcpCredential`
   - `tcpBinding`
6. 触发 `activateTerminalSucceeded`

实现见 [src/features/actors/identity.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/tcp-client/src/features/actors/identity.ts)。

### 凭证刷新

刷新链路如下：

1. 调用 `refreshCredential`
2. 从 `tcpCredentialRepository` 读取 `refreshToken`
3. 调用 `TcpCredentialCoordinator`
4. 写回新的 `accessToken/expiresAt`
5. 保留原 `refreshToken`

实现见 [src/features/actors/credential.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/tcp-client/src/features/actors/credential.ts)。

### 任务结果回报

回报链路如下：

1. 调用 `reportTaskResult`
2. 若调用方未显式带 `terminalId`，则从 repository 回退读取
3. 调用 `TcpTaskReportCoordinator`
4. 控制面写回任务实例结果

实现见 [src/features/actors/taskReport.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/tcp-client/src/features/actors/taskReport.ts)。

## 7. 错误与参数

### 错误定义

定义见 [src/supports/errors/index.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/tcp-client/src/supports/errors/index.ts)。

当前已定义：

- `tcpActivationCodeInvalid`
- `tcpActivationFailed`
- `tcpCredentialMissing`
- `tcpCredentialExpired`
- `tcpRefreshFailed`
- `tcpTaskResultReportFailed`
- `tcpBootstrapHydrationFailed`

### 系统参数

定义见 [src/supports/parameters/index.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/tcp-client/src/supports/parameters/index.ts)。

当前参数：

- `credentialRefreshLeadTimeMs`

现在这个参数已经定义，但当前包内还没有自动刷新 epic；目前刷新是显式命令驱动。

## 8. 使用方式

### 注册模块

```ts
import {ApplicationManager, ScreenMode} from '@impos2/kernel-core-base'
import {kernelCoreTcpClientModule} from '@impos2/kernel-core-tcp-client'
import {devServerSpace} from '@impos2/kernel-server-config'

const {store} = await ApplicationManager.getInstance().generateStore({
  serverSpace: devServerSpace,
  environment: {
    deviceId: 'demo-device',
    production: false,
    screenMode: ScreenMode.DESKTOP,
    displayCount: 1,
    displayIndex: 0,
  },
  preInitiatedState: {},
  module: kernelCoreTcpClientModule,
})

ApplicationManager.getInstance().init()
```

### 激活终端

```ts
import {kernelCoreTcpClientCommands} from '@impos2/kernel-core-tcp-client'

kernelCoreTcpClientCommands.activateTerminal({
  activationCode: 'ACT-XXXX',
}).execute('activate-terminal-demo')
```

### 读取激活结果

```ts
import {
  selectTcpBindingSnapshot,
  selectTcpCredentialSnapshot,
  selectTcpIdentitySnapshot,
} from '@impos2/kernel-core-tcp-client'

const state = store.getState()

const identity = selectTcpIdentitySnapshot(state)
const credential = selectTcpCredentialSnapshot(state)
const binding = selectTcpBindingSnapshot(state)
```

## 9. 与 mock-terminal-platform 的对齐情况

当前 `tcp-client` 已经按现有 mock 服务对齐并验证过：

- 激活接口
- token 刷新接口
- 任务结果回报接口
- 激活后丰富 binding 字段回写
- 重启后 persisted state 恢复

其中服务端返回的 binding 目前包含：

- `platformId`
- `tenantId`
- `brandId`
- `projectId`
- `storeId`
- `profileId`
- `templateId`

## 10. Dev 验证

dev 入口见 [dev/index.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/tcp-client/dev/index.ts)。

这个验证不是“模拟请求成功”，而是加载完整应用环境并检查真实 store state。

### 运行方式

先启动 mock 服务：

```bash
corepack yarn mock:platform:dev
```

再运行：

```bash
corepack yarn workspace @impos2/kernel-core-tcp-client dev
```

### 验证内容

`dev/index.ts` 会按 `full -> seed -> verify` 两阶段重启模式执行：

- `seed`
  - 创建激活码
  - 激活终端
  - 刷新 credential
  - 创建任务并回报结果
  - 校验 selector 和 runtime state
  - 把持久化数据写入 `ai-result/dev-storage/tcp-client.dev.storage.json`
- `verify`
  - 重建应用环境
  - 验证 `tcpIdentity/tcpCredential/tcpBinding` 已恢复
  - 验证 `tcpRuntime` 不会被持久化
  - 验证 persisted key 分布是否符合预期

状态存储适配器使用的是共享 file storage：

- [1-kernel/1.1-cores/shared-dev/fileStateStorage.ts](/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-cores/shared-dev/fileStateStorage.ts)

## 11. 适合上层怎么用

上层业务一般可以把 `tcp-client` 当成“终端控制面身份来源”：

- 需要终端身份时读 `selectTcpTerminalId`
- 需要 HTTP/TDP 凭证时读 `selectTcpAccessToken`
- 需要业务绑定信息时读 `selectTcpBindingSnapshot`

建议保持这个包只承担控制面身份和凭证，不要把更高层业务对象继续塞进来。

## 12. 当前限制

- 还没有自动刷新 credential 的 epic
- `modulePreSetup` 当前为空
- 目前只对接 `mock-terminal-platform`
- 目前没有更高层“终端注册/解绑/轮换凭证策略”抽象
