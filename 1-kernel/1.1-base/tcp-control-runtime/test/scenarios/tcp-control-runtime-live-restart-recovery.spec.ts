import {afterEach, describe, expect, it} from 'vitest'
import {createRequestId} from '@impos2/kernel-base-contracts'
import {
    selectTcpBindingSnapshot,
    selectTcpCredentialSnapshot,
    selectTcpIdentitySnapshot,
    selectTcpRuntimeState,
    tcpControlCommandNames,
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

describe('tcp-control-runtime live restart recovery', () => {
    it('rehydrates persisted identity, credential, and binding state after real restart without reviving runtime-only observation', async () => {
        const platform = await createLivePlatform()
        platforms.push(platform)

        const storagePair = createLiveFileStoragePair('tcp-control-runtime-live-restart')
        storagePairs.push(storagePair)

        const firstRuntimeHarness = createLiveRuntime({
            baseUrl: platform.baseUrl,
            localNodeId: 'node_tcp_live_restart',
            stateStorage: storagePair.stateStorage,
            secureStateStorage: storagePair.secureStateStorage,
        })

        await firstRuntimeHarness.runtime.start()
        await activateLiveTerminal(firstRuntimeHarness.runtime, '200000000002', 'device-live-tcp-restart-001')
        await firstRuntimeHarness.runtime.execute({
            commandName: tcpControlCommandNames.refreshCredential,
            payload: {},
            requestId: createRequestId(),
        })
        await firstRuntimeHarness.runtime.flushPersistence()

        const seededIdentity = selectTcpIdentitySnapshot(firstRuntimeHarness.runtime.getState())
        const seededCredential = selectTcpCredentialSnapshot(firstRuntimeHarness.runtime.getState())
        const seededBinding = selectTcpBindingSnapshot(firstRuntimeHarness.runtime.getState())

        expect((await storagePair.stateStorage.storage.getAllKeys?.())?.some(key => key.endsWith(':terminalId'))).toBe(true)
        expect((await storagePair.secureStateStorage.storage.getAllKeys?.())?.some(key => key.endsWith(':accessToken'))).toBe(true)
        expect((await storagePair.secureStateStorage.storage.getAllKeys?.())?.some(key => key.endsWith(':refreshToken'))).toBe(true)

        const secondRuntimeHarness = createLiveRuntime({
            baseUrl: platform.baseUrl,
            localNodeId: 'node_tcp_live_restart',
            stateStorage: storagePair.stateStorage,
            secureStateStorage: storagePair.secureStateStorage,
        })

        await secondRuntimeHarness.runtime.start()

        expect(selectTcpIdentitySnapshot(secondRuntimeHarness.runtime.getState())).toMatchObject({
            terminalId: seededIdentity.terminalId,
            deviceFingerprint: seededIdentity.deviceFingerprint,
            activationStatus: 'ACTIVATED',
        })
        expect(selectTcpCredentialSnapshot(secondRuntimeHarness.runtime.getState())).toMatchObject({
            accessToken: seededCredential.accessToken,
            refreshToken: seededCredential.refreshToken,
            status: 'READY',
        })
        expect(selectTcpBindingSnapshot(secondRuntimeHarness.runtime.getState())).toMatchObject(seededBinding)
        expect(selectTcpRuntimeState(secondRuntimeHarness.runtime.getState())).toMatchObject({
            bootstrapped: false,
        })
        expect(selectTcpRuntimeState(secondRuntimeHarness.runtime.getState())?.lastActivationRequestId).toBeUndefined()
        expect(selectTcpRuntimeState(secondRuntimeHarness.runtime.getState())?.lastRefreshRequestId).toBeUndefined()
        expect(selectTcpRuntimeState(secondRuntimeHarness.runtime.getState())?.lastTaskReportRequestId).toBeUndefined()
    })
})
