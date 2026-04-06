# 11-前台业务端API详细设计

## 1. 文档目的

本文档详细定义后台服务对所有前台业务端（小程序、POS、KDS、商家后台）提供的REST API接口规范，包括请求参数、响应格式、错误码、鉴权方式等。

---

## 2. API设计原则

### 2.1 RESTful规范

- 使用标准HTTP方法：GET（查询）、POST（创建）、PUT（更新）、DELETE（删除）
- URL使用名词复数形式：`/api/v1/orders`、`/api/v1/products`
- 所有接口路径必须包含版本前缀 `/api/v1/`（见 `10-接口设计规范.md` §1.1）
- 使用HTTP状态码表示结果：200成功、400参数错误、401未授权、404不存在、500服务器错误

### 2.2 统一响应格式

```json
{
  "code": 200,
  "message": "success",
  "data": {},
  "timestamp": 1704355200000,
  "traceId": "1a2b3c4d5e6f7g8h"
}
```

### 2.3 分页响应格式

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "items": [],
    "total": 100,
    "pageNum": 1,
    "pageSize": 20,
    "totalPages": 5
  },
  "timestamp": 1704355200000,
  "traceId": "1a2b3c4d5e6f7g8h"
}
```

### 2.4 鉴权方式

**顾客侧终端（小程序/H5/自助机）**：单 Token 模式
```
Authorization: Bearer {customer_token}
```

**门店执行侧终端（POS/PDA/KDS/打包台）**：双 Token 模式，请求头同时携带设备 Token 和操作员 Token
```
Authorization: Bearer {operator_token}
X-Device-Token: {device_token}
```

**Token包含信息**：
- user_id / staff_id：用户/员工ID
- device_id：设备ID（设备 Token 中）
- tenant_id：租户ID
- store_id：门店ID
- role：角色
- exp：过期时间

> 设备 Token 有效期 90 天，操作员 Token 有效期 8 小时。网关层同时校验两个 Token，操作审计以操作员 Token 中的 staff_id 为准。

---

## 3. 商品与门店API

### 3.1 查询门店商品列表

**接口**：`GET /api/v1/products`

**描述**：查询门店可售商品列表，支持分类筛选、关键词搜索

**请求头**：
```
Authorization: Bearer {token}
Content-Type: application/json
```

**请求参数**：
```
store_id        string  必填  门店ID
category_id     string  可选  分类ID
keyword         string  可选  搜索关键词
status          string  可选  商品状态（ACTIVE）
page_num        int     可选  页码（默认1）
page_size       int     可选  每页大小（默认20）
```

**响应示例**：
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "items": [
      {
        "product_id": "prod_001",
        "product_code": "COFFEE_001",
        "product_name": "美式咖啡",
        "product_type": "SINGLE",
        "category_id": "cat_001",
        "category_name": "咖啡",
        "base_price": 2800,
        "product_image_url": "https://cdn.example.com/coffee.jpg",
        "description": "经典美式咖啡",
        "tags": ["热销", "推荐"],
        "variants": [
          {
            "variant_id": "var_001",
            "variant_name": "大杯",
            "price_delta": 500,
            "is_default": false
          },
          {
            "variant_id": "var_002",
            "variant_name": "中杯",
            "price_delta": 0,
            "is_default": true
          }
        ],
        "modifier_groups": [
          {
            "group_id": "mg_001",
            "group_name": "甜度",
            "selection_type": "SINGLE",
            "is_required": true,
            "modifiers": [
              {
                "modifier_id": "mod_001",
                "modifier_name": "正常糖",
                "price_delta": 0,
                "is_default": true
              },
              {
                "modifier_id": "mod_002",
                "modifier_name": "少糖",
                "price_delta": 0,
                "is_default": false
              }
            ]
          }
        ],
        "status": "ACTIVE"
      }
    ],
    "total": 50,
    "pageNum": 1,
    "pageSize": 20,
    "totalPages": 3
  },
  "timestamp": 1704355200000,
  "traceId": "1a2b3c4d5e6f7g8h"
}
```

### 3.2 查询商品详情

**接口**：`GET /api/v1/products/{product_id}`

**描述**：查询单个商品的完整信息

**请求头**：
```
Authorization: Bearer {token}
```

**路径参数**：
```
product_id      string  必填  商品ID
```

**查询参数**：
```
store_id        string  必填  门店ID
```

**响应示例**：
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "product_id": "prod_001",
    "product_code": "COFFEE_001",
    "product_name": "美式咖啡",
    "product_type": "SINGLE",
    "category_id": "cat_001",
    "category_name": "咖啡",
    "base_price": 2800,
    "product_image_url": "https://cdn.example.com/coffee.jpg",
    "product_images": [
      "https://cdn.example.com/coffee1.jpg",
      "https://cdn.example.com/coffee2.jpg"
    ],
    "description": "经典美式咖啡，选用优质咖啡豆",
    "allergen_info": "无",
    "nutrition_info": {
      "calories": 10,
      "protein": 0.5,
      "fat": 0.1
    },
    "tags": ["热销", "推荐"],
    "variants": [...],
    "modifier_groups": [...],
    "combo_items": [],
    "production_profile": {
      "station_type": "HOT_DRINK",
      "estimated_duration": 180,
      "complexity_level": "SIMPLE"
    },
    "status": "ACTIVE"
  },
  "timestamp": 1704355200000,
  "traceId": "1a2b3c4d5e6f7g8h"
}
```

### 3.3 查询商品分类树

**接口**：`GET /api/v1/categories`

**描述**：查询商品分类树形结构

**请求参数**：
```
store_id        string  可选  门店ID（不传则返回品牌级分类）
```

**响应示例**：
```json
{
  "code": 200,
  "message": "success",
  "data": [
    {
      "category_id": "cat_001",
      "category_name": "咖啡",
      "sort_order": 1,
      "children": [
        {
          "category_id": "cat_001_01",
          "category_name": "美式系列",
          "sort_order": 1,
          "children": []
        },
        {
          "category_id": "cat_001_02",
          "category_name": "拿铁系列",
          "sort_order": 2,
          "children": []
        }
      ]
    },
    {
      "category_id": "cat_002",
      "category_name": "茶饮",
      "sort_order": 2,
      "children": []
    }
  ],
  "timestamp": 1704355200000,
  "traceId": "1a2b3c4d5e6f7g8h"
}
```

### 3.4 查询门店信息

**接口**：`GET /api/v1/stores/{store_id}`

**描述**：查询门店基础信息和营业状态

**响应示例**：
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "store_id": "store_001",
    "store_code": "SH001",
    "store_name": "上海南京路店",
    "store_phone": "021-12345678",
    "address": {
      "province": "上海市",
      "city": "上海市",
      "district": "黄浦区",
      "street": "南京东路",
      "address_detail": "南京东路123号",
      "latitude": 31.2304,
      "longitude": 121.4737
    },
    "business_hours": [
      {
        "day_of_week": 1,
        "open_time": "08:00",
        "close_time": "22:00"
      }
    ],
    "operating_status": "OPERATING",
    "has_dine_in": true,
    "has_takeaway": true,
    "facilities": {
      "wifi_available": true,
      "has_parking": false
    }
  },
  "timestamp": 1704355200000,
  "traceId": "1a2b3c4d5e6f7g8h"
}
```

---

## 4. 订单交易API

### 4.1 创建订单

**接口**：`POST /api/v1/orders`

**描述**：创建新订单（支持堂食、外卖、自取等所有场景）

**请求头**：
```
Authorization: Bearer {token}
Content-Type: application/json
Idempotency-Key: {unique_key}
```

**请求体**：
```json
{
  "store_id": "store_001",
  "channel_type": "MINI_PROGRAM",
  "order_scene": "DINE_IN",
  "fulfillment_type": "TABLE_SERVICE",
  "customer_id": "cust_001",
  "customer_name": "张三",
  "customer_phone": "13800138000",
  "items": [
    {
      "product_id": "prod_001",
      "variant_id": "var_001",
      "modifier_ids": ["mod_001", "mod_002"],
      "quantity": 2,
      "remark": "少糖"
    }
  ],
  "service_context": {
    "table_id": "table_001",
    "table_no": "A01",
    "dine_in_count": 2
  },
  "remark": "尽快出餐"
}
```

**响应示例**：
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "order_id": "order_20240101_001",
    "order_no": "2024010100001",
    "store_id": "store_001",
    "channel_type": "MINI_PROGRAM",
    "order_scene": "DINE_IN",
    "fulfillment_type": "TABLE_SERVICE",
    "status": "PENDING_PAYMENT",
    "total_amount": 5600,
    "discount_amount": 0,
    "payable_amount": 5600,
    "items": [
      {
        "item_id": "item_001",
        "product_snapshot": {
          "product_id": "prod_001",
          "product_name": "美式咖啡",
          "selected_variant": {
            "variant_name": "大杯",
            "price_delta": 500
          },
          "selected_modifiers": [
            {
              "modifier_name": "正常糖",
              "price_delta": 0
            }
          ],
          "unit_price": 2800
        },
        "quantity": 2,
        "subtotal": 5600
      }
    ],
    "service_context": {
      "table_id": "table_001",
      "table_no": "A01",
      "dine_in_count": 2
    },
    "created_at": "2024-01-01T10:00:00Z"
  },
  "timestamp": 1704355200000,
  "traceId": "1a2b3c4d5e6f7g8h"
}
```

### 4.2 查询订单详情

**接口**：`GET /api/v1/orders/{order_id}`

**描述**：查询订单完整信息

**响应示例**：
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "order_id": "order_20240101_001",
    "order_no": "2024010100001",
    "store_id": "store_001",
    "store_name": "上海南京路店",
    "channel_type": "MINI_PROGRAM",
    "order_scene": "DINE_IN",
    "fulfillment_type": "TABLE_SERVICE",
    "status": "PAID",
    "status_display": "已支付",
    "customer_name": "张三",
    "customer_phone_suffix": "8000",
    "total_amount": 5600,
    "discount_amount": 0,
    "payable_amount": 5600,
    "paid_amount": 5600,
    "items": [...],
    "payments": [
      {
        "payment_id": "pay_001",
        "payment_method": "WECHAT_PAY",
        "amount": 5600,
        "status": "SUCCESS",
        "paid_at": "2024-01-01T10:01:00Z"
      }
    ],
    "service_context": {
      "table_id": "table_001",
      "table_no": "A01",
      "dine_in_count": 2
    },
    "timeline": [
      {
        "status": "PENDING_PAYMENT",
        "occurred_at": "2024-01-01T10:00:00Z"
      },
      {
        "status": "PAID",
        "occurred_at": "2024-01-01T10:01:00Z"
      }
    ],
    "created_at": "2024-01-01T10:00:00Z",
    "paid_at": "2024-01-01T10:01:00Z"
  },
  "timestamp": 1704355200000,
  "traceId": "1a2b3c4d5e6f7g8h"
}
```

### 4.3 查询订单列表

**接口**：`GET /api/v1/orders`

**请求参数**：
```
store_id        string  必填  门店ID
status          string  可选  订单状态
channel_type    string  可选  渠道类型
start_date      string  可选  开始日期
end_date        string  可选  结束日期
page_num        int     可选  页码
page_size       int     可选  每页大小
```

### 4.4 接单

**接口**：`POST /api/v1/orders/{order_id}/accept`

**请求体**：
```json
{
  "accepted_by": "staff_001",
  "expected_ready_time": "2024-01-01T10:30:00Z"
}
```

### 4.5 取消订单

**接口**：`POST /api/v1/orders/{order_id}/cancel`

**请求体**：
```json
{
  "cancel_reason_code": "CUSTOMER_REQUEST",
  "cancel_reason_text": "顾客要求取消"
}
```

---

## 5. 支付API

### 5.1 创建支付

**接口**：`POST /api/v1/payments`

**请求体**：
```json
{
  "order_id": "order_20240101_001",
  "payment_method": "WECHAT_PAY",
  "amount": 5600
}
```

### 5.2 查询支付状态

**接口**：`GET /api/v1/payments/{payment_id}`

---

## 6. 履约生产API

### 6.1 查询工作站待制作列表

**接口**：`GET /api/v1/work-units`

**请求参数**：
```
store_id            string  必填  门店ID
workstation_type    string  必填  工作站类型
status              string  可选  状态
```

### 6.2 开始制作

**接口**：`POST /api/v1/work-units/{work_unit_id}/start`

### 6.3 完成制作

**接口**：`POST /api/v1/work-units/{work_unit_id}/complete`

---

## 7. 桌台管理API

### 7.1 查询桌台列表

**接口**：`GET /api/v1/tables`

**请求参数**：
```
store_id        string  必填  门店ID
area            string  可选  区域
status          string  可选  状态
```

**响应示例**：
```json
{
  "code": 200,
  "message": "success",
  "data": [
    {
      "table_id": "table_001",
      "table_no": "A01",
      "table_name": "A区1号桌",
      "area": "大厅",
      "capacity": 4,
      "status": "AVAILABLE",
      "qr_code_url": "https://cdn.example.com/qr/table_001.png"
    }
  ]
}
```

### 7.2 占用桌台

**接口**：`POST /api/v1/tables/{table_id}/occupy`

**请求体**：
```json
{
  "order_id": "order_20240101_001",
  "customer_count": 2,
  "occupied_by": "staff_001"
}
```

### 7.3 释放桌台

**接口**：`POST /api/v1/tables/{table_id}/release`

---

## 8. 正餐桌台会话API（P0-2）

### 8.1 开台

**接口**：`POST /api/v1/table-sessions`

**描述**：正餐场景开台，创建桌台会话

**请求头**：
```
Authorization: Bearer {token}
Content-Type: application/json
Idempotency-Key: {unique_key}
```

**请求体**：
```json
{
  "store_id": "store_001",
  "table_id": "table_001",
  "party_size": 4,
  "operator_id": "staff_001",
  "booking_id": "booking_001"
}
```

**响应示例**：
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "session_id": "session_001",
    "table_id": "table_001",
    "table_no": "A01",
    "party_size": 4,
    "session_status": "OPEN",
    "opened_at": "2024-01-01T10:00:00Z"
  }
}
```

### 8.2 查询桌台会话

**接口**：`GET /api/v1/table-sessions/{session_id}`

**描述**：查询桌台会话详情，包含关联订单列表

**响应示例**：
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "session_id": "session_001",
    "table_id": "table_001",
    "table_no": "A01",
    "party_size": 4,
    "session_status": "OPEN",
    "orders": [
      {
        "order_id": "order_001",
        "order_no": "2024010100001",
        "status": "PAID",
        "total_amount": 5600
      }
    ],
    "total_consumed": 5600,
    "opened_at": "2024-01-01T10:00:00Z"
  }
}
```

### 8.3 变更就餐人数

**接口**：`PUT /api/v1/table-sessions/{session_id}/party-size`

**请求体**：
```json
{
  "party_size": 6,
  "operator_id": "staff_001"
}
```

### 8.4 挂单

**接口**：`POST /api/v1/table-sessions/{session_id}/hang-bill`

**描述**：暂挂账单，桌台状态变为HANG_BILL

**请求体**：
```json
{
  "operator_id": "staff_001",
  "remark": "顾客暂时离开"
}
```

### 8.4.1 恢复挂单

**接口**：`POST /api/v1/table-sessions/{session_id}/resume-hang`

**描述**：恢复已挂起的桌台会话，桌台状态从 HANG_BILL 恢复为 OCCUPIED

**请求体**：
```json
{
  "operator_id": "staff_001"
}
```

### 8.5 打印预结单

**接口**：`POST /api/v1/table-sessions/{session_id}/pre-bill`

**描述**：打印预结单，不关闭会话

**请求体**：
```json
{
  "operator_id": "staff_001",
  "printer_device_id": "printer_001"
}
```

### 8.6 确认上菜

**接口**：`POST /api/v1/orders/{order_id}/items/{item_id}/served`

**描述**：服务员确认菜品已上桌

**请求体**：
```json
{
  "operator_id": "staff_001",
  "served_at": "2024-01-01T10:30:00Z"
}
```

---

## 9. 预订域API（P0-1）

### 9.1 查询可预订餐段

**接口**：`GET /api/v1/booking/periods`

**请求参数**：
```
store_id        string  必填  门店ID
date            string  必填  预订日期（YYYY-MM-DD）
```

**响应示例**：
```json
{
  "code": 200,
  "message": "success",
  "data": [
    {
      "period_id": "period_001",
      "period_name": "午餐",
      "start_time": "11:00",
      "end_time": "14:00",
      "remaining_capacity": 8,
      "available_tables": [
        {
          "table_id": "table_001",
          "table_no": "A01",
          "capacity": 4,
          "table_type": "REGULAR"
        }
      ]
    }
  ]
}
```

### 9.2 创建预订单

**接口**：`POST /api/v1/bookings`

**请求头**：
```
Authorization: Bearer {token}
Content-Type: application/json
Idempotency-Key: {unique_key}
```

**请求体**：
```json
{
  "store_id": "store_001",
  "booking_type": "C_END",
  "source_channel": "MINI_PROGRAM",
  "customer_name": "张三",
  "customer_phone": "13800138000",
  "party_size": 4,
  "booking_date": "2024-01-02",
  "period_id": "period_001",
  "arrival_time": "12:00",
  "table_id": "table_001",
  "deposit_required": false,
  "pre_order_items": [
    {
      "product_id": "prod_001",
      "product_name": "招牌烤鸭",
      "quantity": 1,
      "unit_price": 18800
    }
  ]
}
```

**响应示例**：
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "booking_id": "booking_001",
    "booking_no": "BK20240102001",
    "status": "PENDING",
    "expire_at": "2024-01-01T22:00:00Z"
  }
}
```

### 9.3 查询预订单详情

**接口**：`GET /api/v1/bookings/{booking_id}`

### 9.4 查询门店预订列表

**接口**：`GET /api/v1/bookings`

**请求参数**：
```
store_id        string  必填  门店ID
booking_date    string  可选  预订日期
status          string  可选  状态
page_num        int     可选  页码
page_size       int     可选  每页大小
```

### 9.5 确认预订

**接口**：`POST /api/v1/bookings/{booking_id}/confirm`

**请求体**：
```json
{
  "operator_id": "staff_001"
}
```

### 9.5.1 拒绝预订

**接口**：`POST /api/v1/bookings/{booking_id}/reject`

**描述**：门店拒绝待确认的预订（仅 `PENDING` 状态可操作），预订进入 `CANCELLED` 状态，若顾客已支付订金则自动发起退款。

**请求体**：
```json
{
  "operator_id": "staff_001",
  "reject_reason": "餐厅当日已满座"
}
```

**响应**：`200 OK`，`{ "code": 200, "data": { "booking_id": "...", "status": "CANCELLED" } }`



**接口**：`POST /api/v1/bookings/{booking_id}/arrive`

**描述**：顾客到店，触发开台创建TableSession

**请求体**：
```json
{
  "operator_id": "staff_001",
  "actual_party_size": 4
}
```

**响应示例**：
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "booking_id": "booking_001",
    "status": "ARRIVED",
    "session_id": "session_001",
    "linked_order_id": null
  }
}
```

### 9.7 取消预订

**接口**：`POST /api/v1/bookings/{booking_id}/cancel`

**请求体**：
```json
{
  "cancel_reason_code": "CUSTOMER_REQUEST",
  "cancel_reason_text": "顾客临时有事",
  "cancel_initiator": "CUSTOMER"
}
```

---

## 10. 附加费API（P0-3）

### 10.1 查询门店附加费规则

**接口**：`GET /api/v1/stores/{store_id}/extra-charge-rules`

**描述**：查询门店配置的附加费规则（包房费、服务费等）

**响应示例**：
```json
{
  "code": 200,
  "message": "success",
  "data": [
    {
      "rule_id": "rule_001",
      "charge_name": "服务费",
      "charge_type": "SERVICE_FEE",
      "calc_way": "PERCENT",
      "calc_amount": 10,
      "apply_scenes": ["DINE_IN"],
      "auto_add_to_order": true,
      "calc_after_discount": false,
      "allow_discount": false,
      "enabled": true
    }
  ]
}
```

### 10.2 查询订单附加费明细

**接口**：`GET /api/v1/orders/{order_id}/charge-items`

**响应示例**：
```json
{
  "code": 200,
  "message": "success",
  "data": [
    {
      "charge_item_id": "ci_001",
      "rule_id": "rule_001",
      "charge_name": "服务费",
      "charge_type": "SERVICE_FEE",
      "calc_base": 5600,
      "charge_amount": 560,
      "is_waived": false
    }
  ]
}
```

### 10.3 减免附加费

**接口**：`POST /api/v1/orders/{order_id}/charge-items/{charge_item_id}/waive`

**描述**：对特定附加费项目进行减免（需权限）

**请求体**：
```json
{
  "operator_id": "staff_001",
  "waive_reason": "VIP顾客"
}
```

---

## 11. 打印与叫号API（P0-4）

### 11.1 创建打印任务

**接口**：`POST /api/v1/print-tasks`

**描述**：手动触发打印（补打、重打）

**请求体**：
```json
{
  "order_id": "order_001",
  "store_id": "store_001",
  "receipt_type": "KITCHEN_GATE",
  "target_device_id": "printer_001",
  "trigger_type": "REPRINT"
}
```

**receipt_type枚举**：
```
KITCHEN_GATE      出品口小票
GUEST_WATCH       顾客取餐小票
KITCHEN_SUMMARY   厨房汇总单
LABEL             标签贴纸
TAKEOUT           外卖打包单
PRE_BILL          预结单
RECEIPT           正式收据
```

**响应示例**：
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "task_id": "print_001",
    "status": "PENDING",
    "created_at": "2024-01-01T10:00:00Z"
  }
}
```

### 11.2 查询打印任务状态

**接口**：`GET /api/v1/print-tasks/{task_id}`

**响应示例**：
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "task_id": "print_001",
    "order_id": "order_001",
    "receipt_type": "KITCHEN_GATE",
    "target_device_id": "printer_001",
    "status": "PRINTED",
    "sent_at": "2024-01-01T10:00:01Z",
    "printed_at": "2024-01-01T10:00:03Z"
  }
}
```

### 11.3 触发取餐叫号

**接口**：`POST /api/v1/pickup-calls`

**描述**：手动触发取餐叫号（自动叫号由系统在生产完成后触发）

**请求体**：
```json
{
  "order_id": "order_001",
  "store_id": "store_001",
  "operator_id": "staff_001"
}
```

### 11.4 查询叫号状态

**接口**：`GET /api/v1/pickup-calls`

**请求参数**：
```
store_id        string  必填  门店ID
status          string  可选  叫号状态（WAITING|CALLED|PICKED_UP|EXPIRED）
```

**响应示例**：
```json
{
  "code": 200,
  "message": "success",
  "data": [
    {
      "call_id": "call_001",
      "order_id": "order_001",
      "pickup_code": "A023",
      "call_status": "CALLED",
      "called_at": "2024-01-01T10:15:00Z",
      "call_count": 1
    }
  ]
}
```

### 11.5 确认取餐

**接口**：`POST /api/v1/pickup-calls/{call_id}/pickup`

**请求体**：
```json
{
  "operator_id": "staff_001"
}
```

---

## 12. 库存与沽清API（P1-3）

### 12.1 查询商品库存

**接口**：`GET /api/v1/stores/{store_id}/stocks`

**请求参数**：
```
product_ids     string  可选  商品ID列表（逗号分隔）
stock_type      string  可选  库存类型（DAILY|BATCH|UNLIMITED）
```

**响应示例**：
```json
{
  "code": 200,
  "message": "success",
  "data": [
    {
      "product_id": "prod_001",
      "product_name": "招牌烤鸭",
      "stock_type": "DAILY",
      "remaining_quantity": 5,
      "sold_out_threshold": 0,
      "is_sold_out": false,
      "reset_policy": "DAILY_RESET"
    }
  ]
}
```

### 12.2 手动沽清商品

**接口**：`POST /api/v1/stores/{store_id}/stocks/{product_id}/sold-out`

**描述**：手动将商品标记为沽清

**请求体**：
```json
{
  "operator_id": "staff_001",
  "reason": "今日食材用完"
}
```

### 12.3 恢复商品库存

**接口**：`POST /api/v1/stores/{store_id}/stocks/{product_id}/restore`

**请求体**：
```json
{
  "operator_id": "staff_001",
  "quantity": 10,
  "reason": "补货到位"
}
```

### 12.4 批量更新库存

**接口**：`PUT /api/v1/stores/{store_id}/stocks`

**请求体**：
```json
{
  "operator_id": "staff_001",
  "items": [
    {
      "product_id": "prod_001",
      "remaining_quantity": 20
    },
    {
      "product_id": "prod_002",
      "remaining_quantity": 0
    }
  ]
}
```

---

## 13. 报表查询API（P1-1）

### 13.1 查询营业日报

**接口**：`GET /api/v1/reports/daily-summary`

**请求参数**：
```
store_id        string  必填  门店ID
summary_date    string  必填  日期（YYYY-MM-DD）
```

**响应示例**：
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "store_id": "store_001",
    "summary_date": "2024-01-01",
    "order_count": 120,
    "total_revenue": 1560000,
    "avg_order_amount": 13000,
    "dine_in_count": 80,
    "takeaway_count": 40,
    "top_products": [
      {
        "product_id": "prod_001",
        "product_name": "美式咖啡",
        "quantity_sold": 45,
        "revenue": 126000
      }
    ],
    "payment_breakdown": {
      "wechat_pay": 980000,
      "alipay": 380000,
      "cash": 200000
    }
  }
}
```

### 13.2 查询订单事实明细

**接口**：`GET /api/v1/reports/orders`

**请求参数**：
```
store_id        string  必填  门店ID
start_date      string  必填  开始日期
end_date        string  必填  结束日期
channel_type    string  可选  渠道类型
order_scene     string  可选  订单场景
page_num        int     可选  页码
page_size       int     可选  每页大小（最大1000）
```

### 13.3 查询菜品销售明细

**接口**：`GET /api/v1/reports/items`

**请求参数**：
```
store_id        string  必填  门店ID
start_date      string  必填  开始日期
end_date        string  必填  结束日期
category_id     string  可选  分类ID
page_num        int     可选  页码
page_size       int     可选  每页大小
```

### 13.4 查询支付方式统计

**接口**：`GET /api/v1/reports/payments`

**请求参数**：
```
store_id        string  必填  门店ID
start_date      string  必填  开始日期
end_date        string  必填  结束日期
```

### 13.5 查询履约效率报表

**接口**：`GET /api/v1/reports/fulfillments`

**请求参数**：
```
store_id        string  必填  门店ID
start_date      string  必填  开始日期
end_date        string  必填  结束日期
```

**响应示例**：
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "avg_production_seconds": 420,
    "avg_handoff_seconds": 180,
    "overdue_rate": 0.05,
    "fulfillment_type_breakdown": {
      "TABLE_SERVICE": {"count": 80, "avg_seconds": 380},
      "SELF_PICKUP": {"count": 40, "avg_seconds": 320}
    }
  }
}
```

---

## 14. 接入治理API（P1-2）

### 14.1 注册应用客户端

**接口**：`POST /api/v1/governance/clients`

**描述**：ISV或商户自有系统注册接入

**请求体**：
```json
{
  "client_name": "商户自有收银系统",
  "client_type": "ISV",
  "contact_email": "dev@example.com",
  "callback_url": "https://merchant.example.com/callback",
  "requested_scopes": ["order:read", "order:write", "product:read"]
}
```

**响应示例**：
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "client_id": "client_001",
    "client_secret": "cs_xxxxxxxxxxxxxxxx",
    "status": "PENDING_REVIEW"
  }
}
```

### 14.2 查询授权列表

**接口**：`GET /api/v1/governance/clients/{client_id}/grants`

### 14.3 订阅Webhook事件

**接口**：`POST /api/v1/governance/clients/{client_id}/subscriptions`

**请求体**：
```json
{
  "event_types": [
    "ORDER_CREATED",
    "ORDER_PAID",
    "ORDER_COMPLETED",
    "BOOKING_CONFIRMED"
  ],
  "callback_url": "https://merchant.example.com/webhook",
  "store_ids": ["store_001", "store_002"]
}
```

**可订阅事件类型**：
```
ORDER_CREATED           订单已创建
ORDER_ACCEPTED          订单已接单
ORDER_PAID              订单已支付
ORDER_CANCELLED         订单已取消
ORDER_COMPLETED         订单已完成
FULFILLMENT_DISPATCHED  订单已派送
FULFILLMENT_DELIVERED   订单已送达
BOOKING_CONFIRMED       预订已确认
BOOKING_ARRIVED         顾客已到店
BOOKING_CANCELLED       预订已取消
PRODUCT_SOLD_OUT        商品已沽清
PRODUCT_STOCK_RESTORED  商品库存已恢复
```

### 14.4 查询Webhook投递日志

**接口**：`GET /api/v1/governance/clients/{client_id}/delivery-logs`

**请求参数**：
```
event_type      string  可选  事件类型
status          string  可选  投递状态（SUCCESS|FAILED|PENDING）
start_date      string  可选  开始日期
page_num        int     可选  页码
page_size       int     可选  每页大小
```

### 14.5 手动重放Webhook

**接口**：`POST /api/v1/governance/delivery-logs/{log_id}/replay`

---

## 15. 幂等与异步结果API（P1-5）

### 15.1 查询异步任务结果

**接口**：`GET /api/v1/async-tasks/{task_id}`

**描述**：查询异步操作（如批量库存更新、ERP同步）的执行结果

**响应示例**：
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "task_id": "task_001",
    "task_type": "BATCH_STOCK_UPDATE",
    "status": "COMPLETED",
    "result": {
      "success_count": 18,
      "fail_count": 2,
      "errors": [
        {
          "product_id": "prod_099",
          "error": "商品不存在"
        }
      ]
    },
    "created_at": "2024-01-01T10:00:00Z",
    "completed_at": "2024-01-01T10:00:05Z"
  }
}
```

### 15.2 查询幂等记录

**接口**：`GET /api/v1/idempotency/{idempotency_key}`

**描述**：通过幂等键查询之前请求的处理结果，避免重复提交

**响应示例**：
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "idempotency_key": "idem_xxx",
    "request_path": "/api/v1/orders",
    "status": "COMPLETED",
    "response_body": {"order_id": "order_001"},
    "created_at": "2024-01-01T10:00:00Z",
    "expires_at": "2024-01-02T10:00:00Z"
  }
}
```

---

## 16. SPI回调接口规范（P0-5）

> SPI（Service Provider Interface）是平台提供给商户收银系统的反向回调接口，由商户系统实现，平台在关键节点主动调用。

### 16.1 会员识别回调

**接口**：商户实现，平台调用

**调用时机**：顾客在POS/小程序出示会员码时

**平台请求**：
```json
{
  "spi_type": "MEMBER_IDENTIFY",
  "store_id": "store_001",
  "idempotency_key": "idem_xxx",
  "timestamp": 1704355200000,
  "sign": "sha256_hmac",
  "data": {
    "member_code": "M123456",
    "channel": "MINI_PROGRAM"
  }
}
```

**商户响应**：
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "member_id": "mem_001",
    "member_name": "张三",
    "member_level": "GOLD",
    "available_points": 1500,
    "available_coupons": [
      {
        "coupon_id": "coup_001",
        "coupon_name": "满100减20",
        "discount_amount": 2000,
        "min_order_amount": 10000,
        "expire_date": "2024-12-31"
      }
    ]
  }
}
```

**超时策略**：300ms超时，超时允许匿名下单，不阻塞收银

### 16.2 权益扣减回调

**调用时机**：订单支付确认时

**平台请求**：
```json
{
  "spi_type": "DEDUCT",
  "store_id": "store_001",
  "idempotency_key": "idem_yyy",
  "data": {
    "order_id": "order_001",
    "member_id": "mem_001",
    "coupon_ids": ["coup_001"],
    "points_to_deduct": 100,
    "order_amount": 10000
  }
}
```

**超时策略**：300ms超时，超时拒绝权益支付，提示顾客重试

### 16.3 积分累积回调

**调用时机**：订单完成后

**平台请求**：
```json
{
  "spi_type": "ACCUMULATE",
  "store_id": "store_001",
  "idempotency_key": "idem_zzz",
  "data": {
    "order_id": "order_001",
    "member_id": "mem_001",
    "order_amount": 10000,
    "points_to_add": 100
  }
}
```

**超时策略**：300ms超时，超时进入异步补偿队列，不影响支付完成

### 16.4 SPI调用日志查询

**接口**：`GET /api/v1/spi-logs`

**请求参数**：
```
store_id        string  必填  门店ID
spi_type        string  可选  SPI类型
status          string  可选  状态（SUCCESS|TIMEOUT|FAILED）
start_date      string  可选  开始日期
page_num        int     可选  页码
page_size       int     可选  每页大小
```

---

## 17. 错误码定义

### 17.1 系统级错误码 (10000-19999)

| 错误码 | 说明 |
|-------|------|
| 10000 | 系统错误 |
| 10001 | 参数错误 |
| 10002 | 未授权 |
| 10003 | 无权限 |
| 10004 | 资源不存在 |
| 10005 | 服务不可用 |

### 17.2 业务级错误码 (20000-29999)

**订单相关 (20000-20999)**：
| 错误码 | 说明 |
|-------|------|
| 20001 | 订单不存在 |
| 20002 | 订单状态无效 |
| 20003 | 订单不可取消 |
| 20004 | 订单金额错误 |

**支付相关 (21000-21999)**：
| 错误码 | 说明 |
|-------|------|
| 21001 | 支付失败 |
| 21002 | 支付超时 |
| 21003 | 退款失败 |

**商品相关 (22000-22999)**：
| 错误码 | 说明 |
|-------|------|
| 22001 | 商品不存在 |
| 22002 | 商品不可售 |
| 22003 | 商品库存不足 |

**门店相关 (23000-23999)**：
| 错误码 | 说明 |
|-------|------|
| 23001 | 门店不存在 |
| 23002 | 门店未营业 |
| 23003 | 门店已暂停 |

**预订相关 (24000-24999)**：
| 错误码 | 说明 |
|-------|------|
| 24001 | 预订单不存在 |
| 24002 | 预订状态无效 |
| 24003 | 餐段容量已满 |
| 24004 | 桌台已被预订 |
| 24005 | 超过提前预订天数限制 |

**桌台会话相关 (25000-25999)**：
| 错误码 | 说明 |
|-------|------|
| 25001 | 桌台已被占用 |
| 25002 | 会话不存在 |
| 25003 | 会话已关闭 |

**库存相关 (26000-26999)**：
| 错误码 | 说明 |
|-------|------|
| 26001 | 商品已沽清 |
| 26002 | 库存不足 |

**接入治理相关 (27000-27999)**：
| 错误码 | 说明 |
|-------|------|
| 27001 | 客户端未授权 |
| 27002 | 订阅事件类型不支持 |
| 27003 | 回调地址不可达 |

---

## 18. 本文结论

前台业务端API设计提供了完整的接口规范：

- **商品API**：商品列表、详情、分类查询
- **订单API**：创建、查询、接单、取消
- **支付API**：创建支付、查询状态
- **履约API**：工作站任务、制作流程、打印、叫号
- **桌台API**：桌台管理、桌台会话（开台/挂单/预结）
- **预订API**：餐段查询、预订单全生命周期
- **附加费API**：规则查询、减免操作
- **库存API**：库存查询、沽清、恢复
- **报表API**：日报、订单/菜品/支付/履约明细
- **接入治理API**：客户端注册、Webhook订阅、投递日志
- **幂等API**：异步任务结果、幂等记录查询
- **SPI规范**：会员识别、权益扣减、积分累积回调规范
- **统一规范**：响应格式、错误码、鉴权方式

所有接口均已就绪，可直接用于前端开发对接。
