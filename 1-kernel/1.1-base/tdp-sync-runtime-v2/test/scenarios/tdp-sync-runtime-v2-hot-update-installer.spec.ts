import {describe, expect, it, vi} from 'vitest'
import {createLoggerPort, createPlatformPorts} from '@impos2/kernel-base-platform-ports'
import {
    createKernelRuntimeV2,
    type RuntimeModuleContextV2,
} from '@impos2/kernel-base-runtime-shell-v2'
import {createHttpRuntime, type HttpTransport} from '@impos2/kernel-base-transport-runtime'
import {createTcpControlRuntimeModuleV2} from '@impos2/kernel-base-tcp-control-runtime-v2'
import {
    createTdpSyncRuntimeModuleV2,
    tdpHotUpdateActions,
    selectTdpHotUpdateState,
} from '../../src'
import {resolveTransportServers} from '../../../../test-support/serverConfig'
import {kernelBaseTestServerConfig} from '@impos2/kernel-server-config-v2'

const createMemoryStorage = () => {
    const saved = new Map<string, string>()
    return {
        storage: {
            async getItem(key: string) {
                return saved.get(key) ?? null
            },
            async setItem(key: string, value: string) {
                saved.set(key, value)
            },
            async removeItem(key: string) {
                saved.delete(key)
            },
        },
    }
}

const createTestRuntime = (input: {
    hotUpdatePort: {
        downloadPackage: ReturnType<typeof vi.fn>
        writeBootMarker: ReturnType<typeof vi.fn>
    }
    restartApp?: ReturnType<typeof vi.fn>
    displayIndex?: number
}) => {
    const stateStorage = createMemoryStorage()
    const secureStateStorage = createMemoryStorage()
    const httpTransport: HttpTransport = {
        async execute() {
            return {
                data: {success: true},
                status: 200,
                statusText: 'OK',
                headers: {},
            } as any
        },
    }

    return createKernelRuntimeV2({
        displayContext: {
            displayIndex: input.displayIndex ?? 0,
            displayCount: 2,
        },
        platformPorts: {
            ...createPlatformPorts({
                environmentMode: 'DEV',
                logger: createLoggerPort({
                    environmentMode: 'DEV',
                    write() {},
                    scope: {
                        moduleName: 'kernel.base.tdp-sync-runtime-v2.hot-update-installer.test',
                        layer: 'kernel',
                    },
                }),
                stateStorage: stateStorage.storage,
                secureStateStorage: secureStateStorage.storage,
            }),
            appControl: input.restartApp
                ? {
                    restartApp: input.restartApp,
                }
                : undefined,
            hotUpdate: {
                downloadPackage: input.hotUpdatePort.downloadPackage,
                writeBootMarker: input.hotUpdatePort.writeBootMarker,
            },
        },
        modules: [
            createTcpControlRuntimeModuleV2({
                assembly: {
                    createHttpRuntime(context: RuntimeModuleContextV2) {
                        return createHttpRuntime({
                            logger: context.platformPorts.logger.scope({
                                moduleName: 'kernel.base.tdp-sync-runtime-v2.hot-update-installer.test',
                                subsystem: 'transport.http',
                            }),
                            transport: httpTransport,
                            servers: resolveTransportServers(kernelBaseTestServerConfig),
                        })
                    },
                },
            }),
            createTdpSyncRuntimeModuleV2({
                assembly: {
                    createHttpRuntime(context: RuntimeModuleContextV2) {
                        return createHttpRuntime({
                            logger: context.platformPorts.logger.scope({
                                moduleName: 'kernel.base.tdp-sync-runtime-v2.hot-update-installer.test',
                                subsystem: 'transport.http',
                            }),
                            transport: httpTransport,
                            servers: resolveTransportServers(kernelBaseTestServerConfig),
                        })
                    },
                },
                hotUpdate: {
                    getPort(context) {
                        return context.platformPorts.hotUpdate
                    },
                    getCurrentFacts() {
                        return {
                            appId: 'assembly-android-mixc-retail-rn84',
                            platform: 'android' as const,
                            product: 'mixc-retail',
                            runtimeVersion: 'android-mixc-retail-rn84@1.0',
                            assemblyVersion: '1.0.0',
                            buildNumber: 1,
                            channel: 'development',
                            capabilities: [],
                        }
                    },
                },
            }),
        ],
    })
}

const desired = {
    schemaVersion: 1 as const,
    releaseId: 'release-001',
    packageId: 'package-001',
    appId: 'assembly-android-mixc-retail-rn84',
    platform: 'android' as const,
    product: 'mixc-retail',
    bundleVersion: '1.0.0+ota.1',
    runtimeVersion: 'android-mixc-retail-rn84@1.0',
    packageUrl: '/api/v1/hot-updates/packages/package-001/download',
    packageSize: 123,
    packageSha256: 'package-sha',
    manifestSha256: 'manifest-sha',
    compatibility: {
        appId: 'assembly-android-mixc-retail-rn84',
        platform: 'android' as const,
        product: 'mixc-retail',
        runtimeVersion: 'android-mixc-retail-rn84@1.0',
    },
    restart: {mode: 'manual' as const},
    rollout: {mode: 'active' as const, publishedAt: '2026-04-19T00:00:00.000Z'},
    safety: {
        requireSignature: false,
        maxDownloadAttempts: 3,
        maxLaunchFailures: 2,
        healthCheckTimeoutMs: 5_000,
    },
}

describe('tdp hot update installer watcher', () => {
    it('downloads, marks ready and writes boot marker for primary owner', async () => {
        const downloadPackage = vi.fn(async () => ({
            installDir: '/tmp/hot-updates/package-001',
            entryFile: 'index.android.bundle',
            manifestPath: '/tmp/hot-updates/package-001/manifest.json',
            packageSha256: 'package-sha',
            manifestSha256: 'manifest-sha',
        }))
        const writeBootMarker = vi.fn(async () => ({
            bootMarkerPath: '/tmp/hot-updates/boot-marker.json',
        }))
        const runtime = createTestRuntime({
            hotUpdatePort: {
                downloadPackage,
                writeBootMarker,
            },
        })

        await runtime.start()
        runtime.getStore().dispatch(tdpHotUpdateActions.reconcileDesired({desired, now: 1}))
        await vi.waitFor(() => expect(downloadPackage).toHaveBeenCalledTimes(1))

        expect(downloadPackage).toHaveBeenCalledWith(expect.objectContaining({
            packageId: 'package-001',
            packageUrls: [
                'http://mock-terminal-platform.test/api/v1/hot-updates/packages/package-001/download',
            ],
        }))
        expect(writeBootMarker).toHaveBeenCalledTimes(1)
        expect(writeBootMarker).toHaveBeenCalledWith(expect.objectContaining({
            healthCheckTimeoutMs: 5_000,
        }))
        await vi.waitFor(() => expect(selectTdpHotUpdateState(runtime.getState())).toMatchObject({
            ready: {
                packageId: 'package-001',
                installDir: '/tmp/hot-updates/package-001',
            },
            applying: {
                packageId: 'package-001',
                bootMarkerPath: '/tmp/hot-updates/boot-marker.json',
            },
        }))
    })

    it('does not install on non-owner secondary display without topology context', async () => {
        const downloadPackage = vi.fn()
        const writeBootMarker = vi.fn()
        const runtime = createTestRuntime({
            hotUpdatePort: {
                downloadPackage,
                writeBootMarker,
            },
            displayIndex: 1,
        })

        await runtime.start()
        runtime.getStore().dispatch(tdpHotUpdateActions.reconcileDesired({desired, now: 1}))
        await new Promise(resolve => setTimeout(resolve, 20))

        expect(downloadPackage).not.toHaveBeenCalled()
        expect(writeBootMarker).not.toHaveBeenCalled()
    })

    it('restarts immediately when policy requires immediate restart', async () => {
        const restartApp = vi.fn(async () => undefined)
        const downloadPackage = vi.fn(async () => ({
            installDir: '/tmp/hot-updates/package-001',
            entryFile: 'index.android.bundle',
            manifestPath: '/tmp/hot-updates/package-001/manifest.json',
            packageSha256: 'package-sha',
            manifestSha256: 'manifest-sha',
        }))
        const writeBootMarker = vi.fn(async () => ({
            bootMarkerPath: '/tmp/hot-updates/boot-marker.json',
        }))
        const runtime = createTestRuntime({
            restartApp,
            hotUpdatePort: {
                downloadPackage,
                writeBootMarker,
            },
        })

        await runtime.start()
        runtime.getStore().dispatch(tdpHotUpdateActions.reconcileDesired({
            desired: {
                ...desired,
                restart: {mode: 'immediate'},
            },
            now: 1,
        }))
        await vi.waitFor(() => expect(restartApp).toHaveBeenCalledTimes(1))
    })

    it('marks failed when download throws', async () => {
        const runtime = createTestRuntime({
            hotUpdatePort: {
                downloadPackage: vi.fn(async () => {
                    throw new Error('download failed')
                }),
                writeBootMarker: vi.fn(),
            },
        })

        await runtime.start()
        runtime.getStore().dispatch(tdpHotUpdateActions.reconcileDesired({desired, now: 1}))
        await vi.waitFor(() => expect(selectTdpHotUpdateState(runtime.getState())?.lastError?.code).toBe('download failed'))

        expect(selectTdpHotUpdateState(runtime.getState())).toMatchObject({
            candidate: {
                status: 'failed',
                reason: 'download failed',
            },
        })
    })

    it('retries failed downloads up to max attempts and succeeds on a later attempt', async () => {
        vi.useFakeTimers()
        try {
            const downloadPackage = vi.fn()
                .mockRejectedValueOnce(new Error('transient network error'))
                .mockResolvedValueOnce({
                    installDir: '/tmp/hot-updates/package-001',
                    entryFile: 'index.android.bundle',
                    manifestPath: '/tmp/hot-updates/package-001/manifest.json',
                    packageSha256: 'package-sha',
                    manifestSha256: 'manifest-sha',
                })
            const writeBootMarker = vi.fn(async () => ({
                bootMarkerPath: '/tmp/hot-updates/boot-marker.json',
            }))
            const runtime = createTestRuntime({
                hotUpdatePort: {
                    downloadPackage,
                    writeBootMarker,
                },
            })

            await runtime.start()
            runtime.getStore().dispatch(tdpHotUpdateActions.reconcileDesired({desired, now: 1}))

            await vi.waitFor(() => expect(downloadPackage).toHaveBeenCalledTimes(1))
            await vi.waitFor(() => expect(selectTdpHotUpdateState(runtime.getState())?.candidate).toMatchObject({
                status: 'failed',
                attempts: 1,
            }))

            await vi.advanceTimersByTimeAsync(1_000)

            await vi.waitFor(() => expect(downloadPackage).toHaveBeenCalledTimes(2))
            await vi.waitFor(() => expect(selectTdpHotUpdateState(runtime.getState())).toMatchObject({
                ready: {
                    packageId: 'package-001',
                },
                applying: {
                    packageId: 'package-001',
                },
            }))
            expect(writeBootMarker).toHaveBeenCalledTimes(1)
        } finally {
            vi.useRealTimers()
        }
    })
})
