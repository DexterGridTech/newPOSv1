# OrgScope 与 Topic 治理

> 版本：1.0 | 状态：正式稿 | 日期：2026-04-05

---

## 1. OrgScope 与餐饮中台组织层级的映射

### 1.1 OrgScope 树结构

餐饮中台的组织层级直接映射为 OrgScope 树：

```
platform:001                           # 平台层（全局）
└── project:mall-001                   # 购物中心项目（某个商场）
    ├── tenant:t-001                   # 项目租户（某商户主体/法人）
    │   ├── brand:b-001                # 品牌（某餐饮品牌）
    │   │   ├── store:s-001            # 门店（最高频操作单元）
    │   │   └── store:s-002
    │   └── brand:b-002
    └── tenant:t-002
```

**scopeId 格式规范：**
```
{type}:{业务主键}
```

示例：
- `store:s-001`
- `brand:b-001`
- `project:mall-001`
- `platform:001`

### 1.2 各层级承载的数据

| OrgScope 层级 | 典型数据 | 说明 |
|-------------|---------|------|
| `platform` | 系统级配置、全局字典 | 极少变更，几乎不用于终端推送 |
| `project`（商场） | 商场营业时间、ISV Token 状态、平台级告警 | 影响整个商场所有终端 |
| `tenant`（租户） | 支付方式配置、租户级别参数 | 影响该商户旗下所有品牌/门店 |
| `brand`（品牌） | 品牌菜单模板、品牌级促销规则 | 连锁场景下从总部下发 |
| `store`（门店） | 订单列表、菜单可售状态、桌台状态、预订列表 | **80% 的推送数据在此层级** |

### 1.3 ProfileScope 与终端类型映射

```
device-category:pos                    # 收银终端类
├── device-model:pos-standard          # 标准 POS
└── device-model:pos-kiosk             # 自助点餐机

device-category:kds                    # 厨房显示类
└── device-model:kds-v1

device-category:pda                    # 移动终端类
└── device-model:pda-handheld

device-category:display                # 展示类终端
├── device-model:pickup-screen         # 取餐叫号屏
└── device-model:pack-station          # 打包台显示

device-category:app                    # 软件终端
├── device-model:customer-miniapp      # 顾客小程序
└── device-model:merchant-web          # 商户后台 Web
```

### 1.4 Scope 解析优先级

当同一 Topic/Item 在多个 Scope 上都有 Projection 时，终端按以下规则确定最终生效值：

**优先级规则：**
1. `TerminalScope > ProfileScope > OrgScope`
2. 同类型中：`更深层级（叶子）> 更浅层级（根）`
3. 同节点内：`Revision 新者 > 旧者`

**示例：**

假设终端 `pos-001` 的作用域为：
- OrgScope: `store:s-001` → `brand:b-001` → `tenant:t-001` → `project:mall-001` → `platform:001`
- ProfileScope: `device-model:pos-standard` → `device-category:pos`
- TerminalScope: `terminal:pos-001`

对于 Topic `config.system-params`、ItemKey `timeout-thresholds`，如果存在以下 Projection：
- `platform:001` → `{connectTimeout: 5000}`
- `store:s-001` → `{connectTimeout: 3000}`
- `terminal:pos-001` → `{connectTimeout: 2000}`

最终生效值：`{connectTimeout: 2000}`（TerminalScope 优先级最高）

---

## 2. Topic 注册表

### 2.1 Topic 命名规范

```
{domain}.{entity}.{qualifier?}

示例：
  menu.catalog            商品菜单目录
  menu.availability       商品可售状态
  order.pending           待处理订单列表
  workunit.active         活跃工单
  config.store-params     门店参数配置
```

### 2.2 Topic 元数据

每个 Topic 必须在 Topic Registry 中注册，包含以下元数据：

| 字段 | 说明 |
|------|------|
| `topic` | Topic 名称（唯一） |
| `topicType` | `retained_state` / `durable_event` / `ephemeral_cmd` |
| `ownerDomain` | 归属业务域 |
| `schemaVersion` | Payload Schema 版本 |
| `payloadSchema` | JSON Schema 定义 |
| `allowedScopeTypes` | 允许的 Scope 类型（如 `['store', 'brand']`） |
| `maxPayloadSize` | 最大载荷大小（字节） |
| `retentionPolicy` | 保留策略（`permanent` / `ttl` / `tombstone`） |
| `ttlSeconds` | TTL 秒数（如适用） |

---

## 3. 保留态 Topic（retained_state）

这类 Topic 的语义是"终端当前应看到什么"。Projection Store 始终保留最新值；终端上线后无论何时都能获得最新快照。

### 3.1 menu.catalog（菜单目录）

| 属性 | 值 |
|------|-----|
| **归属业务域** | 商品与门店经营域 |
| **触发来源** | `MenuPublished` 领域事件 |
| **Scope 层级** | `store` 或 `brand`（连锁场景） |
| **ItemKey 模式** | `menu-version:{version}` |
| **Payload 简述** | 菜单版本号 + 所有分类 + 商品基础信息 |
| **消费终端** | POS、KIOSK、顾客小程序、堂食H5 |
| **更新频率** | 低（每天0-5次） |
| **Payload 大小** | 中-大（50KB～500KB） |
| **保留策略** | 永久（直到被新版本覆盖） |

**大 Payload 处理：**
当 `menu.catalog` Payload 超过 64KB 时，只推送版本指针：
```json
{
  "version": "v2024040501",
  "downloadUrl": "https://cdn.example.com/menus/s-001/v2024040501.json",
  "checksum": "md5_hash_xxx"
}
```
终端通过 HTTP 拉取完整菜单。

### 3.2 menu.availability（商品可售状态）

| 属性 | 值 |
|------|-----|
| **归属业务域** | 商品与门店经营域 |
| **触发来源** | `ProductAvailabilityChanged` 领域事件 |
| **Scope 层级** | `store` |
| **ItemKey 模式** | `product:{productId}` |
| **Payload 简述** | `{productId, status, stock, price, updatedAt}` |
| **消费终端** | POS、KIOSK、顾客小程序、堂食H5、KDS（沽清提示） |
| **更新频率** | 中（高峰期每分钟数十次） |
| **保留策略** | 永久（每个商品一条） |

**Payload 示例：**
```json
{
  "productId": "prod_001",
  "status": "AVAILABLE",
  "stock": 50,
  "price": 2800,
  "updatedAt": "2026-04-05T10:30:00Z"
}
```

### 3.3 store.config（门店配置）

| 属性 | 值 |
|------|-----|
| **归属业务域** | 商品与门店经营域 / 租户与组织域 |
| **触发来源** | 门店设置修改 |
| **Scope 层级** | `store` |
| **ItemKey 模式** | `hours`、`auto-accept`、`print-settings`、`fulfillment-types` |
| **消费终端** | POS、KDS、KIOSK（所有门店终端） |
| **更新频率** | 极低 |
| **保留策略** | 永久 |

**ItemKey 清单：**
- `hours`：营业时间
- `auto-accept`：自动接单配置
- `print-settings`：打印机配置
- `fulfillment-types`：支持的履约类型

### 3.4 config.system-params（系统参数）

| 属性 | 值 |
|------|-----|
| **归属业务域** | 运营治理域 / 平台层 |
| **Scope 层级** | `platform`、`tenant`、`store`（多层覆盖） |
| **ItemKey 模式** | 参数键名，如 `timeout-thresholds`、`feature-flags` |
| **消费终端** | 所有终端 |
| **说明** | 对应当前内核中的 `unitData_systemParameters`，保持兼容 |

### 3.5 config.error-messages（错误消息字典）

| 属性 | 值 |
|------|-----|
| **归属业务域** | 运营治理域 |
| **Scope 层级** | `platform`、`tenant` |
| **说明** | 对应当前内核中的 `unitData_errorMessages`，保持兼容 |

### 3.6 config.task-definitions（任务定义）

| 属性 | 值 |
|------|-----|
| **归属业务域** | 运营治理域 |
| **Scope 层级** | `platform`、`tenant` |
| **说明** | 对应当前内核中的 `unitData_taskDefinitions`，保持兼容 |

### 3.7 order.pending（待处理订单）

| 属性 | 值 |
|------|-----|
| **归属业务域** | 交易域 |
| **触发来源** | `OrderPaid`、`OrderCancelled`、`OrderCompleted` 领域事件 |
| **Scope 层级** | `store` |
| **ItemKey 模式** | `order:{orderId}` |
| **Payload 简述** | `{orderId, orderNo, scene, items[], amount, status, createdAt}` |
| **消费终端** | POS |
| **更新频率** | 中（正常营业每分钟0-5次） |
| **保留策略** | 订单完成/取消后标记 tombstone |

**说明：** `order.pending` 只为 POS 服务，存储的是 POS 需要处理的待处理视图，不是订单的权威数据（权威在交易域）。

### 3.8 table.status（桌台状态）

| 属性 | 值 |
|------|-----|
| **归属业务域** | 租户与组织域 |
| **触发来源** | `TableStatusChanged` 领域事件 |
| **Scope 层级** | `store` |
| **ItemKey 模式** | `table:{tableCode}` |
| **Payload 简述** | `{tableCode, status, sessionId?, partySize?, openedAt?}` |
| **消费终端** | POS、PDA |
| **保留策略** | 永久（每张桌台一条） |

**Payload 示例：**
```json
{
  "tableCode": "A-05",
  "status": "OCCUPIED",
  "sessionId": "sess_xxx",
  "partySize": 4,
  "openedAt": "2026-04-05T12:00:00Z"
}
```

### 3.9 booking.today（今日预订）

| 属性 | 值 |
|------|-----|
| **归属业务域** | 预订域 |
| **触发来源** | 预订创建/确认/取消/到店/逾期 |
| **Scope 层级** | `store` |
| **ItemKey 模式** | `booking:{bookingId}` |
| **Payload 简述** | `{bookingId, bookingNo, status, slotTime, partySize, contactName, tableCode?}` |
| **消费终端** | POS |
| **保留策略** | 预订日期过期后 TTL 24h |

### 3.10 workunit.active（活跃工单）

| 属性 | 值 |
|------|-----|
| **归属业务域** | 履约与生产域 |
| **触发来源** | `WorkUnitCreated`、`WorkUnitCompleted`、`WorkUnitRecalled` |
| **Scope 层级** | `store`（按 stationId 过滤由终端自行完成） |
| **ItemKey 模式** | `workunit:{workUnitId}` |
| **Payload 简述** | `{workUnitId, orderId, stationId, items[], status, priority, createdAt}` |
| **消费终端** | KDS、打包台 |
| **保留策略** | 工单完成后 tombstone，TTL 2h |

### 3.11 printer.status（打印机状态）

| 属性 | 值 |
|------|-----|
| **归属业务域** | 打印域 |
| **Scope 层级** | `terminal:{terminalId}` |
| **ItemKey 模式** | `printer:{printerId}` |
| **消费终端** | POS（该终端绑定的打印机） |

---

## 4. 耐久事件 Topic（durable_event）

这类 Topic 承载不能只看最终态的动作型事件，需要逐条处理。数量**严格受控**。

### 4.1 order.urge（催单）

| 属性 | 值 |
|------|-----|
| **ItemKey 模式** | `urge:{orderId}:{timestamp}` |
| **Scope 层级** | `store` |
| **Payload** | `{orderId, orderNo, urgeCount}` |
| **消费终端** | POS、KDS |
| **TTL** | 30 分钟（超时订单的催单无意义） |
| **说明** | 不能合并为保留态——每次催单都是独立动作 |

### 4.2 workunit.recalled（工单撤销）

| 属性 | 值 |
|------|-----|
| **ItemKey 模式** | `recall:{workUnitId}:{timestamp}` |
| **Scope 层级** | `store` |
| **TTL** | 30 分钟 |
| **说明** | 工单已在 `workunit.active` 中 tombstone，此事件驱动终端执行"撤销提示"动作 |

---

## 5. 点对点命令 Topic（ephemeral_cmd）

这类 Topic 的 `targetScope` 必须精确到 `TerminalScope`，不广播。

### 5.1 print.command（打印命令）

| 属性 | 值 |
|------|-----|
| **归属业务域** | 打印域 |
| **触发来源** | 业务系统主动发起打印任务 |
| **Scope 层级** | `terminal:{terminalId}` |
| **ItemKey 模式** | `task:{printTaskId}` |
| **Payload** | `{printTaskId, taskType, templateId, data, retryPolicy}` |
| **TTL** | 10 分钟 |
| **消费终端** | 目标 POS / KIOSK |
| **Ack 要求** | 终端必须回传 ack（成功/失败） |

### 5.2 remote.control（远程控制）

| 属性 | 值 |
|------|-----|
| **归属业务域** | 运营治理域 |
| **Scope 层级** | `terminal:{terminalId}` |
| **Payload** | `{commandType, params, timeout}` |
| **消费终端** | 所有终端 |
| **commandType 枚举** | `RESTART`、`RELOAD_CONFIG`、`FORCE_SYNC`、`LOG_UPLOAD`、`SCREEN_LOCK` |

---

## 6. 终端订阅矩阵

终端通过连接时声明的 `capabilities + topicSubscription` 决定接收哪些 Topic。

```
✓  主动订阅，必接收
△  选配订阅（按终端配置）
—  不订阅
```

### 6.1 保留态 Topic 订阅

| Topic | POS | KIOSK | KDS | PDA | 打包台 | 叫号屏 | 顾客小程序 |
|-------|-----|-------|-----|-----|--------|--------|----------|
| `menu.catalog` | ✓ | ✓ | — | △ | — | — | ✓ |
| `menu.availability` | ✓ | ✓ | △ | △ | — | — | ✓ |
| `store.config` | ✓ | ✓ | ✓ | ✓ | ✓ | — | — |
| `config.system-params` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| `config.error-messages` | ✓ | ✓ | ✓ | ✓ | — | — | — |
| `config.task-definitions` | ✓ | — | ✓ | △ | — | — | — |
| `order.pending` | ✓ | — | — | — | — | — | — |
| `table.status` | ✓ | — | — | ✓ | — | — | — |
| `booking.today` | ✓ | — | — | △ | — | — | — |
| `workunit.active` | — | — | ✓ | — | ✓ | — | — |
| `printer.status` | ✓ | ✓ | — | — | — | — | — |

### 6.2 事件与命令 Topic 订阅

| Topic | POS | KIOSK | KDS | PDA | 打包台 | 叫号屏 |
|-------|-----|-------|-----|-----|--------|--------|
| `order.urge` | ✓ | — | ✓ | — | — | — |
| `workunit.recalled` | — | — | ✓ | — | ✓ | — |
| `print.command` | ✓ | ✓ | — | — | — | — |
| `remote.control` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

### 6.3 顾客小程序的特殊说明

顾客小程序连接时 `orgScopeId` 是具体门店，但连接时长短且连接量大（每个活跃顾客都是一个连接）。

**建议对小程序连接做轻量化处理：**
- 仅订阅 `menu.availability`、`menu.catalog`
- 不进入 Session Presence Store
- 订单状态变更通过独立的顾客通知通道（微信模板消息）处理，不走 TDP
- 小程序端无需实现完整的 Projection Store，直接用 HTTP 拉取最新状态即可

---

## 7. 与现有消息类型的对应关系

现有 24 种 WS 消息类型如何迁移到 TDP Topic 体系：

| 现有消息类型 | TDP Topic | 说明 |
|------------|---------|------|
| `ORDER_NEW` | `order.pending` (upsert) | 新订单写入 |
| `ORDER_STATUS_CHANGED` | `order.pending` (upsert) | 更新 status 字段 |
| `ORDER_URGE` | `order.urge` (durable_event) | 独立 Topic |
| `REFUND_STATUS_CHANGED` | `order.pending` (upsert) | 更新 refundStatus 字段 |
| `WORK_UNIT_NEW` | `workunit.active` (upsert) | 新工单写入 |
| `WORK_UNIT_STATUS_CHANGED` | `workunit.active` (upsert) | 更新 status 字段 |
| `WORK_UNIT_CANCELLED` | `workunit.active` (tombstone) + `workunit.recalled` (durable_event) | 双写 |
| `WORK_UNIT_URGE` | `order.urge` 中附带 workUnitId | 合并到 urge Topic |
| `PACK_UNIT_READY` | `workunit.active` (upsert, status=PACK_READY) | 状态更新 |
| `RIDER_STATUS_CHANGED` | `workunit.active` (upsert, riderStatus字段) | 附在履约对象上 |
| `PICKUP_CALL` | `print.command` + 叫号屏推送 | 命令型，独立处理 |
| `TABLE_STATUS_CHANGED` | `table.status` (upsert) | 保留态 |
| `MENU_INVALIDATED` | `menu.catalog` (upsert) | 保留态版本指针 |
| `PRINTER_STATUS_CHANGED` | `printer.status` (upsert) | 保留态 |
| `PRINT_TASK_FAILED` | `print.command` Ack 失败 + `device.alerts` | 命令回执 |
| `INVENTORY_ALERT` | `device.alerts` (ephemeral) | 短生命周期通知 |
| `BOOKING_*` 系列 | `booking.today` (upsert/tombstone) | 统一到预订 Topic |
| `CHANNEL_PUSH_FAILED` | `device.alerts` (ephemeral) | 告警通知 |
| `DEVICE_OFFLINE` | `device.alerts` (ephemeral) | 告警通知 |

---

*上一篇：[00-终端数据平面服务总览](./00-终端数据平面服务总览.md)*
*下一篇：[02-业务域集成设计](./02-业务域集成设计.md)*
