# 交易权益计算维护说明

`@next/kernel-business-benefit-calculation` 是纯计算包。它不查后台、不持久化、不占用配额、不核销权益，只根据 `BenefitEvaluationRequest` 计算：

- 哪些权益可用、不可用或需要下一步动作
- 哪些权益已经被自动应用或被选择使用
- 哪些权益改变商品价格
- 哪些权益生成支付单候选
- 哪些赠品、兑换、服务权益需要业务包调整订单内容
- 已完成支付行之后还能继续怎么使用其他权益

## 计算入口

入口是 `evaluateBenefitRequest(request)`。

调用方必须先把零售、餐饮、高化等业务对象适配成：

- `request.contextRef`: 当前购物车/订单/支付上下文
- `request.stage`: `cart`、`orderConfirm` 或 `payment`
- `request.subject`: 标准交易快照
- `request.identitySnapshot`: 当前消费者的身份快照，可为空
- `request.benefitSnapshot`: TDP 权益、个人权益、动态码权益、占用和配额事实
- `request.selectedApplications`: 店员/消费者已选择要使用的权益

## 为什么按这个顺序处理

计算顺序不能随意换，因为每一步对应一个真实业务约束。

1. 解析模板和权益行

   全场满减只有模板，没有权益行；优惠券、积分、购物卡既有模板也有权益行。计算时先把模板扩成 `BenefitRef`，有行就按行算，没有行就按模板算。

2. 判断权益行状态和模板生命周期

   券已经核销或过期，就应该返回 `lineConsumed/lineExpired`，不能继续走阈值、身份、叠加逻辑。

3. 剔除商品级“不参与权益”

   商品行如果标了 `benefitParticipation.mode = excludeAllBenefits`，无论模板范围如何都不参与。比如烟酒、服务费、充值商品通常不允许参与任何优惠。

4. 按商品范围筛选 eligible lines

   店铺券可能只支持某些 SKU、SPU、类目；商场券可能按销售商品类型判断。后续门槛、分摊、调价都只基于筛选后的商品行。

5. 判断阶段

   购物车阶段的全场满减会直接调价；支付阶段的预付卡 8 折只有在 `stage = payment` 且支付工具匹配时才可用。

6. 判断身份、会员、时间、终端、渠道

   例如黑金卡会员每天一次 8 折，需要身份快照里有 active 的 `membershipType = mall.black-card`。

7. 判断剩余应付下限和满额门槛

   支付阶段必须考虑已完成支付行。订单 300 元，先核销 100 元券，再微信付 150 元，剩余应付只有 50 元；后续积分最多只能再抵 50 元。

8. 判断配额事实和当前会话占用

   如果每天一次的黑金卡 8 折已经被购物车 A 占用，购物车 B 只能返回 `reservedByOtherContext`，不能再自动占用。

9. 处理条件型机会

   预付卡支付可减 20 元这类权益，在还没选支付工具时返回 `conditional + prompt`，让前端展示提示，而不是直接使用。

10. 处理选择型权益

   券可用和券被使用是两回事。`opportunities` 告诉前端可用，只有 `selectedApplications` 里明确选择了，才生成支付单候选。

11. 自动调价权益直接应用

   全场满减、身份专属价等自动权益会生成 `pricingAdjustments` 和 `priceLayers`。购物车金额已经被调低，订单金额应该基于调低后的金额。

12. 叠加规则最后统一裁剪

   多个权益先各自算出候选效果，再按 `stackingPolicy` 过滤。这样可以保留完整机会列表，同时只把最终可叠加的应用进入结果。

## 真实数值链路

### 场景 A：购物车阶段全场满减

购物车：

- 商品 A：120.00 元，`currentLineAmount = 12000`
- 商品 B：80.00 元，`currentLineAmount = 8000`
- 合计：`totals.currentAmount = 20000`

模板：

- `thresholdRequirements`: 满 200.00 元，`amount = 20000`
- `effectPolicy`: 减 20.00 元，`amount = 2000`
- `settlementPolicy.createSettlementLineCandidate = false`

结果：

- `opportunities[0].availability = available`
- `applications[0].actualEffect.kind = pricingAdjustment`
- `pricingAdjustments[0].amount = 2000`
- `priceLayers` 写回商品行，解释哪个活动把价格从 200.00 调到 180.00
- 订单确认时订单金额应按 180.00 元继续，而不是 200.00 元

### 场景 B：订单阶段使用 100 元券

订单金额已经是 180.00 元。

模板：

- `effectPolicy.kind = amountOff`
- `amount = 10000`
- `selectionPolicy.mode = manual`
- `settlementPolicy.createSettlementLineCandidate = true`
- `settlementLineType = coupon_deduction`

第一次计算不选择：

- `opportunities` 返回该券 available
- 不生成 `settlementLines`

店员选择后再次计算：

- `selectedApplications = [{benefitRef: {templateKey, lineKey}}]`
- 生成 `SettlementLineCandidate.payableImpactAmount = 10000`
- 支付中心后续负责核销，计算包只给候选

### 场景 C：支付阶段已有支付行后继续算积分

订单 300.00 元，支付阶段 subject 带入已完成支付：

- 100.00 元券：`CompletedSettlementSnapshot.payableImpactAmount = 10000`
- 微信支付 150.00 元：`payableImpactAmount = 15000`

剩余应付：

- `30000 - 10000 - 15000 = 5000`

积分模板：

- `pointsPerMoneyUnit = 100`
- `selectedQuantity = 5000`

结果：

- 积分最多抵 50.00 元
- `SettlementLineCandidate.quantity = 5000`
- `quantityUnit = point`
- `payableImpactAmount = 5000`

这里必须区分数量和金额。`quantity = 5000` 是积分数量，`payableImpactAmount.amount = 5000` 是 50.00 元金额。

### 场景 D：预付卡支付 8 折

剩余订单金额 100.00 元，消费者选择预付卡支付。

模板：

- `effectPolicy.kind = paymentMethodDiscount`
- `discountRatio = 0.2`
- `paymentInstrumentScope.instrumentTypes = ["prepaidCard"]`

结果：

- `SettlementGroupCandidate.coverageAmount = 10000`
- `externalRequestAmount = 8000`
- 主支付行覆盖 100.00 元
- 子支付行 1 表示外部扣款 80.00 元
- 子支付行 2 表示支付优惠 20.00 元

退款时业务上只能选择主支付行 100.00 元退款；支付中心根据组内子行完成反向处理。

## 维护禁区

- 不在计算包里访问 HTTP、TDP、缓存、localStorage 或后端接口。
- 不在计算包里做权益核销、退款返还、库存扣减。
- 不在计算包里理解零售/餐饮/高化原始模型。业务包必须先适配成标准快照。
- 不把展示字段当计算字段。`templatePayloadSnapshot.faceAmount` 是元数据，只有生成支付单候选时复制，不参与优惠金额计算。
- 不把“可用”误认为“已使用”。`opportunities` 是机会，`applications/settlementLines/pricingAdjustments` 才是实际使用结果。
