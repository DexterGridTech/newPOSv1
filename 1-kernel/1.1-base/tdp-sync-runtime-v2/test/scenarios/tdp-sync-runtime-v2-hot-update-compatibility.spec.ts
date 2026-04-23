import {describe, expect, it} from 'vitest'
import {
    evaluateHotUpdateCompatibility,
    type HotUpdateCompatibility,
} from '../../src'

const baseCurrent = {
    appId: 'assembly-android-mixc-retail-rn84',
    platform: 'android' as const,
    product: 'mixc-retail',
    runtimeVersion: 'android-mixc-retail-rn84@1.0',
    assemblyVersion: '1.0.0',
    buildNumber: 1,
    channel: 'development',
    capabilities: ['projection-mirror', 'dispatch-relay', 'state-sync'],
}

const baseCompatibility: HotUpdateCompatibility = {
    appId: 'assembly-android-mixc-retail-rn84',
    platform: 'android',
    product: 'mixc-retail',
    runtimeVersion: 'android-mixc-retail-rn84@1.0',
}

describe('tdp hot update compatibility', () => {
    it('accepts exact runtimeVersion match', () => {
        expect(evaluateHotUpdateCompatibility({
            current: baseCurrent,
            compatibility: baseCompatibility,
            desiredBundleVersion: '1.0.0+ota.1',
            currentBundleVersion: '1.0.0+ota.0',
        })).toMatchObject({ok: true})
    })

    it('rejects runtimeVersion mismatch', () => {
        expect(evaluateHotUpdateCompatibility({
            current: baseCurrent,
            compatibility: {
                ...baseCompatibility,
                runtimeVersion: 'android-mixc-retail-rn84@2.0',
            },
            desiredBundleVersion: '1.0.0+ota.1',
            currentBundleVersion: '1.0.0+ota.0',
        })).toMatchObject({
            ok: false,
            reason: 'RUNTIME_VERSION_MISMATCH',
        })
    })

    it('rejects downgrade unless rollback explicitly allowed', () => {
        expect(evaluateHotUpdateCompatibility({
            current: baseCurrent,
            compatibility: baseCompatibility,
            desiredBundleVersion: '1.0.0+ota.0',
            currentBundleVersion: '1.0.0+ota.2',
            rolloutMode: 'active',
            allowDowngrade: false,
        })).toMatchObject({
            ok: false,
            reason: 'DOWNGRADE_NOT_ALLOWED',
        })
    })
})
