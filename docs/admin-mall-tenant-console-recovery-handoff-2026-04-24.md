# Admin Mall Tenant Console Recovery Handoff

更新时间：2026-04-24

## 1. 当前统一任务

统一任务名称：

`admin mall tenant console UC/API aligned master-data`

这是一个统一任务，不要拆成“终端侧任务”和“后台侧任务”两个独立任务。

当前总目标保持不变：

1. 以 `design-v3` 为基线，把本地 `mock-admin-mall-tenant-console` 做到接近 99% 生产还原度。
2. 页面、写模型、投影、TDP 发布、HTTP/API 形状都尽量对齐 `design-v3` 与 `4.后台服务全面设计`。
3. 不回到旧 demo/mock-only 方案，不为测试便利简化 topic、scope、DTO、API。

## 2. 恢复时的权威基线

新会话开始后，先读这些文件：

1. `/Users/dexter/Documents/workspace/idea/newPOSv1/AGENTS.md`
2. `/Users/dexter/Documents/workspace/idea/newPOSv1/.omx/project-memory.json`
3. `/Users/dexter/Documents/workspace/idea/newPOSv1/docs/superpowers/specs/2026-04-23-admin-mall-tenant-console-uc-aligned-backoffice-design.md`
4. `/Users/dexter/Documents/workspace/idea/newPOSv1/.omx/plans/2026-04-23-admin-mall-tenant-console-uc-aligned-implementation-plan.md`
5. `/Users/dexter/Documents/workspace/idea/newPOSv1/.omx/wiki/2026-04-24-admin-mall-tenant-console-recovery-handoff.md`
6. `/Users/dexter/Documents/workspace/idea/newPOSv1/docs/admin-mall-tenant-console-recovery-handoff-2026-04-24.md`

恢复时不要把旧记忆、旧 demo 代码、或未更新的早期计划当真相源。

## 3. 绝对不要偏离的约束

1. 不要重新从零分析。
2. 不要回到旧 demo 方案。
3. 不要把统一任务拆散。
4. 不要回滚工作区脏改动。
5. 不要为了测试方便简化 topic、scope、DTO、API。
6. 不要把“页面能显示”当成完成，必须有真实验证。
7. 页面 UI 变化必须跟着 state，不要靠 ad hoc 逻辑硬拼。
8. 不要再把所有逻辑堆回 `0-mock-server/mock-admin-mall-tenant-console/web/src/App.tsx`。
9. 不要再让 contract regression 或管理后台回归测试污染开发 SQLite 数据。

## 4. 当前阶段判断

统一判断如下：

1. 终端侧 deactivation / secondary stale master-data / 主副屏收敛 / Android automation，已经进入“基本验收”状态。
2. 当前主线不应回到终端侧重新打一遍，除非出现新的回归证据。
3. 当前真正需要继续推进的是后台产品化主线。
4. 当前处于 implementation plan 的第 3 阶段收口完成后、继续进入第 4 阶段 `用户与权限` 的位置。

分阶段状态可按下面理解：

1. 第 0 阶段：已完成。
2. 第 1 阶段：大部分完成，剩最终系统性验收。
3. 第 2 阶段：aligned 底座已可用，但后台壳层和 API 规范仍需持续收口。
4. 第 3 阶段：`组织与租户` 已完成一轮产品化收口与验证。
5. 第 4 阶段：下一步主战场，直接继续做 IAM。

## 5. 当前真实进展

### 5.1 已经基本验收的终端侧能力

下面这些能力不要在恢复后重新当主线回头重做：

1. deactivation / stale master-data / secondary convergence
2. retail-shell initialize 未激活时 reset business master-data
3. “激活 -> 取消激活 -> 主副机 UI/state/request”真实 Android automation 链路
4. secondary 离线后重新连接，能收敛到 primary 最新状态
5. A 取消激活，或 A 重新激活到另一终端后，B 重连时能收敛到新的未激活或新激活状态

当前关于“清空是否也应带时间戳”的思路，已经通过 business master-data 的
`lastChangedAt` / authoritative empty semantics 进入正确方向，不要再走回
“只是 patch 清空 UI”的旧路。

### 5.2 后台侧本轮已收口内容

`mock-admin-mall-tenant-console` 当前已经在继续往 production-shaped backoffice 收口：

1. `App.tsx` 已保持 thin shell，状态、路由、共享逻辑拆到 `web/src/app/*`。
2. `OrganizationWorkspace` 已不再是单纯 raw JSON 工作台，而是更接近 workflow-first 页面。
3. 当前组织页已有：
   - dashboard
   - tenant/store 监控上下文
   - contract lifecycle 区域
   - store contract monitor 可读视图
   - 折叠式参考台账
4. 服务端 `getOrgTree()` 已修复：
   - 不再把所有 tenant/brand 重复铺在每个 project 下
   - 只保留真实属于该 project 分支的 tenant/brand/store
5. tenant/store 选择已收口为统一 context action：
   - `selectTenantContext`
   - `selectStoreContext`
6. contract regression 已新增组织树 project 分支正确性回归。
7. 测试数据库污染问题已修复：
   - `MOCK_ADMIN_MALL_TENANT_CONSOLE_DB_FILE` 已接入
   - `scripts/mock-admin-console-contract.test.mjs` 改为使用隔离 SQLite
   - 本轮回归引入和遗留的 `Tree*` 测试实体已从开发库清掉

## 6. 当前验证状态

以下验证已经通过：

1. `node --import tsx scripts/mock-admin-console-contract.test.mjs`
2. `corepack yarn workspace @next/mock-admin-mall-tenant-console-web type-check`
3. `corepack yarn workspace @next/mock-admin-mall-tenant-console-web build`
4. `corepack yarn workspace @next/mock-admin-mall-tenant-console-server build`
5. Playwright CLI 真实页面链路验证：
   - `tenant -> store -> contract monitor`
   - 组织页可以收敛到 `1 in scope`
   - 选中 store 后合同快照、关联合同、时间线、raw evidence 一起更新
   - org tree 会收敛到选中 tenant 的真实 branch
   - 浏览器控制台仅有 React DevTools 提示

关键浏览器证据在：

1. `/Users/dexter/Documents/workspace/idea/newPOSv1/.playwright-cli/org-verify-refined-after-store.md`
2. `/Users/dexter/Documents/workspace/idea/newPOSv1/.playwright-cli/org-verify-after-tree-clean.md`

## 7. 当前不要再做的事

1. 不要重新返工 `组织与租户` 到“概览 + 诊断台”旧状态。
2. 不要把所有内容重新堆回 `web/src/App.tsx`。
3. 不要继续让回归测试写开发库。
4. 不要把终端侧已验收能力当成当前主战场。
5. 不要把当前任务错误拆成“只做主数据清空”或“只做 admin console 页面”两个子任务。
6. 不要为了赶进度跳过真实浏览器验证。

## 8. 下一步应该做什么

直接沿 implementation plan 继续执行第 4 阶段：

`用户与权限`

当前应该把 IAM 从“能跑 workflow”继续推进成更接近真实后台的产品化页面和 API：

1. 用户列表 / 详情 / store-effective 视图
2. 角色列表 / 权限目录 / 绑定关系
3. 权限检查结果的人可读页面
4. API 形状继续向 `iam-service` 规范收口
5. 做完后继续真实浏览器验证，而不是只过 type-check

建议恢复后优先看这些文件：

1. `/Users/dexter/Documents/workspace/idea/newPOSv1/0-mock-server/mock-admin-mall-tenant-console/web/src/app/workspaces/IamWorkspace.tsx`
2. `/Users/dexter/Documents/workspace/idea/newPOSv1/0-mock-server/mock-admin-mall-tenant-console/web/src/app/useAdminConsoleState.ts`
3. `/Users/dexter/Documents/workspace/idea/newPOSv1/0-mock-server/mock-admin-mall-tenant-console/web/src/api.ts`
4. `/Users/dexter/Documents/workspace/idea/newPOSv1/0-mock-server/mock-admin-mall-tenant-console/server/src/modules/aligned-master-data/routes.ts`
5. `/Users/dexter/Documents/workspace/idea/newPOSv1/0-mock-server/mock-admin-mall-tenant-console/server/src/modules/aligned-master-data/service.ts`

做完 IAM 改造后的标准验证顺序：

1. `node --import tsx scripts/mock-admin-console-contract.test.mjs`
2. `corepack yarn workspace @next/mock-admin-mall-tenant-console-web type-check`
3. `corepack yarn workspace @next/mock-admin-mall-tenant-console-web build`
4. `corepack yarn workspace @next/mock-admin-mall-tenant-console-server build`
5. 再跑真实浏览器 IAM 链路验证

## 9. 新会话推荐提示词

直接复制下面这段到新会话：

```text
继续执行 `admin mall tenant console UC/API aligned master-data`。

工作目录：
/Users/dexter/Documents/workspace/idea/newPOSv1

先读取并严格遵循：
1. /Users/dexter/Documents/workspace/idea/newPOSv1/AGENTS.md
2. /Users/dexter/Documents/workspace/idea/newPOSv1/.omx/project-memory.json
3. /Users/dexter/Documents/workspace/idea/newPOSv1/docs/superpowers/specs/2026-04-23-admin-mall-tenant-console-uc-aligned-backoffice-design.md
4. /Users/dexter/Documents/workspace/idea/newPOSv1/.omx/plans/2026-04-23-admin-mall-tenant-console-uc-aligned-implementation-plan.md
5. /Users/dexter/Documents/workspace/idea/newPOSv1/.omx/wiki/2026-04-24-admin-mall-tenant-console-recovery-handoff.md
6. /Users/dexter/Documents/workspace/idea/newPOSv1/docs/admin-mall-tenant-console-recovery-handoff-2026-04-24.md

重要约束：
- 不要重新从零分析，不要回到旧 demo 方案
- 不要把终端侧和后台侧拆成两个任务
- 不要回滚工作区脏改动
- UI 变化必须跟着 state，不要靠 ad hoc 逻辑硬拼
- 终端侧 deactivation / reset business master-data / 主副屏 / Android automation 已基本验收，当前主线应继续 `mock-admin-mall-tenant-console` 后台产品化
- 当前第 3 阶段 `组织与租户` 已收口一轮：组织树 project 分支归属已修正，tenant/store 统一 context action 已接入，组织页参考台账已改成折叠二级信息，contract regression 与浏览器链路都已验证
- `scripts/mock-admin-console-contract.test.mjs` 已改成使用隔离 SQLite，后续测试不要污染开发库

当前下一步：
直接沿 implementation plan 继续执行第 4 阶段 `用户与权限` 产品化，把 IAM 页面和 API 继续往 design-v3 / 后台服务规范对齐；先做真实代码和验证，不要只给计划。
```

## 10. 备注

1. 当前工作区存在大量无关脏改动，恢复后继续工作时只聚焦当前任务相关文件。
2. 本轮没有提交 commit，不要假设已经有可回退的 clean checkpoint。
3. 如果恢复后需要再次确认当前定位，以本文件第 4、8、9 节为主。
