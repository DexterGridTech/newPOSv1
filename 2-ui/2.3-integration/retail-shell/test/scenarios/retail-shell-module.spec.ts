import {describe, expect, it, vi} from 'vitest'
import {createCommand} from '@impos2/kernel-base-runtime-shell-v2'
import {
    selectUiOverlays,
    selectUiScreenDefinition,
} from '@impos2/kernel-base-ui-runtime-v2'
import {tdpSyncV2CommandDefinitions} from '@impos2/kernel-base-tdp-sync-runtime-v2'
import {RETAIL_SHELL_HOT_UPDATE_RESTART_OVERLAY_ID} from '../../src/features'
import {createRetailShellHarness} from '../support/retailShellHarness'

describe('retail-shell module', () => {
    it('registers the retail welcome screen definition', async () => {
        await createRetailShellHarness()

        expect(
            selectUiScreenDefinition('ui.integration.retail-shell.welcome')?.rendererKey,
        ).toBe('ui.integration.retail-shell.welcome')
        expect(
            selectUiScreenDefinition('ui.integration.retail-shell.secondary-welcome')?.rendererKey,
        ).toBe('ui.integration.retail-shell.secondary-welcome')
    })

    it('handles hot update restart preparation through the ui bridge actor', async () => {
        vi.useFakeTimers()
        try {
            const harness = await createRetailShellHarness()
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
                    .some(overlay => overlay.id === RETAIL_SHELL_HOT_UPDATE_RESTART_OVERLAY_ID),
            ).toBe(false)
        } finally {
            vi.useRealTimers()
        }
    })
})
