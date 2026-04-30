# 交易权益会话维护说明

`@next/kernel-business-benefit-session` 负责把权益计算放进终端运行时。它不是纯计算包，也不是权益后台 SDK；它的职责是管理交易上下文里的身份、权益快照、选择、占用和计算结果。

## 包边界

- 依赖 `@next/kernel-business-benefit-calculation` 做纯计算。
- 依赖 `@next/kernel-business-benefit-types` 作为标准模型。
- 依赖 `@next/kernel-base-transport-runtime` 调用权益中台 HTTP 服务。
- 接收 `tdp-sync-runtime-v2` 推送的非个人权益模板/权益行。
- 不依赖零售、餐饮、高化任意具体下单包。

业务下单包只需要把自己的购物车/订单/支付对象适配成 `CommerceSubjectSnapshot`，再 dispatch 本包的 command。

## 状态切片

### identity

保存当前上下文绑定过的身份快照。

例子：

- POS 扫到商场会员卡 `MALL-BLACK-001`
- 后台返回该入口身份绑定了商场身份和品牌身份
- 商场身份下有 `mall.black-card` 黑金会员资格

`linkBenefitIdentity` 会把这个快照写入 identity slice，并按 `contextKey = cart:cart-A` 关联起来。

### snapshot

保存权益快照，来源包括：

- TDP 推送的非个人模板，例如全场满 200 减 20
- TDP 推送的非个人权益行，例如某个门店活动实例
- 个人权益查询返回的券、积分、购物卡
- 优惠码/券码动态激活出的模板和权益行

这层只保存数据，不直接决定“是否使用”。真正是否可用和是否生效由计算结果决定。

### reservation

保存占用。占用是解决“当前购物车”和“多挂单”冲突的关键。

真实场景：

- 黑金会员每天一次 8 折
- 购物车 A 登录黑金会员并满足条件
- 模板 `reservationPolicy.mode = autoOnOpportunity`
- 计算发现机会可用后，本包调用 `BenefitCenterPort.reserveBenefit`
- A 获得 `held_by_cart` 占用
- 购物车 B 用同一会员计算时，看到 A 的占用，返回 `reservedByOtherContext`
- A 取消后 dispatch `releaseBenefitContext`，释放占用
- B 再算就可以享受

### evaluation

保存每个上下文最后一次计算结果、选择项和输入指纹。

输入没有变化时会直接复用缓存，避免购物车未变、权益未变、身份未变时重复计算。

## Command 调用顺序

### 1. TDP 推送非个人权益

TDP 发来 `commercial.benefit-template.profile` 或 `commercial.benefit-line.profile`。

本包处理流程：

1. `tdpTopicDataChanged`
2. 解码模板/权益行
3. 写入 snapshot slice
4. 标记所有 evaluation stale

为什么要标记 stale：购物车 A 原本不满足任何活动，TDP 新推送“满 200 减 20”后，同一个购物车需要重新计算才能展示优惠。

### 2. 关联个人身份

业务包在用户登录/扫码/绑卡后调用：

```ts
dispatchCommand(linkBenefitIdentity, {
  contextRef: {contextType: 'cart', contextId: 'cart-A', isCurrent: true},
  terminalNo: 'TERM-MIXC-SZ-UNI-001',
  entryIdentity: {
    identityType: 'mallMemberCard',
    identityValue: 'MALL-BLACK-001',
  },
})
```

本包通过 `BenefitCenterPort.queryPersonalBenefits` 查询后台。后台会根据终端号找到组织可查询范围，例如深圳万象城优衣库可以查询万象城体系和优衣库体系的身份/权益。

返回后写入：

- identity snapshot
- personal benefit snapshot
- 后台已有 reservation

然后标记所有 evaluation stale。

### 3. 购物车阶段计算

购物车金额：

- 商品 A：120.00 元
- 商品 B：80.00 元
- 合计：200.00 元

调用：

```ts
dispatchCommand(evaluateBenefitContext, {
  contextRef: {contextType: 'cart', contextId: 'cart-A', isCurrent: true},
  stage: 'cart',
  subject: cartSubject,
})
```

如果 TDP 中有自动满减：

- 结果里有 `pricingAdjustments.amount = 2000`
- 结果里有 `priceLayers`，商品行可展示原价、现价和活动来源
- 这 20.00 元是购物车调价，不生成支付单候选

如果黑金卡 8 折需要自动占用：

- 计算先得到 available opportunity
- `reserveAutoOpportunities` 根据模板占用策略调用后台占用
- reservation 写入 session
- 其他购物车再算会看到该占用

### 4. 人工选择券/积分/赠品

第一次计算只返回 opportunity：

- 100 元券 available
- 积分账户 available
- 赠品池 available 且 requiredAction = chooseGift

店员选择后调用：

```ts
dispatchCommand(selectBenefitOpportunity, {
  contextRef: {contextType: 'order', contextId: 'order-001'},
  opportunityId: 'opp-tmpl-coupon-100-off-coupon-line-100-off',
})
```

或者赠品：

```ts
dispatchCommand(chooseBenefitGift, {
  contextRef: {contextType: 'cart', contextId: 'cart-A'},
  opportunityId: 'opp-tmpl-gift-pool-template',
  giftLineIds: ['gift-mask-001'],
})
```

选择动作只更新 `selectedApplications` 并标记 stale。业务包随后再次调用 `evaluateBenefitContext`，计算包才会生成支付单候选或履约效果。

这样设计是为了区分“券可用”和“券被使用”。

### 5. 动态优惠码/券码

购物车阶段输入促销码：

```ts
dispatchCommand(activateBenefitCode, {
  contextRef: {contextType: 'cart', contextId: 'cart-A'},
  code: 'PROMO100',
  idempotencyKey: 'PROMO100:cart-A',
})
```

订单支付阶段扫到别人转赠的券码：

```ts
dispatchCommand(activateBenefitCode, {
  contextRef: {contextType: 'order', contextId: 'order-001'},
  code: 'COUPON-TRANSFER-001',
  idempotencyKey: 'COUPON-TRANSFER-001:order-001',
})
```

后台返回该码激活出来的模板和权益行。本包写入 snapshot，并只标记该上下文 stale。

### 6. 支付阶段分步计算

订单 300.00 元，支付已经完成：

- 100.00 元券
- 微信支付 150.00 元

业务包继续调用 payment stage，subject 带上 `completedSettlements`。

计算结果：

- 剩余应付是 50.00 元
- 5000 积分最多抵 50.00 元
- 预付卡支付优惠按剩余应付计算

这保证前端在分步支付时不会用原订单 300.00 元重复套权益。

## BenefitCenterPort 为什么这样设计

`BenefitCenterPort` 是权益中台能力端口，不是 HTTP gateway。

默认装配：

- `createBenefitSessionModule()`
- 内部使用 `createDefaultBenefitSessionHttpRuntime`
- HTTP 运行时来自 `transport-runtime`
- HTTP service 由 `createBenefitSessionHttpService(runtime)` 创建

测试或非 HTTP 适配可以直接传 `benefitCenterPort`：

```ts
createBenefitSessionModule({
  benefitCenterPort: fakeBenefitCenterPort,
})
```

但不能同时传：

```ts
createBenefitSessionModule({
  benefitCenterPort,
  assembly,
})
```

这样会直接抛错。原因是两条链路同时存在会让维护者不知道真实运行时到底走 HTTP runtime 还是直接端口，容易绕过统一传输能力。

## 缓存与 stale

`evaluateBenefitContext` 会生成输入指纹，包含：

- context key
- stage
- subject
- identity snapshot
- benefit snapshot
- selected applications

如果上次结果存在、没有 stale、指纹一致，直接返回缓存。

下列事件会标记 stale：

- TDP 模板/权益行变化
- 关联或切换身份
- 动态码激活
- 选择或取消某个权益
- 释放上下文占用

## 维护禁区

- 不在本包里理解零售/餐饮/高化业务对象。
- 不新增手写 HTTP gateway；HTTP 必须走 `transport-runtime`。
- 不把 TDP 推送和个人权益查询混成一个来源。TDP 是非个人，关联身份后才主动查个人权益。
- 不在本包里执行核销或退款；本包只提供当前订单已完成支付行参与后续计算。
- 不把 `opportunities` 当作最终使用结果。最终使用结果看 `applications/pricingAdjustments/settlementLines/fulfillmentEffects`。

