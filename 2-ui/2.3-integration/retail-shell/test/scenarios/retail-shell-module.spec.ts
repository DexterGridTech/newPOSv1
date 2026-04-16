import {describe, expect, it} from 'vitest'
import {selectUiScreenDefinition} from '@impos2/kernel-base-ui-runtime-v2'
import {createRetailShellHarness} from '../support/retailShellHarness'

describe('retail-shell module', () => {
    it('registers the retail welcome screen definition', async () => {
        await createRetailShellHarness()

        expect(
            selectUiScreenDefinition('ui.integration.retail-shell.welcome')?.rendererKey,
        ).toBe('ui.integration.retail-shell.welcome')
    })
})
