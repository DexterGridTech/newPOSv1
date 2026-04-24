import {describe, expect, it} from 'vitest'
import {applySliceSyncDiff} from '@impos2/kernel-base-state-runtime'
import {cateringProductMasterDataSliceDescriptor} from '../../src/features/slices/masterData'

describe('cateringProductMasterDataSliceDescriptor state sync', () => {
    it('removes existing records when authoritative tombstones arrive', () => {
        const next = applySliceSyncDiff(
            cateringProductMasterDataSliceDescriptor,
            {
                byTopic: {
                    'catering.product.profile': {
                        'product-salmon-bowl': {
                            topic: 'catering.product.profile',
                            itemKey: 'product-salmon-bowl',
                            scopeType: 'BRAND',
                            scopeId: 'brand-kernel-base-test',
                            revision: 2,
                            updatedAt: 200,
                            data: {
                                product_id: 'product-salmon-bowl',
                                product_name: 'Salmon Bowl 64',
                            },
                        } as any,
                    },
                },
                diagnostics: [],
                lastChangedAt: 200,
            },
            [
                {
                    key: 'catering.product.profile:product-salmon-bowl',
                    value: {
                        updatedAt: 201,
                        tombstone: true,
                    },
                },
            ],
            {
                mode: 'authoritative',
            },
        )

        expect(next.byTopic['catering.product.profile']).toEqual({})
        expect(next.lastChangedAt).toBeGreaterThanOrEqual(200)
    })
})
