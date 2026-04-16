import React from 'react'
import {describe, expect, it} from 'vitest'
import {act} from 'react-test-renderer'
import {
    createRuntimeReactHarness,
    renderWithStore,
} from '../support/runtimeReactHarness'
import {createRuntimeReactScenarioModule} from '../support/runtimeReactScenarioModule'
import {RuntimeReactScenarioStatePanel} from '../support/RuntimeReactScenarioStatePanel'
import {UiRuntimeRootShell} from '../../src'
import {textOf} from '../support/testRendererText'

const createScenarioTree = async () => {
    const harness = await createRuntimeReactHarness({
        modules: [createRuntimeReactScenarioModule()],
        displayContext: {
            displayIndex: 0,
            displayCount: 2,
        },
    })

    return renderWithStore(
        <>
            <RuntimeReactScenarioStatePanel />
            <UiRuntimeRootShell />
        </>,
        harness.store,
        harness.runtime,
    )
}

const expectText = (
    tree: ReturnType<typeof renderWithStore>,
    testID: string,
    expected: string,
) => {
    expect(textOf(tree.root.findByProps({testID}))).toBe(expected)
}

describe('runtime-react command flow', () => {
    it('renders bootstrapped screen parts and reacts to navigation, overlay, variable and display commands', async () => {
        const bootstrapTree = await createScenarioTree()
        expectText(bootstrapTree, 'ui-base-runtime-react-test:state:primary', 'ui.base.runtime-react.test.home')
        expectText(bootstrapTree, 'ui-base-runtime-react-test:state:secondary', 'ui.base.runtime-react.test.secondary')
        expectText(bootstrapTree, 'ui-base-runtime-react-test:state:variable', 'bootstrapped')
        expectText(bootstrapTree, 'ui-base-runtime-react-test:state:instance-mode', 'MASTER')
        expectText(bootstrapTree, 'ui-base-runtime-react-test:state:display-mode', 'PRIMARY')
        expectText(bootstrapTree, 'ui-base-runtime-react-test:state:workspace', 'MAIN')

        const navigateTree = await createScenarioTree()
        await act(async () => {
            navigateTree.root.findByProps({testID: 'ui-base-runtime-react-test:navigate-detail'}).props.onPress()
        })
        expectText(navigateTree, 'ui-base-runtime-react-test:state:primary', 'ui.base.runtime-react.test.detail')

        const replaceTree = await createScenarioTree()
        await act(async () => {
            replaceTree.root.findByProps({testID: 'ui-base-runtime-react-test:replace-detail'}).props.onPress()
        })
        expectText(replaceTree, 'ui-base-runtime-react-test:detail-label', 'detail-from-replace')

        const overlayTree = await createScenarioTree()
        await act(async () => {
            overlayTree.root.findByProps({testID: 'ui-base-runtime-react-test:open-modal'}).props.onPress()
        })
        expectText(overlayTree, 'ui-base-runtime-react-test:state:overlay-count', '1')
        expect(() => overlayTree.root.findByProps({testID: 'ui-base-runtime-react-test:modal'})).not.toThrow()
        await act(async () => {
            overlayTree.root.findByProps({testID: 'ui-base-runtime-react-test:close-modal'}).props.onPress()
        })
        expectText(overlayTree, 'ui-base-runtime-react-test:state:overlay-count', '0')

        const variableTree = await createScenarioTree()
        await act(async () => {
            variableTree.root.findByProps({testID: 'ui-base-runtime-react-test:set-variable'}).props.onPress()
        })
        expectText(variableTree, 'ui-base-runtime-react-test:state:variable', 'value-from-button')
        await act(async () => {
            variableTree.root.findByProps({testID: 'ui-base-runtime-react-test:secondary-display'}).props.onPress()
        })
        expectText(variableTree, 'ui-base-runtime-react-test:state:display-mode', 'SECONDARY')
    })
})
