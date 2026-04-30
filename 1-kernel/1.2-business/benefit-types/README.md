# 交易权益模型维护说明

这个包只表达交易阶段用于判断、计算和生成支付单候选的模型，不负责权益发放、支付中心核销、退款执行、会员升级或商品系统定价。字段设计的核心原则是：订单、购物车、支付阶段都可以把自己的业务对象适配成这里的标准快照，然后交给计算引擎判断权益是否可用、应该如何影响价格、是否应该生成支付单候选。

## 统一数值约定

所有 `Money.amount` 都使用最小货币单位。人民币场景下 `10000` 表示 100.00 元，`2000` 表示 20.00 元。不要在模型层混用元和分，否则满减阈值、积分抵扣、支付优惠都会错一个数量级。

典型交易：

- 商品 A 原价 120.00 元：`originalUnitPrice.amount = 12000`
- 商品 B 原价 80.00 元：`originalUnitPrice.amount = 8000`
- 购物车原始金额：`totals.originalAmount.amount = 20000`
- 全场满 200 减 20 在购物车阶段生效后：`currentAmount.amount = 18000`
- 下单后再选 100 元券：生成 `SettlementLineCandidate.payableImpactAmount.amount = 10000`
- 订单剩余 80.00 元用预付卡支付享 8 折：`coverageAmount = 8000`，`externalRequestAmount = 6400`，支付优惠行 `payableImpactAmount = 1600`
- 再用 5000 积分抵扣 50.00 元：`quantity = 5000`，`quantityUnit = point`，`payableImpactAmount = 5000`

## BenefitRef

`BenefitRef` 是计算引擎里识别一个权益的最小引用。

| 字段 | 说明 | 示例 |
| --- | --- | --- |
| `templateKey` | 权益模板主键，表达规则本身，比如“黑金卡每日 8 折”“满 200 减 20”。模板可以来自 TDP 推送、个人权益查询或动态优惠码激活。 | `tmpl-black-card-daily-8-off` |
| `lineKey` | 权益行主键，表达某个用户持有的资产或账户，比如一张具体券、一个积分账户、一个购物卡账户。没有权益行的活动只填模板。 | `coupon-line-100-off` |

设计原因：活动规则和用户资产必须分开。全场满减只有模板；优惠券既有模板规则，也有属于某个人的一张券行。

## BenefitContextRef

`BenefitContextRef` 标识当前权益计算发生在哪个交易上下文里。

| 字段 | 说明 | 示例 |
| --- | --- | --- |
| `contextType` | `cart` 表示购物车阶段，`order` 表示订单确认阶段，`payment` 表示支付阶段。不同阶段决定哪些权益可用，以及权益影响价格还是生成支付单候选。 | `cart` |
| `contextId` | 购物车、订单或支付尝试的业务 ID。挂单 A 和挂单 B 必须不同。 | `cart-A` |
| `isCurrent` | 前端会话里的当前上下文标记。当前购物车自动占用类权益会优先在这个上下文里占用；切换挂单时用它区分“正在操作的那一单”。 | `true` |

真实场景：黑金卡每天一次 8 折。购物车 A 登录会员后自动占用，`contextId = cart-A`；购物车 B 用同一个会员计算时看到 `reservedByOtherContext`。A 取消后释放占用，B 重新计算变为可用。

## 身份模型

身份模型只表达“当前交易里这个消费者是谁、拥有哪些会员资格”。如果积分只是用于判断身份等级，例如“积分大于 10000 才是黑金”，可以放在 `qualificationAttributes`；如果积分要用于抵扣金额，就必须建成权益行。

### EntryIdentityCredential

| 字段 | 说明 | 示例 |
| --- | --- | --- |
| `identityType` | 入口身份类型。消费者可能用商场会员、品牌会员、银行卡会员登录。 | `mallMemberCard` |
| `identityValue` | 入口身份值。 | `MALL-BLACK-001` |
| `credentialType` | 终端拿到身份的方式，例如扫码、手机号、手输卡号、外部 token。它用于后台适配，不参与计算。 | `barcode` |
| `credentialPayload` | 原始凭据扩展信息。只作为适配器 payload，不直接进入权益规则。 | `{rawCode: "..."}` |

### CustomerIdentitySnapshot

| 字段 | 说明 | 示例 |
| --- | --- | --- |
| `entryIdentity` | 本次登录或识别消费者时使用的主身份。 | 商场会员卡 |
| `identities` | 后台身份中台返回的所有绑定身份，每个身份又可以有多个会员忠诚度计划。 | 商场会员、品牌会员 |
| `snapshotVersion` | 身份快照版本，用于排查终端缓存和后台返回不一致。 | `3` |
| `fetchedAt` | 后台查询时间。用于调试“为什么某个会员等级没有生效”。 | `2026-04-30T10:00:00.000Z` |

### CustomerIdentity

| 字段 | 说明 | 示例 |
| --- | --- | --- |
| `identityKey` | 身份系统内稳定主键。权益行通常通过它标识所有者。 | `identity-mall-member-001` |
| `identityType` | 身份系统类型。 | `mallMemberCard` |
| `identityValue` | 外部可识别值。 | `MALL-BLACK-001` |
| `displayName` | 展示名，不参与计算。 | `张三` |
| `status` | 身份状态。只有 `active` 身份参与身份资格判断。 | `active` |
| `memberships` | 此身份下的会员忠诚度计划列表。一个商场身份可能同时是积分卡、金卡、美妆黑卡。 | 见下表 |
| `attributes` | 身份扩展属性，仅在模板明确配置要判断时使用。 | `{city: "SZ"}` |

### MembershipProfile

| 字段 | 说明 | 示例 |
| --- | --- | --- |
| `membershipKey` | 会员资格主键，用于占用配额时作为 `subjectKey`。 | `membership-black-001` |
| `membershipType` | 会员资格类型。 | `mall.black-card` |
| `planCode` | 忠诚度计划。 | `MIXC_BEAUTY` |
| `levelCode` / `levelCodes` | 会员等级。兼容单等级和多标签等级。 | `BLACK` |
| `status` | 会员资格状态。只有 `active` 且在有效期内参与计算。 | `active` |
| `qualificationAttributes` | 身份资格补充属性，例如成长值、积分、生日月标记。只有用于资格判断时放这里。 | `{growthPoint: 12000}` |
| `validFrom` / `validTo` | 会员资格有效期。 | `2026-01-01T00:00:00.000Z` |

## 商品与交易快照

权益计算不直接依赖零售、餐饮、高化的原始商品模型。业务包需要把商品适配成 `CommerceSubjectSnapshot`。

### CommerceSubjectSnapshot

| 字段 | 说明 | 示例 |
| --- | --- | --- |
| `terminalNo` | 终端号。个人权益查询、组织可查询范围和终端专属活动会用到。 | `TERM-MIXC-SZ-UNI-001` |
| `channelCode` | 渠道。线上/线下、POS/小程序可以配置不同权益。 | `POS` |
| `currency` | 币种。当前版本主要按 CNY。 | `CNY` |
| `lines` | 商品行快照。权益只看这个标准行，不关心原始商品来源。 | 两个商品行 |
| `totals` | 交易金额汇总。购物车阶段调价后必须更新这里，否则订单阶段阈值会用错。 | 原价 200，现价 180 |
| `completedSettlements` | 已完成支付/权益支付行。支付分步时，后续权益要在扣掉已完成行之后计算。 | 已核销 100 元券、已微信支付 150 元 |
| `paymentInstrument` | 当前选择或试算的支付工具。支付优惠只在它匹配时变为可用。 | 预付卡 |
| `attributes` | 业务扩展，例如组织编码、桌台、导购。模板明确使用时才参与计算。 | `{organizationCode: "MIXC-SZ-UNI"}` |

### CommerceLineSnapshot

| 字段 | 说明 | 示例 |
| --- | --- | --- |
| `lineId` | 交易行 ID。所有分摊、调价层都回指这个 ID。 | `line-A` |
| `quantity` | 商品数量。买 3 免 1、第 N 件折扣、赠品数量判断会用。 | `2` |
| `originalUnitPrice` / `originalLineAmount` | 原始价和原始行金额。原价 120，买 2 件则行金额 240。 | `12000` / `24000` |
| `currentUnitPrice` / `currentLineAmount` | 当前价和当前行金额。购物车调价后要更新，例如会员价从 120 调到 100。 | `10000` / `20000` |
| `payableAmount` | 当前行最终应付金额。支付阶段可用它表达已完成支付后的剩余可付。 | `8000` |
| `priceLayers` | 行级价格层，记录从原价到现价的每一次变化。维护退款和展示“原价/现价/优惠活动”时使用。 | 会员价层、满减层 |
| `productIdentities` | 商品身份列表，例如店铺 SKU、店铺 SPU、类目、销售商品类型。 | `skuId=sku-001` |
| `categoryPath` | 类目树路径。店铺优惠券常按类目或 SPU 判断。 | 美妆/护肤/面霜 |
| `saleProductTypeCode` | 商场级销售商品类型。餐饮菜品、零售商品、服务商品可以用它过滤权益。 | `DINING_PRODUCT` |
| `benefitParticipation` | 商品是否参与权益。`excludeAllBenefits` 表示此商品不进任何权益计算。 | `eligible` |
| `attributes` | 业务扩展。 | `{brandCode: "UNIQLO"}` |

### CommerceLinePriceLayer

价格层用于解释“商品单上原价、现价、优惠价和活动”的来源。

| 字段 | 说明 | 示例 |
| --- | --- | --- |
| `layerId` | 价格层 ID。 | `layer-app-001-line-A` |
| `source` | 价格来源：基础价、手工改价、会员价、权益调价、套装价、优惠码。 | `pricingBenefit` |
| `benefitRef` / `applicationId` | 由哪个权益应用产生。 | 满 200 减 20 |
| `descriptionCode` | 展示文案 key。 | `FULL_200_MINUS_20` |
| `unitPriceBefore` / `unitPriceAfter` | 单价变化前后。 | `10000 -> 9000` |
| `lineAmountBefore` / `lineAmountAfter` | 行金额变化前后。 | `20000 -> 18000` |
| `adjustmentAmount` | 本层优惠金额。 | `2000` |
| `sequence` | 层顺序。先会员价，再满减，再优惠码。 | `20` |

## 权益模板与权益行

### BenefitTemplate

模板是规则，不是用户资产。后台权益中台应当把外部系统差异包装好，前端计算只读取这些计算字段。

| 字段 | 说明 | 示例 |
| --- | --- | --- |
| `templateKey` / `templateCode` | 模板主键和业务编码。 | `tmpl-full-200-minus-20` |
| `version` | 模板版本。TDP 推送更新后用于替换旧规则。 | `1` |
| `status` | 模板状态。只有 `active` 可参与计算。 | `active` |
| `calculationSchemaVersion` | 计算 schema 版本。第一版固定为 `1`。 | `1` |
| `eligibilityPolicy` | 资格和范围：身份、会员、时间、终端、渠道、商品、支付工具、阈值。 | 黑金会员且满 100 |
| `effectPolicy` | 效果：减钱、打折、固定价、买 N 免 M、积分抵扣、支付优惠、赠品池等。 | `amountOff 2000` |
| `basisPolicy` | 计算基准：用原价、现价、已调价后金额还是剩余应付。 | `currentRemainingAmount` |
| `selectionPolicy` | 是否自动使用，还是店员/消费者选择，是否由优惠码触发。 | `auto` |
| `reservationPolicy` | 是否占用配额以及占用主体。 | 黑金卡按会员每天占一次 |
| `stackingPolicy` / `transactionStackingPolicy` | 叠加和互斥规则。 | 券和会员价互斥 |
| `allocationPolicy` | 优惠金额如何分摊到商品行。退款按原分摊反向时必须依赖它。 | 按金额比例 |
| `settlementPolicy` | 是否生成支付单候选，以及支付行类型、数量单位。 | `coupon_deduction` |
| `fulfillmentPolicy` | 是否生成赠品池、兑换行、服务权益。 | `giftPool` |
| `lifecyclePolicy` | 有效期、作废、退款时权益是否返还。这里只表达计算需要的策略，实际返还由支付/权益系统执行。 | 退款返还券 |
| `templatePayloadSnapshot` | 模板元数据快照。展示名、面值等不参与计算但会复制到支付单候选。 | `faceAmount=10000` |
| `settlementPayload` | 核销/记账所需 payload 模板。生成支付单候选时复制。 | 外部券模板号 |
| `externalSnapshot` | 外部系统原始数据，仅供排查，不参与计算。 | 原券系统 JSON |

### BenefitLine

权益行是用户资产、账户或活动实例。

| 字段 | 说明 | 示例 |
| --- | --- | --- |
| `lineKey` | 权益行主键。 | `coupon-line-100-off` |
| `templateKey` | 归属模板。 | `tmpl-coupon-100-off` |
| `lineType` | `asset` 表示券，`account` 表示积分/钱包/购物卡账户，`qualification` 表示资格，`activity_instance` 表示活动实例。 | `asset` |
| `ownerIdentityKey` / `ownerMembershipKey` | 资产归属身份或会员资格。 | `identity-mall-member-001` |
| `quantity` | 可用数量。券是张数，积分是点数，服务权益是次数。 | `5000` 积分 |
| `balanceAmount` | 账户型权益的余额金额，例如购物卡 120 元。 | `12000` |
| `availableFrom` / `availableTo` | 权益行有效期。过期后机会变为 `lineExpired`。 | `2026-05-01` |
| `status` | 行状态。`available` 可用，`reserved` 已占用，`consumed` 已核销。 | `available` |
| `linePayloadSnapshot` | 行级元数据，比如券码、面值。 | `barcode=8888` |
| `settlementPayload` | 行级核销 payload。生成支付单候选时与模板 payload 合并。 | 外部券号 |
| `externalSnapshot` | 外部系统原始权益行。 | 原券 JSON |

## 资格、效果、选择、占用

### EligibilityPolicy

| 字段 | 说明 | 示例 |
| --- | --- | --- |
| `applicableStages` | 限定购物车、下单、支付阶段。购物车价调活动常为 `cart/orderConfirm`，支付优惠常为 `payment`。 | `["payment"]` |
| `identityRequirements` | 需要某类身份存在。 | 需要品牌会员 |
| `membershipRequirements` | 需要某个会员计划/等级。 | 黑金卡 |
| `timeWindow` | 日期、星期、日内时间。 | 周五 18:00-22:00 |
| `terminalRequirements` | 终端或组织范围。 | 深圳万象城门店 |
| `channelRequirements` | 渠道范围。 | POS |
| `productScope` | 商品范围。 | 仅护肤类目 |
| `paymentInstrumentScope` | 支付工具范围。 | 预付卡 |
| `thresholdRequirements` | 满额、满件、满行数等门槛。 | 满 200 |
| `minimumPayableAmount` | 支付阶段剩余应付下限，防止已经支付/抵扣太多后继续套用。 | 剩余至少 10 元 |

### EffectPolicy

常用效果与数值：

- `amountOff`: 满 200 减 20，`amount.amount = 2000`
- `ratioOff`: 黑金卡 8 折，`discountRatio = 0.2` 表示优惠 20%，消费者支付 80%
- `fixedPrice`: 身份专属价，原价 120 调到 99，`fixedUnitPrice.amount = 9900`
- `tieredDiscount`: 满 100 减 10、满 200 减 30
- `buyNFreeM`: 买 3 免 1，按最低价行生成优惠
- `nthItemDiscount`: 第 2 件半价
- `bundlePrice`: A+B 套装 99
- `pointsDeduction`: 100 积分抵 1 元，5000 积分抵 50 元
- `storedValueDeduction`: 购物卡/礼品卡/钱包余额抵扣
- `paymentMethodDiscount`: 预付卡支付 8 折，输入 100 元，外部扣款 80 元，优惠 20 元
- `giftPool`: 满额赠品池，计算生成可选赠品，店员选择后再落到订单内容调整
- `exchangeLine`: 兑换券换商品，订单可以是 0 元，但仍通过支付单候选统一表达权益使用
- `serviceEntitlement`: 服务次数权益，例如免费护理 1 次

### SelectionPolicy

| 字段 | 说明 |
| --- | --- |
| `mode` | `auto` 自动使用；`manual/customerChoose/clerkChoose` 只返回可用机会，实际使用要选择；`conditional` 要先选支付工具；`codeActivated` 由优惠码添加。 |
| `trigger` | 触发重新计算的业务事件，例如购物车变化、身份绑定、选择赠品、选择支付工具、输入码。 |
| `defaultSelectedQuantity` | 默认占用或使用数量。黑金卡每日 8 折通常为 1。 |
| `allowDeselect` | 是否允许店员/消费者取消。 |

### ReservationPolicy

| 字段 | 说明 |
| --- | --- |
| `mode` | `none` 不占用；`autoOnOpportunity` 在机会可用时自动占用；`onSelection` 选择时占用；`onOrderSubmit` 下单时占用；`onPaymentAttempt` 支付尝试时占用。 |
| `subject` | 占用主体：入口身份、身份、会员、支付账户、权益行或自定义。 |
| `subjectIdentityType` / `subjectMembershipType` | 从身份快照里找具体占用主体。黑金卡每天一次按 `membershipType=mall.black-card` 占用。 |
| `quotaBucket` | 配额桶。每天一次、每单一次、终身一次都在这里表达。 |
| `ttlSeconds` | 购物车挂单占用过期时间。 |
| `releaseOn` | 取消购物车、清空、订单取消、支付超时、移除权益、身份变化等事件释放占用。 |
| `promoteOn` | 购物车占用何时提升到订单占用。 |
| `consumeOn` | 何时视为消耗事实。具体核销动作不在本模型内，由支付/权益系统处理。 |

## 输出模型

### BenefitOpportunity

表示“可用权益”和“用权益”之间的中间状态。

| 字段 | 说明 |
| --- | --- |
| `opportunityId` | 前端选择时使用的机会 ID。 |
| `benefitRef` | 对应模板/权益行。 |
| `availability` | `available` 可直接用；`conditional` 需要动作，例如选支付工具；`unavailable` 展示不可用原因。 |
| `unavailableReason` | 不可用原因，前端只展示原因，不强行使用。 |
| `maxEffectPreview` | 最大优惠预览，例如“购物卡支付可减 20 元”。不代表已经使用。 |
| `requiredAction` | 下一步动作：选择权益、选择支付工具、选赠品、输入码、输入密码。 |
| `reservationPreview` | 是否需要占用以及占用主体预览。 |

### BenefitApplication

表示已经被自动应用或人工选择的权益。

| 字段 | 说明 |
| --- | --- |
| `applicationId` | 本次应用 ID。 |
| `opportunityId` | 来源机会。 |
| `benefitRef` | 被使用的权益。 |
| `state` | `autoApplied` 自动调价，`selected` 人工选择，`reserved` 已占用，`applied` 已进入结果。 |
| `selectedQuantity` | 选用数量。积分是点数，券通常是 1。 |
| `actualEffect` | 真实效果：价格调整、支付单候选、履约效果或仅提示。 |
| `reservationId` | 已占用的配额/权益行。 |
| `allocations` | 优惠分摊。退款反向、商品行展示都依赖它。 |

### SettlementLineCandidate

生成给支付中心的支付单候选，不代表已经核销成功。

| 字段 | 说明 | 示例 |
| --- | --- | --- |
| `settlementLineId` | 候选行 ID。 | `settle-app-coupon` |
| `settlementGroupId` | 支付组 ID。支付优惠的主支付行和优惠行归同一组。 | `group-prepaid` |
| `benefitRef` | 来源权益。 | 100 元券 |
| `lineType` | 支付行类型。 | `coupon_deduction` |
| `quantity` / `quantityUnit` | 支付数量与单位。积分 5000 点和金额 50 元是两个概念。 | `5000 point` |
| `payableImpactAmount` | 对应付金额的影响。100 元券为 10000。 | `10000` |
| `benefitValueAmount` | 权益价值金额。可和实际扣减不同。 | 面值 100，实际用 80 |
| `externalRequestAmount` | 需要发给外部支付/账户系统的请求金额。预付卡 8 折场景覆盖 100，实际请求 80。 | `8000` |
| `settlementPayloadSnapshot` | 模板和权益行 payload 的快照，支付中心用它做核销/记账。 | 外部券号 |
| `externalSnapshot` | 外部原始数据，仅排查。 | 原支付返回 |

### CompletedSettlementSnapshot

这是订单里已经完成的支付/权益支付事实，计算后续权益时必须带入。

| 字段 | 说明 |
| --- | --- |
| `coverageAmount` | 该支付行覆盖了多少订单金额。预付卡主支付行可覆盖 100 元。 |
| `payableImpactAmount` | 对剩余应付的影响。券抵扣 100 元，微信支付 150 元都影响剩余应付。 |
| `quantity` / `quantityUnit` | 已使用数量，比如积分 5000 点。 |
| `allocations` | 已完成支付行的分摊，后续退款或继续计算用。 |
| `status` | `completed/refunded/partiallyRefunded/voided`。只有完成或部分退款状态会影响剩余应付。 |

