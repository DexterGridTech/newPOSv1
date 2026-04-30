import type {
    CommerceLinePriceLayer,
    CommerceLineSnapshot,
    CommerceSubjectSnapshot,
    Money,
    PaymentInstrumentSnapshot,
    ProductCategoryNode,
    ProductIdentity,
} from '@next/kernel-business-benefit-types'

export const yuan = (amount: number): Money => ({
    amount,
    currency: 'CNY',
})

export interface StandardAdapterContext {
    terminalNo: string
    channelCode?: string
}

export interface StandardAdapterLineBase {
    lineId: string
    quantity?: number
    originalUnitPrice: number
    currentUnitPrice?: number
    priceLayers?: CommerceLinePriceLayer[]
    excludeAllBenefits?: boolean
    attributes?: Record<string, unknown>
}

export interface RetailOrderLineInput extends StandardAdapterLineBase {
    storeSkuId: string
    storeSpuId?: string
    storeCategoryPath?: ProductCategoryNode[]
    mallSaleProductTypeCode?: string
}

export interface CateringOrderLineInput extends StandardAdapterLineBase {
    dishSkuId: string
    dishSpuId?: string
    dishCategoryPath?: ProductCategoryNode[]
    saleModeCode?: 'DINE_IN' | 'TAKEAWAY' | 'SET_MEAL' | 'ADD_ON' | string
}

export interface BeautyOrderLineInput extends StandardAdapterLineBase {
    beautySkuId: string
    beautySpuId?: string
    categoryPath?: ProductCategoryNode[]
    saleProductTypeCode?: string
    counterCode?: string
    brandCode?: string
}

export interface StandardSubjectOptions {
    paymentInstrument?: PaymentInstrumentSnapshot
}

export const adaptRetailOrderToCommerceSubject = (
    context: StandardAdapterContext,
    lines: RetailOrderLineInput[],
    options: StandardSubjectOptions = {},
): CommerceSubjectSnapshot => createCommerceSubject({
    context,
    lines: lines.map(line => adaptRetailLine(line)),
    paymentInstrument: options.paymentInstrument,
})

export const adaptCateringOrderToCommerceSubject = (
    context: StandardAdapterContext,
    lines: CateringOrderLineInput[],
    options: StandardSubjectOptions = {},
): CommerceSubjectSnapshot => createCommerceSubject({
    context,
    lines: lines.map(line => adaptCateringLine(line)),
    paymentInstrument: options.paymentInstrument,
})

export const adaptBeautyOrderToCommerceSubject = (
    context: StandardAdapterContext,
    lines: BeautyOrderLineInput[],
    options: StandardSubjectOptions = {},
): CommerceSubjectSnapshot => createCommerceSubject({
    context,
    lines: lines.map(line => adaptBeautyLine(line)),
    paymentInstrument: options.paymentInstrument,
})

function adaptRetailLine(line: RetailOrderLineInput): CommerceLineSnapshot {
    const identities: ProductIdentity[] = [
        {
            identityType: 'skuId',
            identityValue: line.storeSkuId,
            ownerScope: 'store',
        },
    ]

    if (line.storeSpuId) {
        identities.push({
            identityType: 'spuId',
            identityValue: line.storeSpuId,
            ownerScope: 'store',
        })
    }
    appendCategoryIdentities(identities, line.storeCategoryPath)
    if (line.mallSaleProductTypeCode) {
        identities.push({
            identityType: 'saleProductType',
            identityValue: line.mallSaleProductTypeCode,
            ownerScope: 'mall',
        })
    }

    return createCommerceLine(line, {
        identities,
        categoryPath: line.storeCategoryPath,
        saleProductTypeCode: line.mallSaleProductTypeCode,
    })
}

function adaptCateringLine(line: CateringOrderLineInput): CommerceLineSnapshot {
    const identities: ProductIdentity[] = [
        {
            identityType: 'skuId',
            identityValue: line.dishSkuId,
            ownerScope: 'store',
        },
    ]

    if (line.dishSpuId) {
        identities.push({
            identityType: 'spuId',
            identityValue: line.dishSpuId,
            ownerScope: 'store',
        })
    }
    appendCategoryIdentities(identities, line.dishCategoryPath)
    if (line.saleModeCode) {
        identities.push({
            identityType: 'saleProductType',
            identityValue: line.saleModeCode,
            ownerScope: 'mall',
        })
    }

    return createCommerceLine(line, {
        identities,
        categoryPath: line.dishCategoryPath,
        saleProductTypeCode: line.saleModeCode,
    })
}

function adaptBeautyLine(line: BeautyOrderLineInput): CommerceLineSnapshot {
    const identities: ProductIdentity[] = [
        {
            identityType: 'skuId',
            identityValue: line.beautySkuId,
            ownerScope: 'store',
        },
    ]

    if (line.beautySpuId) {
        identities.push({
            identityType: 'spuId',
            identityValue: line.beautySpuId,
            ownerScope: 'store',
        })
    }
    appendCategoryIdentities(identities, line.categoryPath)
    if (line.saleProductTypeCode) {
        identities.push({
            identityType: 'saleProductType',
            identityValue: line.saleProductTypeCode,
            ownerScope: 'mall',
        })
    }

    return createCommerceLine(line, {
        identities,
        categoryPath: line.categoryPath,
        saleProductTypeCode: line.saleProductTypeCode,
        attributes: {
            ...line.attributes,
            counterCode: line.counterCode,
            brandCode: line.brandCode,
        },
    })
}

function createCommerceSubject(input: {
    context: StandardAdapterContext
    lines: CommerceLineSnapshot[]
    paymentInstrument?: PaymentInstrumentSnapshot
}): CommerceSubjectSnapshot {
    const originalAmount = input.lines.reduce((sum, line) => sum + line.originalLineAmount.amount, 0)
    const currentAmount = input.lines.reduce((sum, line) => sum + line.currentLineAmount.amount, 0)

    return {
        terminalNo: input.context.terminalNo,
        channelCode: input.context.channelCode,
        currency: 'CNY',
        lines: input.lines,
        totals: {
            originalAmount: yuan(originalAmount),
            currentAmount: yuan(currentAmount),
            payableAmount: yuan(currentAmount),
            discountAmount: yuan(Math.max(0, originalAmount - currentAmount)),
        },
        paymentInstrument: input.paymentInstrument,
    }
}

function createCommerceLine(
    line: StandardAdapterLineBase,
    input: {
        identities: ProductIdentity[]
        categoryPath?: ProductCategoryNode[]
        saleProductTypeCode?: string
        attributes?: Record<string, unknown>
    },
): CommerceLineSnapshot {
    const quantity = line.quantity ?? 1
    const currentUnitPrice = line.currentUnitPrice ?? line.originalUnitPrice

    return {
        lineId: line.lineId,
        quantity,
        originalUnitPrice: yuan(line.originalUnitPrice),
        originalLineAmount: yuan(line.originalUnitPrice * quantity),
        currentUnitPrice: yuan(currentUnitPrice),
        currentLineAmount: yuan(currentUnitPrice * quantity),
        payableAmount: yuan(currentUnitPrice * quantity),
        priceLayers: line.priceLayers,
        productIdentities: input.identities,
        categoryPath: input.categoryPath,
        saleProductTypeCode: input.saleProductTypeCode,
        benefitParticipation: line.excludeAllBenefits
            ? {
                  mode: 'excludeAllBenefits',
                  reasonCode: 'business-no-benefit',
              }
            : {
                  mode: 'eligible',
              },
        attributes: input.attributes ?? line.attributes,
    }
}

function appendCategoryIdentities(
    identities: ProductIdentity[],
    categoryPath?: ProductCategoryNode[],
): void {
    categoryPath?.forEach(category => identities.push({
        identityType: 'categoryId',
        identityValue: category.categoryId,
        ownerScope: category.ownerScope,
    }))
}

