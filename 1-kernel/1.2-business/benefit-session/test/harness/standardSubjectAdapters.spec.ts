import {describe, expect, it} from 'vitest'
import type {CommerceLinePriceLayer} from '@next/kernel-business-benefit-types'
import {
    adaptBeautyOrderToCommerceSubject,
    adaptCateringOrderToCommerceSubject,
    adaptRetailOrderToCommerceSubject,
    yuan,
} from './standardSubjectAdapters'

describe('standard commerce subject adapters', () => {
    it('maps retail order lines to the standard product identity model', () => {
        const subject = adaptRetailOrderToCommerceSubject(
            {
                terminalNo: 'TERM-RETAIL-001',
                channelCode: 'POS',
            },
            [
                {
                    lineId: 'retail-line-1',
                    storeSkuId: 'SKU-001',
                    storeSpuId: 'SPU-001',
                    storeCategoryPath: [
                        {categoryId: 'CAT-BEAUTY', depth: 1, ownerScope: 'store-001'},
                        {categoryId: 'CAT-SKINCARE', depth: 2, ownerScope: 'store-001'},
                    ],
                    mallSaleProductTypeCode: 'NORMAL_GOODS',
                    quantity: 2,
                    originalUnitPrice: 12000,
                    currentUnitPrice: 10000,
                },
            ],
        )

        expect(subject).toMatchObject({
            terminalNo: 'TERM-RETAIL-001',
            channelCode: 'POS',
            totals: {
                originalAmount: yuan(24000),
                currentAmount: yuan(20000),
                payableAmount: yuan(20000),
                discountAmount: yuan(4000),
            },
        })
        expect(subject.lines[0]?.productIdentities).toEqual([
            {identityType: 'skuId', identityValue: 'SKU-001', ownerScope: 'store'},
            {identityType: 'spuId', identityValue: 'SPU-001', ownerScope: 'store'},
            {identityType: 'categoryId', identityValue: 'CAT-BEAUTY', ownerScope: 'store-001'},
            {identityType: 'categoryId', identityValue: 'CAT-SKINCARE', ownerScope: 'store-001'},
            {identityType: 'saleProductType', identityValue: 'NORMAL_GOODS', ownerScope: 'mall'},
        ])
    })

    it('maps catering order lines and preserves benefit exclusion markers', () => {
        const subject = adaptCateringOrderToCommerceSubject(
            {terminalNo: 'TERM-CATERING-001'},
            [
                {
                    lineId: 'dish-line-1',
                    dishSkuId: 'DISH-SKU-001',
                    dishSpuId: 'DISH-SPU-001',
                    dishCategoryPath: [{categoryId: 'CAT-NOODLES', depth: 1, ownerScope: 'store-restaurant-001'}],
                    saleModeCode: 'DINE_IN',
                    originalUnitPrice: 5800,
                },
                {
                    lineId: 'service-fee-line',
                    dishSkuId: 'SERVICE-FEE',
                    saleModeCode: 'SERVICE_FEE',
                    originalUnitPrice: 300,
                    excludeAllBenefits: true,
                },
            ],
        )

        expect(subject.totals.currentAmount).toEqual(yuan(6100))
        expect(subject.lines[0]?.productIdentities).toContainEqual({
            identityType: 'saleProductType',
            identityValue: 'DINE_IN',
            ownerScope: 'mall',
        })
        expect(subject.lines[1]?.benefitParticipation).toEqual({
            mode: 'excludeAllBenefits',
            reasonCode: 'business-no-benefit',
        })
    })

    it('maps high-end beauty order lines and keeps prior price layers for explanation', () => {
        const priorLayer: CommerceLinePriceLayer = {
            layerId: 'layer-member-price',
            source: 'memberPrice',
            benefitRef: {templateKey: 'tmpl-black-card-price'},
            descriptionCode: 'black-card-member-price',
            unitPriceBefore: yuan(30000),
            unitPriceAfter: yuan(26000),
            lineAmountBefore: yuan(30000),
            lineAmountAfter: yuan(26000),
            adjustmentAmount: yuan(4000),
            sequence: 1,
        }
        const subject = adaptBeautyOrderToCommerceSubject(
            {terminalNo: 'TERM-BEAUTY-001'},
            [
                {
                    lineId: 'beauty-line-1',
                    beautySkuId: 'BEAUTY-SKU-001',
                    beautySpuId: 'BEAUTY-SPU-001',
                    categoryPath: [{categoryId: 'CAT-SKINCARE', depth: 2, ownerScope: 'store-beauty-001'}],
                    saleProductTypeCode: 'BEAUTY_PRODUCT',
                    counterCode: 'COUNTER-LA-MER',
                    brandCode: 'LA_MER',
                    originalUnitPrice: 30000,
                    currentUnitPrice: 26000,
                    priceLayers: [priorLayer],
                },
            ],
            {
                paymentInstrument: {
                    instrumentType: 'bankCard',
                    issuerCode: 'ABC',
                    acquiringTypeCode: 'BANK_CARD',
                },
            },
        )

        expect(subject.paymentInstrument).toMatchObject({
            instrumentType: 'bankCard',
            issuerCode: 'ABC',
        })
        expect(subject.lines[0]).toMatchObject({
            priceLayers: [priorLayer],
            attributes: {
                counterCode: 'COUNTER-LA-MER',
                brandCode: 'LA_MER',
            },
        })
        expect(subject.lines[0]?.productIdentities).toContainEqual({
            identityType: 'saleProductType',
            identityValue: 'BEAUTY_PRODUCT',
            ownerScope: 'mall',
        })
    })
})

