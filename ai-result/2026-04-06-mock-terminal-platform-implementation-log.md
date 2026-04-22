# Mock Terminal Platform 落地日志

- 日期：2026-04-06
- 实施人：Codex
- 实施依据：`docs/mock-design-claude`
- 实施范围：联调可用版首期（方案 B，非最简壳）

## 目标

从零搭建 `0-mock-server/mock-terminal-platform`，提供：
- Mock TCP Core
- Mock TDP Core
- Mock Admin Web
- SQLite3 持久化
- 根目录一键启动

## 实施原则

- 不参考 `0-mock-server/kernel-server` 的实现代码
- 仅以设计文档为依据落地
- 保持 TCP / TDP 真实边界
- 强类型优先，统一常量与枚举
- 首期保证联调价值，不做空壳

## 当前进度

1. 已确认采用从零搭建方案
2. 已创建目标目录
3. 正在创建 workspace、基础配置和工程骨架

## 后续记录

- 待补充

## 第一阶段完成情况

### 已完成

- 创建新工程：
  - `0-mock-server/mock-terminal-platform`
  - `0-mock-server/mock-terminal-platform/server`
  - `0-mock-server/mock-terminal-platform/web`
- 根目录新增启动与检查脚本：
  - `mock:platform:dev`
  - `mock:platform:type-check`
- 后端首期能力已落地：
  - Sandbox 概览
  - TCP：终端、激活、任务发布、任务实例、伪结果回写、强制状态修改、批量造数
  - TDP：Session、Topic、Projection、Change Log、TCP→TDP 任务投递委托
  - Scene：场景模板与一键运行
  - Fault：规则列表、新建、命中模拟
- 前端首批后台页面已落地：
  - 总览
  - TCP 控制面
  - TDP 数据面
  - 场景引擎
  - 故障注入

### 本阶段检查结果

1. 服务端 TypeScript 类型检查通过
2. 前端 TypeScript 类型检查通过
3. 服务端构建通过
4. 前端构建通过
5. 服务端健康检查通过：`GET /health`
6. 运行时发现 `better-sqlite3` 与 Node ABI 不匹配，已通过 `npm rebuild better-sqlite3` 修复并验证

### 当前 UI 设计基线

- 风格：专业深色控制台 + 玻璃感信息面板
- 原则：真实后台风格、清晰信息层级、高自由度调试入口并存
- 结构：左侧导航 + 顶部状态条 + 分域控制面板 + 可观测数据表/JSON 区块

### 下一阶段建议

- 补充 Topic / Schema / Scope 创建与治理页面
- 补充终端激活实操流与 Token 可视化
- 补充任务筛选、详情抽屉、实例链路追踪
- 补充故障规则 DSL 表单化编辑
- 补充 Snapshot / Changes 的终端维度查看入口

## 第二阶段完成情况

### 新增后端能力

- Topic 创建接口：`POST /api/v1/admin/tdp/topics`
- Scope 统计接口：`GET /api/v1/admin/tdp/scopes`
- Projection 注入接口：`POST /api/v1/admin/tdp/projections/upsert`
- 激活码批量生成接口：`POST /api/v1/admin/activation-codes/batch`
- 任务链路追踪接口：`GET /api/v1/admin/tasks/instances/{instanceId}/trace`

### 新增前端能力

- TCP 页面新增激活实操流
- TCP 页面新增任务链路追踪视图
- TDP 页面新增 Topic / Schema / Scope 治理入口
- TDP 页面新增 Projection 手工注入入口
- 页面表单、三栏布局与后台工作台样式增强

### 第二阶段校验结果

1. 服务端类型检查通过
2. 前端类型检查通过
3. 服务端构建通过
4. 前端构建通过
5. `GET /api/v1/admin/tdp/topics` 正常
6. `GET /api/v1/admin/tdp/scopes` 正常
7. 创建任务发布单后，`GET /api/v1/admin/tasks/instances/{instanceId}/trace` 正常返回 TCP→TDP 链路

### 当前已达到的联调能力

- 可批量生成激活码并模拟真实激活
- 可注册新 Topic，并允许自由扩展 JSON Payload
- 可手工注入 Projection，驱动终端侧联调观察
- 可查看任务从 TCP 发布、到 TDP Projection / Change Log 的完整链路

## 第三阶段完成情况

### 新增后端能力

- 审计日志查询接口：`GET /api/v1/admin/audit-logs`
- 关键写操作自动落审计日志
- Session 生命周期实操接口继续纳入审计
- 终端维度 snapshot / changes 查询已在后台工作流中接入

### 新增前端能力

- 终端筛选与终端维度快照 / 变更查看
- 任务实例筛选与链路详情并排查看
- Session 建连 / 心跳 / 断开操作入口
- 审计日志总览面板

### 第三阶段校验结果

1. 服务端类型检查通过
2. 前端类型检查通过
3. 服务端构建通过
4. 前端构建通过
5. `POST /api/v1/tdp/sessions/connect` 正常
6. `GET /api/v1/tdp/terminals/T-1001/snapshot` 正常
7. `GET /api/v1/admin/audit-logs` 正常

## 第四阶段完成情况

### 新增后端能力

- 全量导出接口：`GET /api/v1/admin/export`
- 故障规则更新接口：`PUT /mock-admin/fault-rules/{faultRuleId}`

### 新增前端能力

- 总览页导出预览
- 故障规则表单化编辑
- 终端快照与变更对比说明增强
- 后台交互细节进一步 polish

### 第四阶段校验结果

1. 服务端类型检查通过
2. 前端类型检查通过
3. 服务端构建通过
4. 前端构建通过
5. `GET /api/v1/admin/export` 正常
6. `PUT /mock-admin/fault-rules/{faultRuleId}` 正常

## 第五阶段完成情况

### 新增后端能力

- 导出文件下载接口：`GET /api/v1/admin/export/download`

### 新增前端能力

- 导出文件下载按钮
- 轻量详情抽屉（终端 / 任务实例）
- 页面交互进一步增强

### 第五阶段校验结果

1. 服务端类型检查通过
2. 前端类型检查通过
3. 服务端构建通过
4. 前端构建通过
5. `GET /api/v1/admin/export/download` 返回附件下载头正常

## 第六阶段完成情况

### 新增后端能力

- 审计日志分页：`GET /api/v1/admin/audit-logs?page=&pageSize=`
- 模板导入接口：`POST /api/v1/admin/import/templates`

### 新增前端能力

- 审计日志分页切换
- Topic / Fault 模板导入入口
- 表单基础校验与错误提示增强

### 第六阶段校验结果

1. 服务端类型检查通过
2. 前端类型检查通过
3. 服务端构建通过
4. 前端构建通过
5. 分页审计接口正常
6. 模板导入接口正常

## 第七阶段完成情况

### 新增后端能力

- 场景模板库增加 `category`
- 模板导入增加字段级校验
- 导入异常已统一返回 JSON 错误响应

### 新增前端能力

- 复用分页器组件
- 场景模板库按类别展示
- 交互反馈进一步标准化

### 第七阶段校验结果

1. 服务端类型检查通过
2. 前端类型检查通过
3. 服务端构建通过
4. 前端构建通过
5. 场景模板接口正常返回分类字段
6. 模板导入校验失败时正常返回 JSON 错误

## 第八阶段完成情况

### 新增后端能力

- Topic 模板库：`GET /api/v1/admin/templates/topic-library`
- Fault 模板库：`GET /api/v1/admin/templates/fault-library`
- 导入预检：`POST /api/v1/admin/import/templates/validate`

### 新增前端能力

- Topic / Fault 模板库展示
- 导入预检结果展示
- 导入前校验流程

### 第八阶段校验结果

1. 服务端类型检查通过
2. 前端类型检查通过
3. 服务端构建通过
4. 前端构建通过
5. Topic 模板库接口正常
6. Fault 模板库接口正常
7. 导入预检接口正常

## 第九阶段完成情况

### 新增前端能力

- 视图偏好本地记忆（当前导航、筛选词）
- 更强筛选词匹配
- Topic / Fault 模板一键套用
- 列表空态提示
- Scene DSL 草案展示

### 第九阶段校验结果

1. 服务端构建通过
2. 前端类型检查通过
3. 前端构建通过

## 收口阶段补充

### 新增交付文档

- 平台 README：`0-mock-server/mock-terminal-platform/README.md`
- 交付说明：`docs/mock-platform-delivery/README.md`

### 稳定化建议

- 优先增加冒烟测试与接口测试
- 梳理 API 文档与对象模型说明
- 将 Scene DSL 从草案推进到可执行版本
- 扩展分页、筛选与模板管理 CRUD

## 收口验证补充

### 根脚本验证结论

- `mock:platform:dev` 已验证可拉起 Server 与 Web 两个进程
- Server 健康检查正常：`GET /health`
- 当前 CLI 环境设置了全局代理 `127.0.0.1:7890`，会干扰对本地 Vite 服务的 `curl` 验证，导致出现 `502`
- 因此 Web 侧建议直接通过浏览器打开 `http://localhost:5820` 验证

## 文档交付补充

### 新增文档

- 快速上手：`docs/mock-platform-delivery/Quick-Start.md`
- API 文档：`docs/mock-platform-delivery/API.md`
- 对象模型：`docs/mock-platform-delivery/Object-Model.md`
- 交付索引：`docs/mock-platform-delivery/README.md`

## 对外交付版补充

### 新增文档

- 对外交付版：`docs/mock-platform-delivery/External-Handover.md`
