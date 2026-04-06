# adapter/electron

## 定位

Electron 侧适配层按两层组织：

- `adapterV1`
  - 真正的 Electron 适配能力本体
  - 负责 `main / preload / renderer` 三侧桥接与宿主能力实现
- `adapterDevApp`
  - 仅用于适配层独立调试和验证的 Electron 壳工程
  - 对应 Android `adapterPure/dev-app`

## 目录说明

### `adapterV1`

只承载 Electron 原生宿主能力与严格桥接：

- `src/main`
  - Host service container
  - `stateStorage / logger / device / localWebServer / scriptsExecution / externalConnector / appControl`
- `src/preload`
  - `contextIsolation: true` 下的严格桥接注入
- `src/renderer`
  - TS 侧 adapter 注册实现
- `src/shared`
  - `LaunchContext`、host bridge contract

### `adapterDevApp`

这是 Electron adapter 的独立调试壳。

职责类似 Android `adapterPure/dev-app`：

- 独立启动 Electron，不依赖业务 assembly
- 注册 `adapterV1` 的全部 TS 适配器
- 复用 `@impos2/ui-core-adapter-test` 作为调试工作台
- 独立验证：
  - Logger
  - Device
  - StateStorage
  - ScriptExecution
  - LocalWebServer
  - ExternalConnector

## 与 assembly 的关系

- `adapterV1`
  - 只做能力适配
- `adapterDevApp`
  - 只做 adapter 独立调试
- `4-assembly/electron/*`
  - 只做业务整合壳

也就是说：

- adapter 能力应先在 `adapterDevApp` 独立验证
- assembly 不应该成为 adapter 唯一的测试入口

## 常用命令

在仓库根目录执行：

```bash
corepack yarn adapter:electron-dev-app:dev
corepack yarn adapter:electron-v1:type-check
corepack yarn assembly:electron-mixc-retail-v1:dev
```

## 当前边界

### 1. `adapterDevApp` 是独立壳，不是业务包

它只服务于 adapter 验证，不承担业务整合职责。

### 2. `assembly` 仍可保留集成层验证入口

如果某些页面验证的是“业务集成结果”，可以留在 assembly。
但 adapter 基础能力验证应优先沉到 `adapterDevApp`。
