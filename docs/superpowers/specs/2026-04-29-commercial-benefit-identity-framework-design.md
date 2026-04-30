# 商业权益与身份计算框架设计

## 背景

早期 [`cashier-sdk`](/Users/dexter/Documents/workspace/idea/cashier-sdk) 已经沉淀了几个有价值的方向：

1. 权益模板与权益行分离。
2. 通过规则判断权益是否可用。
3. 计算权益最大可用数量、实际选择数量、抵扣金额和分摊。
4. 支持历史支付行、已核销权益等已完成结算事实对当前权益计算的影响。
5. 区分自动推荐和用户调整。

但旧 SDK 的问题也很明显：

1. 请求、全局状态、身份、购物单、权益模板、计算器、支付转换混在一个前端 SDK 内。
2. `EquityCaculator` 聚合过多规则，新增玩法容易继续堆 if/else。
3. 身份模型过薄，只表达一个 `UserIdentity` 和会员节点，无法覆盖一个入口身份绑定多个独立身份、一个身份拥有多个会员计划的场景。
4. “可用权益”和“实际使用权益”混在同一个结果对象里，支付方式优惠、赠品池、可选券提示容易被误建模成已使用。
5. 购物车阶段定价优惠、订单确认后的支付抵扣、支付方式内部优惠、履约型权益没有被明确拆开。

本设计面向 `newPOSv1` 当前架构，目标是在 `0-mock-server` 和 `1-kernel/1.2-business` 中建立一套前后端共同理解的交易阶段商业权益、身份、计算、占用和结算候选标准。

## 目标

1. 设计一套足够完整的身份模型，支持入口主身份、绑定身份数组、每个身份下多个会员计划/会员卡/等级。
2. 设计一套足够抽象的权益模板与权益行模型，覆盖积分、券、活动、会员权益、支付方式优惠、赠品、兑换、服务等玩法。
3. 明确购物车定价阶段、订单金额冻结阶段、支付抵扣阶段、履约权益阶段的边界。
4. 支持多购物车/挂单下的自动占用、占用冲突、取消释放、订单提升，以及支付阶段权益使用候选生成。
5. 支持“可用机会、提示机会、实际应用”分离。
6. 支持统一的结算候选行模型，让支付中心后续统一对接各权益平台做核销、记账、退款还原；本模型只生成候选和读取已完成事实。
7. 支持后台根据终端号和组织树规则查询、包装、归一化个人权益与非个人权益。
8. 给零售、餐饮、高化等下单业务提供标准接入规范。

## 非目标

1. 本设计不实现真实外部权益系统、会员系统、支付中心适配。
2. 本设计不要求订单系统在第一版真实存在，但需要预留 `OrderFactPort`，并在 mock server 中模拟订单事实。
3. 本设计不把商场、品牌、门店、银行等发行方字段放进计算核心；这些字段只作为模板 payload、结算 payload 或外部快照保存。
4. 本设计不让权益 session 包反向依赖购物车、订单、零售、餐饮、高化业务包。
5. 本设计不让前端直接解释外部权益系统私有字段；权益模板组装由后台完成。
6. 本设计不负责权益发放、会员升级、积分累计、券包售卖、充值赠送、拼团秒杀、裂变助力、抽奖集点等上游营销或商品系统机制。
7. 本设计不执行具体核销、记账、退款反向动作；这些动作由支付中心或对应权益系统处理。本设计只生成候选结算行/核销意图，并读取已完成支付行、已核销权益、已撤销或已退款事实参与后续计算。

## 核心结论

### 1. 前台采用入口主身份 + 绑定身份数组

消费者可以用银行会员、商场会员、品牌会员、手机号等任意身份作为入口身份登录或识别。

后台根据入口身份返回绑定身份数组。每个身份保持独立，不合并成一个隐式用户账户。

每个身份可以拥有多个会员计划。例如一个商场会员身份下，可以同时有积分卡、金卡、美妆黑卡，它们分别属于不同忠诚度计划。

### 2. 权益模板与权益行必须分离

`BenefitTemplate` 表达规则、门槛、效果、选择、占用、叠加、分摊、结算等策略。

`BenefitLine` 表达某个用户持有的券、积分账户、购物卡余额、兑换资格、活动资格等具体实例。

非个人活动可以只有模板，没有个人权益行。需要余额、次数、资产实例、候选结算行或已完成结算事实回读的权益必须有权益行。

### 3. 计算核心只包含参与计算的字段

发行方、成本承担方、组织适用范围、外部权益类型、展示名、票面金额等不直接参与计算的字段，不进入计算核心模型。

这些字段放在：

1. `templatePayloadSnapshot`
2. `settlementPayloadSnapshot`
3. `externalSnapshot`

计算器只读取结构化策略字段，不读取任意 `raw`。

### 4. 前端可以计算订单金额，但受限权益必须先占用

前端购物车/订单业务包可以基于标准权益模板和标准购物车快照计算订单金额。

但凡影响订单金额，并且依赖身份、次数、额度、资产、外部名额的权益，必须在订单创建前拿到有效 reservation，才能计入订单金额。

无限量、无身份限制的全场满减可以不占用。

黑金卡每日一次 8 折、会员专属价、限量活动、个人资产券等必须先占用。

### 5. 支付阶段失败只适用于支付阶段权益

对于订单金额已固定后的支付抵扣、支付方式优惠，后台可以在支付阶段做最终正确性把控。

如果支付券、钱包、支付工具优惠不可用，支付失败，店员可以换支付方式或移除权益。

但如果一个权益已经影响了订单金额，不能等支付阶段才发现无效。它必须在下单前占用或提升占用。

### 6. 履约型权益也生成结算候选行

赠品、兑换商品、服务资格等履约型权益会产生订单结构行或履约项。

但具体核销、退款返还、反向记账由支付中心或对应权益系统执行。

本模型只生成 `SettlementLineCandidate` 作为支付中心的标准输入，并在后续计算时读取支付中心返回的已完成支付行、已核销权益、已退款或已撤销事实。

## 建议包拆分

第一版建议采用两个前端业务包，必要时再把身份独立出去。

### 包 A：`@next/kernel-business-benefit-calculation`

纯计算包。

职责：

1. 定义标准计算模型。
2. 解释标准权益模板策略。
3. 根据标准商品/订单/支付快照计算可用机会、提示机会、已应用权益、定价调整、分摊、结算候选、赠品/兑换/服务效果。
4. 保持纯函数，无副作用。

禁止：

1. 请求后台。
2. 读取 Redux 状态。
3. 依赖购物车/订单/餐饮/零售/高化业务包。
4. 解释外部权益系统 `raw`。

### 包 B：`@next/kernel-business-benefit-session`

终端权益会话包。

职责：

1. 维护当前终端下的非个人权益模板快照。
2. 维护入口主身份、绑定身份、会员计划、个人权益行、个人配额事实。
3. 接收 TDP 推送的非个人权益。
4. 在关联个人后主动查询个人身份与个人权益。
5. 管理多购物车/多订单上下文的占用状态。
6. 维护已完成支付行、已核销权益、已退款或已撤销等交易事实快照，并传给计算包。
7. 根据业务包传入的标准计算快照，调用计算包，并根据模板策略触发自动占用、释放、提升、支付占用。
8. 对业务包暴露 selector 和 command。

禁止：

1. 反向读取购物车/订单业务数据。
2. 依赖零售、餐饮、高化业务包。
3. 自己拼接完整购物车模型。
4. 解释外部权益系统 `raw`。

建议 Redux state 树：

```ts
export interface BenefitSessionState {
  identityState: BenefitIdentityState
  benefitSnapshotState: BenefitSnapshotState
  reservationState: BenefitReservationState
  evaluationState: BenefitEvaluationState
}
```

分区说明：

1. `identityState`：当前终端入口身份、绑定身份、会员计划快照。
2. `benefitSnapshotState`：非个人权益模板、个人权益行、动态激活模板/权益行。
3. `reservationState`：按 `contextRef` 和 `reservationId` 索引的占用状态。
4. `evaluationState`：按 `contextRef` 缓存最近一次计算结果、诊断和计算时间。

这个 state 树只存权益会话状态，不存业务购物车、订单明细或支付业务包内部状态。

### 可选包 C：`@next/kernel-business-customer-identity`

如果身份中台能力变复杂，可以将身份登录、绑定、解绑、身份快照维护独立为包。

第一版可以先放在 `benefit-session` 内，避免过早拆包。

## 后台 mock server 建议

建议新增或扩展一个权益后台 mock server，暂名：

`0-mock-server/mock-commercial-benefit-center`

职责：

1. 维护终端号到组织节点的映射。
2. 维护组织树和组织可查询系统注册表。
3. 根据终端号和入口身份返回身份快照。
4. 根据终端号、入口身份、绑定身份返回标准权益模板与权益行。
5. 提供非个人权益 TDP projection fixture。
6. 提供配额查询、占用、释放、提升 mock API。
7. 预留 `OrderFactPort`，模拟从订单系统查询已用次数、历史支付行、已核销权益、退款或撤销事实。
8. 提供支付中心 mock，接收 `SettlementLineCandidate` 后返回成功、失败或已完成支付行事实；具体核销和退款逻辑只模拟结果，不进入权益计算核心。

外部会员/权益系统第一版不真实接入，只用 mock adapter。

与现有 `mock-terminal-platform` 的关系：

1. 第一版优先复用现有 `mock-terminal-platform` 的 TDP 通道、projection 生命周期和 topic registry。
2. `mock-commercial-benefit-center` 可以作为 mock server 内的权益中心模块，而不是独立启动第二套平台服务。
3. 终端号到组织节点的映射优先复用现有终端主数据；权益中心只扩展组织可查询系统注册表和权益 fixture。
4. 非个人权益通过 TDP projection 推送；个人权益、动态券码、占用和支付事实模拟通过 HTTP API 提供。

## 组织查询策略

第一版不做复杂外部系统规则，只按组织树和系统归属关系查询。

基础规则：

1. 每个用户身份系统、权益系统都注册一个归属组织节点。
2. 终端号可以解析到当前终端所属组织节点。
3. 下级组织可以查询上级组织注册的系统。
4. 当前终端可能同时处在多条组织链中。

示例：

```text
店铺条线：
万象集团 -> 深圳万象城 -> 深圳万象城优衣库

品牌条线：
优衣库 -> 深圳万象城优衣库
```

如果万象集团注册了会员权益系统，优衣库注册了会员权益系统，那么深圳万象城优衣库终端可以查询这两个系统。

前端只传：

```ts
interface PersonalBenefitQueryInput {
  terminalNo: string
  entryIdentity: EntryIdentityCredential
}
```

后台决定查询哪些身份系统和权益系统。

## 基础类型

### `Money`

金额统一使用最小货币单位的整数，避免浮点误差。

```ts
export interface Money {
  amount: number
  currency: string
}
```

说明：

1. `amount` 使用最小货币单位，例如人民币分。
2. 虽然 TypeScript 类型是 `number`，但所有 `amount` 值必须是整数，不得出现小数。
3. 所有计算器不得使用浮点金额直接相加、相减、相乘；需要比例运算时必须使用整数运算和明确舍入策略。
4. 不同 `currency` 的金额不能在同一次计算中直接合并。

### `BenefitRef`

```ts
export interface BenefitRef {
  templateKey: string
  lineKey?: string
}
```

说明：

1. 非个人活动、全场活动、会员价等可以只有 `templateKey`。
2. 个人券、积分账户、购物卡、兑换资格等必须带 `lineKey`。

### `EntryIdentityCredential`

```ts
export interface EntryIdentityCredential {
  credentialType: 'mobile' | 'memberId' | 'qrCode' | 'nfc' | 'faceId' | string
  credentialValue: string
  identitySystemCode?: string
}
```

说明：

1. 入口凭证只表达本次识别消费者的方式。
2. 后台根据入口凭证解析入口身份和绑定身份。
3. 前端不需要知道各身份系统的私有登录协议。

### `ProductScopeRule`

```ts
export interface ProductScopeRule {
  mode: 'all' | 'include' | 'exclude'
  identityMatchers?: ProductIdentityMatcher[]
}

export interface ProductIdentityMatcher {
  identityType: 'skuId' | 'spuId' | 'categoryId' | 'saleProductType' | string
  values: string[]
  ownerScope?: string
}
```

规则：

1. `mode = all` 表示不限制商品范围。
2. `mode = include` 表示只命中指定商品身份。
3. `mode = exclude` 表示排除指定商品身份。
4. 商品行级 `benefitParticipation.excludeAllBenefits` 优先级高于任何 `ProductScopeRule`。

### `ReservationSubjectRef`

```ts
export interface ReservationSubjectRef {
  subjectType:
    | 'entryIdentity'
    | 'identity'
    | 'membership'
    | 'paymentAccount'
    | 'benefitLine'
    | 'custom'
  subjectKey: string
  identitySystemCode?: string
}
```

说明：

1. `subjectType` 必须与 `ReservationPolicy.subject` 可映射。
2. `subjectKey` 是占用和配额合成的稳定 key。
3. 自定义主体必须由后台权益中心标准化后返回，前端计算器不拼私有 key。

## 身份模型

### `CustomerIdentitySnapshot`

```ts
export interface CustomerIdentitySnapshot {
  snapshotId: string
  terminalNo: string
  entryIdentity: CustomerIdentity
  boundIdentities: CustomerIdentity[]
  resolvedAt: string
  diagnostics?: IdentityDiagnostic[]
}
```

### `CustomerIdentity`

```ts
export interface CustomerIdentity {
  identityKey: string
  identitySystemCode: string
  identityType: string
  externalIdentityId: string
  verified: boolean
  displayName?: string
  mobileMasked?: string
  memberships: MembershipProfile[]
  attributes?: Record<string, unknown>
  externalSnapshot?: unknown
}
```

说明：

1. `identityKey` 是本系统内稳定引用。
2. `identityType` 可以是 `mall_member`、`brand_member`、`store_member`、`bank_member`、`payment_account` 等。
3. `externalIdentityId` 是外部系统 ID。
4. `memberships` 表示同一个身份下的多个会员计划、卡、等级、权益身份。
5. `externalSnapshot` 不参与计算。

### `MembershipProfile`

```ts
export interface MembershipProfile {
  membershipKey: string
  identityKey: string
  loyaltyProgramCode: string
  membershipType: string
  levelCode?: string
  status: 'active' | 'inactive' | 'frozen' | 'expired'
  tags?: string[]
  qualificationAttributes?: Record<string, string | number | boolean>
  attributes?: Record<string, unknown>
  externalSnapshot?: unknown
}
```

示例：

```text
identity: 深圳万象城商场会员
memberships:
  - 积分卡
  - 金卡
  - 美妆黑卡
```

权益规则可以要求 identity，也可以要求 membership。

边界说明：

1. 身份模型只表达当前消费者身份、会员忠诚度和会影响交易资格判断的身份属性。
2. 积分如果用于判断身份资格，例如积分高于某值才能享受权益，可以进入 `qualificationAttributes`。
3. 积分如果用于支付抵扣，例如多少积分抵扣多少金额，必须建模为账户型 `BenefitLine`。
4. 积分累计、多倍积分、积分清零、会员升级规则不进入本模型。

## 权益模型

### `BenefitTemplate`

```ts
export interface BenefitTemplate {
  templateKey: string
  templateCode: string
  version: number
  status: 'active' | 'inactive' | 'expired'
  calculationSchemaVersion: 1

  eligibilityPolicy: EligibilityPolicy
  effectPolicy: EffectPolicy
  basisPolicy: BasisPolicy
  selectionPolicy: SelectionPolicy
  reservationPolicy: ReservationPolicy
  stackingPolicy: StackingPolicy
  transactionStackingPolicy?: TransactionStackingPolicy
  allocationPolicy: AllocationPolicy
  settlementPolicy: SettlementPolicy
  fulfillmentPolicy?: FulfillmentPolicy
  lifecyclePolicy: LifecyclePolicy

  templatePayloadSnapshot?: BenefitTemplatePayload
  settlementPayload?: BenefitSettlementPayload
  externalSnapshot?: unknown
}
```

说明：

1. `templatePayloadSnapshot` 保存展示、报表、发行方、成本承担、票面额、外部模板编码等非计算信息。
2. `settlementPayload` 在生成结算行时复制到结算行。
3. `externalSnapshot` 保存外部原始快照，不参与计算。
4. 所有影响计算的字段必须进入明确 policy，不能藏在 payload 或 raw 中。

### `BenefitLine`

```ts
export interface BenefitLine {
  lineKey: string
  templateKey: string
  lineType: 'asset' | 'account' | 'qualification' | 'activity_instance'
  ownerIdentityKey?: string
  ownerMembershipKey?: string

  quantity?: number
  balanceAmount?: Money
  availableFrom?: string
  availableTo?: string
  status: 'available' | 'reserved' | 'consumed' | 'expired' | 'voided'

  linePayloadSnapshot?: BenefitLinePayload
  settlementPayload?: BenefitSettlementPayload
  externalSnapshot?: unknown
}
```

示例：

1. 一张优惠券：`lineType = asset`，`quantity = 1`。
2. 积分账户：`lineType = account`，`quantity = 当前积分余额`。
3. 购物卡：`lineType = account`，`balanceAmount = 当前余额`。
4. 生日礼遇资格：`lineType = qualification`。
5. 非个人全场满减：可以只有 template，没有 line。

状态边界：

1. `BenefitLine.status` 是后台权益系统或权益中台返回的资产状态快照，例如可用、已消费、已过期、已作废。
2. `BenefitReservation.state` 是当前终端权益会话维护的占用状态，例如被购物车占用、提升到订单、支付阶段占用、释放、过期。
3. 计算包同时读取两类事实，但职责不同：`BenefitLine.status` 决定资产本身是否仍可用，`BenefitReservation.state` 决定当前上下文是否已经占用、是否被其他上下文占用。
4. 当前端占用成功后，不要求立即改写 `BenefitLine.status = reserved`；占用以 `BenefitReservation` 为准，避免 line 快照和会话占用双写冲突。
5. 当 `BenefitLine.status = consumed | expired | voided` 时，计算器直接判定该权益行不可用，不需要再检查 reservation 状态。
6. `BenefitLine.availableFrom/availableTo` 和模板级 `LifecyclePolicy.validFrom/validTo` 都必须满足才可用；权益行过期则不可用，即使模板仍在有效期内。

## 十个策略维度

第一版框架按十个 policy 设计。它们是完整模型，不是窄 MVP。

### 1. `eligibilityPolicy`

判断谁、何时、哪里、什么商品、什么支付方式可用。

```ts
export interface EligibilityPolicy {
  identityRequirements?: IdentityRequirement[]
  membershipRequirements?: MembershipRequirement[]
  timeWindow?: TimeWindowRule
  terminalRequirements?: TerminalRequirement[]
  channelRequirements?: ChannelRequirement[]
  productScope?: ProductScopeRule
  paymentInstrumentScope?: PaymentInstrumentScopeRule
  thresholdRequirements?: ThresholdRequirement[]
}
```

说明：

1. 身份资格只读 `CustomerIdentitySnapshot`。
2. 商品资格只读 `CommerceSubjectSnapshot`。
3. 支付方式资格只读支付快照，不在未选择支付方式时强行应用。

### 2. `effectPolicy`

定义权益产生什么效果。

```ts
export type EffectPolicy =
  | AmountOffEffectPolicy
  | RatioOffEffectPolicy
  | FixedPriceEffectPolicy
  | TieredDiscountEffectPolicy
  | BuyNFreeMEffectPolicy
  | NthItemDiscountEffectPolicy
  | BundlePriceEffectPolicy
  | PointsDeductionEffectPolicy
  | StoredValueDeductionEffectPolicy
  | PaymentMethodDiscountEffectPolicy
  | GiftPoolEffectPolicy
  | ExchangeLineEffectPolicy
  | ServiceEntitlementEffectPolicy
```

覆盖场景：

1. 满额减。
2. 满额折。
3. 满额赠。
4. 买 3 免 1。
5. 第 N 件优惠。
6. 会员价、身份专属价。
7. 组合价、套餐价。
8. 积分抵扣。
9. 购物卡、礼品卡、钱包抵扣。
10. 支付方式优惠。
11. 赠品池。
12. 兑换商品。
13. 服务权益。

复杂商品作用范围不应塞进各个具体 effect 的私有字段，建议抽成通用商品角色规则：

```ts
export interface BenefitItemRoleRule {
  role:
    | 'thresholdItem'
    | 'conditionItem'
    | 'benefitTargetItem'
    | 'discountedItem'
    | 'freeItem'
    | 'giftItem'
    | 'exchangeItem'
    | 'addOnItem'
  productScope: ProductScopeRule
  quantityRule?: QuantityRule
  amountRule?: ThresholdRequirement
  targetSelection?: BenefitTargetSelection
  participationEffect?: LineParticipationEffect
}

export interface BenefitTargetSelection {
  mode:
    | 'allMatched'
    | 'highestPrice'
    | 'lowestPrice'
    | 'cartOrder'
    | 'sameAsConditionItem'
    | 'clerkSelected'
  maxQuantity?: number
}

export interface LineParticipationEffect {
  excludeThisLineFromOtherBenefitKinds?: string[]
  excludeThisLineFromOtherThresholds?: boolean
}

export interface NthItemDiscountEffectPolicy {
  kind: 'nthItemDiscount'
  n: number
  discountRatio?: number
  discountAmount?: Money
  sortOrder: 'byPriceAsc' | 'byPriceDesc' | 'byCartOrder'
  productScope?: ProductScopeRule
  targetSelection?: BenefitTargetSelection
}
```

`discountRatio` 和 `discountAmount` 必须且只能配置一个。折扣比例和固定减额不能同时存在，也不能同时为空。

该结构用于覆盖：

1. 折扣券只优惠最高价或最低价一份。
2. 第 N 件优惠。
3. 买 A 赠 B、买 A 赠 A。
4. 满额后指定商品优惠购。
5. 条件商品不再参与其他折扣或其他门槛。

### 3. `basisPolicy`

定义计算基准。

旧 SDK 的 `OriginalBased` 和 `RemainedBased` 应升级为更完整的基准策略。

```ts
export interface BasisPolicy {
  thresholdBase: 'originalAmount' | 'currentRemainingAmount' | 'afterSelectedPricingAdjustments'
  discountBase: 'originalAmount' | 'currentRemainingAmount' | 'lineUnitPrice' | 'membershipPrice'
  includePriorAdjustments: boolean
  includeGiftLines: boolean
  includeExchangeLines: boolean
  thresholdConsumptionMode?: 'none' | 'consumeByApplication' | 'consumeByGroup'
}
```

典型差异：

1. 全场满减按原价门槛算。
2. 支付券按剩余应付算。
3. A 权益后 B 权益是否按剩余金额算，由 `basisPolicy + stackingPolicy` 决定。
4. 门槛金额是否被前一个权益消耗，由 `thresholdConsumptionMode` 决定。

### 4. `selectionPolicy`

定义可用机会如何变成实际应用。

```ts
export interface SelectionPolicy {
  mode:
    | 'auto'
    | 'manual'
    | 'clerkChoose'
    | 'customerChoose'
    | 'conditional'
    | 'codeActivated'
  trigger?:
    | 'cartChanged'
    | 'identityLinked'
    | 'giftChosen'
    | 'paymentInstrumentSelected'
    | 'codeEntered'
  defaultSelectedQuantity?: number
  allowDeselect?: boolean
}
```

默认建议可以由权益类型推导，但最终必须以模板配置为准。

### 5. `reservationPolicy`

定义是否占用、何时占用、按谁占用、何时释放。

```ts
export interface ReservationPolicy {
  mode:
    | 'none'
    | 'autoOnOpportunity'
    | 'onSelection'
    | 'onOrderSubmit'
    | 'onPaymentAttempt'
  subject:
    | 'entryIdentity'
    | 'identity'
    | 'membership'
    | 'paymentAccount'
    | 'benefitLine'
    | 'custom'
  subjectIdentityType?: string
  subjectMembershipType?: string
  quotaBucket?: QuotaBucketPolicy
  ttlSeconds?: number
  releaseOn: ReservationReleaseEvent[]
  promoteOn?: 'orderCreated' | 'paymentStarted'
  consumeOn?: 'orderConfirmed' | 'paymentSucceeded' | 'fulfillmentCompleted' | 'manualWriteOff'
}
```

配额事实来源必须显式表达，避免只看当前购物车占用而漏掉历史订单或外部权益系统事实。

```ts
export interface QuotaBucketPolicy {
  bucketKey: string
  window: 'perOrder' | 'perDay' | 'perWeek' | 'perMonth' | 'lifetime' | 'custom'
  limitQuantity: number
  factSources: QuotaFactSource[]
}

export type QuotaFactSource =
  | 'reservationLedger'
  | 'orderFact'
  | 'externalQuery'

export interface BenefitQuotaFact {
  bucketKey: string
  subjectRef: ReservationSubjectRef
  usedQuantity: number
  source: QuotaFactSource
  factRef?: string
  occurredAt?: string
}
```

合成规则：

1. `reservationLedger` 表达当前终端、多购物车、多订单上下文里的占用。
2. `orderFact` 表达订单系统已经发生的成功交易、已完成支付行、已核销权益等事实。
3. `externalQuery` 表达外部权益系统实时返回的使用次数或余额事实。
4. 计算包只消费已标准化的 `BenefitQuotaFact`，不直接查询订单系统或外部权益系统。

多购物车场景：

```text
购物车 A 自动占用黑金卡每日一次 8 折。
购物车 B 同一黑金会员也满足条件，但显示“已被购物车 A 占用”。
取消 A 后，B 可以重新占用。
```

默认不自动抢占。

### 6. `stackingPolicy`

定义互斥、叠加、优先级和同组上限。

```ts
export interface StackingPolicy {
  priority: number
  groupKey?: string
  exclusionGroupKeys?: string[]
  stackMode: 'exclusive' | 'stackable' | 'bestOfGroup' | 'sequential'
  groupLimit?: GroupLimitPolicy
  thresholdGroupKey?: string
}
```

覆盖场景：

1. 会员价和券互斥。
2. 多张券同组只可选一张。
3. 积分和折扣积分同组最多抵扣 10000 积分。
4. 商品类优惠先于支付类优惠。
5. 外部优先级、内部优先级。

第一版可以保留上面的简单结构作为模板内快捷配置，但需要预留交易阶段同享互斥关系图，避免后续被美团同享互斥 2.0、POS 手工优惠、团购券、余额/礼品卡等组合场景卡住。

```ts
export interface TransactionStackingPolicy {
  defaultRelation: 'exclusive' | 'shareable'
  rules: TransactionStackingRule[]
  conflictResolution: 'priority' | 'bestBenefit' | 'manualSelectionRequired'
}

export interface TransactionStackingRule {
  ruleId: string
  left: BenefitStackingSelector
  right: BenefitStackingSelector
  relation: 'shareable' | 'exclusive'
  dimension: 'order' | 'commerceLine' | 'paymentGroup'
  priority: number
  source: 'global' | 'template' | 'store' | 'runtime'
}
```

关系图只表达“当前交易中哪些权益、手工调整、支付资产可以同时使用”。营销投放活动、券包售卖、积分累计活动不进入这张图。

合并规则：

1. `StackingPolicy` 是模板自身的默认叠加声明，适合表达优先级、默认组、默认互斥组、组内上限。
2. `TransactionStackingPolicy` 是交易上下文的最终关系图，来源可以是全局规则、门店规则、模板规则和运行时规则。
3. 当两者冲突时，以 `TransactionStackingPolicy.rules` 的高优先级规则为准。
4. 后台组装权益快照时，应尽量把模板默认 `StackingPolicy` 展开成交易关系图；前端计算器只在没有关系图规则命中时回退模板默认配置。
5. 运行时规则只允许收紧或诊断，不应悄悄放宽后台返回的强互斥规则。
6. 类型上不使用 union。`stackingPolicy` 始终表达模板默认策略，`transactionStackingPolicy` 可选表达后台组装后的交易最终关系图。

### 7. `allocationPolicy`

定义金额或权益效果如何分摊到商品行。

```ts
export interface AllocationPolicy {
  target: 'matchedLines' | 'allPayableLines' | 'selectedLines' | 'paymentGroup'
  method: 'byAmountRatio' | 'byQuantityRatio' | 'fixedPerLine' | 'bestBenefitFirst'
  rounding: 'floorToCent' | 'roundToCent' | 'bankersRound'
  remainder: 'largestAmountLine' | 'firstLine' | 'lastLine'
  includeZeroAmountLines: boolean
  refundReversal: 'byOriginalAllocation' | 'recalculateOnRefund'
}
```

退款强依赖分摊。

第一版建议退款默认按原分摊反向，不在退款时重新计算权益。

### 8. `settlementPolicy`

定义是否生成结算候选行、候选行类型、数量单位、payload 快照。

```ts
export interface SettlementPolicy {
  createSettlementLineCandidate: boolean
  settlementLineType:
    | 'pricing_adjustment_record'
    | 'coupon_deduction'
    | 'points_deduction'
    | 'stored_value_deduction'
    | 'wallet_deduction'
    | 'payment_method_discount'
    | 'gift_benefit_writeoff'
    | 'exchange_benefit_writeoff'
    | 'service_benefit_writeoff'
  quantityUnit?: 'piece' | 'point' | 'cent' | 'times' | 'item'
  amountRole:
    | 'payableImpact'
    | 'coverageAmount'
    | 'benefitValueOnly'
    | 'externalChargeAmount'
  copySettlementPayload: boolean
}
```

注意：

1. 结算行同时支持数量和金额。
2. `faceAmount` 等票面额不参与计算，应在 `settlementPayload` 中复制。
3. 支付中心最终核销/记账/退款反向不在本次范围，但结算候选需要为支付中心准备好标准输入。

### 9. `fulfillmentPolicy`

定义赠品、兑换、服务等结构性效果如何落单和履约。

```ts
export interface FulfillmentPolicy {
  materialization:
    | 'none'
    | 'giftPool'
    | 'giftLine'
    | 'exchangeLine'
    | 'serviceLine'
    | 'postOrderCertificate'
  selectionMode?: 'auto' | 'clerkChoose' | 'customerChoose'
  stockMode?: 'reserveOnOrder' | 'deductOnOrder' | 'deductOnFulfillment'
  returnMode?: 'withMainProduct' | 'independent' | 'notReturnable'
}
```

本设计倾向：

1. 赠品默认根据模板配置生成可选赠品池，由店员选择。
2. 兑换商品可以生成 0 元订单行。
3. 履约型权益也生成结算候选行，供支付中心或对应权益系统后续执行核销、记账或退款返还。

### 10. `lifecyclePolicy`

定义有效期、状态流转、撤销、退款返还处理建议。

```ts
export interface LifecyclePolicy {
  validFrom?: string
  validTo?: string
  statusRules?: LifecycleStatusRule[]
  voidOn?: LifecycleVoidEvent[]
  refundBehavior:
    | 'returnBenefit'
    | 'doNotReturnBenefit'
    | 'returnRemainingQuantity'
    | 'manualReview'
  partialRefundBehavior:
    | 'proportional'
    | 'byOriginalAllocation'
    | 'notSupported'
}
```

`LifecyclePolicy` 只表达交易计算和候选生成需要携带的策略建议。具体退款返还、反向记账、权益恢复动作仍由支付中心、订单中心或对应权益系统执行。

## 标准计算输入

业务包负责组装标准输入，权益 session 包和计算包不反向读取业务状态。

### `BenefitEvaluationRequest`

```ts
export type BenefitEvaluationStage = 'cart' | 'orderConfirm' | 'payment'

export interface BenefitEvaluationRequest {
  contextRef: BenefitContextRef
  stage: BenefitEvaluationStage
  subject: CommerceSubjectSnapshot
  identitySnapshot?: CustomerIdentitySnapshot
  benefitSnapshot: BenefitSnapshot
  selectedApplications?: BenefitApplicationInput[]
}
```

阶段语义：

1. `cart`：商品可增删改，主要输出价格调整、赠品机会、提示机会和需要购物车占用的权益。
2. `orderConfirm`：订单金额准备冻结，必须提升或确认已影响订单金额的受限权益占用。
3. `payment`：订单金额已形成，主要输出支付/抵扣候选行、支付方式优惠、动态券码权益和已完成支付事实后的剩余权益判断。

### `BenefitSnapshot`

```ts
export interface BenefitSnapshot {
  templates: BenefitTemplate[]
  lines: BenefitLine[]
  reservations: BenefitReservation[]
  completedSettlements?: CompletedSettlementSnapshot[]
  quotaFacts?: BenefitQuotaFact[]
  activatedCodes?: ActivatedBenefitCodeResult[]
}
```

说明：

1. `templates` 包含非个人交易权益模板、个人权益模板和动态激活模板。
2. `lines` 包含个人券、账户型权益、兑换资格、动态券码返回的权益行。
3. `reservations` 是当前权益 session 维护的占用事实。
4. `completedSettlements` 是支付中心或订单中心返回的已完成事实冗余副本。权威来源是 `CommerceSubjectSnapshot.completedSettlements`，由业务包基于订单/支付事实组装；两者同时存在时，计算器以 `CommerceSubjectSnapshot.completedSettlements` 为准。
5. `quotaFacts` 是后端标准化后的配额事实输入。

### `BenefitContextRef`

```ts
export interface BenefitContextRef {
  contextType: 'cart' | 'order' | 'payment'
  contextId: string
  isCurrent?: boolean
}
```

`contextId` 只用于占用、释放、诊断和多购物车归属，不用于让权益包反查购物车数据。

阶段与上下文的关系：

1. `stage = cart` 时，`contextRef.contextType = cart`。
2. `stage = orderConfirm` 时，`contextRef.contextType = order`，表示购物车已准备提升为订单，占用需要提升到订单级。
3. `stage = payment` 时，`contextRef.contextType = payment` 或 `order`。如果一次订单存在多个支付尝试，建议使用 `payment` 并用 `paymentAttemptId` 作为 `contextId`。

### `CommerceSubjectSnapshot`

```ts
export interface CommerceSubjectSnapshot {
  terminalNo: string
  channelCode?: string
  currency: string
  lines: CommerceLineSnapshot[]
  totals: CommerceTotalsSnapshot
  completedSettlements?: CompletedSettlementSnapshot[]
  paymentInstrument?: PaymentInstrumentSnapshot
  attributes?: Record<string, unknown>
}
```

### `CommerceLineSnapshot`

```ts
export interface CommerceLineSnapshot {
  lineId: string
  quantity: number
  originalUnitPrice: Money
  originalLineAmount: Money
  currentUnitPrice: Money
  currentLineAmount: Money
  payableAmount?: Money
  priceLayers?: CommerceLinePriceLayer[]

  productIdentities: ProductIdentity[]
  categoryPath?: ProductCategoryNode[]
  saleProductTypeCode?: string
  benefitParticipation?: CommerceLineBenefitParticipation
  attributes?: Record<string, unknown>
}
```

### `CommerceLineBenefitParticipation`

商品行可以明确标记“不参与任何权益”。这是商品事实的一部分，优先级高于任意权益模板的商品范围。

```ts
export interface CommerceLineBenefitParticipation {
  mode: 'eligible' | 'excludeAllBenefits'
  reasonCode?: string
  allowManualOverride?: boolean
}
```

规则：

1. `excludeAllBenefits` 硬排除所有权益，计算器必须输出不可用诊断，而不是静默跳过。
2. 如果业务方只是想禁止手工折扣、禁止积分累计或禁止某一类活动，不应使用 `excludeAllBenefits`，而应使用更细的业务属性或权益模板范围。
3. 赠品/兑换行默认不参与后续权益，除非权益模板显式允许。

价格字段语义：

1. `originalUnitPrice` 和 `originalLineAmount` 是商品进入购物车时的原始价格事实。
2. `currentUnitPrice` 和 `currentLineAmount` 是购物车阶段定价权益、会员价、改价活动叠加后的当前价格。
3. `payableAmount` 是当前行在本轮计算后的剩余应付金额，可继续被后续权益或支付抵扣影响。
4. `priceLayers` 用于解释现价从哪里来，避免只保存一个最终价导致退款、展示和二次计算缺少依据。

### `CommerceLinePriceLayer`

```ts
export interface CommerceLinePriceLayer {
  layerId: string
  source:
    | 'basePrice'
    | 'manualPriceChange'
    | 'memberPrice'
    | 'pricingBenefit'
    | 'bundlePrice'
    | 'promotionCode'
  benefitRef?: BenefitRef
  applicationId?: string
  descriptionCode?: string
  unitPriceBefore: Money
  unitPriceAfter: Money
  lineAmountBefore: Money
  lineAmountAfter: Money
  adjustmentAmount: Money
  sequence: number
}
```

商品单上必须能标识：

1. 原价。
2. 现价。
3. 每个优惠活动带来的价格影响。
4. 多个活动叠加后的顺序和结果。

业务包展示“原价、现价、优惠价、活动来源”时，不应该重新解释权益模板，而应该消费 `priceLayers` 或 `PricingAdjustment` 的快照。

### `CompletedSettlementSnapshot`

订单阶段可能分步支付。已经完成的支付行、已核销权益、已退款或已撤销事实必须作为计算事实参与后续可选权益判断。

```ts
export interface CompletedSettlementSnapshot {
  settlementGroupId?: string
  settlementLineId: string
  lineType: string
  benefitRef?: BenefitRef
  coverageAmount: Money
  payableImpactAmount: Money
  quantity?: number
  quantityUnit?: string
  allocations?: BenefitAllocation[]
  settlementPayloadSnapshot?: BenefitSettlementPayload
  completedAt: string
  status: 'completed' | 'refunded' | 'partiallyRefunded' | 'voided'
}
```

典型场景：

```text
订单应付 300
先核销一张 100 元代金券
再微信支付 150
再使用积分抵 50
```

当计算“当前还能用哪些权益”时，计算器必须看到前两步已完成的 `CompletedSettlementSnapshot`，用它们推导订单剩余应付、已使用权益组、已消耗门槛、已分摊金额和可退款事实。

边界说明：

1. `CompletedSettlementSnapshot` 是事实输入，不是本模型执行核销后的结果。
2. 支付中心或权益系统完成扣减、核销、退款、撤销后，将事实回写给业务包或权益 session 包。
3. 计算器只读取这些事实，推导剩余应付、互斥关系、配额占用和后续权益可用性。

商品身份包括：

1. 店铺专属 `skuId`
2. 店铺专属 `spuId`
3. 店铺专属树形 `category`
4. 商场专属销售商品类型
5. 业务方扩展身份

```ts
export interface ProductIdentity {
  identityType: 'skuId' | 'spuId' | 'categoryId' | 'saleProductType' | string
  identityValue: string
  ownerScope?: string
}
```

## 标准计算输出

### `BenefitEvaluationResult`

```ts
export interface BenefitEvaluationResult {
  contextRef: BenefitContextRef
  stage: BenefitEvaluationStage
  opportunities: BenefitOpportunity[]
  prompts: BenefitPrompt[]
  applications: BenefitApplication[]
  pricingAdjustments: PricingAdjustment[]
  fulfillmentEffects: FulfillmentEffect[]
  settlementGroups: SettlementGroupCandidate[]
  settlementLines: SettlementLineCandidate[]
  allocations: BenefitAllocation[]
  diagnostics: BenefitEvaluationDiagnostic[]
}
```

### `BenefitAllocation`

```ts
export interface BenefitAllocation {
  allocationId: string
  benefitRef: BenefitRef
  applicationId?: string
  targetLineId: string
  allocatedAmount: Money
  allocatedQuantity?: number
  allocationRatio?: number
}
```

说明：

1. `allocatedAmount` 表达分摊到商品行的金额影响。
2. `allocatedQuantity` 表达积分、次数、件数等数量型分摊。
3. `allocationRatio` 只用于解释分摊比例，不作为金额权威值。

### `BenefitEffectPreview`

```ts
export interface BenefitEffectPreview {
  effectKind: string
  estimatedAmount?: Money
  estimatedQuantity?: number
  descriptionKey?: string
}
```

### `BenefitUnavailableReason`

```ts
export type BenefitUnavailableReason =
  | { code: 'reservedByOtherContext'; contextRef: BenefitContextRef }
  | { code: 'quotaExhausted'; bucketKey: string }
  | { code: 'eligibilityNotMet'; failedRequirements: string[] }
  | { code: 'lineExpired' }
  | { code: 'lineConsumed' }
  | { code: 'thresholdNotMet'; required: Money; current: Money }
  | { code: 'stackingConflict'; conflictingBenefitRef: BenefitRef }
  | { code: 'stageNotApplicable'; applicableStages: BenefitEvaluationStage[] }
  | { code: 'productExcluded'; lineIds: string[] }
```

### `BenefitEvaluationDiagnostic`

```ts
export interface BenefitEvaluationDiagnostic {
  diagnosticId: string
  level: 'info' | 'warn' | 'error'
  code: string
  benefitRef?: BenefitRef
  message?: string
  trace?: PolicyExecutionTrace[]
}
```

## 可用机会、提示机会、实际应用

### `BenefitOpportunity`

表示“这个权益在当前上下文是否可用，最多能带来什么效果”。

```ts
export interface BenefitOpportunity {
  opportunityId: string
  benefitRef: BenefitRef
  availability: 'available' | 'unavailable' | 'conditional'
  unavailableReason?: BenefitUnavailableReason
  maxEffectPreview?: BenefitEffectPreview
  requiredAction?:
    | 'selectBenefit'
    | 'selectPaymentInstrument'
    | 'chooseGift'
    | 'enterCode'
    | 'enterPassword'
  reservationPreview?: ReservationPreview
}
```

### `BenefitPrompt`

表示“当前还没有实际应用，但可以提示店员或消费者采取动作”。

示例：

```text
如果使用购物卡支付，可减 20 元。
```

```ts
export interface BenefitPrompt {
  promptId: string
  benefitRef: BenefitRef
  triggerAction: 'selectPaymentInstrument' | 'enterCode' | 'linkIdentity' | 'chooseGift'
  previewTextKey?: string
  effectPreview?: BenefitEffectPreview
}
```

### `BenefitApplication`

表示权益已经被选择、自动应用、占用或生效。

```ts
export interface BenefitApplication {
  applicationId: string
  opportunityId?: string
  benefitRef: BenefitRef
  state: 'selected' | 'autoApplied' | 'reserved' | 'applied'
  selectedQuantity: number
  actualEffect: BenefitEffect
  reservationId?: string
  allocations?: BenefitAllocation[]
}
```

只有 `BenefitApplication` 才会影响当前计算结果、占用配额或后续生成结算候选。

## 占用模型

### `BenefitReservation`

```ts
export interface BenefitReservation {
  reservationId: string
  benefitRef: BenefitRef
  subjectRef: ReservationSubjectRef
  contextRef: BenefitContextRef
  quantity: number
  amount?: Money
  state:
    | 'held_by_cart'
    | 'promoted_to_order'
    | 'held_by_payment'
    | 'consumed'
    | 'released'
    | 'expired'
  idempotencyKey: string
  expiresAt?: string
  createdAt: string
  updatedAt: string
}
```

典型流转：

```text
cart opportunity -> held_by_cart
held_by_cart -> promoted_to_order
promoted_to_order -> consumed
held_by_cart -> released
held_by_cart -> expired
held_by_payment -> consumed
held_by_payment -> released
```

## 定价、结算、履约

### `PricingAdjustment`

下单前影响订单金额。

```ts
export interface PricingAdjustment {
  adjustmentId: string
  benefitRef: BenefitRef
  amount: Money
  targetLineIds: string[]
  allocationIds: string[]
  priceLayerIds?: string[]
  priceEffect:
    | 'amountOff'
    | 'ratioOff'
    | 'fixedPrice'
    | 'memberPrice'
    | 'bundlePrice'
    | 'buyNFreeM'
    | 'nthItemDiscount'
  affectsOrderPayable: true
}
```

`PricingAdjustment` 是计算结果；`CommerceLinePriceLayer` 是商品行价格解释快照。

两者关系：

1. `PricingAdjustment` 说明本次权益整体影响。
2. `BenefitAllocation` 说明影响如何分摊到商品行。
3. `CommerceLinePriceLayer` 说明商品行价格如何从原价变成现价。

购物车业务包在接收 `PricingAdjustment` 后，可以把相关 `priceLayer` 写回自己的商品行状态。

订单创建时必须冻结这些价格层，避免支付、退款、补打小票时重新解释活动。

### `SettlementGroupCandidate`

一次支付/抵扣/权益使用主单候选，作为支付中心创建支付组或退款锚点的标准输入。

支付方式优惠示例：

```text
订单应付 100
预付卡 8 折支付
主支付单 coverageAmount = 100
外部扣款 externalRequestAmount = 80
子结算行 1 = 预付卡扣款 80
子结算行 2 = 支付优惠 20
退款入口选择主支付单 100
```

```ts
export interface SettlementGroupCandidate {
  settlementGroupId: string
  contextRef: BenefitContextRef
  coverageAmount: Money
  refundAnchorAmount: Money
  externalRequestAmount?: Money
  lineIds: string[]
}
```

### `SettlementLineCandidate`

```ts
export interface SettlementLineCandidate {
  settlementLineId: string
  settlementGroupId?: string
  benefitRef?: BenefitRef
  lineType: string
  quantity?: number
  quantityUnit?: string
  payableImpactAmount: Money
  benefitValueAmount?: Money
  externalRequestAmount?: Money
  settlementPayloadSnapshot?: BenefitSettlementPayload
  externalSnapshot?: unknown
}
```

注意：

1. `payableImpactAmount` 是对订单应付的影响。
2. `benefitValueAmount` 是权益价值或票面价值，不一定影响应付。
3. `externalRequestAmount` 是真实发给支付/权益系统的金额。
4. `settlementPayloadSnapshot` 从模板/权益行复制，供支付中心后续执行核销、记账、退款反向。

### `FulfillmentEffect`

```ts
export interface FulfillmentEffect {
  fulfillmentEffectId: string
  benefitRef: BenefitRef
  effectType: 'giftPool' | 'giftLine' | 'exchangeLine' | 'serviceLine' | 'postOrderCertificate'
  candidateLines?: FulfillmentLineCandidate[]
  selectedLines?: FulfillmentLineCandidate[]
  linkedSettlementLineId?: string
}
```

## 前端调用协议

### 0. 依赖方向

权益 session 包与购物车/订单业务包之间只通过标准快照、public command 和 selector 交互。

禁止方向：

```text
benefit-session -> retail-cart
benefit-session -> catering-cart
benefit-session -> cosmetic-cart
benefit-session -> order package internal state
```

允许方向：

```text
retail/catering/cosmetic business package
-> assemble CommerceSubjectSnapshot
-> dispatch benefit-session public command
-> read benefit-session selector result
```

这样 `benefit-session` 只知道一个 `contextRef` 的权益会话状态，不知道业务包的购物车结构。

### 1. TDP 推送非个人权益

```text
mock backend / platform -> TDP -> benefit-session
```

内容：

1. 非个人权益模板。
2. 活动规则。
3. 模板版本。
4. 失效/tombstone。

建议 topic：

```text
commercial.benefit-template.profile
commercial.benefit-activity.profile
```

约束：

1. topic 命名遵守现有 TDP profile 风格。
2. 优先复用 `mock-terminal-platform` 现有 TDP 通道和 projection 机制，不新增第二套 WebSocket 通道。
3. 权益相关 topic 需要在 mock server 的 topic registry 中注册，避免与现有商品、价格、分类 topic 冲突。

### 2. 关联个人后主动查询个人权益

```text
business UI / identity command
-> benefit-session command
-> backend personal query terminalNo + entryIdentity
-> identity snapshot + personal benefit templates/lines/quota facts
```

### 3. 业务包主动发起计算

购物车、订单、支付业务包在这些时机发起：

1. 商品增删改。
2. 关联/切换个人。
3. 切换挂单。
4. 选择/取消权益。
5. 选择支付方式。
6. 输入券码。
7. 提交订单。
8. 发起支付。

业务包传入 `CommerceSubjectSnapshot`，不让权益包反查业务数据。

推荐 command：

```ts
export interface EvaluateBenefitContextCommand {
  type: 'benefitSession.evaluateContext'
  payload: BenefitEvaluationRequest
}
```

业务包可以把自己的 `cartId`、`orderId`、`paymentAttemptId` 作为 `contextRef.contextId` 传入，但这个 ID 对权益包是不透明的。

权益包只用它做：

1. 占用归属。
2. 释放归属。
3. 诊断追踪。
4. selector 查询 key。

权益包不能拿这个 ID 反向查询业务 state。

### 4. 自动占用

`benefit-session` 根据 `selectionPolicy` 和 `reservationPolicy` 处理：

1. `auto + autoOnOpportunity`：计算发现可用后自动占用当前 context。
2. `manual + onSelection`：用户/店员选择后占用。
3. `conditional + onPaymentAttempt`：支付方式选择或支付尝试时占用。

### 5. 取消和释放

业务包必须在这些时机调用 release：

1. 取消购物车。
2. 清空购物车。
3. 取消订单。
4. 支付超时。
5. 移除已选择权益。
6. 切换身份导致当前权益不再适用。

推荐 command：

```ts
export interface ReleaseBenefitContextCommand {
  type: 'benefitSession.releaseContext'
  payload: {
    contextRef: BenefitContextRef
    reason:
      | 'cartCanceled'
      | 'cartCleared'
      | 'orderCanceled'
      | 'paymentTimeout'
      | 'benefitRemoved'
      | 'codeRemoved'
      | 'identityChanged'
  }
}
```

### 6. 业务包选择/取消权益

业务包不直接改 `BenefitApplication` 内部状态，而是发 public command。

```ts
export interface SelectBenefitOpportunityCommand {
  type: 'benefitSession.selectOpportunity'
  payload: {
    contextRef: BenefitContextRef
    opportunityId: string
    selectedQuantity?: number
    input?: BenefitSelectionInput
  }
}

export interface DeselectBenefitApplicationCommand {
  type: 'benefitSession.deselectApplication'
  payload: {
    contextRef: BenefitContextRef
    applicationId: string
    reason: 'clerkRemoved' | 'customerRemoved' | 'businessRecalculation'
  }
}
```

`input` 用于承载密码、券码、店员选择的赠品、顾客选择的支付工具等结构化输入。

### 7. 业务包选择赠品

赠品池是 `Opportunity`，不是已经落单的商品行。

店员选择赠品后，业务包发：

```ts
export interface ChooseBenefitGiftCommand {
  type: 'benefitSession.chooseGift'
  payload: {
    contextRef: BenefitContextRef
    opportunityId: string
    giftLineIds: string[]
  }
}
```

权益包重新计算并输出 `FulfillmentEffect.selectedLines`。

业务包再决定是否把 selected gift lines materialize 成自己的购物车赠品行。

### 8. 业务包选择支付方式

支付方式优惠通常先是 `Prompt`。

选择支付方式后，业务包重新提交带有 `paymentInstrument` 的 `CommerceSubjectSnapshot`。

```ts
export interface PaymentInstrumentSnapshot {
  instrumentType: string
  accountRef?: string
  issuerCode?: string
  productCode?: string
  acquiringTypeCode?: string
  acquiringInstitutionCode?: string
  acquiringProductCode?: string
  attributes?: Record<string, unknown>
}
```

计算后，原先的 `Prompt` 可能变成：

1. `Opportunity`
2. `Application`
3. `SettlementGroupCandidate`
4. `SettlementLineCandidate`

### 9. 动态添加优惠码/券码

优惠码和券码不是同一种东西，但可以共用一个动态权益查询入口。

购物车阶段：

```text
店员输入优惠码
-> backend 查询/包装
-> 返回可用于当前购物车阶段的 template 或 template + line
-> benefit-session 合并进当前 context 的动态权益快照
-> 重新 evaluate
-> 可能输出 PricingAdjustment 和 priceLayers
```

订单/支付阶段：

```text
店员扫码券码
-> backend 查询/包装
-> 返回个人无关或转赠来的 BenefitLine
-> benefit-session 合并进当前 order/payment context
-> 重新 evaluate
-> 可能输出 Opportunity/Application/SettlementLineCandidate
```

推荐 command：

```ts
export interface ActivateBenefitCodeCommand {
  type: 'benefitSession.activateCode'
  payload: {
    contextRef: BenefitContextRef
    code: string
    codeType?: 'promotionCode' | 'couponCode' | 'voucherCode' | 'unknown'
    subject?: CommerceSubjectSnapshot
    entryIdentity?: EntryIdentityCredential
    idempotencyKey: string
  }
}
```

返回结果必须表达动态权益的归属：

```ts
export interface ActivatedBenefitCodeResult {
  activationId: string
  contextRef: BenefitContextRef
  code: string
  activatedTemplates: BenefitTemplate[]
  activatedLines: BenefitLine[]
  expiresAt?: string
  diagnostics: BenefitEvaluationDiagnostic[]
}
```

动态添加规则：

1. 购物车价格类优惠码可以生成或激活 `BenefitTemplate`，并按模板策略自动应用或等待选择。
2. 订单支付券码通常生成 `BenefitLine`，表示一张可用于生成结算候选行的代金券、兑换券、礼品卡等。
3. 动态权益必须带 `activationId` 和 `contextRef`，便于移除、释放和诊断。
4. 如果码对应他人转赠券，身份归属不应强行改成当前主身份；权益行应保留后端标准化后的 owner/holder 语义。
5. 同一个码的幂等、过期、已使用、已被其他购物车占用，必须由后台返回标准诊断。

动态权益清理规则：

1. 取消购物车、取消订单、支付超时、切换身份时，`benefit-session` 必须释放该 context 下的动态权益和相关 reservation。
2. 同一个 context 下多次输入优惠码默认累积；是否互斥或替换由动态模板的 `stackingPolicy/TransactionStackingPolicy` 决定。
3. 店员显式移除优惠码时，业务包调用 `ReleaseBenefitContextCommand(reason=codeRemoved)` 或后续更细的 `RemoveActivatedBenefitCodeCommand`。
4. 如果后端返回模板版本变更，已激活动态权益必须重新 evaluate；版本不兼容时输出不可用诊断，不静默沿用旧规则。

### 10. 推荐 selector

```ts
export interface BenefitContextView {
  contextRef: BenefitContextRef
  evaluation?: BenefitEvaluationResult
  reservations: BenefitReservation[]
  unavailableBecauseReservedByOtherContext: BenefitReservation[]
  lastEvaluatedAt?: number
  diagnostics: BenefitEvaluationDiagnostic[]
}
```

推荐 selector：

```ts
selectBenefitContextView(state, contextRef)
selectBenefitApplications(state, contextRef)
selectBenefitOpportunities(state, contextRef)
selectBenefitPrompts(state, contextRef)
selectBenefitReservations(state, contextRef)
selectBenefitDiagnostics(state, contextRef)
```

这些 selector 返回权益会话视图，不返回业务购物车。

## 覆盖场景矩阵

| 场景 | 模板/行 | 关键 policy | 输出 |
| --- | --- | --- | --- |
| 全场满 100 减 20 | template only | eligibility + effect + basis | `PricingAdjustment` |
| 黑金会员每日一次 8 折 | template + membership | eligibility + reservation + effect | 自动 `Application` + reservation |
| 店铺优惠券 | template + line | selection + settlement + allocation | 手动 `Application` + `SettlementLine` |
| 积分抵扣 | template + account line | effect + settlement + allocation | `SettlementLine(quantity=points)` |
| 购物卡抵扣 | template + account line | selection + settlement | `SettlementLine(amount)` |
| 购物卡支付 8 折 | template maybe no line | conditional + paymentInstrument + settlementGroup | `Prompt` -> `SettlementGroup` |
| 满 199 赠小样 | template only or qualification line | giftPool + clerkChoose + fulfillment | `FulfillmentEffect(giftPool)` |
| 兑换券换商品 | template + line | exchangeLine + settlement + fulfillment | 0 元订单行 + 兑换结算候选行 |
| 买 3 免 1 | template only | effect + basis + allocation | 定价调整 + 分摊 |
| 第 N 件半价 | template only | effect + product ordering + allocation | 定价调整 |
| 组合 A+B 套餐价 | template only | bundle matching + effect | 定价调整 |
| 每人每日两次 | template/line | reservation + lifecycle | quota reservation |
| 多购物车占用 | reservation state | contextRef + release rules | B 显示 A 已占用 |
| 券码添加 | dynamic line | codeActivated + personal query | 新增 line 后重算 |
| 购物车优惠码调价 | dynamic template/line | codeActivated + pricing effect | `PricingAdjustment` + `priceLayers` |
| 分步支付后继续选权益 | completed settlement facts | basis + stacking + allocation | 基于剩余应付和已完成支付重算 |
| 转赠券码支付 | dynamic line | codeActivated + settlement | 扫码查询 line 后生成支付抵扣机会 |
| 退款事实回读 | completed settlement snapshot | lifecycle + allocation | 读取已退款/已撤销事实后重算剩余权益 |

## 玩法覆盖压力测试

这一节用常见且容易把模型带歪的玩法压测十个 policy。

### 1. 无身份全场满减

```text
满 100 减 20
所有人可用
不占用
影响订单金额
```

建模：

1. `BenefitTemplate` only。
2. `eligibilityPolicy.thresholdRequirements = amount >= 100`。
3. `effectPolicy = amountOff(20)`。
4. `reservationPolicy.mode = none`。
5. `selectionPolicy.mode = auto`。
6. 输出 `PricingAdjustment`，不输出个人 `BenefitLine`。

### 2. 黑金卡每日一次 8 折

```text
要求美妆黑卡 membership
每日一次
当前购物车自动占用
影响订单金额
```

建模：

1. `eligibilityPolicy.membershipRequirements` 指向美妆黑卡。
2. `effectPolicy = ratioOff(20%)`。
3. `reservationPolicy.mode = autoOnOpportunity`。
4. `reservationPolicy.subject = membership`。
5. `reservationPolicy.quotaBucket = daily`。
6. A 购物车占用后，B 购物车输出 unavailable reason：reserved by A。

### 3. 可用券但未使用

```text
券满足门槛
店员/顾客没有选择
```

建模：

1. `BenefitTemplate + BenefitLine`。
2. `selectionPolicy.mode = manual`。
3. 计算输出 `BenefitOpportunity(available)`。
4. 不输出 `BenefitApplication`。
5. 不输出 `SettlementLineCandidate`。

只有选择后才输出 application 和 settlement line。

### 4. 购物卡支付可减 20 提示

```text
订单 100
当前未选购物卡支付
提示：使用购物卡可减 20
```

建模：

1. `eligibilityPolicy.paymentInstrumentScope` 要求购物卡。
2. 当前 subject 没有 `paymentInstrument`。
3. 输出 `BenefitPrompt(triggerAction=selectPaymentInstrument)`。
4. 不改变当前订单金额。
5. 选择购物卡后重算，输出 `SettlementGroupCandidate + SettlementLineCandidate`。

### 5. 预付卡 8 折主/子支付单

```text
订单 100
输入 100
实际向预付卡请求 80
主支付单 100
子流水 80 扣款 + 20 支付优惠
退款只能选主支付单 100
```

建模：

1. `effectPolicy = paymentMethodDiscount(ratio=20%)`。
2. `settlementGroups.coverageAmount = 100`。
3. `settlementGroups.externalRequestAmount = 80`。
4. 子 `SettlementLine`：
   - `stored_value_charge = 80`
   - `payment_method_discount = 20`
5. 退款入口是 `SettlementGroup`。

### 6. 满赠可选赠品池

```text
满 199 可选一个小样
由店员选择
```

建模：

1. `effectPolicy = giftPool`。
2. `selectionPolicy.mode = clerkChoose`。
3. `fulfillmentPolicy.materialization = giftPool`。
4. 初次计算输出 `Opportunity(requiredAction=chooseGift)`。
5. 店员选择后输出 `FulfillmentEffect.selectedLines`。
6. 如果需要后续核销权益，同时输出 `SettlementLineCandidate(gift_benefit_writeoff intent)`。

### 7. 兑换券换商品

```text
一张兑换券兑换一个商品
订单里只有兑换商品时应付 0
仍然要扣库存，并生成权益使用候选
退款或撤销后需要读取支付中心/订单中心返回的事实重新计算
```

建模：

1. `BenefitTemplate + BenefitLine`。
2. `effectPolicy = exchangeLine`。
3. `fulfillmentPolicy.materialization = exchangeLine`。
4. `settlementPolicy.lineType = exchange_benefit_writeoff`。
5. 输出 0 元订单行 + 兑换结算候选行。
6. 具体核销、还券、反向记账由支付中心或对应权益系统处理；本模型在后续计算中读取已核销、已退款或已撤销事实。

### 8. 买 3 免 1

```text
买 3 件同范围商品，最便宜 1 件免费
```

建模：

1. `eligibilityPolicy.productScope` 匹配商品范围。
2. `effectPolicy = buyNFreeM(n=3, m=1, freeTarget=lowestPrice)`。
3. `basisPolicy.discountBase = lineUnitPrice`。
4. `allocationPolicy.target = selectedLines`。
5. 输出对免费行的 `PricingAdjustment`。

### 9. 第 N 件半价

```text
第 2 件半价
```

建模：

1. `effectPolicy = nthItemDiscount(n=2, ratio=50%)`。
2. 需要 `effectPolicy` 声明排序规则，例如按价格从低到高或按加入购物车顺序。
3. 输出命中行的 `PricingAdjustment`。

排序规则必须结构化，不能隐藏在代码默认值中。

### 10. 组合 A+B 套餐价

```text
A 商品 + B 商品 组合价 99
```

建模：

1. `effectPolicy = bundlePrice`。
2. `eligibilityPolicy.productScope` 提供候选池。
3. `effectPolicy.bundleMatcher` 声明 A/B 组合槽位。
4. `allocationPolicy` 决定组合优惠如何分摊。
5. 多组组合时按 `stackingPolicy.priority` 和 `effectPolicy.matchingStrategy` 决定。

### 11. 阶梯优惠

```text
满 100 减 10
满 200 减 30
满 300 减 60
```

建模：

1. `effectPolicy = tieredDiscount`。
2. `basisPolicy.thresholdBase` 决定按原价还是剩余价。
3. `effectPolicy.tierSelection = highestMatched | firstMatched | allMatched`。

### 12. 封顶、保底、最低支付

```text
最多减 50
折后最低支付 1 元
不得低于成本价
```

建模：

1. `effectPolicy.capAmount`。
2. `effectPolicy.floorPayableAmount`。
3. 如果涉及成本价，成本价必须作为标准输入字段进入 `CommerceLineSnapshot.attributes` 或结构化成本字段。
4. 不允许计算器从外部 raw 查成本。

### 13. 门槛叠加消耗

```text
满 100 减 20 可叠加
订单 300 最多用 3 次
历史已经用过 1 次
```

建模：

1. `basisPolicy.thresholdConsumptionMode = consumeByGroup`。
2. `stackingPolicy.thresholdGroupKey`。
3. `reservationPolicy` 或历史结算快照提供已消耗门槛事实。
4. 输出剩余可用次数和实际应用次数。

### 14. 同组额度上限

```text
普通积分 + 活动积分最多共抵 100 元
```

建模：

1. 多个 template 使用同一个 `stackingPolicy.groupKey`。
2. `stackingPolicy.groupLimit.amount = 100`。
3. 计算器按优先级消耗组额度。
4. 输出每个 application 的分配量。

### 15. 部分退款

```text
订单 300
优惠 30 已分摊到 3 行
退其中 1 行
```

建模：

1. 原订单保存 `BenefitAllocation`。
2. `allocationPolicy.refundReversal = byOriginalAllocation`。
3. 退款不重新计算优惠，只反向原分摊。
4. `lifecyclePolicy.partialRefundBehavior` 决定权益是否部分返还、整张返还或人工审核。

### 16. 订单事实参与配额

```text
每人每天 2 次
订单系统已有 1 次成功订单
当前购物车占用 1 次
再开 B 单不可用
```

建模：

1. `OrderFactPort` 提供已成功/已核销事实。
2. reservation ledger 提供当前占用事实。
3. 计算器看到的 quota facts 是两者合成后的标准快照。
4. 后台占用仍是权威操作。

### 17. 购物车阶段活动改商品价

```text
商品原价 100
会员活动改价 80
又叠加一个活动减 10
商品行需要展示原价 100、现价 70、活动来源
```

建模：

1. `CommerceLineSnapshot.originalUnitPrice = 100`。
2. 第一层 `CommerceLinePriceLayer(source=memberPrice, before=100, after=80)`。
3. 第二层 `CommerceLinePriceLayer(source=pricingBenefit, before=80, after=70)`。
4. `PricingAdjustment.priceLayerIds` 关联这些 price layers。
5. 订单冻结时保存 price layers，退款和小票展示都读冻结快照。

影响：

1. 商品单模型不能只有 `amount`。
2. 商品单必须能解释“为什么是这个现价”。
3. 后续权益的 `basisPolicy` 可以选择按原价、当前价或某层之后的价格计算。

### 18. 分步支付后继续计算

```text
订单 300
已完成代金券支付行 100
已微信支付 150
当前还剩 50
此时继续判断积分是否可用
```

建模：

1. `CommerceSubjectSnapshot.completedSettlements` 输入已完成代金券和微信支付。
2. 计算器据此得到剩余应付 50。
3. `basisPolicy.discountBase = currentRemainingAmount` 的权益只能基于 50 计算。
4. 已完成代金券的权益组、分摊、门槛消耗也要影响后续权益。

影响：

1. 订单阶段不能只传订单原金额。
2. 必须传已完成结算事实。
3. 当前可选权益计算需要和旧 SDK 的 `finishPayments`/`finishPaymentPromotions` 同等能力，但使用更标准的 `CompletedSettlementSnapshot`。

### 19. 购物车优惠码动态调价

```text
购物车阶段输入 PROMO20
后台返回一个当前购物车可用的满减活动
活动会改变商品现价或订单金额
```

建模：

1. `ActivateBenefitCodeCommand(contextType=cart, code=PROMO20)`。
2. 后台返回 `activatedTemplates`，必要时返回 `activatedLines`。
3. `benefit-session` 将动态权益挂到当前 context。
4. 重新 evaluate 后输出 `PricingAdjustment` 和 `CommerceLinePriceLayer`。

影响：

1. 动态权益不一定属于个人。
2. 动态权益可能只对当前购物车有效。
3. 移除优惠码时要移除对应 application、price layer 和 reservation。

### 20. 订单阶段扫码转赠券

```text
A 买了一张代金券，把券码给 B
B 付款时向收银员出示券码
收银员扫码后查出券，并用于当前订单支付
```

建模：

1. `ActivateBenefitCodeCommand(contextType=payment, code=...)`。
2. 后台查询券码并返回标准 `BenefitLine`。
3. 这条 line 不一定属于当前 entryIdentity。
4. `selectionPolicy` 可以让它自动选中或手动选择。
5. 输出 `SettlementLineCandidate(coupon_deduction)`。

影响：

1. 个人权益查询不是订单阶段权益的唯一来源。
2. 权益行 owner 与当前使用者可以不同。
3. 后台必须返回可用性和诊断，例如已使用、已过期、已被其他订单占用。

## 策略引擎形态建议

第一版不建议直接做通用表达式语言作为核心规则。

原因：

1. 表达式语言会把规则调试、类型安全、分摊和退款解释变复杂。
2. 当前玩法虽然多，但大部分可以用结构化策略对象覆盖。
3. 结构化策略更容易做 golden tests 和可观测诊断。

建议：

1. policy 使用结构化 discriminated union。
2. 每种 `effectPolicy.kind` 对应一个独立 calculator。
3. `eligibilityPolicy` 使用可组合 matcher。
4. 所有 matcher/calculator 都输出诊断节点。
5. 预留 `customPolicyRef`，但第一版不让计算器执行任意脚本。

```ts
export interface PolicyExecutionTrace {
  policyName: string
  policyKind: string
  result: 'matched' | 'notMatched' | 'applied' | 'skipped'
  reasonCode?: string
  inputs?: Record<string, unknown>
  outputs?: Record<string, unknown>
}
```

`diagnostics` 对 POS 排查非常关键：店员需要知道为什么可用、为什么不可用、为什么被 A 购物车占用、为什么支付方式优惠没触发。

## 后端接口草案

### 查询个人权益

```ts
POST /api/commercial-benefit/personal-query

interface PersonalBenefitQueryRequest {
  terminalNo: string
  entryIdentity: EntryIdentityCredential
}

interface PersonalBenefitQueryResponse {
  identitySnapshot: CustomerIdentitySnapshot
  benefitSnapshot: BenefitSnapshot
}
```

`PersonalBenefitQueryResponse` 是一次性一致快照。`benefitSnapshot.lines.ownerIdentityKey` 和 `ownerMembershipKey` 引用同一响应里的 `identitySnapshot`。如果身份发生变化，例如会员升级、绑定新身份、解绑身份或入口身份切换，业务包必须重新发起 `PersonalBenefitQueryRequest` 获取新快照，不能只更新 `identitySnapshot` 而沿用旧 `benefitSnapshot`。

### 占用

```ts
POST /api/commercial-benefit/reservations

interface CreateReservationRequest {
  terminalNo: string
  contextRef: BenefitContextRef
  benefitRef: BenefitRef
  subjectRef: ReservationSubjectRef
  quantity: number
  amount?: Money
  idempotencyKey: string
}
```

### 释放

```ts
POST /api/commercial-benefit/reservations/{reservationId}/release
```

### 提升

```ts
POST /api/commercial-benefit/reservations/{reservationId}/promote
```

### 支付事实模拟

支付中心最终核销、记账、退款反向不在本次范围。

本 mock backend 只提供支付事实模拟接口，用于验证权益计算如何读取已完成支付行、已核销权益、已退款或已撤销事实：

```ts
POST /api/commercial-benefit/payment-facts/settlements/complete
POST /api/commercial-benefit/payment-facts/settlements/{settlementLineId}/refund
POST /api/commercial-benefit/payment-facts/settlements/{settlementLineId}/void
```

## 测试策略

### 计算包 golden tests

至少覆盖：

1. 满减、折扣、阶梯优惠。
2. 买 N 免 M、第 N 件优惠。
3. 会员价、身份专属价。
4. 券、积分、购物卡、钱包。
5. 支付方式优惠主/子支付单。
6. 赠品池、兑换商品、服务权益。
7. 互斥、叠加、优先级。
8. 原价基准、剩余价基准、门槛消耗。
9. 分摊和退款反向分摊。
10. 可用机会、提示机会、实际应用分离。

### session 包场景测试

至少覆盖：

1. TDP 推送非个人权益。
2. 关联个人后查询个人权益。
3. 多购物车自动占用。
4. A 挂单占用，B 显示不可用原因。
5. A 取消后 B 可重新占用。
6. 下单时 cart reservation 提升为 order reservation。
7. 支付失败释放 payment reservation。
8. 切换身份释放不再适用的 reservation。

### mock backend 测试

至少覆盖：

1. 终端号解析组织节点。
2. 下级组织查询上级系统。
3. 多组织链查询系统合并。
4. 入口身份返回绑定身份数组。
5. 一个身份返回多个会员计划。
6. 配额依赖订单事实 mock。
7. 占用幂等。
8. 释放、提升、过期、支付事实回读状态流转。

## 接入规范草案

零售、餐饮、高化下单业务包接入时必须做三件事。

### 1. 提供标准商品/订单快照适配器

业务模型必须能转换成 `CommerceSubjectSnapshot`。

业务商品数据可以有自己的复杂结构，但必须补齐标准商品身份：

1. `skuId`
2. `spuId`
3. `categoryPath`
4. `saleProductTypeCode`
5. 扩展身份

### 2. 主动触发权益评估

业务包拥有购物车/订单事实，所以由业务包在变化时发起：

```ts
dispatch(evaluateBenefitContext({ contextRef, subject }))
```

权益包不主动去业务包拿数据。

### 3. 消费标准结果

业务包只能消费标准输出：

1. `opportunities`
2. `prompts`
3. `applications`
4. `pricingAdjustments`
5. `fulfillmentEffects`
6. `settlementGroups`
7. `settlementLines`
8. `allocations`

业务包不直接读取模板内部 raw。

## 需要继续压测的问题

1. `effectPolicy` 是否需要规则 AST/表达式引擎，还是先用枚举策略对象。
2. 组合商品、买 N 免 M、第 N 件优惠的商品排序规则如何标准化。
3. 赠品池是否需要库存实时校验，库存校验在订单系统还是权益后台 mock。
4. 积分、购物卡、钱包这类账户型权益，余额快照和支付中心最终扣减如何保持一致。
5. 订单金额由前端计算时，后端创建订单是否只校验 reservation，还是还要校验模板版本。
6. 支付方式优惠的主支付单/子支付单结构是否放在支付业务包，还是由权益计算输出候选。
7. 退款时权益返还处理建议是否需要从权益模板带出，还是完全由支付中心/订单中心覆盖。

## 外部评审处理记录

参考：`ai-result/2026-04-30-commercial-benefit-identity-framework-design-review.md`

处理原则：

1. 用户明确要求忽略 3.1 和 3.5，本轮不采纳这两节。
2. 其他建议仅作为参考，只有能增强交易阶段模型边界、降低实现歧义、补齐标准接入协议的内容才进入正式设计。

### 明确忽略

1. 3.1 `BenefitTemplate` 字段数量过多，第一版实现压力大。
   - 处理：忽略。
   - 原因：用户希望第一版覆盖完整核心玩法，本设计文档保持完整模型，不在设计层主动收窄 effectPolicy 覆盖范围。实现阶段可以按测试顺序分批落地，但标准模型不降级。
2. 3.5 `SettlementGroupCandidate` 与支付业务包边界模糊。
   - 处理：忽略。
   - 原因：本轮已经明确本模型输出 `SettlementGroupCandidate/SettlementLineCandidate` 只是候选和支付中心输入，不执行支付、核销、记账、退款反向动作；该边界已足够表达当前设计意图。

### 已采纳

1. 3.2 `StackingPolicy` 与 `TransactionStackingPolicy` 关系不清。
   - 处理：已补充合并规则和优先级。
   - 决策：交易关系图优先，模板默认配置只作为回退；运行时规则不应悄悄放宽后台强互斥。
2. 3.3 配额事实来源不完整。
   - 处理：已补充 `QuotaBucketPolicy.factSources`、`QuotaFactSource`、`BenefitQuotaFact`。
   - 决策：配额事实由 reservation ledger、订单事实、外部查询合成，计算包只消费标准化事实。
3. 3.4 `BenefitLine.status` 与 `BenefitReservation.state` 语义重叠。
   - 处理：已补充状态边界。
   - 决策：`BenefitLine.status` 是后端资产状态快照，`BenefitReservation.state` 是终端会话占用状态，前端占用不要求改写 line 状态。
4. 3.6 动态权益 context 归属和清理规则不完整。
   - 处理：已补充动态权益清理规则，并在释放原因中增加 `codeRemoved`。
   - 决策：同 context 多码默认累积，是否互斥或替换由 stacking 策略决定；模板版本变化必须重算。
5. 4.1 `Money` 类型未定义。
   - 处理：已补充 `Money`。
   - 决策：金额使用最小货币单位整数。
6. 4.2 `BenefitRef` 未定义。
   - 处理：已补充 `BenefitRef`。
7. 4.3 `EntryIdentityCredential` 未定义。
   - 处理：已补充入口身份凭证结构。
8. 4.4 `BenefitSnapshot` 未定义。
   - 处理：已补充 `BenefitSnapshot`。
9. 4.5 第 N 件排序规则需要结构化。
   - 处理：已补充 `NthItemDiscountEffectPolicy`。
10. 4.7 `BenefitEvaluationStage` 未定义。
    - 处理：已补充 `cart | orderConfirm | payment`。
11. 5.1 TDP topic 命名规范。
    - 处理：已补充建议 topic，并要求复用现有 TDP profile 风格。
12. 5.2 benefit-session Redux slice 结构。
    - 处理：已补充建议 state 树。
13. 5.3 mock-commercial-benefit-center 与 mock-terminal-platform 的关系。
    - 处理：已补充复用现有 TDP 通道、projection 生命周期、终端主数据和 topic registry 的原则。

### 部分采纳或改写采纳

1. 4.6 `LifecyclePolicy.validFrom/validTo` 与 `BenefitLine.availableFrom/availableTo` 重复。
   - 处理：暂不新增字段说明。
   - 原因：当前文档已有模板级 `LifecyclePolicy` 和权益行级 `availableFrom/availableTo`，语义基本明确。后续实现类型时再补充校验顺序即可。
2. 6 待压测问题优先级建议。
   - 处理：不直接复制优先级表。
   - 原因：其中 P1 “支付方式优惠主/子支付单归属”与用户要求忽略 3.5 有重叠；其余内容保留在“需要继续压测的问题”中，后续进入实现计划时再排序。

## 外部评审处理记录 v2

参考：`ai-result/2026-04-30-commercial-benefit-identity-framework-design-review-v2.md`

### 已采纳

1. `BenefitTemplate.stackingPolicy` union 类型歧义。
   - 处理：拆成 `stackingPolicy: StackingPolicy` 和 `transactionStackingPolicy?: TransactionStackingPolicy`。
   - 决策：模板默认策略始终存在，交易关系图可选；有交易关系图时优先使用，否则回退模板默认策略。
2. `BenefitSnapshot.completedSettlements` 权威来源不清。
   - 处理：明确权威来源是 `CommerceSubjectSnapshot.completedSettlements`。
   - 决策：`BenefitSnapshot.completedSettlements` 只作为冗余副本或特殊场景输入；两者同时存在时以业务包组装的 `CommerceSubjectSnapshot` 为准。
3. `LifecyclePolicy.validFrom/validTo` 与 `BenefitLine.availableFrom/availableTo` 校验顺序。
   - 处理：补充到 `BenefitLine` 状态边界。
   - 决策：模板有效期和权益行有效期都必须满足；权益行过期直接不可用。
4. `BenefitContextRef.contextType` 与 `BenefitEvaluationStage` 关系。
   - 处理：补充阶段与上下文映射。
   - 决策：`orderConfirm` 阶段使用 `contextType = order`。
5. `PersonalBenefitQueryResponse` 中 identity 与 benefit 快照一致性。
   - 处理：补充一次性一致快照说明。
   - 决策：身份变化必须重新查询，不能沿用旧权益快照。
6. 缺失类型：`BenefitAllocation`。
   - 处理：已补充。
7. 缺失类型：`ReservationSubjectRef`。
   - 处理：已补充。
8. 缺失类型：`BenefitEffectPreview`。
   - 处理：已补充。
9. 缺失类型：`BenefitUnavailableReason`。
   - 处理：已补充。
10. 缺失类型：`BenefitEvaluationDiagnostic`。
    - 处理：已补充。
11. 缺失类型：`ProductScopeRule`。
    - 处理：已补充。
12. `Money.amount` 虽为 `number` 但必须是整数。
    - 处理：已补充整数金额约束。
13. `NthItemDiscountEffectPolicy.discountRatio/discountAmount` 约束。
    - 处理：已补充二者必须且只能配置一个。
14. `BenefitLine.status = consumed/expired/voided` 时是否还查 reservation。
    - 处理：已补充直接不可用规则。

### 未采纳

无。第二轮评审主要是类型补齐和歧义消除，均与当前交易阶段边界一致。
