import {describe, expect, it} from 'vitest'
import {applySliceSyncDiff} from '@impos2/kernel-base-state-runtime'
import {organizationIamMasterDataSliceDescriptor} from '../../src/features/slices/masterData'

describe('organizationIamMasterDataSliceDescriptor state sync', () => {
    it('removes existing records when authoritative tombstones arrive', () => {
        const next = applySliceSyncDiff(
            organizationIamMasterDataSliceDescriptor,
            {
                byTopic: {
                    'org.store.profile': {
                        'store-kernel-base-test': {
                            topic: 'org.store.profile',
                            itemKey: 'store-kernel-base-test',
                            scopeType: 'STORE',
                            scopeId: 'store-kernel-base-test',
                            revision: 1,
                            updatedAt: 200,
                            data: {
                                store_id: 'store-kernel-base-test',
                                store_name: 'Kernel Base Test Store',
                            },
                        } as any,
                    },
                },
                diagnostics: [],
                lastChangedAt: 200,
            },
            [
                {
                    key: 'org.store.profile:store-kernel-base-test',
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

        expect(next.byTopic['org.store.profile']).toEqual({})
        expect(next.lastChangedAt).toBeGreaterThanOrEqual(200)
    })
})
