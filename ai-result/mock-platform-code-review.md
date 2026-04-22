# Mock Terminal Platform 代码审查报告

> 审查时间：2026-04-06
> 审查范围：`0-mock-server/mock-terminal-platform/server/src`
> 审查人：Claude Code Review Agent

---

## 执行摘要

本次审查发现了 **4 个严重问题（P0）**、**5 个重要问题（P1）** 和 **6 个一般问题（P2）**。

### 关键发现

1. **缺少认证授权机制（CRITICAL）** - 所有 API 端点都没有认证保护
2. **竞态条件** - 激活码使用、Token 刷新存在并发问题
3. **缺少输入验证** - 大量端点直接使用 req.body 没有验证
4. **事务处理缺失** - 多步骤操作没有事务保护

### 优先级分布

- **P0（严重）**：4 个 - 需要立即修复
- **P1（重要）**：5 个 - 需要尽快修复
- **P2（一般）**：6 个 - 建议修复

---

## 严重问题（P0）

### P0-1: 缺少认证授权机制（CRITICAL）

**严重程度**：🔴 严重

**问题描述**：
所有 API 端点都没有认证和授权检查，任何人都可以访问敏感操作。

**影响范围**：
- 任何人都可以激活终端
- 任何人都可以创建任务发布
- 任何人都可以批量创建终端
- 任何人都可以修改故障规则
- 任何人都可以导出所有数据

**受影响文件**：
- `modules/admin/routes.ts` - 所有路由（第 1-400 行）
- `app/createApp.ts` - 缺少认证中间件

**代码示例**：
```typescript
// modules/admin/routes.ts:87-95
router.post('/api/v1/terminals/activate', (req, res) => {
  try {
    const result = activateTerminal(req.body)
    return success(res, result)
  } catch (error) {
    return fail(res, error instanceof Error ? error.message : '激活失败')
  }
})
// ❌ 没有任何认证检查
```

**修复建议**：

1. 添加认证中间件：
```typescript
// shared/auth.ts
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.replace('Bearer ', '')

  if (!token) {
    return fail(res, '未提供认证令牌', 401)
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    req.user = decoded
    next()
  } catch (error) {
    return fail(res, '认证令牌无效', 401)
  }
}

export const authorize = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return fail(res, '权限不足', 403)
    }
    next()
  }
}
```

2. 应用到路由：
```typescript
// modules/admin/routes.ts
import { authenticate, authorize } from '../../shared/auth'

// 需要管理员权限的端点
router.post('/api/v1/admin/tasks/releases',
  authenticate,
  authorize(['admin']),
  (req, res) => {
    // ...
  }
)

// 需要开发者或管理员权限的端点
router.post('/api/v1/admin/terminals/batch',
  authenticate,
  authorize(['admin', 'developer']),
  (req, res) => {
    // ...
  }
)
```

**优先级**：P0 - 立即修复

---

### P0-2: 竞态条件（Race Condition）

**严重程度**：🔴 严重

**问题描述**：
激活终端、刷新 Token、投递任务等关键操作存在读-修改-写竞态条件，可能导致数据不一致。

**影响范围**：
- 同一个激活码可能被多次使用
- Token 刷新可能产生重复 token
- Revision 更新可能丢失

**受影响文件**：
- `modules/tcp/service.ts:38-100` - activateTerminal
- `modules/tcp/service.ts:102-124` - refreshTerminalToken
- `modules/tdp/service.ts:66-126` - dispatchTaskReleaseToDataPlane

**代码示例**：
```typescript
// modules/tcp/service.ts:38-46
export const activateTerminal = (input: {...}) => {
  // 1. 检查激活码
  const activation = db.select().from(activationCodesTable)
    .where(eq(activationCodesTable.code, input.activationCode)).get()

  if (!activation || activation.status !== 'AVAILABLE') {
    throw new Error('激活码不可用')
  }

  // ⚠️ 在这里，另一个请求可能同时使用同一个激活码

  // 2. 插入终端
  const terminalId = createId('terminal')
  db.insert(terminalsTable).values({...}).run()

  // 3. 更新激活码状态
  db.update(activationCodesTable)
    .set({ status: 'USED', usedBy: terminalId, usedAt: timestamp })
    .where(eq(activationCodesTable.code, input.activationCode))
    .run()
  // ❌ 没有检查激活码是否已被其他请求使用
}
```

**修复建议**：

使用事务和乐观锁：
```typescript
export const activateTerminal = (input: {...}) => {
  return db.transaction((tx) => {
    // 1. 原子性更新激活码状态，检查当前状态
    const updated = tx.update(activationCodesTable)
      .set({
        status: 'USED',
        usedBy: terminalId,
        usedAt: timestamp
      })
      .where(
        and(
          eq(activationCodesTable.code, input.activationCode),
          eq(activationCodesTable.status, 'AVAILABLE') // 乐观锁
        )
      )
      .run()

    if (updated.changes === 0) {
      throw new Error('激活码不可用或已被使用')
    }

    // 2. 插入终端（在事务中）
    const terminalId = createId('terminal')
    tx.insert(terminalsTable).values({...}).run()

    // 3. 插入凭证（在事务中）
    tx.insert(credentialsTable).values({...}).run()

    return { terminalId, ... }
  })
}
```

**优先级**：P0 - 立即修复

---

### P0-3: 缺少输入验证（Input Validation）

**严重程度**：🔴 严重

**问题描述**：
大量 API 端点直接使用 `req.body`，没有进行 schema 验证和类型检查。

**影响范围**：
- 可能导致数据库插入无效数据
- `Number()` 转换可能返回 `NaN` 导致逻辑错误
- 空字符串、null、undefined 可能导致业务逻辑错误
- 可能导致 SQL 注入（虽然使用了参数化查询，但字段验证缺失）

**受影响文件**：
- `modules/admin/routes.ts` - 几乎所有 POST/PUT 端点
- `modules/tcp/service.ts` - 所有导出函数
- `modules/tdp/service.ts` - 所有导出函数

**代码示例**：
```typescript
// modules/admin/routes.ts:115-125
router.post('/api/v1/admin/tasks/releases', (req, res) => {
  try {
    const release = createTaskRelease(req.body) // ❌ 没有验证
    return success(res, release)
  } catch (error) {
    return fail(res, error instanceof Error ? error.message : '创建失败')
  }
})

// modules/tcp/service.ts:141-149
export const createTaskRelease = (input: {
  title: string
  taskType: TaskType
  sourceType: string
  sourceId: string
  priority: number
  targetTerminalIds: string[]
  payload: Record<string, unknown>
}) => {
  // ❌ 没有验证 title 是否为空、priority 是否在合理范围等
  const releaseId = createId('release')
  // ...
}
```

**修复建议**：

使用 zod 进行输入验证：
```typescript
import { z } from 'zod'

// 1. 定义 schema
const CreateTaskReleaseSchema = z.object({
  title: z.string().min(1).max(200),
  taskType: z.enum(['CONFIG_PUBLISH', 'APP_UPGRADE', 'REMOTE_CONTROL']),
  sourceType: z.string().min(1).max(50),
  sourceId: z.string().min(1).max(100),
  priority: z.number().int().min(0).max(100),
  targetTerminalIds: z.array(z.string()).min(1).max(1000),
  payload: z.record(z.unknown()),
})

// 2. 创建验证中间件
const validate = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body)
      next()
    } catch (error) {
      if (error instanceof z.ZodError) {
        return fail(res, '输入验证失败', 400, error.errors)
      }
      return fail(res, '输入验证失败', 400)
    }
  }
}

// 3. 应用到路由
router.post('/api/v1/admin/tasks/releases',
  authenticate,
  authorize(['admin']),
  validate(CreateTaskReleaseSchema),
  (req, res) => {
    try {
      const release = createTaskRelease(req.body) // ✅ 已验证
      return success(res, release)
    } catch (error) {
      return fail(res, error instanceof Error ? error.message : '创建失败')
    }
  }
)
```

**优先级**：P0 - 立即修复

---

### P0-4: 敏感信息处理不当

**严重程度**：🔴 严重

**问题描述**：
Token 和 refreshToken 以明文存储和传输，没有加密或哈希处理。

**影响范围**：
- Token 泄露可以直接使用
- 数据库泄露导致所有 token 暴露
- 没有 token 撤销机制
- 没有 token 过期自动清理

**受影响文件**：
- `modules/tcp/service.ts:80-92` - 创建凭证
- `database/schema.ts:79-88` - credentials 表定义
- `modules/tcp/service.ts:102-124` - refreshTerminalToken

**代码示例**：
```typescript
// modules/tcp/service.ts:80-92
const token = createId('token')
const refreshToken = createId('refresh')

db.insert(credentialsTable).values({
  credentialId: createId('credential'),
  terminalId,
  token, // ❌ 明文存储
  refreshToken, // ❌ 明文存储
  issuedAt: timestamp,
  expiresAt: timestamp + 2 * 3600_000,
  refreshExpiresAt: timestamp + 30 * 24 * 3600_000,
  revokedAt: null,
}).run()
```

**修复建议**：

1. 使用哈希存储 token：
```typescript
import crypto from 'crypto'

// 哈希函数
const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex')
}

// 创建凭证时
const token = createId('token')
const refreshToken = createId('refresh')
const tokenHash = hashToken(token)
const refreshTokenHash = hashToken(refreshToken)

db.insert(credentialsTable).values({
  credentialId: createId('credential'),
  terminalId,
  token: tokenHash, // ✅ 存储哈希
  refreshToken: refreshTokenHash, // ✅ 存储哈希
  // ...
}).run()

// 返回给客户端的是原始 token
return { token, refreshToken, ... }
```

2. 验证 token 时：
```typescript
export const verifyToken = (token: string) => {
  const hash = hashToken(token)
  const credential = db.select().from(credentialsTable)
    .where(eq(credentialsTable.token, hash))
    .get()

  if (!credential) {
    throw new Error('Token 不存在')
  }

  if (credential.revokedAt) {
    throw new Error('Token 已被撤销')
  }

  if (credential.expiresAt < Date.now()) {
    throw new Error('Token 已过期')
  }

  return credential
}
```

3. 添加 token 撤销功能：
```typescript
export const revokeToken = (token: string) => {
  const hash = hashToken(token)
  db.update(credentialsTable)
    .set({ revokedAt: Date.now() })
    .where(eq(credentialsTable.token, hash))
    .run()
}
```

**优先级**：P0 - 立即修复

---

## 重要问题（P1）

### P1-1: 事务处理缺失

**严重程度**：🟡 重要

**问题描述**：
多步骤数据库操作没有事务保护，可能导致数据不一致。

**受影响文件**：
- `modules/tcp/service.ts:38-100` - activateTerminal（3 个表操作）
- `modules/tcp/service.ts:172-207` - createTaskInstancesForRelease（循环插入）
- `modules/tdp/service.ts:66-126` - dispatchTaskReleaseToDataPlane（循环更新）

**修复建议**：
使用 Drizzle 的事务 API 包装所有多步骤操作。

**优先级**：P1 - 尽快修复

---

### P1-2: 错误处理不完整

**严重程度**：🟡 重要

**问题描述**：
错误处理只捕获 Error 类型，没有统一的错误处理机制，没有错误日志记录。

**受影响文件**：
- `modules/admin/routes.ts` - 所有 try-catch 块
- 缺少全局错误处理中间件

**修复建议**：
实现统一的错误类型和全局错误处理中间件。

**优先级**：P1 - 尽快修复

---

### P1-3: 资源泄露风险

**严重程度**：🟡 重要

**问题描述**：
数据库连接管理不当，WAL 模式下文件可能无限增长，没有优雅关闭逻辑。

**受影响文件**：
- `database/index.ts:12-13` - 全局 sqlite 连接

**修复建议**：
添加数据库关闭逻辑和定期 checkpoint。

**优先级**：P1 - 尽快修复

---

### P1-4: 并发控制缺失（Revision 冲突）

**严重程度**：🟡 重要

**问题描述**：
Revision 更新没有乐观锁，可能导致更新丢失。

**受影响文件**：
- `modules/tdp/service.ts:77-106` - dispatchTaskReleaseToDataPlane
- `modules/tdp/service.ts:194-238` - upsertProjection

**修复建议**：
在 UPDATE 语句中添加 revision 检查。

**优先级**：P1 - 尽快修复

---

### P1-5: 缺少 Rate Limiting

**严重程度**：🟡 重要

**问题描述**：
没有请求频率限制，可能被恶意攻击或滥用。

**修复建议**：
```typescript
import rateLimit from 'express-rate-limit'

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: 100, // 限制 100 个请求
  message: '请求过于频繁，请稍后再试',
})

app.use('/api/', limiter)
```

**优先级**：P1 - 尽快修复

---

## 一般问题（P2）

### P2-1: 类型安全问题
### P2-2: 魔法数字
### P2-3: 代码重复
### P2-4: 缺少日志
### P2-5: 性能问题（N+1 查询）
### P2-6: 边界条件处理不足

（详细内容见完整报告）

---

## 代码质量建议

1. **添加输入验证层** - 使用 zod 或 joi
2. **实现认证授权系统** - JWT + RBAC
3. **添加事务支持** - 所有多步骤操作使用事务
4. **实现乐观锁** - 在更新时检查版本号
5. **添加 Rate Limiting** - 防止滥用
6. **实现统一错误处理** - 错误类型层次结构
7. **添加结构化日志** - winston 或 pino

---

## 修复优先级建议

### 第一阶段（立即修复）- P0 问题
1. 添加认证授权机制
2. 修复竞态条件
3. 添加输入验证
4. 修复敏感信息处理

### 第二阶段（1-2 周内）- P1 问题
1. 添加事务处理
2. 完善错误处理
3. 修复资源泄露
4. 添加并发控制
5. 添加 Rate Limiting

### 第三阶段（持续改进）- P2 问题
1. 提升类型安全
2. 消除魔法数字
3. 减少代码重复
4. 添加日志
5. 优化性能
6. 完善边界处理

---

**报告生成时间**：2026-04-06
**审查工具**：Claude Code Review Agent
**审查版本**：v1.0
