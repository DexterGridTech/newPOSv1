# 交易权益框架维护入口

这份文档是权益框架的入口索引。需要理解细节时按顺序阅读：

1. `benefit-types/README.md`: 标准模型、每个字段含义、金额单位、支付单候选字段。
2. `benefit-calculation/README.md`: 纯计算顺序、为什么这样算、购物车/订单/支付阶段数值案例。
3. `benefit-session/README.md`: 前端运行时会话、TDP、个人权益查询、动态码、多购物车占用。
4. `0-mock-server/mock-terminal-platform/server/src/modules/benefit-center`: mock 权益后台，提供个人查询、占用、释放、动态码和订单事实测试数据。

## 一眼看懂三包职责

| 包 | 负责什么 | 不负责什么 |
| --- | --- | --- |
| `benefit-types` | 统一模型。让零售、餐饮、高化都能适配到同一套商品、身份、权益、支付单候选字段。 | 不计算、不请求后台。 |
| `benefit-calculation` | 纯计算。输入标准快照，输出可用机会、实际应用、价格调整、支付单候选、履约效果。 | 不查接口、不占用、不核销、不退款。 |
| `benefit-session` | 终端运行时会话。接 TDP，查个人权益，处理动态码，保存多个购物车上下文，占用和释放配额，调用计算。 | 不理解具体业务下单模型，不手写 HTTP。 |

## 标准接入流程

### 购物车阶段

1. 业务包把购物车转成 `CommerceSubjectSnapshot`。
2. TDP 推送全场活动、非个人模板到 `benefit-session`。
3. 如果消费者登录，业务包 dispatch `linkBenefitIdentity`。
4. 业务包 dispatch `evaluateBenefitContext(stage = cart)`。
5. 根据结果：
   - `opportunities`: 展示可用、条件可用、不可用原因。
   - `pricingAdjustments/priceLayers`: 回写商品行原价、现价、优惠来源。
   - `settlementLines`: 一般购物车阶段较少出现，除非业务允许购物车预选支付型权益。
   - `fulfillmentEffects`: 展示赠品池，由店员选择赠品。

### 订单确认阶段

1. 订单金额应使用购物车阶段调价后的金额。
2. 业务包把订单转成 `CommerceSubjectSnapshot`。
3. 如果店员选择券、积分、赠品，先 dispatch 选择 command。
4. 再 dispatch `evaluateBenefitContext(stage = orderConfirm)`。
5. 结果里的 `SettlementLineCandidate` 给支付中心作为可支付/可核销候选。

### 支付阶段

1. 每次支付尝试都把订单里已完成支付行放入 `completedSettlements`。
2. 支付工具试算时填 `paymentInstrument`。
3. dispatch `evaluateBenefitContext(stage = payment)`。
4. 结果可能返回：
   - 预付卡支付优惠组：覆盖 100.00，外部请求 80.00，优惠 20.00。
   - 积分抵扣：数量 5000 点，金额 50.00。
   - 剩余可用券、钱包、购物卡候选。

## 关键业务规则

- “可用权益”和“使用权益”分开。`BenefitOpportunity` 只是机会；只有 `BenefitApplication`、`PricingAdjustment`、`SettlementLineCandidate` 或 `FulfillmentEffect` 才代表真实使用。
- 购物车阶段调价会改变订单金额。满 200 减 20 后，订单金额应该是 180.00，而不是 200.00。
- 订单/支付阶段的券、积分、购物卡、兑换券等统一生成支付单候选，让支付中心后续统一处理核销、记账和退款反向。
- 支付数量和金额分开。5000 积分是数量，50.00 元是金额。
- 配额占用要支持多购物车。购物车 A 当前占用后，购物车 B 只能显示不可用原因；A 取消释放后，B 可重新计算可用。
- 动态码只是添加权益来源。后台返回模板/权益行，前端重新计算，不把码逻辑写死在计算包。

## 真实数值总案例

购物车：

- 商品 A: 120.00 元
- 商品 B: 80.00 元
- 原始合计: 200.00 元

购物车权益：

- 全场满 200 减 20，自动调价。
- 结果：订单确认金额为 180.00 元。

订单权益：

- 店员选择 100 元券。
- 结果：生成 `coupon_deduction` 支付单候选，`payableImpactAmount = 10000`。

支付阶段：

- 若券已核销，订单剩余 80.00 元。
- 选择预付卡支付 8 折：
  - 支付组覆盖 80.00 元。
  - 外部请求金额 64.00 元。
  - 支付优惠 16.00 元。
- 如果改用积分：
  - 8000 积分最多抵 80.00 元。
  - `quantity = 8000`，`payableImpactAmount = 8000`。

维护者看到这些数值时，可以判断字段是否用对：金额字段永远是分，数量字段按自己的单位，购物车调价不等于支付单候选。

