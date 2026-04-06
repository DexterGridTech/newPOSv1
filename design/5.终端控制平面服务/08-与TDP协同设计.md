# 08-与TDP协同设计

## 1. TCP 与 TDP 协同概述

### 1.1 职责划分

**TCP（控制面）**：
- 管理终端身份、归属、能力（Who、Where、What）
- 定义任务发布（配置、升级、远控）
- **内部完成目标圈选**，产出明确的 `terminalId → taskInstance` 集合
- 追踪任务执行结果（lifecycleStatus 权威）
- 提供审计日志

**TDP（数据面）**：
- 管理终端在线连接（presenceStatus 权威）
- 可靠投递任务到终端（WebSocket 推送）
- 离线补偿机制
- Topic 订阅与消息推送
- 同步终端在线状态到 TCP

### 1.2 协同原则

1. **任务定义与投递分离**：TCP 定义任务并圈选终端，TDP 负责投递
2. **TCP 内部圈选**：TCP 提交给 TDP 的是**已解算后的终端级投递列表**，不是高层选择器
3. **状态分层**：
   - `lifecycleStatus`：控制面权威（TCP）
   - `presenceStatus`：连接会话态（TDP 同步给 TCP）
   - `healthStatus`：运维汇总态（TCP 计算）
4. **结果回报**：终端通过 HTTP 直接回报 TCP
5. **身份材料**：TCP 是终端身份的权威源

---

## 2. 任务委托协议（统一接口）

### 2.1 统一任务投递接口

TCP 通过**单一内部接口**向 TDP 提交任务，不再区分配置/升级/控制：

```http
POST /internal/control-plane/tasks/dispatch
Content-Type: application/json
Authorization: Bearer {tcp_internal_token}

{
  "releaseId": "release-001",
  "taskType": "CONFIG_PUBLISH",
  "priority": "NORMAL",
  "expiresAt": "2026-04-07T00:00:00Z",
  "instances": [
    {
      "instanceId": "inst-001",
      "terminalId": "pos-001",
      "payload": {
        "configVersionId": "cfg-20260406-001",
        "configData": {
          "printEnabled": true,
          "scanTimeout": 30000
        }
      }
    },
    {
      "instanceId": "inst-002",
      "terminalId": "pos-002",
      "payload": {
        "configVersionId": "cfg-20260406-001",
        "configData": {
          "printEnabled": true,
          "scanTimeout": 30000
        }
      }
    }
  ]
}
```

**关键设计：**
- TCP 已完成目标圈选，提交的是**明确的终端列表**（`terminalId`）
- 每个终端一个 `instanceId`，用于追踪执行状态
- 不使用 `orgScopeId + profileScopeId + terminalIds` 这种复合表达
- TDP 只负责投递，不负责解析目标范围

TDP 响应：

```json
{
  "code": 200,
  "data": {
    "releaseId": "release-001",
    "acceptedCount": 2,
    "rejectedInstances": []
  }
}
```

---

## 3. 状态同步协议

### 3.1 终端在线状态同步（TDP → TCP）

TDP 通过 WebHook 向 TCP 同步终端在线状态（presenceStatus）：

```http
POST /api/v1/tcp/terminals/presence-status
Content-Type: application/json
Authorization: Bearer {tdp_internal_token}

{
  "terminalId": "pos-001",
  "presenceStatus": "ONLINE",
  "lastSeenAt": "2026-04-06T10:00:00Z",
  "sessionId": "session-001",
  "ipAddress": "192.168.1.100"
}
```

TCP 响应：

```json
{
  "code": 200,
  "message": "success"
}
```

### 3.2 任务送达状态同步（TDP → TCP）

TDP 将任务推送到终端后，同步送达状态：

```http
POST /api/v1/tcp/tasks/delivery-status
Content-Type: application/json
Authorization: Bearer {tdp_internal_token}

{
  "instanceId": "inst-001",
  "deliveryStatus": "DELIVERED",
  "deliveredAt": "2026-04-06T10:00:30Z"
}
```

**deliveryStatus 枚举：**
- `DELIVERED`：已送达终端（WebSocket 推送成功）
- `DELIVERY_FAILED`：送达失败（终端离线或推送失败）

### 3.3 批量状态同步

```http
POST /api/v1/tcp/terminals/presence-status/batch
Content-Type: application/json
Authorization: Bearer {tdp_internal_token}

{
  "updates": [
    {
      "terminalId": "pos-001",
      "presenceStatus": "ONLINE",
      "lastSeenAt": "2026-04-06T10:00:00Z"
    },
    {
      "terminalId": "pos-002",
      "presenceStatus": "OFFLINE",
      "lastSeenAt": "2026-04-06T09:50:00Z"
    }
  ]
}
```

---

## 4. 结果回报协议（终端 → TCP）

### 4.1 统一结果回报接口

终端通过 HTTP API 向 TCP 回报任务执行结果：

```http
POST /api/v1/tcp/tasks/results
Content-Type: application/json
Authorization: Bearer {terminal_token}

{
  "instanceId": "inst-001",
  "status": "SUCCESS",
  "executedAt": "2026-04-06T10:05:00Z",
  "result": {
    "appliedConfigVersion": "cfg-20260406-001",
    "appliedAt": "2026-04-06T10:05:00Z"
  }
}
```

**说明：**
- `instanceId`：TerminalTaskInstance 的唯一标识
- `status`：执行状态（SUCCESS / FAILED）
- `result`：执行结果（不同任务类型有不同结构）
- **终端身份**：从 JWT token 中提取 `terminalId`，以 token 为准

### 4.2 配置发布结果

```json
{
  "instanceId": "inst-001",
  "status": "SUCCESS",
  "executedAt": "2026-04-06T10:05:00Z",
  "result": {
    "appliedConfigVersion": "cfg-20260406-001",
    "appliedAt": "2026-04-06T10:05:00Z"
  }
}
```

### 4.3 应用升级结果

```json
{
  "instanceId": "inst-002",
  "status": "SUCCESS",
  "executedAt": "2026-04-06T10:10:00Z",
  "result": {
    "installedVersion": "2.3.1",
    "installedAt": "2026-04-06T10:10:00Z",
    "restartedAt": "2026-04-06T10:11:00Z"
  }
}
```

### 4.4 远程控制结果

```json
{
  "instanceId": "inst-003",
  "status": "SUCCESS",
  "executedAt": "2026-04-06T10:05:00Z",
  "result": {
    "command": "RESTART",
    "restartedAt": "2026-04-06T10:05:00Z",
    "uptime": 120
  }
}
```

### 4.5 失败结果回报

```json
{
  "instanceId": "inst-004",
  "status": "FAILED",
  "executedAt": "2026-04-06T10:05:00Z",
  "errorCode": "CONFIG_VALIDATION_FAILED",
  "errorMessage": "配置校验失败：printEnabled 必须为布尔值"
}
```

---

## 5. TDP 客户端实现

### 5.1 TdpClient 接口

```java
public interface TdpClient {

    /**
     * 统一任务投递接口
     */
    void dispatchTasks(DispatchTasksRequest request);

    /**
     * 查询任务投递状态
     */
    TaskDispatchStatus queryDispatchStatus(String releaseId);
}
```

### 5.2 TdpClient 实现

```java
@Service
public class TdpClientImpl implements TdpClient {

    @Autowired
    private RestTemplate restTemplate;

    @Value("${tdp.api.base-url}")
    private String tdpBaseUrl;

    @Override
    public void dispatchTasks(DispatchTasksRequest request) {
        String url = tdpBaseUrl + "/internal/control-plane/tasks/dispatch";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(getTcpInternalToken());

        HttpEntity<DispatchTasksRequest> httpRequest = new HttpEntity<>(request, headers);

        try {
            ResponseEntity<TdpResponse> response = restTemplate.postForEntity(
                url, httpRequest, TdpResponse.class
            );

            if (response.getStatusCode() != HttpStatus.OK) {
                throw new TdpClientException("投递任务失败：" + response.getBody());
            }
        } catch (Exception e) {
            throw new TdpClientException("投递任务异常", e);
        }
    }

    @Override
    public TaskDispatchStatus queryDispatchStatus(String releaseId) {
        String url = tdpBaseUrl + "/internal/control-plane/tasks/" + releaseId + "/status";

        try {
            ResponseEntity<TaskDispatchStatus> response = restTemplate.getForEntity(
                url, TaskDispatchStatus.class
            );

            return response.getBody();
        } catch (Exception e) {
            throw new TdpClientException("查询任务状态异常", e);
        }
    }

    private String getTcpInternalToken() {
        // 生成 TCP 内部 Token（用于 TCP → TDP 调用）
        return jwtTokenGenerator.generateInternalToken("tcp-service");
    }
}

/**
 * 任务投递请求
 */
@Data
public class DispatchTasksRequest {
    private String releaseId;
    private TaskType taskType;
    private TaskPriority priority;
    private LocalDateTime expiresAt;
    private List<TaskInstanceDispatch> instances;
}

/**
 * 任务实例投递信息
 */
@Data
public class TaskInstanceDispatch {
    private String instanceId;
    private String terminalId;
    private Map<String, Object> payload;
}
```

---

## 6. 协同流程示例

### 6.1 统一任务发布完整流程

```
1. 运维后台创建任务发布（TCP）
   - 配置发布：创建 ConfigVersion → 创建 TaskRelease
   - 应用升级：创建 AppVersion → 创建 TaskRelease
   - 远程控制：直接创建 TaskRelease

2. TCP 内部圈选目标终端
   - 根据 targetScope（storeIds、profileIds、tags）查询终端
   - 应用灰度策略（百分比、白名单等）
   - 生成 TerminalTaskInstance 列表

3. TCP 调用 TDP 统一投递接口
   - POST /internal/control-plane/tasks/dispatch
   - 提交已解算的终端级任务列表

4. TDP 接受任务并投递
   - 在线终端：立即通过 WebSocket 推送
   - 离线终端：记录待补偿任务，等待上线后推送

5. TDP 同步送达状态到 TCP
   - POST /api/v1/tcp/tasks/delivery-status
   - 更新 TerminalTaskInstance.status = DELIVERED

6. 终端接收任务并执行
   - 终端从 WebSocket 接收任务
   - 根据 taskType 执行相应逻辑

7. 终端回报执行结果到 TCP
   - POST /api/v1/tcp/tasks/results
   - 携带 instanceId 和执行结果

8. TCP 更新任务实例状态
   - 更新 TerminalTaskInstance.status = SUCCESS/FAILED
   - 更新 TerminalTaskInstance.result

9. TCP 汇总统计并更新发布单
   - 统计各状态的实例数量
   - 更新 TaskRelease 统计信息
   - 判断是否全部完成

10. TCP 发布领域事件
    - TaskReleaseCompletedEvent
    - 触发后续业务逻辑（通知、审计等）
```

### 6.2 状态流转示例

```
TerminalTaskInstance 状态流转：

PENDING (TCP创建)
   ↓ TCP调用TDP
DISPATCHED (TDP已接受)
   ↓ TDP推送到终端
DELIVERED (终端已收到)
   ↓ 终端开始执行
EXECUTING (执行中，可选)
   ↓ 终端回报结果
SUCCESS / FAILED (完成)
```

---

## 7. 异常处理

### 7.1 TDP 不可用

```java
@Service
public class TdpClientWithRetry implements TdpClient {

    @Autowired
    private TdpClient tdpClient;

    @Retryable(
        value = {TdpClientException.class},
        maxAttempts = 3,
        backoff = @Backoff(delay = 1000, multiplier = 2)
    )
    @Override
    public void publishConfigTask(TdpConfigTask task) {
        tdpClient.publishConfigTask(task);
    }

    @Recover
    public void recoverPublishConfigTask(
            TdpClientException e, TdpConfigTask task) {
        // 记录失败日志
        log.error("发布配置任务失败，已重试 3 次：{}", task.getTaskId(), e);

        // 发送告警
        alertService.sendAlert("TDP 不可用", e.getMessage());

        // 标记任务为失败
        taskService.markTaskFailed(task.getTaskId(), "TDP 不可用");
    }
}
```

### 7.2 终端长时间未回报

```java
@Scheduled(fixedRate = 300000) // 每 5 分钟执行一次
public void checkTimeoutTasks() {
    LocalDateTime timeout = LocalDateTime.now().minusMinutes(30);

    List<TaskExecutionRecord> timeoutRecords = taskExecutionRecordRepository
        .findByStatusAndCreatedAtBefore(ExecutionStatus.PENDING, timeout);

    for (TaskExecutionRecord record : timeoutRecords) {
        record.markFailed("执行超时");
        taskExecutionRecordRepository.save(record);

        // 更新任务统计
        updateTaskStats(record.getTaskId());
    }
}
```

---

## 8. 本文结论

TCP 与 TDP 协同设计展示了完整的协同机制：

- **职责明确**：TCP 负责任务定义和目标圈选，TDP 负责可靠投递
- **统一接口**：单一内部接口 `/internal/control-plane/tasks/dispatch`，不再区分任务类型
- **TCP 内部圈选**：TCP 提交给 TDP 的是**已解算后的终端级投递列表**，不是高层选择器
- **状态分层**：
  - `lifecycleStatus`：控制面权威（TCP）
  - `presenceStatus`：连接会话态（TDP 同步给 TCP）
  - `healthStatus`：运维汇总态（TCP 计算）
- **Delivery vs Execution**：
  - Delivery 状态（DISPATCHED → DELIVERED）：TDP 负责
  - Execution 状态（EXECUTING → SUCCESS/FAILED）：终端执行
- **结果回报**：终端通过 HTTP 直接回报 TCP，以 token 中的 terminalId 为准
- **TdpClient**：封装 TDP API 调用，支持重试和异常处理
- **异常处理**：TDP 不可用、终端超时等异常场景的处理

TCP 与 TDP 各司其职，通过标准协议协同工作，实现终端控制面的完整闭环。

---

*上一篇：[07-REST API设计](./07-REST API设计.md)*
*下一篇：[09-部署运维与监控](./09-部署运维与监控.md)*
