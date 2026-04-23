# Mock Terminal Platform 快速使用指引

## 1. 启动

在仓库根目录执行：

```bash
corepack yarn mock:platform:dev
```

访问：

- Server：`http://127.0.0.1:5810`
- Web：`http://localhost:5820`

## 2. 推荐体验路径

### 路径 A：终端激活联调
1. 打开后台总览
2. 在 TCP 页面生成激活码
3. 在激活实操流中执行激活
4. 查看终端列表是否新增终端

### 路径 B：配置下发链路
1. 在 TCP 页面创建配置任务
2. 查看任务实例列表
3. 查看任务链路追踪
4. 到 TDP 页面查看 Projection / Change Log

### 路径 C：故障演练
1. 在 Fault 页面新增或套用故障模板
2. 命中模拟规则
3. 查看审计日志与任务链路变化

### 路径 D：模板导入
1. 在总览页模板库与导入区域准备 JSON
2. 先执行导入预检
3. 再执行导入
4. 到 Topic / Fault 页面确认效果

## 3. 常见入口

- 总览：看平台全貌、审计、导入导出
- TCP：看终端、激活、任务
- TDP：看 Session、Topic、Projection
- Scene：跑场景模板
- Fault：做故障注入

## 4. 当前最重要的三个接口

- `POST /api/v1/admin/tasks/releases`
- `POST /api/v1/admin/tdp/projections/upsert`
- `GET /api/v1/admin/tasks/instances/:instanceId/trace`
