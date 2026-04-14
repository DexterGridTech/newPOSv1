import {packageVersion} from './generated/packageVersion'

/**
 * 设计意图：
 * topology-runtime-v2 合并旧拓扑客户端能力，负责主副机连接、远程 command 投递、request lifecycle 镜像和 state sync。
 * 它只维护“活的控制面”与必要恢复信息；业务状态仍由各自 slice 通过 state-runtime 的 syncIntent 参与同步。
 */
export {moduleName} from './moduleName'
export {packageVersion}

export {topologyRuntimeV2ModuleManifest} from './application/moduleManifest'
export {
    createTopologyRuntimeModuleV2,
    topologyRuntimeModuleV2Descriptor,
    topologyRuntimeV2PreSetup,
} from './application/createModule'
export {
    topologyRuntimeV2CommandDefinitions,
    topologyRuntimeV2CommandNames,
    topologyCommandDefinitions,
    topologyCommandNames,
} from './features/commands'
export {
    topologyRuntimeV2StateActions,
    topologyRuntimeV2StateSlices,
} from './features/slices'
export {
    topologyRuntimeV2ErrorDefinitions,
    topologyRuntimeV2ErrorDefinitionList,
} from './supports/errors'
export {
    topologyRuntimeV2ParameterDefinitions,
    topologyRuntimeV2ParameterDefinitionList,
} from './supports/parameters'
export {
    selectTopologyRuntimeV2Connection,
    selectTopologyRuntimeV2Context,
    selectTopologyRuntimeV2DisplayMode,
    selectTopologyRuntimeV2EnableSlave,
    selectTopologyRuntimeV2InstanceMode,
    selectTopologyRuntimeV2MasterInfo,
    selectTopologyRuntimeV2Peer,
    selectTopologyRuntimeV2PeerConnected,
    selectTopologyRuntimeV2PeerNodeId,
    selectTopologyRuntimeV2ProjectionState,
    selectTopologyRuntimeV2RequestProjection,
    selectTopologyRuntimeV2ServerConnected,
    selectTopologyRuntimeV2Sync,
    selectTopologyRuntimeV2Standalone,
    selectTopologyRuntimeV2Workspace,
    selectTopologyDisplayMode,
    selectTopologyInstanceMode,
    selectTopologyWorkspace,
} from './selectors'
export type {
    NodeHello,
    NodeRuntimeInfo,
    ProjectionMirrorEnvelope,
} from '@impos2/kernel-base-contracts'
export type {
    CreateTopologyRuntimeModuleV2Input,
    TopologyRuntimeV2Assembly,
    TopologyV2ConnectionState,
    TopologyV2ContextState,
    TopologyV2MasterInfo,
    TopologyV2ProjectionState,
    TopologyRuntimeV2SocketBinding,
    TopologyV2SyncState,
} from './types'
