# 开发指南

> IMPOS2 Kernel Server 开发、扩展和修改指南

## 📋 目录

- [开发环境搭建](#开发环境搭建)
- [项目架构](#项目架构)
- [添加新功能](#添加新功能)
- [数据库操作](#数据库操作)
- [前端开发](#前端开发)
- [调试技巧](#调试技巧)
- [最佳实践](#最佳实践)

---

## 开发环境搭建

### 1. 克隆项目

```bash
cd 0-mock-server/kernel-server
```

### 2. 安装依赖

```bash
# 安装后端依赖
npm install --no-audit

# 安装前端依赖
cd web && npm install --no-audit
cd ..
```

### 3. 开发模式

```bash
# 终端1: 启动后端开发服务器
npm run dev

# 终端2: 启动前端开发服务器
cd web && npm run dev
```

### 4. 访问应用

- 后端API: http://localhost:9999
- 前端界面: http://localhost:5173
- 管理后台: http://localhost:9999/kernel-server/manager

---

## 项目架构

### 三层架构

```
┌─────────────┐
│   Routes    │  路由层 - HTTP请求处理
└──────┬──────┘
       │
┌──────▼──────┐
│  Services   │  业务逻辑层 - 业务规则和验证
└──────┬──────┘
       │
┌──────▼──────┐
│ Repositories│  数据访问层 - 数据库操作
└─────────────┘
```

### 目录职责

- **types/**: TypeScript类型定义,所有接口和类型
- **utils/**: 工具函数,如ID生成、验证、响应封装
- **middlewares/**: Express中间件,如CORS、认证、错误处理
- **repositories/**: 数据访问层,封装所有SQL操作
- **services/**: 业务逻辑层,包含业务规则和验证
- **routes/**: 路由层,定义HTTP端点和调用Service

---

## 添加新功能

### 示例: 添加"通知"功能

#### 1. 定义类型 (types/notification.ts)

```typescript
/**
 * 通知类型定义
 */

export interface Notification {
  id: string;
  title: string;
  content: string;
  type: 'info' | 'warning' | 'error';
  read: boolean;
  deviceId: string;
  createdAt: number;
  updatedAt: number;
}

export interface CreateNotificationRequest {
  title: string;
  content: string;
  type: 'info' | 'warning' | 'error';
  deviceId: string;
}

export interface UpdateNotificationRequest {
  read?: boolean;
}
```

#### 2. 添加数据表 (database/schema.ts)

```typescript
export const SCHEMA = `
  -- ... 现有表 ...

  -- 通知表
  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('info', 'warning', 'error')),
    read INTEGER NOT NULL DEFAULT 0,
    device_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_notifications_device_id ON notifications(device_id);
  CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
`;
```

#### 3. 创建Repository (repositories/NotificationRepository.ts)

```typescript
import Database from 'better-sqlite3';
import { db } from '../database';
import { Notification, CreateNotificationRequest, UpdateNotificationRequest } from '../types';
import { generateId } from '../utils/idGenerator';

export class NotificationRepository {
  private db: Database.Database;

  constructor() {
    this.db = db;
  }

  /**
   * 创建通知
   */
  create(data: CreateNotificationRequest): Notification {
    const now = Date.now();
    const id = generateId();

    const stmt = this.db.prepare(`
      INSERT INTO notifications (id, title, content, type, device_id, read, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 0, ?, ?)
    `);

    stmt.run(id, data.title, data.content, data.type, data.deviceId, now, now);

    return this.findById(id)!;
  }

  /**
   * 根据ID查找
   */
  findById(id: string): Notification | null {
    const stmt = this.db.prepare('SELECT * FROM notifications WHERE id = ?');
    const row = stmt.get(id);
    return row ? this.mapToNotification(row) : null;
  }

  /**
   * 查找设备的所有通知
   */
  findByDeviceId(deviceId: string): Notification[] {
    const stmt = this.db.prepare(`
      SELECT * FROM notifications
      WHERE device_id = ?
      ORDER BY created_at DESC
    `);
    const rows = stmt.all(deviceId);
    return rows.map(row => this.mapToNotification(row));
  }

  /**
   * 更新通知
   */
  update(id: string, data: UpdateNotificationRequest): Notification {
    const updates: string[] = [];
    const values: any[] = [];

    if (data.read !== undefined) {
      updates.push('read = ?');
      values.push(data.read ? 1 : 0);
    }

    updates.push('updated_at = ?');
    values.push(Date.now());

    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE notifications
      SET ${updates.join(', ')}
      WHERE id = ?
    `);

    stmt.run(...values);

    return this.findById(id)!;
  }

  /**
   * 删除通知
   */
  delete(id: string): void {
    const stmt = this.db.prepare('DELETE FROM notifications WHERE id = ?');
    stmt.run(id);
  }

  /**
   * 映射到Notification对象
   */
  private mapToNotification(row: any): Notification {
    return {
      id: row.id,
      title: row.title,
      content: row.content,
      type: row.type,
      read: Boolean(row.read),
      deviceId: row.device_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}
```

#### 4. 创建Service (services/NotificationService.ts)

```typescript
import { NotificationRepository } from '../repositories/NotificationRepository';
import { Notification, CreateNotificationRequest, UpdateNotificationRequest } from '../types';
import { validateRequired } from '../utils/validator';
import { getSSEService } from './SSEService';

export class NotificationService {
  private notificationRepository: NotificationRepository;

  constructor() {
    this.notificationRepository = new NotificationRepository();
  }

  /**
   * 创建通知并推送
   */
  create(data: CreateNotificationRequest): Notification {
    const error = validateRequired(data, ['title', 'content', 'type', 'deviceId']);
    if (error) throw new Error(error);

    // 创建通知
    const notification = this.notificationRepository.create(data);

    // 通过SSE推送给设备
    const sseService = getSSEService();
    if (sseService.isConnected(data.deviceId)) {
      sseService.sendMessage(data.deviceId, {
        type: 'NOTIFICATION',
        data: notification
      });
    }

    return notification;
  }

  /**
   * 获取设备的通知列表
   */
  findByDeviceId(deviceId: string): Notification[] {
    return this.notificationRepository.findByDeviceId(deviceId);
  }

  /**
   * 标记为已读
   */
  markAsRead(id: string): Notification {
    return this.notificationRepository.update(id, { read: true });
  }

  /**
   * 删除通知
   */
  delete(id: string): void {
    this.notificationRepository.delete(id);
  }
}
```

#### 5. 创建路由 (routes/manager/notifications.ts)

```typescript
import { Router, Request, Response } from 'express';
import { NotificationService } from '../../services/NotificationService';
import { success, error } from '../../utils/response';

const router = Router();
const notificationService = new NotificationService();

// 创建通知
router.post('/devices/:deviceId/notifications', (req: Request, res: Response) => {
  try {
    const notification = notificationService.create({
      ...req.body,
      deviceId: req.params.deviceId
    });
    res.json(success(notification));
  } catch (err: any) {
    res.json(error('INVALID_REQUEST', err.message));
  }
});

// 获取设备通知
router.get('/devices/:deviceId/notifications', (req: Request, res: Response) => {
  try {
    const notifications = notificationService.findByDeviceId(req.params.deviceId);
    res.json(success(notifications));
  } catch (err: any) {
    res.json(error('INTERNAL_ERROR', err.message));
  }
});

// 标记已读
router.put('/notifications/:id/read', (req: Request, res: Response) => {
  try {
    const notification = notificationService.markAsRead(req.params.id);
    res.json(success(notification));
  } catch (err: any) {
    res.json(error('INVALID_REQUEST', err.message));
  }
});

// 删除通知
router.delete('/notifications/:id', (req: Request, res: Response) => {
  try {
    notificationService.delete(req.params.id);
    res.json(success());
  } catch (err: any) {
    res.json(error('INVALID_REQUEST', err.message));
  }
});

export default router;
```

#### 6. 注册路由 (routes/manager/index.ts)

```typescript
import notificationRoutes from './notifications';

// ... 现有路由 ...

// 通知路由
router.use('/', notificationRoutes);

export default router;
```

#### 7. 添加SSE消息类型 (types/api.ts)

```typescript
export enum SSEMessageType {
  UNIT_DATA_CHANGED = 'UNIT_DATA_CHANGED',
  REMOTE_COMMAND = 'REMOTE_COMMAND',
  HEARTBEAT = 'HEARTBEAT',
  NOTIFICATION = 'NOTIFICATION'  // 新增
}
```

#### 8. 前端API调用 (web/src/services/api.ts)

```typescript
export const api = {
  // ... 现有API ...

  // Notification相关
  getNotifications: (deviceId: string) =>
    request(`/devices/${deviceId}/notifications`),
  createNotification: (deviceId: string, data: any) =>
    request(`/devices/${deviceId}/notifications`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  markNotificationAsRead: (id: string) =>
    request(`/notifications/${id}/read`, { method: 'PUT' }),
  deleteNotification: (id: string) =>
    request(`/notifications/${id}`, { method: 'DELETE' })
};
```

---

## 数据库操作

### 添加新表

1. 在 `database/schema.ts` 中添加表定义
2. 删除 `data/kernel.db` (开发环境)
3. 重启服务器,自动创建新表

### 修改现有表结构

**SQLite不支持ALTER TABLE的大部分操作**,建议:

1. 导出数据
2. 删除旧表
3. 创建新表
4. 导入数据

或使用迁移工具(生产环境推荐)。

### 查询优化

```typescript
// 使用索引
CREATE INDEX idx_table_column ON table(column);

// 使用prepared statements (已在Repository中实现)
const stmt = this.db.prepare('SELECT * FROM table WHERE id = ?');

// 批量插入
const stmt = this.db.prepare('INSERT INTO table VALUES (?, ?)');
const insert = this.db.transaction((items) => {
  for (const item of items) stmt.run(item.a, item.b);
});
insert(items);
```

---

## 前端开发

### 添加新页面

#### 1. 创建页面组件 (web/src/pages/NewPage.tsx)

```typescript
import { useState, useEffect } from 'react';
import { api } from '../services/api';

export function NewPage() {
  const [data, setData] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const result = await api.getNewData();
      setData(result);
    } catch (error) {
      console.error('加载失败:', error);
      alert('加载失败');
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-900">新页面</h2>
      {/* 页面内容 */}
    </div>
  );
}
```

#### 2. 添加到App.tsx

```typescript
import { NewPage } from './pages/NewPage';

const tabs = [
  // ... 现有tabs ...
  { id: 4, label: '新页面' }
];

// 在main中添加
{activeTab === 4 && <NewPage />}
```

### 组件库

推荐抽取通用组件:

#### Modal组件

```typescript
// web/src/components/Modal.tsx
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        {children}
      </div>
    </div>
  );
}
```

#### Table组件

```typescript
// web/src/components/Table.tsx
interface Column {
  key: string;
  label: string;
  render?: (value: any, row: any) => React.ReactNode;
}

interface TableProps {
  columns: Column[];
  data: any[];
}

export function Table({ columns, data }: TableProps) {
  return (
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-gray-50">
        <tr>
          {columns.map(col => (
            <th key={col.key} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {data.map((row, i) => (
          <tr key={i} className="hover:bg-gray-50">
            {columns.map(col => (
              <td key={col.key} className="px-6 py-4 text-sm">
                {col.render ? col.render(row[col.key], row) : row[col.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

---

## 调试技巧

### 后端调试

#### 1. 日志输出

```typescript
// 使用统一的日志前缀
console.log('[Service] 操作描述:', data);
console.error('[Service] 错误信息:', error);
```

#### 2. VSCode调试配置 (.vscode/launch.json)

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Kernel Server",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "skipFiles": ["<node_internals>/**"],
      "console": "integratedTerminal"
    }
  ]
}
```

#### 3. 数据库调试

```bash
# 使用SQLite命令行工具
sqlite3 data/kernel.db

# 查看表结构
.schema units

# 查询数据
SELECT * FROM units;

# 退出
.quit
```

### 前端调试

#### 1. React Developer Tools

安装Chrome扩展: React Developer Tools

#### 2. 网络请求监控

```typescript
// 在api.ts中添加日志
async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  console.log('[API] Request:', endpoint, options);

  const result = await response.json();

  console.log('[API] Response:', endpoint, result);

  return result.data;
}
```

#### 3. 状态调试

```typescript
// 使用useEffect监听状态变化
useEffect(() => {
  console.log('[State] entities changed:', entities);
}, [entities]);
```

---

## 最佳实践

### 代码规范

#### 1. 命名规范

```typescript
// 类名: PascalCase
class UnitService {}

// 函数名: camelCase
function findById() {}

// 常量: UPPER_SNAKE_CASE
const MAX_RETRY = 3;

// 接口: PascalCase, 以I开头或不加前缀
interface Unit {}
interface CreateUnitRequest {}
```

#### 2. 文件组织

```typescript
// 一个文件一个主要导出
export class UnitService {
  // ...
}

// 辅助类型可以同文件导出
export interface UnitServiceOptions {
  // ...
}
```

#### 3. 错误处理

```typescript
// Service层抛出错误
throw new Error('Unit not found');

// Route层捕获错误
try {
  const unit = unitService.findById(id);
  res.json(success(unit));
} catch (err: any) {
  console.error('[Route] Error:', err.message);
  res.json(error('INVALID_REQUEST', err.message));
}
```

### 性能优化

#### 1. 数据库查询

```typescript
// 避免N+1查询
// 不好的做法
const units = this.findAll();
units.forEach(unit => {
  unit.children = this.findChildren(unit.id); // N次查询
});

// 好的做法
const units = this.findAll();
const tree = buildTree(units); // 一次查询,内存构建
```

#### 2. 前端渲染

```typescript
// 使用React.memo避免不必要的重渲染
export const EntityRow = React.memo(({ entity, onEdit, onDelete }) => {
  // ...
});

// 使用useMemo缓存计算结果
const tree = useMemo(() => buildTree(entities), [entities]);
```

#### 3. API调用

```typescript
// 合并多个请求
const [models, terminals, entities] = await Promise.all([
  api.getUnits('model'),
  api.getUnits('terminal'),
  api.getUnits('entity')
]);

// 而不是
const models = await api.getUnits('model');
const terminals = await api.getUnits('terminal');
const entities = await api.getUnits('entity');
```

### 安全建议

#### 1. 参数验证

```typescript
// 使用validator工具
const error = validateRequired(data, ['name', 'key', 'type']);
if (error) throw new Error(error);

// JSON验证
const jsonError = validateJSON(data.value, 'value');
if (jsonError) throw new Error(jsonError);
```

#### 2. SQL注入防护

```typescript
// 使用prepared statements (已在Repository中实现)
const stmt = this.db.prepare('SELECT * FROM units WHERE id = ?');
const row = stmt.get(id); // 参数化查询,防止SQL注入
```

#### 3. Token安全

```typescript
// 生产环境配置
export const CONFIG = {
  CORS_ORIGIN: 'https://yourdomain.com', // 限制来源
  SSE_HEARTBEAT_INTERVAL: 30000,
  // Token过期时间(可选,需实现)
  TOKEN_EXPIRES_IN: 7 * 24 * 60 * 60 * 1000 // 7天
};
```

---

## 测试

### 单元测试 (可选)

```bash
npm install --save-dev jest @types/jest ts-jest
```

```typescript
// __tests__/UnitService.index.ts
import { UnitService } from '../src/services/UnitService';

describe('UnitService', () => {
  let service: UnitService;

  beforeEach(() => {
    service = new UnitService();
  });

  test('should create unit', () => {
    const unit = service.create({
      name: 'Test',
      key: 'test',
      type: 'entity'
    });

    expect(unit.id).toBeDefined();
    expect(unit.name).toBe('Test');
  });
});
```

### API测试

使用Postman或curl测试API:

```bash
# 测试创建单元
curl -X POST http://localhost:9999/kernel-server/manager/units \
  -H "Content-Type: application/json" \
  -d '{"name":"测试","key":"test","type":"entity"}'
```

---

## 部署清单

### 生产环境检查

- [ ] 修改 `CONFIG.CORS_ORIGIN` 为特定域名
- [ ] 配置环境变量(端口、数据库路径等)
- [ ] 备份数据库
- [ ] 设置日志输出到文件
- [ ] 配置进程管理器(PM2)
- [ ] 设置反向代理(Nginx)
- [ ] 启用HTTPS
- [ ] 配置防火墙规则

### 监控和维护

```bash
# 使用PM2
pm2 start dist/index.js --name kernel-server
pm2 logs kernel-server
pm2 monit

# 数据库备份
0 2 * * * cp /path/to/kernel.db /path/to/backup/kernel-$(date +\%Y\%m\%d).db
```

---

## 常见问题

### Q: 如何修改端口?

A: 编辑 `src/config/index.ts`,修改 `PORT` 配置。

### Q: 如何添加新的SSE消息类型?

A:
1. 在 `types/api.ts` 的 `SSEMessageType` 枚举中添加新类型
2. 在 `SSEService.ts` 中添加推送方法
3. 在业务逻辑中调用推送方法

### Q: 如何扩展前端UI?

A: 参考现有页面组件,使用Tailwind CSS保持一致性。

---

## 资源链接

- [TypeScript文档](https://www.typescriptlang.org/docs/)
- [Express文档](https://expressjs.com/)
- [Better-SQLite3文档](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md)
- [React文档](https://react.dev/)
- [Tailwind CSS文档](https://tailwindcss.com/docs)
- [Vite文档](https://vitejs.dev/)

---

> 如有其他问题,请参考 [README.md](./README.md) 和 [API.md](./API.md)
