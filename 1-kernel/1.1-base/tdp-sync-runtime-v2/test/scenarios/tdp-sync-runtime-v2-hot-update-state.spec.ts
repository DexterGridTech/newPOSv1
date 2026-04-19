import {describe, expect, it} from 'vitest'
import {
    createTdpHotUpdateStateForTests,
    reduceHotUpdateDesired,
} from '../../src'

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
})
