import type {
    CommerceLineSnapshot,
    CommerceSubjectSnapshot,
    Money,
    ProductCategoryNode,
    ProductIdentity,
} from '@next/kernel-business-benefit-types'

export const money = (amount: number): Money => ({amount, currency: 'CNY'})

export interface FakeCartLineInput {
    lineId: string
    skuId: string
    spuId?: string
    categoryPath?: ProductCategoryNode[]
    saleProductTypeCode?: string
    quantity?: number
    unitPrice: number
    currentUnitPrice?: number
    excludeAllBenefits?: boolean
}

export interface FakeCartSubjectInput {
    terminalNo?: string
    channelCode?: string
    lines: FakeCartLineInput[]
}

export const createFakeCartSubject = (
    input: FakeCartSubjectInput,
): CommerceSubjectSnapshot => {
    const lines: CommerceLineSnapshot[] = input.lines.map((item) => {
        const quantity = item.quantity ?? 1
        const currentUnitPrice = item.currentUnitPrice ?? item.unitPrice
        const identities: ProductIdentity[] = [
            {
                identityType: 'skuId',
                identityValue: item.skuId,
                ownerScope: 'store-001',
            },
        ]
        if (item.spuId) {
            identities.push({
                identityType: 'spuId',
                identityValue: item.spuId,
                ownerScope: 'store-001',
            })
        }
        if (item.saleProductTypeCode) {
            identities.push({
                identityType: 'saleProductType',
                identityValue: item.saleProductTypeCode,
                ownerScope: 'mall-001',
            })
        }

        return {
            lineId: item.lineId,
            quantity,
            originalUnitPrice: money(item.unitPrice),
            originalLineAmount: money(item.unitPrice * quantity),
            currentUnitPrice: money(currentUnitPrice),
            currentLineAmount: money(currentUnitPrice * quantity),
            productIdentities: identities,
            categoryPath: item.categoryPath,
            saleProductTypeCode: item.saleProductTypeCode,
            benefitParticipation: item.excludeAllBenefits
                ? {
                      mode: 'excludeAllBenefits',
                      reasonCode: 'business-no-benefit',
                  }
                : {
                      mode: 'eligible',
                  },
        }
    })
    const originalAmount = lines.reduce((sum, line) => sum + line.originalLineAmount.amount, 0)
    const currentAmount = lines.reduce((sum, line) => sum + line.currentLineAmount.amount, 0)

    return {
        terminalNo: input.terminalNo ?? 'TERM-001',
        channelCode: input.channelCode,
        currency: 'CNY',
        lines,
        totals: {
            originalAmount: money(originalAmount),
            currentAmount: money(currentAmount),
            payableAmount: money(currentAmount),
            discountAmount: money(Math.max(0, originalAmount - currentAmount)),
        },
    }
}
