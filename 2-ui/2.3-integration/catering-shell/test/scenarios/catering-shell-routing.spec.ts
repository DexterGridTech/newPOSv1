import {describe, expect, it, vi} from 'vitest'
import {
    createCommand,
    runtimeShellV2CommandDefinitions,
} from '@impos2/kernel-base-runtime-shell-v2'
import {
    selectUiScreen,
} from '@impos2/kernel-base-ui-runtime-v2'
import {
    uiRuntimeRootVariables,
} from '@impos2/ui-base-runtime-react'
import {
    tcpControlV2CommandDefinitions,
    tcpControlV2StateActions,
} from '@impos2/kernel-base-tcp-control-runtime-v2'
import {
    selectCateringProductMasterDataState,
} from '@impos2/kernel-business-catering-product-master-data'
import {
    selectOrganizationIamMasterDataState,
} from '@impos2/kernel-business-organization-iam-master-data'
import {
    selectCateringStoreOperatingMasterDataState,
} from '@impos2/kernel-business-catering-store-operating-master-data'
import type {RootState} from '@impos2/kernel-base-state-runtime'
import {createCateringShellHarness} from '../support/cateringShellHarness'

const selectPrimaryRoot = (state: RootState) =>
    selectUiScreen(state, uiRuntimeRootVariables.primaryRootContainer.key)

const selectSecondaryRoot = (state: RootState) =>
    selectUiScreen(state, uiRuntimeRootVariables.secondaryRootContainer.key)

const waitFor = async (
    predicate: () => boolean | Promise<boolean>,
    timeoutMs = 2_000,
) => {
    const startedAt = Date.now()
    while (!(await predicate())) {
        if (Date.now() - startedAt > timeoutMs) {
            throw new Error(`Timed out waiting for condition within ${timeoutMs}ms`)
        }
        await new Promise(resolve => setTimeout(resolve, 10))
    }
}

describe('catering-shell routing', () => {
    it('routes to activation screen on initialize when terminal is not activated', async () => {
        const harness = await createCateringShellHarness()
        const current = selectPrimaryRoot(harness.runtime.getState())
        const secondary = selectSecondaryRoot(harness.runtime.getState())

        expect(current?.partKey).toBe('ui.base.terminal.activate-device')
        expect(secondary?.partKey).toBe('ui.base.terminal.activate-device-secondary')
    })

    it('rebuilds the secondary root to activation on initialize when stale welcome state is persisted', async () => {
        const harness = await createCateringShellHarness({
            displayContext: {
                displayIndex: 1,
                displayCount: 2,
            },
        })

        await harness.runtime.dispatchCommand(createCommand(
            tcpControlV2CommandDefinitions.activateTerminalSucceeded,
            {
                terminalId: 'terminal-secondary-stale',
                accessToken: 'token-secondary-stale',
            },
        ))
        expect(selectSecondaryRoot(harness.runtime.getState())?.partKey).toBe(
            'ui.business.catering-master-data-workbench.secondary-workbench',
        )

        harness.store.dispatch({
            type: 'kernel.business.organization-iam-master-data.master-data/upsertRecords',
            payload: {
                records: [{
                    topic: 'org.store.profile',
                    itemKey: 'store-stale',
                    scopeType: 'STORE',
                    scopeId: 'store-stale',
                    revision: 1,
                    updatedAt: 100,
                    data: {store_id: 'store-stale'},
                }],
                changedAt: 100,
            },
        })
        harness.store.dispatch({
            type: 'kernel.business.catering-product-master-data.master-data/upsertRecords',
            payload: {
                records: [{
                    topic: 'catering.product.profile',
                    itemKey: 'product-stale',
                    scopeType: 'BRAND',
                    scopeId: 'brand-stale',
                    revision: 1,
                    updatedAt: 100,
                    data: {product_id: 'product-stale'},
                }],
                changedAt: 100,
            },
        })
        harness.store.dispatch({
            type: 'kernel.business.catering-store-operating-master-data.master-data/upsertRecords',
            payload: {
                records: [{
                    topic: 'store.config',
                    itemKey: 'store-config-stale',
                    scopeType: 'STORE',
                    scopeId: 'store-stale',
                    revision: 1,
                    updatedAt: 100,
                    data: {config_id: 'store-config-stale'},
                }],
                changedAt: 100,
            },
        })

        harness.store.dispatch(tcpControlV2StateActions.clearActivation())

        const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(777)
        try {
            await harness.runtime.dispatchCommand(createCommand(
                runtimeShellV2CommandDefinitions.initialize,
                {},
            ))
        } finally {
            nowSpy.mockRestore()
        }

        expect(selectSecondaryRoot(harness.runtime.getState())?.partKey).toBe(
            'ui.base.terminal.activate-device-secondary',
        )
        expect(selectOrganizationIamMasterDataState(harness.runtime.getState() as any)).toMatchObject({
            byTopic: {},
            lastChangedAt: 777,
        })
        expect(selectCateringProductMasterDataState(harness.runtime.getState() as any)).toMatchObject({
            byTopic: {},
            lastChangedAt: 777,
        })
        expect(selectCateringStoreOperatingMasterDataState(harness.runtime.getState() as any)).toMatchObject({
            byTopic: {},
            lastChangedAt: 777,
        })
    })

    it('routes to welcome screen on initialize when terminal is already activated', async () => {
        const harness = await createCateringShellHarness()

        harness.store.dispatch(tcpControlV2StateActions.setActivatedIdentity({
            terminalId: 'terminal-001',
            activatedAt: Date.now(),
        }))
        await harness.runtime.dispatchCommand(createCommand(
            runtimeShellV2CommandDefinitions.initialize,
            {},
        ))

        const current = selectPrimaryRoot(harness.runtime.getState())
        const secondary = selectSecondaryRoot(harness.runtime.getState())
        expect(current?.partKey).toBe('ui.business.catering-master-data-workbench.primary-workbench')
        expect(secondary?.partKey).toBe('ui.business.catering-master-data-workbench.secondary-workbench')
        expect((current?.props as {terminalId?: string} | undefined)?.terminalId).toBe('terminal-001')
    })

    it('switches both screens to catering master data workbench after activation succeeds', async () => {
        const harness = await createCateringShellHarness()

        await harness.runtime.dispatchCommand(createCommand(
            tcpControlV2CommandDefinitions.activateTerminalSucceeded,
            {
                terminalId: 'terminal-002',
                accessToken: 'token-002',
            },
        ))

        const current = selectPrimaryRoot(harness.runtime.getState())
        const secondary = selectSecondaryRoot(harness.runtime.getState())
        expect(current?.partKey).toBe('ui.business.catering-master-data-workbench.primary-workbench')
        expect(secondary?.partKey).toBe('ui.business.catering-master-data-workbench.secondary-workbench')
        expect((current?.props as {terminalId?: string} | undefined)?.terminalId).toBe('terminal-002')
        expect((secondary?.props as {terminalId?: string} | undefined)?.terminalId).toBe('terminal-002')
    })

    it('switches back to activation screen after deactivation succeeds', async () => {
        const harness = await createCateringShellHarness()

        await harness.runtime.dispatchCommand(createCommand(
            tcpControlV2CommandDefinitions.activateTerminalSucceeded,
            {
                terminalId: 'terminal-003',
                accessToken: 'token-003',
            },
        ))

        await harness.runtime.dispatchCommand(createCommand(
            tcpControlV2CommandDefinitions.deactivateTerminalSucceeded,
            {
                terminalId: 'terminal-003',
            },
        ))

        const current = selectPrimaryRoot(harness.runtime.getState())
        const secondary = selectSecondaryRoot(harness.runtime.getState())
        expect(current?.partKey).toBe('ui.base.terminal.activate-device')
        expect(secondary?.partKey).toBe('ui.base.terminal.activate-device-secondary')
    })

    it('reroutes to activation screen when synced tcp identity becomes unactivated without local lifecycle command', async () => {
        const harness = await createCateringShellHarness({
            displayContext: {
                displayIndex: 1,
                displayCount: 2,
            },
        })

        harness.store.dispatch(tcpControlV2StateActions.setActivatedIdentity({
            terminalId: 'terminal-synced-before-reset',
            activatedAt: 100,
        }))
        await harness.runtime.dispatchCommand(createCommand(
            runtimeShellV2CommandDefinitions.initialize,
            {},
        ))

        expect(selectSecondaryRoot(harness.runtime.getState())?.partKey).toBe(
            'ui.business.catering-master-data-workbench.secondary-workbench',
        )

        harness.runtime.applyStateSyncDiff({
            envelopeId: 'env-sync-reset' as any,
            sessionId: 'session-sync-reset' as any,
            sourceNodeId: 'master-node' as any,
            targetNodeId: 'slave-node' as any,
            direction: 'master-to-slave',
            diffBySlice: {
                'kernel.base.tcp-control-runtime-v2.identity': [
                    {
                        key: 'terminalId',
                        value: {
                            updatedAt: 101 as any,
                            tombstone: true,
                        },
                    },
                    {
                        key: 'activationStatus',
                        value: {
                            updatedAt: 101 as any,
                            value: 'UNACTIVATED',
                        },
                    },
                    {
                        key: 'activatedAt',
                        value: {
                            updatedAt: 101 as any,
                            tombstone: true,
                        },
                    },
                ],
            },
            sentAt: 101 as any,
        })

        await waitFor(() =>
            selectSecondaryRoot(harness.runtime.getState())?.partKey === 'ui.base.terminal.activate-device-secondary',
        )
    })

    it('updates workbench terminal props when synced tcp identity changes to another activated terminal', async () => {
        const harness = await createCateringShellHarness({
            displayContext: {
                displayIndex: 1,
                displayCount: 2,
            },
        })

        harness.store.dispatch(tcpControlV2StateActions.setActivatedIdentity({
            terminalId: 'terminal-synced-old',
            activatedAt: 100,
        }))
        await harness.runtime.dispatchCommand(createCommand(
            runtimeShellV2CommandDefinitions.initialize,
            {},
        ))

        expect((selectSecondaryRoot(harness.runtime.getState())?.props as {terminalId?: string} | undefined)?.terminalId)
            .toBe('terminal-synced-old')

        harness.runtime.applyStateSyncDiff({
            envelopeId: 'env-sync-reactivate' as any,
            sessionId: 'session-sync-reactivate' as any,
            sourceNodeId: 'master-node' as any,
            targetNodeId: 'slave-node' as any,
            direction: 'master-to-slave',
            diffBySlice: {
                'kernel.base.tcp-control-runtime-v2.identity': [
                    {
                        key: 'terminalId',
                        value: {
                            updatedAt: 200 as any,
                            value: 'terminal-synced-new',
                        },
                    },
                    {
                        key: 'activationStatus',
                        value: {
                            updatedAt: 200 as any,
                            value: 'ACTIVATED',
                        },
                    },
                    {
                        key: 'activatedAt',
                        value: {
                            updatedAt: 200 as any,
                            value: 200,
                        },
                    },
                ],
            },
            sentAt: 200 as any,
        })

        await waitFor(() =>
            (selectSecondaryRoot(harness.runtime.getState())?.props as {terminalId?: string} | undefined)?.terminalId
                === 'terminal-synced-new',
        )
        expect(selectSecondaryRoot(harness.runtime.getState())?.partKey).toBe(
            'ui.business.catering-master-data-workbench.secondary-workbench',
        )
    })
})
