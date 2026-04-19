import {packageVersion} from './generated/packageVersion'

/**
 * 设计意图：
 * tdp-sync-runtime-v2 是终端数据平面的同步仓库，负责 TDP session、projection 全量本地仓库、优先级生效快照和 topic 变更广播。
 * 其他业务包只消费通用 topicDataChanged 语义；除基础 error/parameter catalog 桥接外，这里不主动调用业务模块 command。
 */
export {moduleName} from './moduleName'
export {packageVersion}

export {tdpSyncRuntimeV2ModuleManifest} from './application/moduleManifest'
export {
    createTdpSyncRuntimeModuleV2,
    tdpSyncRuntimeModuleV2Descriptor,
    tdpSyncRuntimeV2PreSetup,
} from './application/createModule'
export {
    tdpSyncV2CommandDefinitions,
    tdpSyncV2CommandNames,
} from './features/commands'
export {
    createTdpHotUpdateStateForTests,
    reduceHotUpdateDesired,
    tdpHotUpdateActions,
    tdpSyncV2StateActions,
    tdpSyncV2StateSlices,
} from './features/slices'
export {
    tdpSyncV2ErrorDefinitions,
    tdpSyncV2ErrorDefinitionList,
} from './supports/errors'
export {
    tdpSyncV2ParameterDefinitions,
    tdpSyncV2ParameterDefinitionList,
} from './supports/parameters'
export {tdpSyncV2SocketProfile} from './supports/socketProfile'
export {TDP_SYNC_V2_SOCKET_PROFILE_NAME} from './foundations/socketBinding'
export {
    HOT_UPDATE_REJECT_REASONS,
    TDP_HOT_UPDATE_ITEM_KEY,
    TDP_HOT_UPDATE_SCHEMA_VERSION,
    TDP_HOT_UPDATE_TOPIC,
} from './foundations/hotUpdateTopic'
export {evaluateHotUpdateCompatibility} from './foundations/hotUpdateCompatibility'
export {reconcileHotUpdateDesiredFromResolvedProjection} from './foundations/hotUpdateProjectionReducer'
export {buildHotUpdateVersionReportPayload} from './foundations/hotUpdateVersionReporter'
export {
    createDefaultTdpSyncHttpRuntimeV2,
    installTdpSessionConnectionRuntimeV2,
} from './foundations/sessionConnectionRuntime'
export {createTdpSyncHttpServiceV2} from './foundations/httpService'
export {
    selectTdpHotUpdateCandidate,
    selectTdpHotUpdateCurrent,
    selectTdpHotUpdateDesired,
    selectTdpHotUpdateReady,
    selectTdpHotUpdateState,
    selectTerminalGroupMembership,
    selectTdpCommandInboxState,
    selectTdpControlSignalsState,
    selectTdpProjectionByTopicAndBucket,
    selectTdpProjectionEntriesByTopic,
    selectTdpResolvedProjection,
    selectTdpResolvedProjectionByTopic,
    selectTdpProjectionState,
    selectTdpSessionState,
    selectTdpSyncState,
} from './selectors'
export type {
    CreateTdpSyncRuntimeModuleV2Input,
    HotUpdateAppliedVersion,
    HotUpdateCandidateState,
    HotUpdateCompatibility,
    HotUpdateCompatibilityResult,
    HotUpdateCurrentFacts,
    HotUpdateHistoryItem,
    HotUpdateReadyState,
    HotUpdateState,
    TerminalHotUpdateDesiredV1,
    TdpChangesResponse,
    TdpClientMessage,
    TdpCommandInboxItem,
    TdpProjectionEnvelope,
    TdpProjectionState,
    TdpServerMessage,
    TdpSessionConnectionRuntimeRefV2,
    TdpSessionConnectionRuntimeV2,
    TdpSessionState,
    TdpSnapshotResponse,
    TdpSyncHttpServiceV2,
    TdpSyncRuntimeAssemblyV2,
    TdpSyncSocketBindingV2,
    TdpSyncState,
    TdpTerminalGroupMembershipPayload,
    TdpTopicDataChangeItem,
    TdpTopicDataChangedPayload,
} from './types'
