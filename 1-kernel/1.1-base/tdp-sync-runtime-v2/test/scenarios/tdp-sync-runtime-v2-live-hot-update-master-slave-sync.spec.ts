import {describe, expect, it} from 'vitest'
import {createKernelRuntimeV2} from '@impos2/kernel-base-runtime-shell-v2'
import {
    createPlatformPorts,
    createLoggerPort,
} from '@impos2/kernel-base-platform-ports'
import {selectTopologySync} from '@impos2/kernel-base-topology-runtime-v3'
import {
    createTdpSyncRuntimeModuleV2,
    selectTdpHotUpdateState,
} from '../../src'
import {createHotUpdateReadModelModule} from '../helpers/hotUpdateReadModelModule'
import {waitFor} from '../helpers/liveHarness'
import {createTerminalTopologyIntegrationHarnessV3} from '../helpers/terminalTopologyIntegrationHarnessV3'

describe('tdp-sync-runtime-v2 live hot update master-slave sync', () => {
    it('syncs desired hot update intent from master to slave while keeping execution state local', async () => {
        const harness = await createTerminalTopologyIntegrationHarnessV3({
            includeDefaultBridgeModule: false,
            slaveModules: [createHotUpdateReadModelModule()],
        })

        try {
            await harness.configureTopologyPair()
            await harness.startTopologyConnectionPair()
            await harness.activateAndConnectTerminal({
                activationCode: '200000000008',
                deviceId: 'device-live-tdp-v2-hot-update-topology-001',
            })

            const terminalId = harness.getTerminalId()
            if (!terminalId) {
                throw new Error('missing terminal id before hot update sync seed')
            }

            await harness.upsertProjection({
                topicKey: 'terminal.hot-update.desired',
                payload: {
                    itemKey: 'main',
                    schemaVersion: 1,
                    releaseId: 'release-topology-hot-update-001',
                    packageId: 'package-topology-hot-update-001',
                    appId: 'assembly-android-mixc-retail-rn84',
                    platform: 'android',
                    product: 'mixc-retail',
                    bundleVersion: '1.0.0+ota.3',
                    runtimeVersion: 'android-mixc-retail-rn84@1.0',
                    packageUrl: 'http://mock/topology-hot-update-001.zip',
                    packageSize: 512,
                    packageSha256: 'sha-topology-hot-update-001',
                    manifestSha256: 'manifest-topology-hot-update-001',
                    compatibility: {
                        appId: 'assembly-android-mixc-retail-rn84',
                        platform: 'android',
                        product: 'mixc-retail',
                        runtimeVersion: 'android-mixc-retail-rn84@1.0',
                    },
                    restart: {
                        mode: 'manual',
                        operatorInstruction: 'wait for cashier idle',
                    },
                    rollout: {
                        mode: 'active',
                        publishedAt: '2026-04-18T02:00:00.000Z',
                    },
                    safety: {
                        requireSignature: false,
                        maxDownloadAttempts: 3,
                        maxLaunchFailures: 2,
                        healthCheckTimeoutMs: 5_000,
                    },
                },
            })

            await waitFor(() => {
                const hotUpdate = selectTdpHotUpdateState(harness.masterRuntime.getState())
                return hotUpdate?.desired?.releaseId === 'release-topology-hot-update-001'
                    && hotUpdate.candidate?.status === 'download-pending'
            }, 10_000)

            await waitFor(() => {
                const hotUpdate = selectTdpHotUpdateState(harness.slaveRuntime.getState())
                return hotUpdate?.desired?.releaseId === 'release-topology-hot-update-001'
            }, 10_000)

            expect(selectTdpHotUpdateState(harness.masterRuntime.getState())).toMatchObject({
                desired: {
                    releaseId: 'release-topology-hot-update-001',
                    packageId: 'package-topology-hot-update-001',
                    bundleVersion: '1.0.0+ota.3',
                },
                candidate: {
                    packageId: 'package-topology-hot-update-001',
                    status: 'download-pending',
                },
            })
            expect(selectTdpHotUpdateState(harness.slaveRuntime.getState())).toMatchObject({
                desired: {
                    releaseId: 'release-topology-hot-update-001',
                    packageId: 'package-topology-hot-update-001',
                    bundleVersion: '1.0.0+ota.3',
                },
            })
            expect(selectTdpHotUpdateState(harness.slaveRuntime.getState())?.candidate).toBeUndefined()

            const rogueSlaveRuntime = createKernelRuntimeV2({
                localNodeId: 'node_hot_update_slave_probe' as any,
                platformPorts: createPlatformPorts({
                    environmentMode: 'DEV',
                    logger: createLoggerPort({
                        environmentMode: 'DEV',
                        write() {},
                        scope: {
                            moduleName: 'kernel.base.tdp-sync-runtime-v2.test.hot-update-readonly-probe',
                            layer: 'kernel',
                        },
                    }),
                    stateStorage: {
                        async getItem() { return null },
                        async setItem() {},
                        async removeItem() {},
                        async multiGet() { return {} },
                        async multiSet() {},
                        async multiRemove() {},
                        async getAllKeys() { return [] },
                        async clear() {},
                    },
                    secureStateStorage: {
                        async getItem() { return null },
                        async setItem() {},
                        async removeItem() {},
                        async multiGet() { return {} },
                        async multiSet() {},
                        async multiRemove() {},
                        async getAllKeys() { return [] },
                        async clear() {},
                    },
                }),
                modules: [createTdpSyncRuntimeModuleV2()],
            })

            await rogueSlaveRuntime.start()
            expect(selectTdpHotUpdateState(rogueSlaveRuntime.getState())).toMatchObject({
                current: {
                    source: 'embedded',
                    bundleVersion: '1.0.0+ota.0',
                },
                history: [],
            })
            expect(selectTdpHotUpdateState(harness.slaveRuntime.getState())?.desired?.releaseId).toBe(
                'release-topology-hot-update-001',
            )
            expect(selectTdpHotUpdateState(harness.slaveRuntime.getState())?.current.bundleVersion).toBe(
                '1.0.0+ota.0',
            )
            expect(selectTopologySync(harness.masterRuntime.getState())?.status).toBe('active')
            expect(selectTopologySync(harness.slaveRuntime.getState())?.status).toBe('active')
        } finally {
            await harness.disconnect()
        }
    }, 20_000)
})
