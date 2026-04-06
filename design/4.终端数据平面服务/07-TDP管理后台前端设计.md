# TDP管理后台前端设计

> 版本：1.0 | 状态：正式稿 | 日期：2026-04-06

---

## 1. 系统概述

### 1.1 系统定位

TDP管理后台是面向平台运营人员和技术支持人员的Web管理平台，用于管理终端数据平面服务的Topic注册、监控终端连接状态、查看数据推送情况、排查推送问题。

**核心价值：**
- 统一的Topic治理入口
- 实时的终端连接监控
- 可视化的数据推送链路追踪
- 便捷的问题排查工具

### 1.2 用户角色

| 角色 | 权限范围 | 主要职责 |
|------|---------|---------|
| 平台管理员 | 全部功能 | Topic注册、系统配置、全局监控 |
| 运营人员 | 监控、查询 | 连接监控、推送查询、问题排查 |
| 技术支持 | 监控、查询、调试 | 故障排查、数据追踪、性能分析 |
| 只读用户 | 查看权限 | 数据查询、报表查看 |

### 1.3 功能模块

```
TDP管理后台
├── Topic管理
│   ├── Topic注册表
│   ├── Schema管理
│   └── 订阅矩阵
├── 连接监控
│   ├── 会话列表
│   ├── 连接统计
│   └── 在线终端
├── 推送监控
│   ├── 推送记录
│   ├── 推送统计
│   └── 失败追踪
├── 数据查询
│   ├── Projection查询
│   ├── Change Log查询
│   └── Cursor状态
├── 联邦管理
│   ├── L1/L2节点
│   ├── 同步状态
│   └── 节点切换
└── 系统管理
    ├── 配置管理
    └── 操作日志
```

## 2. 技术架构

### 2.1 技术栈

**前端框架：**
- React 18.x + TypeScript 5.x
- Vite 5.x

**UI组件库：**
- Ant Design 5.x
- Ant Design Charts

**状态管理：**
- Redux Toolkit + RTK Query

**实时通信：**
- WebSocket（监控数据实时更新）

### 2.2 项目结构

```
tdp-admin-frontend/
├── src/
│   ├── api/
│   │   ├── topic.ts
│   │   ├── session.ts
│   │   ├── projection.ts
│   │   └── federation.ts
│   ├── pages/
│   │   ├── Topic/
│   │   ├── Session/
│   │   ├── Projection/
│   │   └── Federation/
│   ├── components/
│   │   ├── TopicSchemaEditor/
│   │   ├── SessionMonitor/
│   │   └── ProjectionViewer/
│   └── utils/
│       └── websocket.ts
```

## 3. Topic管理模块

### 3.1 Topic注册表页面

```typescript
// src/pages/Topic/Registry/index.tsx
import React, { useState } from 'react'
import { Table, Card, Button, Space, Tag, Modal, Form, Input, Select } from 'antd'
import { PlusOutlined } from '@ant-design/icons'

interface Topic {
  id: string
  topic: string
  topicType: 'retained_state' | 'durable_event' | 'ephemeral_cmd'
  ownerDomain: string
  schemaVersion: string
  allowedScopeTypes: string[]
  maxPayloadSize: number
  retentionPolicy: string
  status: 'ACTIVE' | 'DEPRECATED'
  createdAt: string
}

const TopicRegistry: React.FC = () => {
  const [modalVisible, setModalVisible] = useState(false)
  const [form] = Form.useForm()

  const columns = [
    {
      title: 'Topic名称',
      dataIndex: 'topic',
      key: 'topic',
      render: (topic: string) => <code>{topic}</code>,
    },
    {
      title: 'Topic类型',
      dataIndex: 'topicType',
      key: 'topicType',
      render: (type: string) => {
        const typeConfig = {
          retained_state: { color: 'blue', text: '保留态' },
          durable_event: { color: 'orange', text: '耐久事件' },
          ephemeral_cmd: { color: 'purple', text: '点对点命令' },
        }
        const config = typeConfig[type]
        return <Tag color={config.color}>{config.text}</Tag>
      },
    },
    { title: '归属业务域', dataIndex: 'ownerDomain', key: 'ownerDomain' },
    { title: 'Schema版本', dataIndex: 'schemaVersion', key: 'schemaVersion' },
    {
      title: '允许Scope',
      dataIndex: 'allowedScopeTypes',
      key: 'allowedScopeTypes',
      render: (types: string[]) => (
        <>
          {types.map((type) => (
            <Tag key={type}>{type}</Tag>
          ))}
        </>
      ),
    },
    {
      title: '最大载荷',
      dataIndex: 'maxPayloadSize',
      key: 'maxPayloadSize',
      render: (size: number) => `${(size / 1024).toFixed(0)} KB`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'ACTIVE' ? 'success' : 'default'}>
          {status === 'ACTIVE' ? '启用' : '已废弃'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" onClick={() => handleViewSchema(record)}>
            查看Schema
          </Button>
          <Button type="link" size="small" onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Button type="link" size="small" onClick={() => handleViewSubscribers(record)}>
            订阅终端
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <Card>
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
          注册Topic
        </Button>
      </div>

      <Table columns={columns} rowKey="id" />

      {/* 注册Topic弹窗 */}
      <Modal
        title="注册Topic"
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={800}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="topic" label="Topic名称" rules={[{ required: true }]}>
            <Input placeholder="例如: menu.catalog" />
          </Form.Item>
          <Form.Item name="topicType" label="Topic类型" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="retained_state">保留态</Select.Option>
              <Select.Option value="durable_event">耐久事件</Select.Option>
              <Select.Option value="ephemeral_cmd">点对点命令</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="ownerDomain" label="归属业务域" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="product">商品与门店经营域</Select.Option>
              <Select.Option value="order">交易域</Select.Option>
              <Select.Option value="fulfillment">履约与生产域</Select.Option>
              <Select.Option value="booking">预订域</Select.Option>
              <Select.Option value="channel">渠道集成域</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="allowedScopeTypes" label="允许的Scope类型" rules={[{ required: true }]}>
            <Select mode="multiple">
              <Select.Option value="platform">平台</Select.Option>
              <Select.Option value="project">商场</Select.Option>
              <Select.Option value="tenant">租户</Select.Option>
              <Select.Option value="brand">品牌</Select.Option>
              <Select.Option value="store">门店</Select.Option>
              <Select.Option value="terminal">终端</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="maxPayloadSize" label="最大载荷大小(KB)" rules={[{ required: true }]}>
            <InputNumber min={1} max={1024} />
          </Form.Item>
          <Form.Item name="retentionPolicy" label="保留策略" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="permanent">永久</Select.Option>
              <Select.Option value="ttl">TTL</Select.Option>
              <Select.Option value="tombstone">Tombstone</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}

export default TopicRegistry
```

### 3.2 Schema管理页面

```typescript
// src/pages/Topic/Schema/index.tsx
import React, { useState } from 'react'
import { Card, Tabs, Button, Modal } from 'antd'
import MonacoEditor from '@monaco-editor/react'

interface SchemaEditorProps {
  topic: string
  schema: string
  onSave: (schema: string) => void
}

const SchemaEditor: React.FC<SchemaEditorProps> = ({ topic, schema, onSave }) => {
  const [editorValue, setEditorValue] = useState(schema)
  const [previewVisible, setPreviewVisible] = useState(false)

  return (
    <Card title={`Schema编辑器 - ${topic}`}>
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" onClick={() => onSave(editorValue)}>
          保存Schema
        </Button>
        <Button style={{ marginLeft: 8 }} onClick={() => setPreviewVisible(true)}>
          预览示例
        </Button>
      </div>

      <MonacoEditor
        height="500px"
        language="json"
        theme="vs-dark"
        value={editorValue}
        onChange={(value) => setEditorValue(value || '')}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
        }}
      />

      {/* Schema示例预览 */}
      <Modal
        title="Payload示例"
        open={previewVisible}
        onCancel={() => setPreviewVisible(false)}
        footer={null}
        width={800}
      >
        <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 4 }}>
          {generateExample(editorValue)}
        </pre>
      </Modal>
    </Card>
  )
}

export default SchemaEditor
```

### 3.3 订阅矩阵页面

```typescript
// src/pages/Topic/Subscription/index.tsx
import React from 'react'
import { Card, Table } from 'antd'
import { CheckCircleFilled, MinusCircleFilled } from '@ant-design/icons'

const SubscriptionMatrix: React.FC = () => {
  // 终端类型
  const deviceTypes = ['POS', 'KIOSK', 'KDS', 'PDA', '打包台', '叫号屏', '顾客小程序']

  // Topic列表
  const topics = [
    'menu.catalog',
    'menu.availability',
    'store.config',
    'config.system-params',
    'order.pending',
    'table.status',
    'workunit.active',
    'order.urge',
    'print.command',
    'remote.control',
  ]

  // 订阅关系矩阵
  const subscriptionMatrix = {
    'menu.catalog': { POS: true, KIOSK: true, KDS: false, PDA: false, 打包台: false, 叫号屏: false, 顾客小程序: true },
    'menu.availability': { POS: true, KIOSK: true, KDS: false, PDA: false, 打包台: false, 叫号屏: false, 顾客小程序: true },
    'store.config': { POS: true, KIOSK: true, KDS: true, PDA: true, 打包台: true, 叫号屏: false, 顾客小程序: false },
    'config.system-params': { POS: true, KIOSK: true, KDS: true, PDA: true, 打包台: true, 叫号屏: true, 顾客小程序: false },
    'order.pending': { POS: true, KIOSK: false, KDS: false, PDA: false, 打包台: false, 叫号屏: false, 顾客小程序: false },
    'table.status': { POS: true, KIOSK: false, KDS: false, PDA: true, 打包台: false, 叫号屏: false, 顾客小程序: false },
    'workunit.active': { POS: false, KIOSK: false, KDS: true, PDA: false, 打包台: true, 叫号屏: false, 顾客小程序: false },
    'order.urge': { POS: true, KIOSK: false, KDS: true, PDA: false, 打包台: false, 叫号屏: false, 顾客小程序: false },
    'print.command': { POS: true, KIOSK: true, KDS: false, PDA: false, 打包台: false, 叫号屏: false, 顾客小程序: false },
    'remote.control': { POS: true, KIOSK: true, KDS: true, PDA: true, 打包台: true, 叫号屏: true, 顾客小程序: false },
  }

  const columns = [
    {
      title: 'Topic',
      dataIndex: 'topic',
      key: 'topic',
      fixed: 'left' as const,
      width: 200,
      render: (topic: string) => <code>{topic}</code>,
    },
    ...deviceTypes.map((deviceType) => ({
      title: deviceType,
      dataIndex: deviceType,
      key: deviceType,
      width: 100,
      align: 'center' as const,
      render: (subscribed: boolean) =>
        subscribed ? (
          <CheckCircleFilled style={{ color: '#52c41a', fontSize: 18 }} />
        ) : (
          <MinusCircleFilled style={{ color: '#d9d9d9', fontSize: 18 }} />
        ),
    })),
  ]

  const dataSource = topics.map((topic) => ({
    topic,
    ...subscriptionMatrix[topic],
  }))

  return (
    <Card title="终端订阅矩阵">
      <Table
        columns={columns}
        dataSource={dataSource}
        rowKey="topic"
        pagination={false}
        scroll={{ x: 1200 }}
      />
    </Card>
  )
}

export default SubscriptionMatrix
```

## 4. 连接监控模块

### 4.1 会话列表页面

```typescript
// src/pages/Session/List/index.tsx
import React, { useEffect, useState } from 'react'
import { Table, Card, Form, Input, Select, Button, Space, Tag, Badge } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'

interface Session {
  sessionId: string
  terminalId: string
  deviceType: string
  storeId: string
  storeName: string
  nodeId: string
  connectedAt: string
  lastHeartbeatAt: string
  cursor: number
  status: 'CONNECTED' | 'DISCONNECTED'
}

const SessionList: React.FC = () => {
  const [form] = Form.useForm()
  const [sessions, setSessions] = useState<Session[]>([])
  const [stats, setStats] = useState({ total: 0, connected: 0, disconnected: 0 })

  // WebSocket实时更新
  useEffect(() => {
    const ws = new WebSocket(`${WS_URL}/tdp/sessions/monitor`)

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      setSessions(data.sessions)
      setStats(data.stats)
    }

    return () => ws.close()
  }, [])

  const columns = [
    {
      title: '会话ID',
      dataIndex: 'sessionId',
      key: 'sessionId',
      width: 150,
      render: (id: string) => <code>{id.substring(0, 8)}</code>,
    },
    { title: '终端ID', dataIndex: 'terminalId', key: 'terminalId' },
    { title: '设备类型', dataIndex: 'deviceType', key: 'deviceType' },
    { title: '门店', dataIndex: 'storeName', key: 'storeName' },
    {
      title: '节点',
      dataIndex: 'nodeId',
      key: 'nodeId',
      render: (nodeId: string) => <Tag color="blue">{nodeId}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Badge
          status={status === 'CONNECTED' ? 'success' : 'default'}
          text={status === 'CONNECTED' ? '在线' : '离线'}
        />
      ),
    },
    { title: '连接时间', dataIndex: 'connectedAt', key: 'connectedAt' },
    { title: '最后心跳', dataIndex: 'lastHeartbeatAt', key: 'lastHeartbeatAt' },
    { title: 'Cursor', dataIndex: 'cursor', key: 'cursor' },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" onClick={() => handleViewDetail(record)}>
            详情
          </Button>
          <Button type="link" size="small" onClick={() => handleViewProjections(record)}>
            查看Projection
          </Button>
          {record.status === 'CONNECTED' && (
            <Button type="link" size="small" danger onClick={() => handleDisconnect(record)}>
              断开
            </Button>
          )}
        </Space>
      ),
    },
  ]

  return (
    <Card>
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card>
            <Statistic title="总会话数" value={stats.total} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="在线会话"
              value={stats.connected}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="离线会话"
              value={stats.disconnected}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 搜索表单 */}
      <Form form={form} layout="inline" style={{ marginBottom: 16 }}>
        <Form.Item name="terminalId" label="终端ID">
          <Input placeholder="请输入" style={{ width: 200 }} />
        </Form.Item>
        <Form.Item name="deviceType" label="设备类型">
          <Select placeholder="请选择" style={{ width: 150 }} allowClear>
            <Select.Option value="POS">POS</Select.Option>
            <Select.Option value="KDS">KDS</Select.Option>
            <Select.Option value="PDA">PDA</Select.Option>
          </Select>
        </Form.Item>
        <Form.Item name="status" label="状态">
          <Select placeholder="请选择" style={{ width: 120 }} allowClear>
            <Select.Option value="CONNECTED">在线</Select.Option>
            <Select.Option value="DISCONNECTED">离线</Select.Option>
          </Select>
        </Form.Item>
        <Form.Item>
          <Space>
            <Button type="primary">查询</Button>
            <Button icon={<ReloadOutlined />}>刷新</Button>
          </Space>
        </Form.Item>
      </Form>

      <Table columns={columns} dataSource={sessions} rowKey="sessionId" />
    </Card>
  )
}

export default SessionList
```

## 5. 推送监控模块

### 5.1 推送记录页面

```typescript
// src/pages/Push/Records/index.tsx
import React from 'react'
import { Table, Card, Form, Input, Select, DatePicker, Button, Space, Tag } from 'antd'

interface PushRecord {
  id: string
  topic: string
  itemKey: string
  scopeId: string
  revision: number
  targetTerminals: number
  successCount: number
  failedCount: number
  pushedAt: string
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED'
}

const PushRecords: React.FC = () => {
  const [form] = Form.useForm()

  const columns = [
    { title: 'Revision', dataIndex: 'revision', key: 'revision', width: 100 },
    {
      title: 'Topic',
      dataIndex: 'topic',
      key: 'topic',
      render: (topic: string) => <code>{topic}</code>,
    },
    { title: 'ItemKey', dataIndex: 'itemKey', key: 'itemKey' },
    { title: 'Scope', dataIndex: 'scopeId', key: 'scopeId' },
    { title: '目标终端', dataIndex: 'targetTerminals', key: 'targetTerminals' },
    {
      title: '推送结果',
      key: 'result',
      render: (_, record) => (
        <div>
          <Tag color="success">成功: {record.successCount}</Tag>
          <Tag color="error">失败: {record.failedCount}</Tag>
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const statusConfig = {
          SUCCESS: { color: 'success', text: '成功' },
          PARTIAL: { color: 'warning', text: '部分成功' },
          FAILED: { color: 'error', text: '失败' },
        }
        const config = statusConfig[status]
        return <Tag color={config.color}>{config.text}</Tag>
      },
    },
    { title: '推送时间', dataIndex: 'pushedAt', key: 'pushedAt' },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" onClick={() => handleViewDetail(record)}>
            详情
          </Button>
          <Button type="link" size="small" onClick={() => handleViewPayload(record)}>
            查看Payload
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <Card>
      <Form form={form} layout="inline" style={{ marginBottom: 16 }}>
        <Form.Item name="topic" label="Topic">
          <Select placeholder="请选择" style={{ width: 200 }} allowClear>
            <Select.Option value="menu.catalog">menu.catalog</Select.Option>
            <Select.Option value="order.pending">order.pending</Select.Option>
            <Select.Option value="workunit.active">workunit.active</Select.Option>
          </Select>
        </Form.Item>
        <Form.Item name="scopeId" label="Scope">
          <Input placeholder="例如: store:s-001" style={{ width: 200 }} />
        </Form.Item>
        <Form.Item name="status" label="状态">
          <Select placeholder="请选择" style={{ width: 120 }} allowClear>
            <Select.Option value="SUCCESS">成功</Select.Option>
            <Select.Option value="PARTIAL">部分成功</Select.Option>
            <Select.Option value="FAILED">失败</Select.Option>
          </Select>
        </Form.Item>
        <Form.Item name="dateRange" label="时间范围">
          <DatePicker.RangePicker showTime />
        </Form.Item>
        <Form.Item>
          <Space>
            <Button type="primary">查询</Button>
            <Button>重置</Button>
          </Space>
        </Form.Item>
      </Form>

      <Table columns={columns} rowKey="id" />
    </Card>
  )
}

export default PushRecords
```

### 5.2 推送统计页面

```typescript
// src/pages/Push/Statistics/index.tsx
import React from 'react'
import { Card, Row, Col, Statistic, DatePicker } from 'antd'
import { Line, Column } from '@ant-design/charts'
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons'

const PushStatistics: React.FC = () => {
  return (
    <div>
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic title="今日推送总数" value={12580} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="推送成功率"
              value={99.8}
              precision={2}
              valueStyle={{ color: '#3f8600' }}
              prefix={<ArrowUpOutlined />}
              suffix="%"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="平均推送延迟"
              value={85}
              suffix="ms"
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="失败推送数"
              value={25}
              valueStyle={{ color: '#cf1322' }}
              prefix={<ArrowDownOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 推送趋势图 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <Card title="推送量趋势">
            <PushTrendChart />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="Topic推送分布">
            <TopicDistributionChart />
          </Card>
        </Col>
      </Row>

      {/* 推送延迟分布 */}
      <Row gutter={16}>
        <Col span={24}>
          <Card title="推送延迟分布">
            <LatencyDistributionChart />
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default PushStatistics
```

## 6. 数据查询模块

### 6.1 Projection查询页面

```typescript
// src/pages/Data/Projection/index.tsx
import React, { useState } from 'react'
import { Card, Form, Input, Select, Button, Space, Descriptions, Modal } from 'antd'
import MonacoEditor from '@monaco-editor/react'

const ProjectionQuery: React.FC = () => {
  const [form] = Form.useForm()
  const [projection, setProjection] = useState<any>(null)
  const [payloadVisible, setPayloadVisible] = useState(false)

  const handleQuery = async () => {
    const values = await form.validateFields()
    // 调用API查询Projection
    const result = await queryProjection(values)
    setProjection(result)
  }

  return (
    <div>
      <Card title="Projection查询" style={{ marginBottom: 16 }}>
        <Form form={form} layout="inline">
          <Form.Item name="topic" label="Topic" rules={[{ required: true }]}>
            <Select placeholder="请选择" style={{ width: 200 }}>
              <Select.Option value="menu.catalog">menu.catalog</Select.Option>
              <Select.Option value="order.pending">order.pending</Select.Option>
              <Select.Option value="workunit.active">workunit.active</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="itemKey" label="ItemKey" rules={[{ required: true }]}>
            <Input placeholder="例如: product:prod_001" style={{ width: 250 }} />
          </Form.Item>
          <Form.Item name="scopeId" label="Scope" rules={[{ required: true }]}>
            <Input placeholder="例如: store:s-001" style={{ width: 200 }} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" onClick={handleQuery}>
                查询
              </Button>
              <Button>重置</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      {projection && (
        <Card title="查询结果">
          <Descriptions column={2}>
            <Descriptions.Item label="Topic">{projection.topic}</Descriptions.Item>
            <Descriptions.Item label="ItemKey">{projection.itemKey}</Descriptions.Item>
            <Descriptions.Item label="Scope">{projection.scopeId}</Descriptions.Item>
            <Descriptions.Item label="Revision">{projection.revision}</Descriptions.Item>
            <Descriptions.Item label="创建时间">{projection.createdAt}</Descriptions.Item>
            <Descriptions.Item label="更新时间">{projection.updatedAt}</Descriptions.Item>
          </Descriptions>

          <div style={{ marginTop: 16 }}>
            <Button type="primary" onClick={() => setPayloadVisible(true)}>
              查看Payload
            </Button>
          </div>

          <Modal
            title="Payload内容"
            open={payloadVisible}
            onCancel={() => setPayloadVisible(false)}
            footer={null}
            width={800}
          >
            <MonacoEditor
              height="500px"
              language="json"
              theme="vs-dark"
              value={JSON.stringify(projection.payload, null, 2)}
              options={{
                readOnly: true,
                minimap: { enabled: false },
              }}
            />
          </Modal>
        </Card>
      )}
    </div>
  )
}

export default ProjectionQuery
```

### 6.2 Change Log查询页面

```typescript
// src/pages/Data/ChangeLog/index.tsx
import React from 'react'
import { Table, Card, Form, Input, Select, DatePicker, Button, Space, Tag } from 'antd'

interface ChangeLog {
  id: string
  revision: number
  topic: string
  itemKey: string
  scopeId: string
  operation: 'UPSERT' | 'DELETE'
  occurredAt: string
  sourceSystem: string
}

const ChangeLogQuery: React.FC = () => {
  const [form] = Form.useForm()

  const columns = [
    { title: 'Revision', dataIndex: 'revision', key: 'revision', width: 100 },
    {
      title: 'Topic',
      dataIndex: 'topic',
      key: 'topic',
      render: (topic: string) => <code>{topic}</code>,
    },
    { title: 'ItemKey', dataIndex: 'itemKey', key: 'itemKey' },
    { title: 'Scope', dataIndex: 'scopeId', key: 'scopeId' },
    {
      title: '操作',
      dataIndex: 'operation',
      key: 'operation',
      render: (op: string) => (
        <Tag color={op === 'UPSERT' ? 'blue' : 'red'}>{op}</Tag>
      ),
    },
    { title: '来源系统', dataIndex: 'sourceSystem', key: 'sourceSystem' },
    { title: '发生时间', dataIndex: 'occurredAt', key: 'occurredAt' },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button type="link" size="small" onClick={() => handleViewDetail(record)}>
          查看详情
        </Button>
      ),
    },
  ]

  return (
    <Card>
      <Form form={form} layout="inline" style={{ marginBottom: 16 }}>
        <Form.Item name="topic" label="Topic">
          <Select placeholder="请选择" style={{ width: 200 }} allowClear>
            <Select.Option value="menu.catalog">menu.catalog</Select.Option>
            <Select.Option value="order.pending">order.pending</Select.Option>
          </Select>
        </Form.Item>
        <Form.Item name="scopeId" label="Scope">
          <Input placeholder="例如: store:s-001" style={{ width: 200 }} />
        </Form.Item>
        <Form.Item name="revisionRange" label="Revision范围">
          <Space>
            <InputNumber placeholder="起始" />
            <span>-</span>
            <InputNumber placeholder="结束" />
          </Space>
        </Form.Item>
        <Form.Item name="dateRange" label="时间范围">
          <DatePicker.RangePicker showTime />
        </Form.Item>
        <Form.Item>
          <Space>
            <Button type="primary">查询</Button>
            <Button>重置</Button>
          </Space>
        </Form.Item>
      </Form>

      <Table columns={columns} rowKey="id" />
    </Card>
  )
}

export default ChangeLogQuery
```

### 6.3 Cursor状态页面

```typescript
// src/pages/Data/Cursor/index.tsx
import React from 'react'
import { Table, Card, Form, Input, Button, Space, Progress } from 'antd'

interface CursorStatus {
  terminalId: string
  deviceType: string
  storeId: string
  currentCursor: number
  latestRevision: number
  lag: number
  lastSyncAt: string
}

const CursorStatus: React.FC = () => {
  const [form] = Form.useForm()

  const columns = [
    { title: '终端ID', dataIndex: 'terminalId', key: 'terminalId' },
    { title: '设备类型', dataIndex: 'deviceType', key: 'deviceType' },
    { title: '门店', dataIndex: 'storeId', key: 'storeId' },
    { title: '当前Cursor', dataIndex: 'currentCursor', key: 'currentCursor' },
    { title: '最新Revision', dataIndex: 'latestRevision', key: 'latestRevision' },
    {
      title: '延迟',
      dataIndex: 'lag',
      key: 'lag',
      render: (lag: number, record) => {
        const percent = ((record.currentCursor / record.latestRevision) * 100).toFixed(1)
        return (
          <div>
            <div>{lag} revisions</div>
            <Progress percent={parseFloat(percent)} size="small" />
          </div>
        )
      },
    },
    { title: '最后同步', dataIndex: 'lastSyncAt', key: 'lastSyncAt' },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button type="link" size="small" onClick={() => handleForceSync(record)}>
          强制同步
        </Button>
      ),
    },
  ]

  return (
    <Card>
      <Form form={form} layout="inline" style={{ marginBottom: 16 }}>
        <Form.Item name="terminalId" label="终端ID">
          <Input placeholder="请输入" style={{ width: 200 }} />
        </Form.Item>
        <Form.Item>
          <Space>
            <Button type="primary">查询</Button>
            <Button>刷新</Button>
          </Space>
        </Form.Item>
      </Form>

      <Table columns={columns} rowKey="terminalId" />
    </Card>
  )
}

export default CursorStatus
```

## 7. 联邦管理模块

### 7.1 节点管理页面

```typescript
// src/pages/Federation/Nodes/index.tsx
import React from 'react'
import { Table, Card, Tag, Button, Space, Badge, Statistic, Row, Col } from 'antd'

interface Node {
  nodeId: string
  nodeType: 'L1' | 'L2'
  region: string
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN'
  connectedTerminals: number
  syncLag: number
  lastHeartbeat: string
}

const FederationNodes: React.FC = () => {
  const columns = [
    {
      title: '节点ID',
      dataIndex: 'nodeId',
      key: 'nodeId',
      render: (id: string) => <code>{id}</code>,
    },
    {
      title: '节点类型',
      dataIndex: 'nodeType',
      key: 'nodeType',
      render: (type: string) => (
        <Tag color={type === 'L1' ? 'purple' : 'blue'}>{type}</Tag>
      ),
    },
    { title: '区域', dataIndex: 'region', key: 'region' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const statusConfig = {
          HEALTHY: { status: 'success', text: '健康' },
          DEGRADED: { status: 'warning', text: '降级' },
          DOWN: { status: 'error', text: '宕机' },
        }
        const config = statusConfig[status]
        return <Badge status={config.status as any} text={config.text} />
      },
    },
    { title: '连接终端数', dataIndex: 'connectedTerminals', key: 'connectedTerminals' },
    {
      title: '同步延迟',
      dataIndex: 'syncLag',
      key: 'syncLag',
      render: (lag: number) => (
        <span style={{ color: lag > 100 ? '#cf1322' : '#52c41a' }}>
          {lag} revisions
        </span>
      ),
    },
    { title: '最后心跳', dataIndex: 'lastHeartbeat', key: 'lastHeartbeat' },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" onClick={() => handleViewDetail(record)}>
            详情
          </Button>
          <Button type="link" size="small" onClick={() => handleViewMetrics(record)}>
            监控指标
          </Button>
          {record.nodeType === 'L2' && (
            <Button type="link" size="small" onClick={() => handleSwitchNode(record)}>
              切换节点
            </Button>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      {/* 节点统计 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic title="L1节点" value={2} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="L2节点" value={15} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="健康节点" value={16} valueStyle={{ color: '#3f8600' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="异常节点" value={1} valueStyle={{ color: '#cf1322' }} />
          </Card>
        </Col>
      </Row>

      <Card>
        <Table columns={columns} rowKey="nodeId" />
      </Card>
    </div>
  )
}

export default FederationNodes
```

### 7.2 同步状态页面

```typescript
// src/pages/Federation/Sync/index.tsx
import React from 'react'
import { Card, Table, Tag, Progress, Button } from 'antd'

interface SyncStatus {
  l2NodeId: string
  region: string
  currentRevision: number
  l1LatestRevision: number
  syncLag: number
  syncRate: number
  lastSyncAt: string
  status: 'SYNCING' | 'SYNCED' | 'LAGGING' | 'ERROR'
}

const FederationSync: React.FC = () => {
  const columns = [
    { title: 'L2节点', dataIndex: 'l2NodeId', key: 'l2NodeId' },
    { title: '区域', dataIndex: 'region', key: 'region' },
    { title: '当前Revision', dataIndex: 'currentRevision', key: 'currentRevision' },
    { title: 'L1最新Revision', dataIndex: 'l1LatestRevision', key: 'l1LatestRevision' },
    {
      title: '同步进度',
      key: 'progress',
      render: (_, record) => {
        const percent = ((record.currentRevision / record.l1LatestRevision) * 100).toFixed(1)
        return (
          <div>
            <Progress percent={parseFloat(percent)} size="small" />
            <div style={{ fontSize: 12, color: '#666' }}>
              延迟: {record.syncLag} revisions
            </div>
          </div>
        )
      },
    },
    {
      title: '同步速率',
      dataIndex: 'syncRate',
      key: 'syncRate',
      render: (rate: number) => `${rate} rev/s`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const statusConfig = {
          SYNCING: { color: 'processing', text: '同步中' },
          SYNCED: { color: 'success', text: '已同步' },
          LAGGING: { color: 'warning', text: '延迟' },
          ERROR: { color: 'error', text: '错误' },
        }
        const config = statusConfig[status]
        return <Tag color={config.color}>{config.text}</Tag>
      },
    },
    { title: '最后同步', dataIndex: 'lastSyncAt', key: 'lastSyncAt' },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button type="link" size="small" onClick={() => handleForceSync(record)}>
          强制同步
        </Button>
      ),
    },
  ]

  return (
    <Card title="L1→L2同步状态">
      <Table columns={columns} rowKey="l2NodeId" />
    </Card>
  )
}

export default FederationSync
```

## 8. API集成

```typescript
// src/api/tdp.ts
import request from '@/utils/request'

// Topic管理
export const queryTopics = (params: any) => {
  return request.get('/api/v1/tdp/topics', { params })
}

export const registerTopic = (data: any) => {
  return request.post('/api/v1/tdp/topics', data)
}

export const updateTopicSchema = (topic: string, schema: any) => {
  return request.put(`/api/v1/tdp/topics/${topic}/schema`, { schema })
}

// 会话管理
export const querySessions = (params: any) => {
  return request.get('/api/v1/tdp/sessions', { params })
}

export const disconnectSession = (sessionId: string) => {
  return request.post(`/api/v1/tdp/sessions/${sessionId}/disconnect`)
}

// 推送记录
export const queryPushRecords = (params: any) => {
  return request.get('/api/v1/tdp/push-records', { params })
}

export const getPushStatistics = (params: any) => {
  return request.get('/api/v1/tdp/push-statistics', { params })
}

// Projection查询
export const queryProjection = (params: { topic: string; itemKey: string; scopeId: string }) => {
  return request.get('/api/v1/tdp/projections', { params })
}

// Change Log查询
export const queryChangeLog = (params: any) => {
  return request.get('/api/v1/tdp/change-logs', { params })
}

// Cursor状态
export const queryCursorStatus = (params: any) => {
  return request.get('/api/v1/tdp/cursors', { params })
}

export const forceSync = (terminalId: string) => {
  return request.post(`/api/v1/tdp/cursors/${terminalId}/force-sync`)
}

// 联邦节点
export const queryNodes = (params: any) => {
  return request.get('/api/v1/tdp/federation/nodes', { params })
}

export const querySyncStatus = (params: any) => {
  return request.get('/api/v1/tdp/federation/sync-status', { params })
}
```

---

**版本信息：**
- 文档版本：v1.0
- 创建日期：2026-04-06
