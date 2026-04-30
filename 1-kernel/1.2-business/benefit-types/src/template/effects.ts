import type {Money} from '../foundations/money'
import type {ProductScopeRule, QuantityRule, ThresholdRequirement} from '../foundations/product'

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

export interface EffectPolicyBase {
    capAmount?: Money
    floorPayableAmount?: Money
    itemRoles?: BenefitItemRoleRule[]
}

export interface AmountOffEffectPolicy extends EffectPolicyBase {
    kind: 'amountOff'
    amount: Money
}

export interface RatioOffEffectPolicy extends EffectPolicyBase {
    kind: 'ratioOff'
    /**
     * Discount ratio, not payable ratio.
     * 0.2 means 20% off, so the customer pays 80% of the basis amount.
     */
    discountRatio: number
}

export interface FixedPriceEffectPolicy extends EffectPolicyBase {
    kind: 'fixedPrice'
    fixedUnitPrice: Money
    priceEffect?: 'fixedPrice' | 'memberPrice'
    productScope?: ProductScopeRule
}

export interface TieredDiscountTier {
    threshold: ThresholdRequirement
    effect:
        | {kind: 'amountOff'; amount: Money}
        | {kind: 'ratioOff'; discountRatio: number}
        | {kind: 'fixedPrice'; fixedUnitPrice: Money}
}

export interface TieredDiscountEffectPolicy extends EffectPolicyBase {
    kind: 'tieredDiscount'
    tiers: TieredDiscountTier[]
    tierSelection: 'highestMatched' | 'firstMatched' | 'allMatched'
}

export interface BuyNFreeMEffectPolicy extends EffectPolicyBase {
    kind: 'buyNFreeM'
    buyQuantity: number
    freeQuantity: number
    freeTarget: 'lowestPrice' | 'highestPrice' | 'cartOrder'
    productScope?: ProductScopeRule
}

export interface NthItemDiscountEffectPolicy extends EffectPolicyBase {
    kind: 'nthItemDiscount'
    n: number
    discountRatio?: number
    discountAmount?: Money
    sortOrder: 'byPriceAsc' | 'byPriceDesc' | 'byCartOrder'
    productScope?: ProductScopeRule
    targetSelection?: BenefitTargetSelection
}

export interface BundleSlotRule {
    slotKey: string
    productScope: ProductScopeRule
    quantity: number
}

export interface BundlePriceEffectPolicy extends EffectPolicyBase {
    kind: 'bundlePrice'
    bundleSlots: BundleSlotRule[]
    bundlePrice: Money
    matchingStrategy: 'maxBundles' | 'bestBenefit' | 'cartOrder'
}

export interface PointsDeductionEffectPolicy extends EffectPolicyBase {
    kind: 'pointsDeduction'
    /**
     * Points needed for one currency unit. With CNY/fen money,
     * pointsPerMoneyUnit=100 means 100 points deduct CNY 1.00.
     */
    pointsPerMoneyUnit: number
    maxPoints?: number
    maxDeductionAmount?: Money
}

export interface StoredValueDeductionEffectPolicy extends EffectPolicyBase {
    kind: 'storedValueDeduction'
    maxDeductionAmount?: Money
    requirePassword?: boolean
}

export interface PaymentMethodDiscountEffectPolicy extends EffectPolicyBase {
    kind: 'paymentMethodDiscount'
    /**
     * Discount ratio applied to the covered payment amount.
     * Example: coverageAmount=10000 and discountRatio=0.2 => externalRequestAmount=8000.
     */
    discountRatio?: number
    discountAmount?: Money
    maxDiscountAmount?: Money
}

export interface GiftPoolCandidate {
    candidateLineId: string
    productIdentities?: Array<{
        identityType: string
        identityValue: string
        ownerScope?: string
    }>
    quantity: number
    displayName?: string
    attributes?: Record<string, unknown>
}

export interface GiftPoolEffectPolicy extends EffectPolicyBase {
    kind: 'giftPool'
    candidates: GiftPoolCandidate[]
    chooseQuantity: number
}

export interface ExchangeLineEffectPolicy extends EffectPolicyBase {
    kind: 'exchangeLine'
    exchangeLine: GiftPoolCandidate
    payableAmount?: Money
}

export interface ServiceEntitlementEffectPolicy extends EffectPolicyBase {
    kind: 'serviceEntitlement'
    serviceCode: string
    times: number
    displayName?: string
}

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
