import React from 'react'
import {Text, TouchableOpacity, View} from 'react-native'
import {createCommand} from '@impos2/kernel-base-runtime-shell-v2'
import {topologyRuntimeV3CommandDefinitions} from '@impos2/kernel-base-topology-runtime-v3'
import {
    defineUiModalPart,
    defineUiScreenPart,
    uiRuntimeRootVariables,
    useEditableUiVariable,
    useUiRuntime,
    useUiVariableValue,
    createUiNavigationBridge,
    type UiRuntimeVariable,
} from '../../src'

export const runtimeReactScenarioVariable: UiRuntimeVariable<string> = {
    key: 'ui.base.runtime-react.test.message',
    defaultValue: 'unset',
    persistence: 'transient',
}

export interface RuntimeReactScenarioScreenProps {
    label?: string
}

const ScenarioHomeScreen: React.FC<RuntimeReactScenarioScreenProps> = ({
    label = 'home',
}) => {
    const runtime = useUiRuntime()
    const bridge = createUiNavigationBridge(runtime)
    const editable = useEditableUiVariable(runtimeReactScenarioVariable)
    const value = useUiVariableValue(runtimeReactScenarioVariable)

    return (
        <View testID="ui-base-runtime-react-test:home">
            <Text>runtime-react home</Text>
            <Text testID="ui-base-runtime-react-test:home-label">{label}</Text>
            <Text testID="ui-base-runtime-react-test:variable-value">{value ?? 'null'}</Text>
            <TouchableOpacity
                testID="ui-base-runtime-react-test:navigate-detail"
                onPress={() => {
                    void bridge.navigateTo({
                        target: runtimeReactScenarioParts.detail,
                        props: {label: 'detail-from-navigate'},
                        source: 'runtime-react-test.home.navigate',
                    })
                }}
            >
                <Text>Navigate Detail</Text>
            </TouchableOpacity>
            <TouchableOpacity
                testID="ui-base-runtime-react-test:replace-detail"
                onPress={() => {
                    void bridge.replaceScreen({
                        target: runtimeReactScenarioParts.detail,
                        props: {label: 'detail-from-replace'},
                        source: 'runtime-react-test.home.replace',
                    })
                }}
            >
                <Text>Replace Detail</Text>
            </TouchableOpacity>
            <TouchableOpacity
                testID="ui-base-runtime-react-test:open-modal"
                onPress={() => {
                    void bridge.openModal({
                        target: runtimeReactScenarioParts.modal,
                        overlayId: 'runtime-react-test-modal',
                        props: {label: 'modal-opened'},
                    })
                }}
            >
                <Text>Open Modal</Text>
            </TouchableOpacity>
            <TouchableOpacity
                testID="ui-base-runtime-react-test:set-variable"
                onPress={() => {
                    void editable.setValue('value-from-button')
                }}
            >
                <Text>Set Variable</Text>
            </TouchableOpacity>
            <TouchableOpacity
                testID="ui-base-runtime-react-test:secondary-display"
                onPress={() => {
                    void runtime.dispatchCommand(createCommand(topologyRuntimeV3CommandDefinitions.setDisplayMode, {
                        displayMode: 'SECONDARY',
                    }))
                }}
            >
                <Text>Set Secondary Display</Text>
            </TouchableOpacity>
        </View>
    )
}

const ScenarioDetailScreen: React.FC<RuntimeReactScenarioScreenProps> = ({
    label = 'detail',
}) => (
    <View testID="ui-base-runtime-react-test:detail">
        <Text>runtime-react detail</Text>
        <Text testID="ui-base-runtime-react-test:detail-label">{label}</Text>
    </View>
)

const ScenarioSecondaryScreen: React.FC = () => (
    <View testID="ui-base-runtime-react-test:secondary">
        <Text>runtime-react secondary</Text>
    </View>
)

const ScenarioModal: React.FC<RuntimeReactScenarioScreenProps> = ({
    label = 'modal',
}) => {
    const runtime = useUiRuntime()
    const bridge = createUiNavigationBridge(runtime)

    return (
        <View testID="ui-base-runtime-react-test:modal">
            <Text>runtime-react modal</Text>
            <Text testID="ui-base-runtime-react-test:modal-label">{label}</Text>
            <TouchableOpacity
                testID="ui-base-runtime-react-test:close-modal"
                onPress={() => {
                    void bridge.closeModal('runtime-react-test-modal')
                }}
            >
                <Text>Close Modal</Text>
            </TouchableOpacity>
        </View>
    )
}

export const runtimeReactScenarioParts = {
    home: defineUiScreenPart<RuntimeReactScenarioScreenProps>({
        partKey: 'ui.base.runtime-react.test.home',
        rendererKey: 'ui.base.runtime-react.test.home',
        name: 'RuntimeReactTestHome',
        title: 'Runtime React Test Home',
        description: 'Test-only home screen for runtime-react navigation verification',
        containerKey: uiRuntimeRootVariables.primaryRootContainer.key,
        indexInContainer: 10,
        screenModes: ['DESKTOP', 'MOBILE'],
        workspaces: ['main', 'MAIN'],
        instanceModes: ['MASTER', 'SLAVE'],
        component: ScenarioHomeScreen,
    }),
    detail: defineUiScreenPart<RuntimeReactScenarioScreenProps>({
        partKey: 'ui.base.runtime-react.test.detail',
        rendererKey: 'ui.base.runtime-react.test.detail',
        name: 'RuntimeReactTestDetail',
        title: 'Runtime React Test Detail',
        description: 'Test-only detail screen for runtime-react navigation verification',
        containerKey: uiRuntimeRootVariables.primaryRootContainer.key,
        indexInContainer: 20,
        screenModes: ['DESKTOP', 'MOBILE'],
        workspaces: ['main', 'MAIN'],
        instanceModes: ['MASTER', 'SLAVE'],
        component: ScenarioDetailScreen,
    }),
    secondary: defineUiScreenPart({
        partKey: 'ui.base.runtime-react.test.secondary',
        rendererKey: 'ui.base.runtime-react.test.secondary',
        name: 'RuntimeReactTestSecondary',
        title: 'Runtime React Test Secondary',
        description: 'Test-only secondary screen for runtime-react dual-display verification',
        containerKey: uiRuntimeRootVariables.secondaryRootContainer.key,
        indexInContainer: 10,
        screenModes: ['DESKTOP', 'MOBILE'],
        workspaces: ['main', 'MAIN'],
        instanceModes: ['MASTER', 'SLAVE'],
        component: ScenarioSecondaryScreen,
    }),
    modal: defineUiModalPart<RuntimeReactScenarioScreenProps>({
        partKey: 'ui.base.runtime-react.test.modal',
        rendererKey: 'ui.base.runtime-react.test.modal',
        name: 'RuntimeReactTestModal',
        title: 'Runtime React Test Modal',
        description: 'Test-only modal for runtime-react overlay verification',
        screenModes: ['DESKTOP', 'MOBILE'],
        workspaces: ['main', 'MAIN'],
        instanceModes: ['MASTER', 'SLAVE'],
        component: ScenarioModal,
    }),
} as const

export const runtimeReactScenarioDefinitions = Object.values(runtimeReactScenarioParts)
    .map(part => part.definition)
