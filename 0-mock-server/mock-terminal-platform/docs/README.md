# Mock Terminal Platform 文档总览

面向终端开发联调的 Mock 平台，覆盖 TCP（Terminal Control Plane）与 TDP（Terminal Data Plane）两条主链路，并提供可直接操作的后台管理界面。

## 当前实现与系统边界

这个系统当前更接近：

- 终端联调平台
- 控制面 / 数据面验证后台
- 上游业务结果承载系统

它当前不承担业务主数据治理职责。

这意味着：

- `Platform`（平台）代表购物中心集团，是天然业务隔离器
- `Project`（项目）归属于某一个 `Platform`
- `Tenant`（租户）按 `Platform` 隔离维护
- `Brand`（品牌）按 `Platform` 隔离维护
- `Store`（门店）直接承载业务结果，绑定 `Platform + Project + Tenant + Brand + 铺位号`
- `Contract`（合同）是独立主数据，绑定 `Platform + Project + Tenant + Brand + Store`
- 不单独维护 `品牌授权`
- `终端机型`、`终端模板` 由基础资料统一维护
- `激活码` 是 12 位纯数字，用于后续激活终端，不等于终端实例本身

## 当前后台页面

当前后台由 6 个主入口组成：

- `总览`
- `TCP 控制面`
- `TDP 数据面`
- `场景引擎`
- `故障注入`
- `基础资料`

其中 `TCP 控制面` 下又拆成：

- `快捷控制台`
- `手动控制台`

## 当前能力

### TCP

- 终端实例查看与状态模拟
- 12 位数字激活码生成
- 终端激活模拟
- 任务发布与任务实例追踪
- 强制终端状态修改

### TDP

- Topic / Scope / Projection 治理
- 真实 WebSocket Session 建连 / 心跳 / 断开
- WebSocket 握手与服务端主动推送
- Projection / Change Log 查看
- 终端维度 snapshot / changes HTTP 补偿查看

### 基础资料

- 平台维护
- 项目维护
- 租户维护
- 品牌维护
- 门店维护
- 合同维护
- 终端机型维护
- 终端模板维护

### Mock 增强能力

- 批量造数
- 场景模板运行
- 故障规则新增 / 编辑 / 模板套用 / 命中模拟
- 导入预检 / 模板导入 / 全量导出 / 文件下载
- 审计日志

## 启动方式

在 `0-mock-server/mock-terminal-platform` 目录运行：

```bash
corepack yarn dev
```

启动后：

- Server: `http://127.0.0.1:5810`
- Web: `http://127.0.0.1:5820`

## 检查命令

项目脚本支持：

```bash
corepack yarn type-check
```

但如果你在当前工作区联调，建议直接分别运行：

```bash
cd web && npx tsc --noEmit -p tsconfig.json
cd server && npx tsc --noEmit -p tsconfig.json
```

这样更贴近当前实际联调方式。

## 文档阅读顺序

建议按下面顺序阅读：

1. `docs/小白手册.md`
2. `docs/后台使用手册.md`
3. `docs/给测试的联调用例手册.md`
4. `docs/给开发的进阶手册.md`

## 已知限制

- 本地 SQLite 中如果有历史 `tenant_brand_authorizations` 表，当前业务逻辑已不再使用它
- Scene DSL 当前仍以预制模板和执行结果为主，不是完整可编排 DSL
- 列表分页当前主要覆盖审计日志
- 暂未实现用户体系、权限体系、多人协作隔离
- TDP 当前已实现 `P1 + P2 + P3 主要能力`：真实 WebSocket 主入口、严格鉴权、握手、心跳、快照/增量、实时投影推送、客户端 ACK 驱动的送达确认、`PROJECTION_BATCH` 批量推送、Session lag 指标、`EDGE_DEGRADED / SESSION_REHOME_REQUIRED` 控制消息，以及 `remote.control / print.command` command 专用通道；全局单调 revision 与更完整的 command 治理仍未完成

## 文档与代码已对齐的重点

本轮文档已按当前代码实现对齐以下事实：

- 基础资料已升级为 `Platform -> Project / Tenant / Brand -> Store -> Contract` 组织模型
- 基础资料已存在，且是独立主入口
- 不再维护品牌授权实体
- 门店已增加 `铺位号(unitCode)`，合同为独立实体且允许一店多合同
- 终端主数据术语已统一为“终端机型 / 终端模板”
- 激活码为 12 位数字
- 生成激活码不等于创建终端实例
- TDP 已新增真实 WebSocket 主入口：`/api/v1/tdp/ws/connect`
- 旧的 `/api/v1/tdp/sessions/connect|heartbeat|disconnect` 继续保留，但现在更偏兼容/调试接口
