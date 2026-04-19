import React from 'react'
import {describe, expect, it} from 'vitest'
import {
    createRuntimeReactHarness,
    renderWithAutomation,
} from '../support/runtimeReactHarness'
import {createRuntimeReactScenarioModule} from '../support/runtimeReactScenarioModule'
import {RuntimeReactScenarioStatePanel} from '../support/RuntimeReactScenarioStatePanel'
import {UiRuntimeRootShell} from '../../src'

const createScenarioTree = async () => {
    const harness = await createRuntimeReactHarness({
        modules: [createRuntimeReactScenarioModule()],
        displayContext: {
            displayIndex: 0,
            displayCount: 2,
        },
    })

    return renderWithAutomation(
        <>
            <RuntimeReactScenarioStatePanel />
            <UiRuntimeRootShell />
        </>,
        harness.store,
        harness.runtime,
    )
}

describe('runtime-react command flow', () => {
    it('renders bootstrapped screen parts and reacts to navigation, overlay, variable and display commands', async () => {
        const bootstrapTree = await createScenarioTree()
        await expect(bootstrapTree.getNode('ui-base-root-shell:primary')).resolves.toBeTruthy()
        await expect(bootstrapTree.getText('ui-base-runtime-react-test:state:primary'))
            .resolves.toBe('ui.base.runtime-react.test.home')
        await expect(bootstrapTree.getText('ui-base-runtime-react-test:state:secondary'))
            .resolves.toBe('ui.base.runtime-react.test.secondary')
        await expect(bootstrapTree.getText('ui-base-runtime-react-test:state:variable'))
            .resolves.toBe('bootstrapped')
        await expect(bootstrapTree.getText('ui-base-runtime-react-test:state:instance-mode'))
            .resolves.toBe('MASTER')
        await expect(bootstrapTree.getText('ui-base-runtime-react-test:state:display-mode'))
            .resolves.toBe('PRIMARY')
        await expect(bootstrapTree.getText('ui-base-runtime-react-test:state:workspace'))
            .resolves.toBe('MAIN')

        const navigateTree = await createScenarioTree()
        await navigateTree.press('ui-base-runtime-react-test:navigate-detail')
        await expect(navigateTree.getText('ui-base-runtime-react-test:state:primary'))
            .resolves.toBe('ui.base.runtime-react.test.detail')

        const replaceTree = await createScenarioTree()
        await replaceTree.press('ui-base-runtime-react-test:replace-detail')
        await expect(replaceTree.getText('ui-base-runtime-react-test:detail-label'))
            .resolves.toBe('detail-from-replace')

        const overlayTree = await createScenarioTree()
        await overlayTree.press('ui-base-runtime-react-test:open-modal')
        await expect(overlayTree.getText('ui-base-runtime-react-test:state:overlay-count'))
            .resolves.toBe('1')
        await expect(overlayTree.getNode('ui-base-runtime-react-test:modal')).resolves.toBeTruthy()
        await overlayTree.press('ui-base-runtime-react-test:close-modal')
        await expect(overlayTree.getText('ui-base-runtime-react-test:state:overlay-count'))
            .resolves.toBe('0')

        const variableTree = await createScenarioTree()
        await variableTree.press('ui-base-runtime-react-test:set-variable')
        await expect(variableTree.getText('ui-base-runtime-react-test:state:variable'))
            .resolves.toBe('value-from-button')
        await variableTree.press('ui-base-runtime-react-test:secondary-display')
        await expect(variableTree.getText('ui-base-runtime-react-test:state:display-mode'))
            .resolves.toBe('PRIMARY')
    })
})
