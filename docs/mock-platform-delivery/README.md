# Mock Terminal Platform 交付说明

## 文档索引

- 快速上手：`docs/mock-platform-delivery/Quick-Start.md`
- API 文档：`docs/mock-platform-delivery/API.md`
- 对象模型：`docs/mock-platform-delivery/Object-Model.md`
- 实施日志：`ai-result/2026-04-06-mock-terminal-platform-implementation-log.md`
- 工程说明：`0-mock-server/mock-terminal-platform/README.md`

## 交付内容

- 新工程：`0-mock-server/mock-terminal-platform`
- 实施日志：`ai-result/2026-04-06-mock-terminal-platform-implementation-log.md`

## 已落地的范围

### 后端
- TCP 核心管理 API
- TDP 核心治理 API
- 模板库 / 导入预检 / 导入
- 导出 / 下载
- 审计日志

### 前端
- 专业控制台后台
- TCP / TDP / Scene / Fault / Overview 五大工作区
- 分页、抽屉、空态、偏好记忆

## 验证结论

已完成多轮：
- TypeScript 类型检查
- 构建验证
- HTTP 接口实测
- 启动健康检查

## 启动验证补充

根脚本 `mock:platform:dev` 已验证可启动，但如果本机已有其他进程占用 `5810` 端口，会导致 Server 启动失败，从而使 Web 侧返回 `502`。

建议启动前先确认：

```bash
lsof -i :5810
lsof -i :5820
```

若端口被占用，先清理后再启动。

## 本地验证注意事项（代理相关）

当前环境存在：

- `http_proxy=http://127.0.0.1:7890`
- `https_proxy=http://127.0.0.1:7890`
- `ALL_PROXY=http://127.0.0.1:7890`

这会影响对本地 Vite 开发服务的 `curl` 验证，表现为：
- `curl http://127.0.0.1:5820` 可能返回代理层的 `502`

因此：
- Server 侧健康检查以 `http://127.0.0.1:5810/health` 为准
- Web 侧建议直接浏览器打开 `http://localhost:5820` 做人工验证

## 当前建议

优先进入“产品化稳定阶段”，而不是继续无限堆功能：
1. 统一 README 与使用说明
2. 增加冒烟测试
3. 补更清晰的 API 文档
4. 梳理版本策略与后续 roadmap
- 对外交付版：`docs/mock-platform-delivery/External-Handover.md`
