import type {Money} from '../foundations/money'
import type {BenefitRef} from '../foundations/references'
import type {ProductCategoryNode, ProductIdentity} from '../foundations/product'
import type {CompletedSettlementSnapshot} from './completedSettlement'

export interface CommerceTotalsSnapshot {
    originalAmount: Money
    currentAmount: Money
    payableAmount: Money
    discountAmount?: Money
}

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

export interface CommerceLineBenefitParticipation {
    mode: 'eligible' | 'excludeAllBenefits'
    reasonCode?: string
    allowManualOverride?: boolean
}

export interface CommerceLinePriceLayer {
    layerId: string
    /**
     * Explains why the line price changed.
     * Example: a 120.00 item receives a member price layer to 100.00,
     * then a pricingBenefit layer allocates another 10.00 discount.
     */
    source: 'basePrice' | 'manualPriceChange' | 'memberPrice' | 'pricingBenefit' | 'bundlePrice' | 'promotionCode'
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

export interface CommerceLineSnapshot {
    lineId: string
    quantity: number
    /**
     * Original price before any manual change, member price, bundle price, or benefit adjustment.
     */
    originalUnitPrice: Money
    originalLineAmount: Money
    /**
     * Current price at the moment this calculation starts.
     * Cart-stage pricing benefits should update this before order confirmation uses the order amount.
     */
    currentUnitPrice: Money
    currentLineAmount: Money
    /**
     * Optional remaining payable amount for this line after prior pricing or settlement facts.
     */
    payableAmount?: Money
    priceLayers?: CommerceLinePriceLayer[]
    productIdentities: ProductIdentity[]
    categoryPath?: ProductCategoryNode[]
    saleProductTypeCode?: string
    benefitParticipation?: CommerceLineBenefitParticipation
    attributes?: Record<string, unknown>
}

export interface CommerceSubjectSnapshot {
    terminalNo: string
    channelCode?: string
    currency: string
    lines: CommerceLineSnapshot[]
    totals: CommerceTotalsSnapshot
    /**
     * Completed payment/benefit settlement facts already accepted by the order.
     * Payment-stage evaluation must subtract these before suggesting more points/wallet/payment discounts.
     */
    completedSettlements?: CompletedSettlementSnapshot[]
    paymentInstrument?: PaymentInstrumentSnapshot
    attributes?: Record<string, unknown>
}
