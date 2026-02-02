# HTTP 客户端模块

基于 axios 实现的 HTTP 客户端，提供健壮、通用、可扩展的 HTTP 请求能力。

## 特性

- **单例模式**: ApiManager 全局唯一实例
- **多服务器支持**: 支持配置多个服务器地址，自动轮询重试
- **断路器模式**: 防止故障扩散，自动熔断和恢复
- **请求队列**: 并发控制和速率限制
- **拦截器系统**: 支持请求/响应拦截器
- **动态地址注入**: 服务器地址外部配置，支持热更新
- **请求指标**: 统计请求成功率、响应时间等

## 模块结构

```
src/core/http/
├── ApiManager.ts          # API管理器（单例）
├── Api.ts                 # 单个API请求封装
├── CircuitBreakerManager.ts # 断路器
├── RequestQueueManager.ts  # 请求队列
└── index.ts               # 模块导出
```

## 快速开始

### 1. 初始化服务器地址

```typescript
import { ApiManager, ApiServerAddress } from '@kernel/base';

const serverAddress: ApiServerAddress = {
  serverName: 'kernel-server',
  addresses: [
    {
      addressName: '主线路1',
      baseURL: 'http://127.0.0.1:9999/kernel-server',
      timeout: 10000,
    },
    {
      addressName: '主线路2',
      baseURL: 'http://localhost:9999/kernel-server',
      timeout: 10000,
    },
  ],
  retryCount: 3,
  retryInterval: 1000,
};

ApiManager.getInstance().initApiServerAddress(serverAddress);
```

### 2. 发送请求

```typescript
import { Api, HttpMethod } from '@kernel/base';

// 创建API实例
const api = new Api<RequestType, ResponseType>(
  'kernel-server',
  '/device/activate',
  HttpMethod.POST
);

// 发送请求
const response = await api.run({ request: { activeCode: '123' } });

if (response.code === 'SUCCESS') {
  console.log('成功:', response.data);
} else {
  console.error('失败:', response.message);
}
```

### 3. 取消请求

```typescript
const api = new Api('kernel-server', '/data/sync', HttpMethod.POST);

// 发送请求
const promise = api.run({ request: data });

// 取消请求
api.cancel('用户取消');
```

## API 参考

### ApiManager

| 方法 | 说明 |
|------|------|
| `getInstance()` | 获取单例实例 |
| `initApiServerAddress(config)` | 初始化服务器地址 |
| `updateServerConfig(name, updates)` | 热更新服务器配置 |
| `addRequestInterceptor(interceptor)` | 添加请求拦截器 |
| `addResponseInterceptor(interceptor)` | 添加响应拦截器 |
| `getMetrics()` | 获取请求指标 |
| `getCircuitBreakerStates()` | 获取断路器状态 |
| `resetCircuitBreaker(serverName)` | 重置断路器 |

### Api

| 方法 | 说明 |
|------|------|
| `run(requestWrapper, timeout?)` | 执行请求 |
| `cancel(reason?)` | 取消请求 |

### 断路器状态 (CircuitState)

| 状态 | 说明 |
|------|------|
| `CLOSED` | 正常状态，允许请求 |
| `OPEN` | 熔断状态，拒绝请求 |
| `HALF_OPEN` | 半开状态，尝试恢复 |

## 配置说明

### ApiServerAddress

```typescript
interface ApiServerAddress {
  serverName: string;        // 服务器名称
  addresses: AddressConfig[]; // 地址列表
  retryCount: number;        // 重试次数
  retryInterval: number;     // 重试间隔 (毫秒)
}
```

### AddressConfig

```typescript
interface AddressConfig {
  addressName: string;  // 地址名称
  baseURL: string;      // 基础URL
  timeout: number;      // 超时时间 (毫秒)
}
```

## 拦截器

```typescript
// 添加请求拦截器
ApiManager.getInstance().addRequestInterceptor({
  serverName: 'kernel-server', // 可选，为空则应用到所有服务器
  onRequest: (config) => {
    config.headers['Authorization'] = 'Bearer token';
    return config;
  },
});

// 添加响应拦截器
ApiManager.getInstance().addResponseInterceptor({
  onResponse: (response) => {
    console.log('响应:', response.status);
    return response;
  },
});
```

## 错误码 (APIErrorCode)

| 错误码 | 说明 |
|--------|------|
| `SUCCESS` | 成功 |
| `NETWORK_ERROR` | 网络错误 |
| `CIRCUIT_BREAKER_OPEN` | 断路器打开 |
| `ALL_SERVERS_FAILED` | 所有服务器失败 |
| `REQUEST_CANCELLED` | 请求已取消 |
| `RATE_LIMIT_EXCEEDED` | 超过速率限制 |

## 工作流程

```
请求 → 速率限制检查 → 并发控制 → 断路器检查 → 轮询服务器 → 响应
                                      ↓
                              失败时自动重试下一个地址
```
