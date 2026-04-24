# @next/communication-test

专门用于验证 `@next/kernel-core-communication` 的测试服务器。

## 端口

默认端口：`6190`

## HTTP 场景

- `GET /health`
- `POST /http/echo`
- `POST /http/devices/:deviceId/activate`
- `GET /http/envelope-success`
- `GET /http/envelope-error`
- `GET /http/slow?delayMs=1000`
- `GET /http/retry-once`
- `GET /http/failover`

## WS 场景

- `WS /ws/echo`
