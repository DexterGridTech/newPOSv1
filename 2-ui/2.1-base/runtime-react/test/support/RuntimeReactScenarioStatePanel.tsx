import React from 'react'
import {Text, View} from 'react-native'
import {useSelector} from 'react-redux'
import type {RootState} from '@impos2/kernel-base-state-runtime'
import {
    selectTopologyDisplayMode,
    selectTopologyInstanceMode,
    selectTopologyRuntimeV2Connection,
    selectTopologyRuntimeV2PeerNodeId,
    selectTopologyRuntimeV2ServerConnected,
    selectTopologyWorkspace,
} from '@impos2/kernel-base-topology-runtime-v2'
import {
    selectUiOverlays,
    selectUiScreen,
    selectUiVariable,
} from '@impos2/kernel-base-ui-runtime-v2'
import {uiRuntimeRootVariables} from '../../src'
import {runtimeReactScenarioVariable} from './runtimeReactScenarioParts'

export const RuntimeReactScenarioStatePanel: React.FC = () => {
    const primary = useSelector((state: RootState) =>
        selectUiScreen(state, uiRuntimeRootVariables.primaryRootContainer.key),
    )
    const secondary = useSelector((state: RootState) =>
        selectUiScreen(state, uiRuntimeRootVariables.secondaryRootContainer.key),
    )
    const overlays = useSelector((state: RootState) => selectUiOverlays(state))
    const displayMode = useSelector(selectTopologyDisplayMode)
    const instanceMode = useSelector(selectTopologyInstanceMode)
    const workspace = useSelector(selectTopologyWorkspace)
    const peerNodeId = useSelector(selectTopologyRuntimeV2PeerNodeId)
    const serverConnected = useSelector(selectTopologyRuntimeV2ServerConnected)
    const connection = useSelector(selectTopologyRuntimeV2Connection)
    const variable = useSelector((state: RootState) =>
        selectUiVariable<string>(state, runtimeReactScenarioVariable.key),
    )

    return (
        <View testID="ui-base-runtime-react-test:state-panel">
            <Text testID="ui-base-runtime-react-test:state:primary">{primary?.partKey ?? 'null'}</Text>
            <Text testID="ui-base-runtime-react-test:state:secondary">{secondary?.partKey ?? 'null'}</Text>
            <Text testID="ui-base-runtime-react-test:state:overlay-count">{String(overlays.length)}</Text>
            <Text testID="ui-base-runtime-react-test:state:display-mode">{displayMode ?? 'null'}</Text>
            <Text testID="ui-base-runtime-react-test:state:instance-mode">{instanceMode ?? 'null'}</Text>
            <Text testID="ui-base-runtime-react-test:state:workspace">{workspace ?? 'null'}</Text>
            <Text testID="ui-base-runtime-react-test:state:server-connected">{String(serverConnected)}</Text>
            <Text testID="ui-base-runtime-react-test:state:server-connection-status">
                {connection?.serverConnectionStatus ?? 'null'}
            </Text>
            <Text testID="ui-base-runtime-react-test:state:connection-error">
                {connection?.connectionError ?? 'null'}
            </Text>
            <Text testID="ui-base-runtime-react-test:state:peer-node-id">{peerNodeId ?? 'null'}</Text>
            <Text testID="ui-base-runtime-react-test:state:variable">{variable ?? 'null'}</Text>
        </View>
    )
}
