import {packageVersion} from './generated/packageVersion'

/**
 * 设计意图：
 * tcp-control-runtime-v2 负责终端控制平面：激活终端、刷新凭证、上报任务结果，并把最小恢复状态落入 kernel state。
 * 它通过 transport-runtime 调 HTTP，通过 runtime-shell-v2 暴露 command/actor，不直接绑定具体 mock-server 或平台实现。
 */
export {moduleName} from './moduleName'
export {packageVersion}

export {tcpControlRuntimeV2ModuleManifest} from './application/moduleManifest'
export {
    createTcpControlRuntimeModuleV2,
    createDefaultTcpControlHttpRuntimeV2,
    tcpControlRuntimeModuleV2Descriptor,
    tcpControlRuntimeV2PreSetup,
} from './application/createModule'
export {
    tcpControlV2CommandDefinitions,
    tcpControlV2CommandNames,
} from './features/commands'
export {
    tcpControlV2StateActions,
    tcpControlV2StateSlices,
} from './features/slices'
export {
    tcpControlV2ErrorDefinitions,
    tcpControlV2ErrorDefinitionList,
} from './supports/errors'
export {
    tcpControlV2ParameterDefinitions,
    tcpControlV2ParameterDefinitionList,
} from './supports/parameters'
export {
    selectTcpAccessToken,
    selectTcpBindingState,
    selectTcpBindingSnapshot,
    selectTcpCredentialSnapshot,
    selectTcpCredentialState,
    selectTcpIdentitySnapshot,
    selectTcpIdentityState,
    selectTcpIsActivated,
    selectTcpRefreshToken,
    selectTcpRuntimeState,
    selectTcpTerminalId,
} from './selectors'
export type {
    ActivateTerminalApiRequest,
    ActivateTerminalApiResponse,
    CreateTcpControlRuntimeModuleV2Input,
    DeactivateTerminalApiRequest,
    DeactivateTerminalApiResponse,
    RefreshTerminalCredentialApiRequest,
    RefreshTerminalCredentialApiResponse,
    ReportTaskResultApiRequest,
    ReportTaskResultApiResponse,
    TcpBindingState,
    TcpControlHttpService,
    TcpControlRuntimeAssemblyV2,
    TcpCredentialState,
    TcpIdentityState,
    TcpPlatformEnvelope,
    TcpRuntimeState,
} from './types'
