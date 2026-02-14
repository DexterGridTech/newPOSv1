# IMPOS2 Kernel Server

> POS终端管理服务器 - 用于管理POS设备、业务主体、机型配置、单元数据和远程指令

## 📋 项目简介

IMPOS2 Kernel Server 是一个基于 Node.js + Express + SQLite + React 的 POS 终端管理系统,提供了完整的设备管理、数据同步、远程指令下发等功能。

### 核心功能

- 🏢 **业务主体管理** - 树形结构的业务实体管理
- 📱 **机型与终端管理** - POS机型定义和终端设备管理
- 💾 **单元数据管理** - 灵活的配置数据管理系统
- 📡 **实时通讯** - 基于WebSocket的设备实时连接
- 🎯 **远程指令** - 向在线设备发送远程指令
- 🔄 **增量同步** - 高效的数据增量同步机制

## 🚀 快速开始

### 环境要求

- Node.js >= 18.0.0
- npm >= 9.0.0

### 安装依赖

```bash
# 安装后端依赖
npm install --no-audit

# 安装前端依赖
cd web && npm install --no-audit
```

### 启动开发服务器

```bash
# 后端开发模式 (http://localhost:9999)
npm run dev

# 前端开发模式 (http://localhost:5173)
cd web && npm run dev
```

### 构建生产版本

```bash
# 构建后端和前端
npm run build

# 启动生产服务器
npm start
```

## 📂 项目结构

```
kernel-server/
├── src/                      # 后端源码
│   ├── config/              # 配置文件
│   │   └── master.ts         # 服务器配置
│   ├── database/            # 数据库
│   │   ├── schema.ts        # 表结构定义
│   │   └── master.ts         # 数据库初始化
│   ├── types/               # TypeScript类型定义
│   │   ├── unit.ts          # 单元类型
│   │   ├── device.ts        # 设备类型
│   │   ├── unitData.ts      # 单元数据类型
│   │   ├── command.ts       # 指令类型
│   │   └── api.ts           # API响应类型
│   ├── utils/               # 工具函数
│   │   ├── response.ts      # 响应封装
│   │   ├── idGenerator.ts   # ID生成
│   │   └── validator.ts     # 参数验证
│   ├── middlewares/         # 中间件
│   │   ├── cors.ts          # CORS配置
│   │   ├── errorHandler.ts  # 错误处理
│   │   └── tokenAuth.ts     # Token认证
│   ├── repositories/        # 数据访问层
│   │   ├── UnitRepository.ts
│   │   ├── DeviceRepository.ts
│   │   ├── UnitDataRepository.ts
│   │   └── CommandRepository.ts
│   ├── services/            # 业务逻辑层
│   │   ├── UnitService.ts
│   │   ├── DeviceService.ts
│   │   ├── UnitDataService.ts
│   │   ├── CommandService.ts
│   │   ├── WebSocketService.ts # WebSocket连接管理
│   │   └── DataSyncService.ts
│   ├── routes/              # 路由层
│   │   ├── api/             # 设备API
│   │   ├── manager/         # 管理后台API
│   ├── app.ts               # Express应用
│   └── master.ts             # 入口文件
├── web/                     # 前端源码
│   ├── src/
│   │   ├── pages/           # 页面组件
│   │   │   ├── EntityManagement.tsx
│   │   │   ├── ModelManagement.tsx
│   │   │   ├── UnitDataManagement.tsx
│   │   │   └── CommandManagement.tsx
│   │   ├── services/        # API服务
│   │   │   └── api.ts
│   │   ├── App.tsx          # 主应用
│   │   └── main.tsx         # 入口文件
│   ├── index.html
│   └── vite.config.ts
├── data/                    # 数据目录
│   └── kernel.db            # SQLite数据库文件(自动生成)
├── dist/                    # 构建输出(自动生成)
├── package.json
├── tsconfig.json
├── README.md                # 本文件
├── API.md                   # API文档
└── DEVELOPMENT.md           # 开发指南
```

## 🔧 配置说明

### 服务器配置 (src/config/master.ts)

```typescript
export const CONFIG = {
  PORT: 9999,                              // 服务器端口
  DB_PATH: './data/kernel.db',             // 数据库路径
  CORS_ORIGIN: '*',                        // CORS允许源
  HEARTBEAT_INTERVAL: 30000,               // 心跳间隔(30秒)
  HEARTBEAT_TIMEOUT: 60000,                // 心跳超时(60秒)
  ROUTES: {
    API: '/kernel-server/api',             // 设备API路径
    WS: '/kernel-server/ws',               // WebSocket连接路径
    MANAGER: '/kernel-server/manager',     // 管理API路径
    WEB: '/kernel-server'                  // Web界面路径
  }
};
```

## 📡 API 端点

### 管理后台 API (需要管理权限)

- **单元管理**: `/kernel-server/manager/units/*`
- **设备管理**: `/kernel-server/manager/devices/*`
- **数据管理**: `/kernel-server/manager/unit-data-*/*`
- **指令管理**: `/kernel-server/manager/command-*/*`

### 设备 API (需要Token认证)

- **设备激活**: `POST /kernel-server/api/device/activate`
- **设置操作实体**: `POST /kernel-server/api/device/operating-entity`
- **设备解绑**: `POST /kernel-server/api/device/deactivate`
- **数据同步**: `POST /kernel-server/api/unit-data/by-group`
- **指令确认**: `POST /kernel-server/api/command/confirm`

### WebSocket 连接

- **建立连接**: `ws://localhost:9999/kernel-server/ws/connect?deviceId={id}&token={token}`

详细API文档请查看 [API.md](./API.md)

## 🗄️ 数据库

使用 SQLite 作为数据库,包含以下主要表:

- `units` - 单元表(业务主体/机型/终端)
- `devices` - 设备表
- `device_connections` - 设备连接记录
- `unit_data_groups` - 单元数据分组
- `unit_data_items` - 单元数据项定义
- `unit_data_templates` - 单元数据模板
- `unit_data` - 单元数据
- `command_items` - 指令项定义
- `commands` - 指令
- `command_records` - 指令发送记录

## 🎨 管理后台

访问 `http://localhost:9999/kernel-server/manager` 打开管理后台。

### 功能模块

1. **业务主体管理** - 管理业务实体的树形结构
2. **机型管理** - 管理POS机型和终端设备
3. **单元数据管理** - 管理配置数据的分组和项目
4. **指令管理** - 管理指令定义并向设备发送指令

## 🔐 安全机制

- Token认证 - 设备API需要Token验证
- 激活码验证 - 设备激活时验证激活码
- 解绑码验证 - 设备解绑时验证解绑码
- CORS配置 - 跨域请求控制

## 📝 开发指南

如何扩展和修改系统,请查看 [DEVELOPMENT.md](./DEVELOPMENT.md)

### 常见任务

- 添加新的API端点
- 添加新的数据表
- 添加新的业务逻辑
- 自定义SSE消息类型
- 扩展前端页面

## 🧪 测试

```bash
# 运行测试(如果有)
npm test

# 检查TypeScript类型
npm run build
```

## 📦 部署

### 生产环境部署

```bash
# 1. 构建项目
npm run build

# 2. 启动服务器
npm start

# 或使用 PM2
pm2 start dist/index.js --name kernel-server
```

### Docker部署 (可选)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production --no-audit
COPY dist ./dist
COPY web/dist ./web/dist
EXPOSE 9999
CMD ["node", "dist/index.js"]
```

## 🔄 数据备份

```bash
# 备份数据库
cp data/kernel.db data/kernel.db.backup

# 恢复数据库
cp data/kernel.db.backup data/kernel.db
```

## 📚 相关文档

- [API 文档](./API.md) - 完整的API调用说明
- [开发指南](./DEVELOPMENT.md) - 如何扩展和修改系统
- [架构设计](./ARCHITECTURE.md) - 系统架构和设计理念

## ⚠️ 注意事项

1. **数据库文件** - `data/kernel.db` 会在首次启动时自动创建
2. **端口占用** - 默认端口9999,如需修改请编辑 `src/config/master.ts`
3. **CORS配置** - 生产环境建议限制 `CORS_ORIGIN` 为特定域名
4. **Token安全** - Token存储在数据库中,请确保数据库安全
5. **并发限制** - SQLite在高并发写入时可能有性能瓶颈

## 🐛 问题排查

### 常见问题

**1. 端口被占用**
```bash
# 查看端口占用
lsof -i :9999
# 修改配置文件中的端口号
```

**2. 数据库锁定**
```bash
# 检查是否有多个进程访问数据库
ps aux | grep kernel-server
```

**3. WebSocket连接断开**
- 检查网络稳定性
- 查看心跳日志
- 确认Token有效性

## 📄 许可证

MIT License

## 👥 贡献者

- Claude Code Assistant

## 📞 联系方式

如有问题或建议,请提交 Issue。

---

> **注意**: 本项目为测试服务器,仅用于开发和测试环境。生产环境使用请进行充分的安全评估和性能测试。
