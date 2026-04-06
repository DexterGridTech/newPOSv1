# Mock Terminal Platform

面向终端开发联调的 Mock 平台，覆盖 TCP（Terminal Control Plane）与 TDP（Terminal Data Plane）两条主链路，并提供专业后台管理界面。

## 当前能力

### TCP
- 终端主数据查看
- 激活码批量生成
- 终端激活模拟
- 任务发布与任务实例追踪
- 强制终端状态修改

### TDP
- Topic / Scope / Projection 治理
- Session 建连 / 心跳 / 断开
- Projection / Change Log 查看
- 终端维度 snapshot / changes 查看

### Mock 能力
- 批量造数
- 场景模板运行
- 故障规则新增 / 编辑 / 模板套用 / 命中模拟
- 导入预检 / 模板导入 / 全量导出 / 文件下载
- 审计日志

### 后台界面
- 深色专业控制台风格
- 详情抽屉
- 审计分页
- 模板库展示
- 视图偏好记忆

## 启动方式

在仓库根目录运行：

```bash
corepack yarn mock:platform:dev
```

- Server: `http://127.0.0.1:5810`
- Web: `http://127.0.0.1:5820`

## 检查命令

```bash
corepack yarn mock:platform:type-check
```

## 关键目录

- `0-mock-server/mock-terminal-platform/server`
- `0-mock-server/mock-terminal-platform/web`
- `ai-result/2026-04-06-mock-terminal-platform-implementation-log.md`

## 已知限制

- 当前导入主要面向 Topic / Fault 模板，尚未覆盖更复杂对象
- Scene DSL 目前是草案展示，未进入执行引擎
- 列表分页目前只覆盖审计日志
- 暂未实现用户体系、权限体系、多人协作隔离

## 后续建议

- 完善 Scene DSL 与回放机制
- 扩大分页、筛选、列配置能力
- 增加模板管理 CRUD
- 增加更精细的协议调试与故障脚本
