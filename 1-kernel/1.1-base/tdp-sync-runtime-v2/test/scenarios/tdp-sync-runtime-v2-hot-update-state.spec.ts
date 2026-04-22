import {describe, expect, it} from 'vitest'
import {
    applySliceSyncDiff,
    createSliceSyncDiff,
} from '@impos2/kernel-base-state-runtime'
import {
    createTdpHotUpdateStateForTests,
    reduceHotUpdateDesired,
} from '../../src'
import {
    tdpHotUpdateActions,
    tdpHotUpdateSliceDescriptor,
} from '../../src/features/slices/tdpHotUpdate'

const baseDesired = {
    schemaVersion: 1 as const,
    releaseId: 'release-001',
    packageId: 'package-001',
    appId: 'assembly-android-mixc-retail-rn84',
    platform: 'android' as const,
    product: 'mixc-retail',
    bundleVersion: '1.0.0+ota.1',
    runtimeVersion: 'android-mixc-retail-rn84@1.0',
    packageUrl: 'http://mock/hot-update.zip',
    packageSize: 1,
    packageSha256: 'abc',
    manifestSha256: 'def',
    compatibility: {
        appId: 'assembly-android-mixc-retail-rn84',
        platform: 'android' as const,
        product: 'mixc-retail',
        runtimeVersion: 'android-mixc-retail-rn84@1.0',
    },
    restart: {mode: 'idle' as const, idleWindowMs: 60_000},
    rollout: {mode: 'active' as const, publishedAt: '2026-04-18T00:00:00.000Z'},
    safety: {
        requireSignature: false,
        maxDownloadAttempts: 3,
        maxLaunchFailures: 2,
        healthCheckTimeoutMs: 5_000,
    },
}

describe('tdp hot update state reducer', () => {
    it('moves compatible desired into download-pending', () => {
        const state = reduceHotUpdateDesired(createTdpHotUpdateStateForTests(), {
            desired: baseDesired,
            currentFacts: {
                appId: 'assembly-android-mixc-retail-rn84',
                platform: 'android',
                product: 'mixc-retail',
                runtimeVersion: 'android-mixc-retail-rn84@1.0',
                assemblyVersion: '1.0.0',
                buildNumber: 1,
                channel: 'development',
                capabilities: [],
            },
            now: 100,
        })

        expect(state.candidate).toMatchObject({
            status: 'download-pending',
            releaseId: 'release-001',
            packageId: 'package-001',
        })
    })

    it('records paused event without starting a new download when rollout is paused', () => {
        const state = reduceHotUpdateDesired(createTdpHotUpdateStateForTests(), {
            desired: {
                ...baseDesired,
                rollout: {mode: 'paused', publishedAt: '2026-04-18T00:00:00.000Z'},
            },
            currentFacts: {
                appId: 'assembly-android-mixc-retail-rn84',
                platform: 'android',
                product: 'mixc-retail',
                runtimeVersion: 'android-mixc-retail-rn84@1.0',
                assemblyVersion: '1.0.0',
                buildNumber: 1,
                channel: 'development',
                capabilities: [],
            },
            now: 150,
        })

        expect(state.candidate).toBeUndefined()
        expect(state.history.at(-1)).toMatchObject({
            event: 'paused',
            releaseId: 'release-001',
            packageId: 'package-001',
        })
    })

    it('clears candidate when desired is removed', () => {
        const next = reduceHotUpdateDesired(createTdpHotUpdateStateForTests({
            candidate: {
                releaseId: 'release-001',
                packageId: 'package-001',
                bundleVersion: '1.0.0+ota.1',
                status: 'download-pending',
                attempts: 0,
                updatedAt: 1,
            },
        }), {
            desired: undefined,
            currentFacts: {
                appId: 'assembly-android-mixc-retail-rn84',
                platform: 'android',
                product: 'mixc-retail',
                runtimeVersion: 'android-mixc-retail-rn84@1.0',
                assemblyVersion: '1.0.0',
                buildNumber: 1,
                capabilities: [],
            },
            now: 200,
        })

        expect(next.candidate).toBeUndefined()
        expect(next.history.at(-1)?.event).toBe('desired-cleared')
    })

    it('does not re-enter download-pending when desired package is already current', () => {
        const state = reduceHotUpdateDesired(createTdpHotUpdateStateForTests({
            current: {
                source: 'hot-update',
                appId: 'assembly-android-mixc-retail-rn84',
                assemblyVersion: '1.0.0',
                buildNumber: 1,
                runtimeVersion: 'android-mixc-retail-rn84@1.0',
                bundleVersion: '1.0.0+ota.1',
                packageId: 'package-001',
                releaseId: 'release-001',
                installDir: '/data/user/0/app/files/hot-updates/packages/package-001',
                appliedAt: 123,
            },
        }), {
            desired: baseDesired,
            currentFacts: {
                appId: 'assembly-android-mixc-retail-rn84',
                platform: 'android',
                product: 'mixc-retail',
                runtimeVersion: 'android-mixc-retail-rn84@1.0',
                assemblyVersion: '1.0.0',
                buildNumber: 1,
                channel: 'development',
                capabilities: [],
            },
            now: 300,
        })

        expect(state.candidate).toBeUndefined()
        expect(state.ready).toBeUndefined()
        expect(state.applying).toBeUndefined()
        expect(state.history.at(-1)?.event).not.toBe('download-pending')
    })

    it('does not re-download a desired package that was already rolled back', () => {
        const state = reduceHotUpdateDesired(createTdpHotUpdateStateForTests({
            current: {
                source: 'rollback',
                appId: 'assembly-android-mixc-retail-rn84',
                assemblyVersion: '1.0.0',
                buildNumber: 1,
                runtimeVersion: 'android-mixc-retail-rn84@1.0',
                bundleVersion: '1.0.0+ota.1',
                packageId: 'package-001',
                releaseId: 'release-001',
                appliedAt: 500,
            },
            lastError: {
                code: 'HOT_UPDATE_MAX_LAUNCH_FAILURES',
                message: 'rolled back',
                at: 501,
            },
        }), {
            desired: baseDesired,
            currentFacts: {
                appId: 'assembly-android-mixc-retail-rn84',
                platform: 'android',
                product: 'mixc-retail',
                runtimeVersion: 'android-mixc-retail-rn84@1.0',
                assemblyVersion: '1.0.0',
                buildNumber: 1,
                channel: 'development',
                capabilities: [],
            },
            now: 600,
        })

        expect(state.candidate).toBeUndefined()
        expect(state.ready).toBeUndefined()
        expect(state.applying).toBeUndefined()
        expect(state.history.at(-1)?.event).not.toBe('download-pending')
    })

    it('keeps local download progress when the same desired package is reconciled again', () => {
        const state = reduceHotUpdateDesired(createTdpHotUpdateStateForTests({
            desired: baseDesired,
            candidate: {
                releaseId: 'release-001',
                packageId: 'package-001',
                bundleVersion: '1.0.0+ota.1',
                status: 'ready',
                attempts: 1,
                updatedAt: 500,
            },
            ready: {
                releaseId: 'release-001',
                packageId: 'package-001',
                bundleVersion: '1.0.0+ota.1',
                installDir: '/hot-update/package-001',
                packageSha256: 'abc',
                manifestSha256: 'def',
                readyAt: 600,
            },
        }), {
            desired: baseDesired,
            currentFacts: {
                appId: 'assembly-android-mixc-retail-rn84',
                platform: 'android',
                product: 'mixc-retail',
                runtimeVersion: 'android-mixc-retail-rn84@1.0',
                assemblyVersion: '1.0.0',
                buildNumber: 1,
                channel: 'development',
                capabilities: [],
            },
            now: 700,
        })

        expect(state.desired?.packageId).toBe('package-001')
        expect(state.candidate).toMatchObject({
            packageId: 'package-001',
            status: 'ready',
            attempts: 1,
        })
        expect(state.ready?.installDir).toBe('/hot-update/package-001')
        expect(state.history.at(-1)?.event).not.toBe('download-pending')
    })

    it('records idle restart intent using configured threshold fallback', () => {
        const state = createTdpHotUpdateStateForTests({
            lastUserOperationAt: 1_000,
        })
        const next = tdpHotUpdateActions.markRestartPending({
            desired: {
                ...baseDesired,
                restart: {mode: 'idle'},
            },
            now: 2_000,
            idleThresholdMs: 300_000,
        })

        const reduced = tdpHotUpdateSliceDescriptor.reducer(state, next)
        expect(reduced.restartIntent).toMatchObject({
            mode: 'idle',
            status: 'waiting-idle',
            idleThresholdMs: 300_000,
            lastUserOperationAt: 1_000,
            nextEligibleAt: 301_000,
        })
    })

    it('pushes idle restart intent back when a new user operation arrives', () => {
        const initial = tdpHotUpdateSliceDescriptor.reducer(createTdpHotUpdateStateForTests(), tdpHotUpdateActions.markRestartPending({
            desired: {
                ...baseDesired,
                restart: {mode: 'idle', idleWindowMs: 60_000},
            },
            now: 2_000,
        }))
        const reduced = tdpHotUpdateSliceDescriptor.reducer(initial, tdpHotUpdateActions.recordUserOperation({at: 9_000}))
        expect(reduced.lastUserOperationAt).toBe(9_000)
        expect(reduced.restartIntent).toMatchObject({
            status: 'waiting-idle',
            nextEligibleAt: 69_000,
        })
    })

    it('does not move an idle restart back to waiting once restart preparation has started', () => {
        const initial = tdpHotUpdateSliceDescriptor.reducer(
            createTdpHotUpdateStateForTests(),
            tdpHotUpdateActions.markRestartPending({
                desired: {
                    ...baseDesired,
                    restart: {mode: 'idle', idleWindowMs: 60_000},
                },
                now: 2_000,
            }),
        )
        const preparing = tdpHotUpdateSliceDescriptor.reducer(
            initial,
            tdpHotUpdateActions.markRestartPreparing({now: 10_000}),
        )

        const reduced = tdpHotUpdateSliceDescriptor.reducer(
            preparing,
            tdpHotUpdateActions.recordUserOperation({at: 12_000}),
        )

        expect(reduced.lastUserOperationAt).toBe(12_000)
        expect(reduced.restartIntent).toMatchObject({
            status: 'preparing',
            updatedAt: 10_000,
        })
    })

    it('does not push idle restart back once the eligibility threshold has already been reached', () => {
        const initial = tdpHotUpdateSliceDescriptor.reducer(
            createTdpHotUpdateStateForTests({
                lastUserOperationAt: 1_000,
            }),
            tdpHotUpdateActions.markRestartPending({
                desired: {
                    ...baseDesired,
                    restart: {mode: 'idle', idleWindowMs: 60_000},
                },
                now: 2_000,
            }),
        )

        const reduced = tdpHotUpdateSliceDescriptor.reducer(
            initial,
            tdpHotUpdateActions.recordUserOperation({at: 70_000}),
        )

        expect(reduced.lastUserOperationAt).toBe(70_000)
        expect(reduced.restartIntent).toMatchObject({
            status: 'waiting-idle',
            updatedAt: 2_000,
            lastUserOperationAt: 1_000,
            nextEligibleAt: 61_000,
        })
    })

    it('only syncs desired across topology snapshots and keeps local execution state untouched', () => {
        const masterState = createTdpHotUpdateStateForTests({
            current: {
                source: 'hot-update',
                appId: 'assembly-android-mixc-retail-rn84',
                assemblyVersion: '1.0.0',
                buildNumber: 1,
                runtimeVersion: 'android-mixc-retail-rn84@1.0',
                bundleVersion: '1.0.0+ota.2',
                packageId: 'package-002',
                releaseId: 'release-002',
                installDir: '/hot-update/package-002',
                appliedAt: 20_000,
            },
            desired: {
                ...baseDesired,
                releaseId: 'release-002',
                packageId: 'package-002',
                bundleVersion: '1.0.0+ota.2',
                rollout: {
                    mode: 'active',
                    publishedAt: '2026-04-21T00:00:20.000Z',
                },
            },
        })
        const slaveState = createTdpHotUpdateStateForTests({
            current: {
                source: 'hot-update',
                appId: 'assembly-android-mixc-retail-rn84',
                assemblyVersion: '1.0.0',
                buildNumber: 1,
                runtimeVersion: 'android-mixc-retail-rn84@1.0',
                bundleVersion: '1.0.0+ota.1',
                packageId: 'package-001',
                releaseId: 'release-001',
                installDir: '/hot-update/package-001',
                appliedAt: 10_000,
            },
            candidate: {
                releaseId: 'release-001',
                packageId: 'package-001',
                bundleVersion: '1.0.0+ota.1',
                status: 'ready',
                attempts: 1,
                updatedAt: 10_100,
            },
            ready: {
                releaseId: 'release-001',
                packageId: 'package-001',
                bundleVersion: '1.0.0+ota.1',
                installDir: '/hot-update/package-001',
                packageSha256: 'old-sha',
                manifestSha256: 'old-manifest',
                readyAt: 10_200,
            },
            applying: {
                releaseId: 'release-001',
                packageId: 'package-001',
                bundleVersion: '1.0.0+ota.1',
                bootMarkerPath: '/hot-update/active-marker.json',
                startedAt: 10_300,
            },
            restartIntent: {
                releaseId: 'release-001',
                packageId: 'package-001',
                bundleVersion: '1.0.0+ota.1',
                mode: 'idle',
                status: 'ready-to-restart',
                requestedAt: 10_400,
                updatedAt: 10_500,
                idleThresholdMs: 15_000,
                lastUserOperationAt: 9_000,
                nextEligibleAt: 24_000,
            },
            lastUserOperationAt: 9_000,
            previous: {
                source: 'embedded',
                appId: 'assembly-android-mixc-retail-rn84',
                assemblyVersion: '1.0.0',
                buildNumber: 1,
                runtimeVersion: 'android-mixc-retail-rn84@1.0',
                bundleVersion: '1.0.0+ota.0',
                appliedAt: 8_000,
            },
            lastError: {
                code: 'OLD_ERROR',
                message: 'old error',
                at: 10_600,
            },
        })

        const diff = createSliceSyncDiff(
            tdpHotUpdateSliceDescriptor,
            masterState,
            {},
            {mode: 'authoritative'},
        )

        const next = applySliceSyncDiff(
            tdpHotUpdateSliceDescriptor,
            slaveState,
            diff,
            {mode: 'authoritative'},
        )

        expect(next.current.bundleVersion).toBe('1.0.0+ota.1')
        expect(next.desired?.packageId).toBe('package-002')
        expect(next.candidate).toMatchObject({
            packageId: 'package-001',
            status: 'ready',
        })
        expect(next.ready?.installDir).toBe('/hot-update/package-001')
        expect(next.applying?.bootMarkerPath).toBe('/hot-update/active-marker.json')
        expect(next.restartIntent?.status).toBe('ready-to-restart')
        expect(next.lastUserOperationAt).toBe(9_000)
        expect(next.previous?.bundleVersion).toBe('1.0.0+ota.0')
        expect(next.lastError?.code).toBe('OLD_ERROR')
    })
})
