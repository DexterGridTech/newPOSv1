import {describe, expect, it, vi} from 'vitest'
import {createCommand} from '@next/kernel-base-runtime-shell-v2'
import {
    selectUiOverlays,
    selectUiScreenDefinition,
} from '@next/kernel-base-ui-runtime-v2'
import {tdpSyncV2CommandDefinitions} from '@next/kernel-base-tdp-sync-runtime-v2'
import {cateringShellModuleManifest} from '../../src/application/moduleManifest'
import {CATERING_SHELL_HOT_UPDATE_RESTART_OVERLAY_ID} from '../../src/features'
import {createCateringShellHarness} from '../support/cateringShellHarness'

describe('catering-shell module', () => {
    it('declares payment completion topic interest for TDP handshake', () => {
        expect(cateringShellModuleManifest.tdpTopicInterests).toContainEqual({
            topicKey: 'order.payment.completed',
            category: 'projection',
            required: false,
            reason: 'catering terminal handles payment completion notifications during active order workflows',
        })
    })

    it('registers the catering welcome screen definition', async () => {
        await createCateringShellHarness()

        expect(
            selectUiScreenDefinition('ui.integration.catering-shell.welcome')?.rendererKey,
        ).toBe('ui.integration.catering-shell.welcome')
        expect(
            selectUiScreenDefinition('ui.integration.catering-shell.secondary-welcome')?.rendererKey,
        ).toBe('ui.integration.catering-shell.secondary-welcome')
    })

    it('handles hot update restart preparation through the ui bridge actor', async () => {
        vi.useFakeTimers()
        try {
            const harness = await createCateringShellHarness()
            const resultPromise = harness.runtime.dispatchCommand(createCommand(
                tdpSyncV2CommandDefinitions.requestHotUpdateRestartPreparation,
                {
                    displayIndex: 0,
                    releaseId: 'release-hot-update-ui-bridge',
                    packageId: 'package-hot-update-ui-bridge',
                    bundleVersion: '1.0.1',
                    mode: 'immediate',
                },
            ))

            await vi.advanceTimersByTimeAsync(3_000)

            await expect(resultPromise).resolves.toMatchObject({
                status: 'COMPLETED',
            })
            expect(
                selectUiOverlays(harness.runtime.getState())
                    .some(overlay => overlay.id === CATERING_SHELL_HOT_UPDATE_RESTART_OVERLAY_ID),
            ).toBe(false)
        } finally {
            vi.useRealTimers()
        }
    })
})
