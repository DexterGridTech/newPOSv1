# Mock Terminal Platform 对外交付说明

## 1. 项目定位

Mock Terminal Platform 是一套面向终端开发联调的模拟平台，用于在缺少真实上游业务系统、真实数据面环境或真实设备编排系统的情况下，提供可观测、可操作、可复现的联调工作台。

平台覆盖两条主链路：

- **TCP（Terminal Control Plane）**：终端控制平面，负责终端主数据、激活、任务治理、版本与配置下发治理
- **TDP（Terminal Data Plane）**：终端数据平面，负责 Session、Topic、Projection、Change Log 与数据投递观察

同时，平台提供 Mock 专属增强能力：
- 场景模板
- 故障注入
- 模板导入导出
- 审计日志
- 专业后台控制台

---

## 2. 当前交付范围

### 2.1 后端能力

已交付的主要能力包括：

- TCP 核心接口
  - 终端列表
  - 激活码生成
  - 终端激活
  - 任务发布与任务实例追踪
  - 强制终端状态修改
- TDP 核心接口
  - Session 建连 / 心跳 / 断开
  - Topic 创建与查询
  - Scope 统计
  - Projection 注入与查询
  - Change Log 查询
  - 终端维度 snapshot / changes 查询
- Mock 能力
  - 批量造终端
  - 场景模板运行
  - 故障规则新增 / 编辑 / 命中模拟
  - 模板库与模板导入
  - 导入预检
  - 全量导出 / 下载
  - 审计日志

### 2.2 前端能力

已交付后台界面包括：

- 总览工作区
- TCP 控制面工作区
- TDP 数据面工作区
- 场景引擎工作区
- 故障注入工作区

已具备的 UI 能力包括：

- 专业深色控制台风格
- 列表与详情抽屉
- 审计日志分页
- 空态提示
- 视图偏好本地记忆
- 模板一键套用
- 导入预检结果展示

---

## 3. 工程位置

- 工程根目录：`0-mock-server/mock-terminal-platform`
- 服务端：`0-mock-server/mock-terminal-platform/server`
- 前端：`0-mock-server/mock-terminal-platform/web`
- 实施日志：`ai-result/2026-04-06-mock-terminal-platform-implementation-log.md`

---

## 4. 启动方式

在仓库根目录执行：

```bash
corepack yarn mock:platform:dev
```

访问地址：

- Server：`http://127.0.0.1:5810`
- Web：`http://localhost:5820`

类型检查：

```bash
corepack yarn mock:platform:type-check
```

---

## 5. 关键使用路径

### 路径 1：终端激活联调
1. 在总览或 TCP 页面生成激活码
2. 在 TCP 页面执行终端激活
3. 查看终端列表变化

### 路径 2：配置下发链路联调
1. 在 TCP 页面创建任务发布单
2. 查看任务实例列表
3. 查看任务链路追踪
4. 到 TDP 页面观察 Projection / Change Log

### 路径 3：故障演练
1. 在 Fault 页面新增或套用模板规则
2. 执行命中模拟
3. 查看审计日志、任务链路和投递侧数据变化

### 路径 4：模板导入
1. 打开总览页模板库与导入区域
2. 执行导入预检
3. 通过后执行导入
4. 到 Topic / Fault 页面确认数据已生效

---

## 6. 核心文档索引

- 快速上手：`docs/mock-platform-delivery/Quick-Start.md`
- API 文档：`docs/mock-platform-delivery/API.md`
- 对象模型：`docs/mock-platform-delivery/Object-Model.md`
- 交付索引：`docs/mock-platform-delivery/README.md`

---

## 7. 当前已知限制

- Scene DSL 目前仍为草案展示，尚未进入正式执行引擎
- 分页能力目前主要覆盖审计日志
- 模板导入当前主要覆盖 Topic / Fault 模板
- 当前未引入用户权限体系与多租户协作控制
- 当前未提供自动化测试体系，仍以人工联调和接口实测为主

---

## 8. 建议的下一阶段工作

建议优先进入稳定化与产品化完善阶段：

1. 增加冒烟测试与接口测试
2. 补充更标准的 API / 对象模型文档
3. 扩展分页、筛选与模板 CRUD 能力
4. 推进 Scene DSL 从草案到执行版本
5. 完善权限、协作和更细粒度的治理能力

---

## 9. 验证备注

当前环境启用了本地代理：

- `http://127.0.0.1:7890`
- `https://127.0.0.1:7890`

这会影响 CLI 中使用 `curl` 直接验证本地 Vite 服务。
因此建议：

- Server 以 `http://127.0.0.1:5810/health` 验证
- Web 以浏览器直接访问 `http://localhost:5820` 验证
