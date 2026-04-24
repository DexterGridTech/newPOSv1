import {afterEach, describe, expect, it} from 'vitest'
import {createCommand} from '@next/kernel-base-runtime-shell-v2'
import {createRequestId} from '@next/kernel-base-contracts'
import {
    selectTcpCredentialSnapshot,
    selectTcpIdentitySnapshot,
    selectTcpRuntimeState,
    selectTcpSandboxId,
    tcpControlV2CommandDefinitions,
} from '../../src'
import {
    activateLiveTerminal,
    createLiveFileStoragePair,
    createLivePlatform,
    createLiveRuntime,
} from '../helpers/liveHarness'

const platforms: Array<Awaited<ReturnType<typeof createLivePlatform>>> = []
const storagePairs: Array<ReturnType<typeof createLiveFileStoragePair>> = []

afterEach(async () => {
    await Promise.all(platforms.splice(0).map(platform => platform.close()))
    storagePairs.splice(0).forEach(pair => pair.cleanup())
})

describe('tcp-control-runtime-v2 live restart recovery', () => {
    it('rehydrates persisted identity/credential/binding after real restart without reviving runtime-only request observation state', async () => {
        const platform = await createLivePlatform()
        platforms.push(platform)

        const storagePair = createLiveFileStoragePair('tcp-control-runtime-v2-live-restart')
        storagePairs.push(storagePair)

        const firstRuntimeHarness = createLiveRuntime({
            baseUrl: platform.baseUrl,
            localNodeId: 'node_tcp_v2_live_restart',
            stateStorage: storagePair.stateStorage,
            secureStateStorage: storagePair.secureStateStorage,
        })

        await firstRuntimeHarness.runtime.start()
        await activateLiveTerminal(firstRuntimeHarness.runtime, platform.prepare.sandboxId, '200000000004', 'device-live-tcp-v2-restart-001')
        await firstRuntimeHarness.runtime.dispatchCommand(
            createCommand(tcpControlV2CommandDefinitions.refreshCredential, {}),
            {requestId: createRequestId()},
        )
        await firstRuntimeHarness.runtime.flushPersistence()

        const persistedKeys = await storagePair.stateStorage.storage.getAllKeys?.()
        expect((persistedKeys ?? []).some(key => key.includes('kernel.base.tcp-control-runtime-v2.identity'))).toBe(true)
        expect((persistedKeys ?? []).some(key => key.includes('kernel.base.tcp-control-runtime-v2.binding'))).toBe(true)

        const secureKeys = await storagePair.secureStateStorage.storage.getAllKeys?.()
        expect((secureKeys ?? []).some(key => key.includes('kernel.base.tcp-control-runtime-v2.credential'))).toBe(true)

        const terminalIdBeforeRestart = selectTcpIdentitySnapshot(firstRuntimeHarness.runtime.getState()).terminalId
        const accessTokenBeforeRestart = selectTcpCredentialSnapshot(firstRuntimeHarness.runtime.getState()).accessToken

        const secondRuntimeHarness = createLiveRuntime({
            baseUrl: platform.baseUrl,
            localNodeId: 'node_tcp_v2_live_restart',
            stateStorage: storagePair.stateStorage,
            secureStateStorage: storagePair.secureStateStorage,
        })

        await secondRuntimeHarness.runtime.start()

        expect(selectTcpIdentitySnapshot(secondRuntimeHarness.runtime.getState()).terminalId).toBe(terminalIdBeforeRestart)
        expect(selectTcpCredentialSnapshot(secondRuntimeHarness.runtime.getState()).accessToken).toBe(accessTokenBeforeRestart)
        expect(selectTcpSandboxId(secondRuntimeHarness.runtime.getState())).toBe(platform.prepare.sandboxId)
        expect(selectTcpRuntimeState(secondRuntimeHarness.runtime.getState())?.bootstrapped).toBe(false)
        expect(selectTcpRuntimeState(secondRuntimeHarness.runtime.getState())?.lastActivationRequestId).toBeUndefined()
        expect(selectTcpRuntimeState(secondRuntimeHarness.runtime.getState())?.lastRefreshRequestId).toBeUndefined()
        expect(selectTcpRuntimeState(secondRuntimeHarness.runtime.getState())?.lastTaskReportRequestId).toBeUndefined()

        await secondRuntimeHarness.runtime.dispatchCommand(
            createCommand(tcpControlV2CommandDefinitions.bootstrapTcpControl, {
                deviceInfo: {
                    id: 'device-live-tcp-v2-restart-001',
                    model: 'Live Mock POS',
                },
            }),
            {requestId: createRequestId()},
        )

        expect(selectTcpRuntimeState(secondRuntimeHarness.runtime.getState())?.bootstrapped).toBe(true)
    })
})
