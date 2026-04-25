# 1-kernel/1.2-business

`1-kernel/1.2-business` 是终端业务 kernel 层。这里放置与具体业务域相关、但仍然平台无关、UI 无关的业务状态、command、actor、selector、projection/read-model 逻辑。

当前包包括：

| 包 | 定位 |
| --- | --- |
| `organization-iam-master-data` | 组织、租户、项目、品牌、门店、员工、角色等组织/IAM 主数据 read model。 |
| `catering-product-master-data` | 餐饮商品、菜单、分类、价格、售卖策略等商品主数据 read model。 |
| `catering-store-operating-master-data` | 门店经营、桌台、工作站、库存/运营摘要等门店经营主数据 read model。 |

## 目录定位

本目录位于 `1-kernel` 第二层：

```text
1-kernel/1.1-base      通用 runtime 与基础协议
1-kernel/1.2-business  业务 kernel 包
2-ui/2.2-business      对应业务 UI 包
```

它依赖 `1.1-base`，但不依赖 `2-ui`、`3-adapter`、`4-assembly`。业务 UI、产品 shell、Android host runtime 都应通过公开 exports、command 和 selector 使用这里的能力。

## 可以放什么

每个业务包可以包含：

- `moduleName`：业务包稳定命名空间。
- `features/commands`：业务 public command 定义。
- `features/actors`：command 执行者、projection 处理者、业务状态迁移。
- `features/slices`：业务 read model / runtime state。
- `selectors`：跨层读取业务状态的唯一稳定接口。
- `supports`：topic decoder、business error、parameter、normalizer、schema helper。
- `application/createModule.ts`：业务 kernel module 装配入口。
- `test`：状态语义、projection/tombstone、selector、恢复场景测试。

## 不应该放什么

- React/RN component、hook、style、布局、文案展示逻辑。
- Android、Electron、Web、Node 原生 API 调用。
- HTTP/WS/TDP client 私有实现。
- 直接读取 SQLite、文件系统、设备信息。
- assembly 产品路由和页面切换。
- 直接 import 其他包 slice action 做跨包写入。

## 业务主数据规范

主数据类业务包默认遵守这些规则：

1. 远端 authoritative projection 是事实来源。
2. topic decoder 必须能处理 snapshot、incremental changes、delete/tombstone。
3. 删除必须有明确 tombstone 语义，不能只靠数组覆盖或 UI 过滤。
4. read model 应保留 diagnostics，便于终端侧排查投影问题。
5. selector 应提供 UI 友好的查询结果，但不要包含 UI 文案和布局策略。
6. 数据更新时间、cursor、source、diagnostics 应可观测。
7. reset/rehydrate 语义要覆盖取消激活、切换门店、热更新重启等场景。

## 新增业务包规范

新增 `@next/kernel-business-*` 包时：

1. 明确业务域边界，不要做“大而全”的业务包。
2. 先定义 topic/schema/read model，再定义 UI。
3. exports 只暴露 module、commands、selectors、types、必要 supports。
4. 包名使用 `@next/kernel-business-<domain>`。
5. command/action/state key 必须以 `moduleName` 派生。
6. 业务包依赖只允许指向 `1.1-base` 和必要同层纯类型包；避免业务包之间形成循环。
7. 新增 projection 必须有测试覆盖 snapshot、incremental、delete、diagnostics。
8. 如果 UI 需要确认交互，业务包只发 request command，不直接打开 modal。

## 与 UI 的关系

`2-ui/2.2-business` 通过 selector 读取本层状态，通过 public command 发起写操作。UI 不应 import 本层 slice action。本层也不应 import UI component。

```text
1.2-business selector/state -> 2.2-business render
2.2-business user action -> public command -> 1.2-business actor/state
```

## 验证建议

- 业务 projection 测试：`corepack yarn workspace @next/kernel-business-<pkg> test`
- 类型检查：`corepack yarn workspace @next/kernel-business-<pkg> type-check`
- 若涉及 TDP，需结合 `@next/kernel-base-tdp-sync-runtime-v2` 场景验证。
- 若涉及取消激活或切店，必须验证本地持久化状态清理与重启恢复。
