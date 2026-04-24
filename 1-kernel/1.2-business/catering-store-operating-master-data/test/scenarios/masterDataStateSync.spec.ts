import {describe, expect, it} from 'vitest'
import {applySliceSyncDiff} from '@next/kernel-base-state-runtime'
import {cateringStoreOperatingMasterDataSliceDescriptor} from '../../src/features/slices/masterData'

describe('cateringStoreOperatingMasterDataSliceDescriptor state sync', () => {
    it('removes existing records when authoritative tombstones arrive', () => {
        const next = applySliceSyncDiff(
            cateringStoreOperatingMasterDataSliceDescriptor,
            {
                byTopic: {
                    'store.config': {
                        'store-config-kernel-base-test': {
                            topic: 'store.config',
                            itemKey: 'store-config-kernel-base-test',
                            scopeType: 'STORE',
                            scopeId: 'store-kernel-base-test',
                            revision: 1,
                            updatedAt: 200,
                            data: {
                                config_id: 'store-config-kernel-base-test',
                                store_id: 'store-kernel-base-test',
                            },
                        } as any,
                    },
                },
                diagnostics: [],
                lastChangedAt: 200,
            },
            [
                {
                    key: 'store.config:store-config-kernel-base-test',
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

        expect(next.byTopic['store.config']).toEqual({})
        expect(next.lastChangedAt).toBeGreaterThanOrEqual(200)
    })
})
