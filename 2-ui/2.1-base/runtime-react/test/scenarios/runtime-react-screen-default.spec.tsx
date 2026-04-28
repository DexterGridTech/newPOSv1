import React from 'react'
import {View} from 'react-native'
import {describe, expect, it} from 'vitest'
import {
    selectUiScreen,
} from '@next/kernel-base-ui-runtime-v2'
import {
    createUiNavigationBridge,
    defineUiScreenPart,
    uiRuntimeRootVariables,
    useUiScreenOrSetDefault,
} from '../../src'
import {createRuntimeReactHarness, renderWithAutomation} from '../support/runtimeReactHarness'

const flush = () => new Promise(resolve => setTimeout(resolve, 0))

const defaultPart = defineUiScreenPart<{label: string}>({
    partKey: 'ui.base.runtime-react.test.default-screen',
    rendererKey: 'ui.base.runtime-react.test.default-screen',
    name: 'RuntimeReactTestDefaultScreen',
    title: 'Runtime React Test Default Screen',
    description: 'Test-only default screen for runtime-react navigation initialization',
    containerKey: uiRuntimeRootVariables.primaryRootContainer.key,
    screenModes: ['DESKTOP', 'MOBILE'],
    workspaces: ['main', 'MAIN'],
    instanceModes: ['MASTER', 'SLAVE'],
    component: () => <View />,
})

const existingPart = defineUiScreenPart<{label: string}>({
    partKey: 'ui.base.runtime-react.test.existing-screen',
    rendererKey: 'ui.base.runtime-react.test.existing-screen',
    name: 'RuntimeReactTestExistingScreen',
    title: 'Runtime React Test Existing Screen',
    description: 'Test-only existing screen for runtime-react navigation initialization',
    containerKey: uiRuntimeRootVariables.primaryRootContainer.key,
    screenModes: ['DESKTOP', 'MOBILE'],
    workspaces: ['main', 'MAIN'],
    instanceModes: ['MASTER', 'SLAVE'],
    component: () => <View />,
})

const mismatchedContainerPart = defineUiScreenPart<{label: string}>({
    partKey: 'ui.base.runtime-react.test.mismatched-container-screen',
    rendererKey: 'ui.base.runtime-react.test.mismatched-container-screen',
    name: 'RuntimeReactTestMismatchedContainerScreen',
    title: 'Runtime React Test Mismatched Container Screen',
    description: 'Test-only mismatched screen for runtime-react navigation initialization',
    containerKey: uiRuntimeRootVariables.secondaryRootContainer.key,
    screenModes: ['DESKTOP', 'MOBILE'],
    workspaces: ['main', 'MAIN'],
    instanceModes: ['MASTER', 'SLAVE'],
    component: () => <View />,
})

const DefaultInitializer: React.FC<{
    enabled?: boolean
}> = ({enabled = true}) => {
    useUiScreenOrSetDefault({
        containerPart: uiRuntimeRootVariables.primaryRootContainer,
        defaultTarget: defaultPart,
        defaultProps: {label: 'default'},
        enabled,
        source: 'runtime-react-screen-default.spec',
    })
    return <View testID="ui-base-runtime-react-test:default-initializer" />
}

const MismatchedDefaultInitializer = () => {
    useUiScreenOrSetDefault({
        containerPart: uiRuntimeRootVariables.primaryRootContainer,
        defaultTarget: mismatchedContainerPart,
        defaultProps: {label: 'mismatched'},
        source: 'runtime-react-screen-default.spec.mismatched',
    })
    return <View testID="ui-base-runtime-react-test:mismatched-default-initializer" />
}

describe('useUiScreenOrSetDefault', () => {
    it('initializes the container with the default screen when runtime state is empty', async () => {
        const harness = await createRuntimeReactHarness()
        renderWithAutomation(<DefaultInitializer />, harness.store, harness.runtime)

        await flush()

        expect(selectUiScreen(harness.runtime.getState(), uiRuntimeRootVariables.primaryRootContainer.key))
            .toMatchObject({
                partKey: defaultPart.definition.partKey,
                props: {label: 'default'},
                source: 'runtime-react-screen-default.spec',
            })
    })

    it('does not overwrite an existing runtime screen', async () => {
        const harness = await createRuntimeReactHarness()
        const navigation = createUiNavigationBridge(harness.runtime)
        await navigation.navigateTo({
            target: existingPart,
            props: {label: 'existing'},
            source: 'runtime-react-screen-default.spec.existing',
        })

        renderWithAutomation(<DefaultInitializer />, harness.store, harness.runtime)
        await flush()

        expect(selectUiScreen(harness.runtime.getState(), uiRuntimeRootVariables.primaryRootContainer.key))
            .toMatchObject({
                partKey: existingPart.definition.partKey,
                props: {label: 'existing'},
                source: 'runtime-react-screen-default.spec.existing',
            })
    })

    it('does not initialize the container while disabled', async () => {
        const harness = await createRuntimeReactHarness()
        renderWithAutomation(<DefaultInitializer enabled={false} />, harness.store, harness.runtime)

        await flush()

        expect(selectUiScreen(harness.runtime.getState(), uiRuntimeRootVariables.primaryRootContainer.key))
            .toBeUndefined()
    })

    it('does not initialize when the default target belongs to a different container', async () => {
        const harness = await createRuntimeReactHarness()
        renderWithAutomation(<MismatchedDefaultInitializer />, harness.store, harness.runtime)

        await flush()

        expect(selectUiScreen(harness.runtime.getState(), uiRuntimeRootVariables.primaryRootContainer.key))
            .toBeUndefined()
        expect(selectUiScreen(harness.runtime.getState(), uiRuntimeRootVariables.secondaryRootContainer.key))
            .toBeUndefined()
    })
})
