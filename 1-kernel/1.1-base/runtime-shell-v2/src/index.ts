import {packageVersion} from './generated/packageVersion'

/**
 * 设计意图：
 * runtime-shell-v2 是新版 kernel 的唯一运行时外壳，统一装配模块、Redux state、Command/Actor 广播执行、request ledger 和参数目录。
 * 上层模块只通过公开的 command、actor、state slice、selector、parameter/error definition 接入，不再并列创建多个全局 manager。
 */
export {moduleName} from './moduleName'
export {packageVersion}

export {
    createKernelRuntimeApp,
    createKernelRuntimeV2,
    createRuntimeModuleLifecycleLogger,
    createModuleCommandFactory,
    createModuleActorFactory,
    defineKernelRuntimeModuleV2,
    defineKernelRuntimeModuleManifestV2,
    defineModuleActor,
    deriveKernelRuntimeModuleDescriptorV2,
    resolveKernelRuntimeModuleOrderV2,
} from './application'
export {createCommand, defineCommand} from './foundations/command'
export {onCommand} from './foundations/actor'
export {
    runtimeShellV2CommandDefinitions,
    runtimeShellV2CommandNames,
} from './features/commands'
export {
    runtimeShellV2StateActions,
    runtimeShellV2StateSlices,
    RUNTIME_SHELL_V2_ERROR_CATALOG_STATE_KEY,
    RUNTIME_SHELL_V2_PARAMETER_CATALOG_STATE_KEY,
} from './features/slices'
export {
    selectRuntimeShellV2ErrorCatalog,
    selectRuntimeShellV2ParameterCatalog,
} from './selectors'
export type {
    ActorCommandHandler,
    ActorCommandHandlerDefinition,
    ActorCommandHandlerDefinitionFor,
    ActorDefinition,
    ActorDispatchOptions,
    ActorExecutionContext,
    ActorExecutionResult,
    ActorInfo,
    AnyActorCommandHandlerDefinition,
    CommandAggregateResult,
    CommandAggregateStatus,
    CommandDefinition,
    CommandIntent,
    CommandQueryResult,
    CommandQueryStatus,
    CommandTarget,
    CommandVisibility,
    CreateKernelRuntimeV2Input,
    DefineCommandInput,
    DispatchOptions,
    DispatchedCommand,
    KernelRuntimeAppConfigV2,
    KernelRuntimeAppDescriptorV2,
    KernelRuntimeAppV2,
    KernelRuntimeModuleDescriptorV2,
    KernelRuntimeModuleV2,
    KernelRuntimeV2,
    PeerDispatchGateway,
    RegisteredActorHandler,
    RequestListener,
    RequestQueryResult,
    RequestQueryStatus,
    RuntimeModuleContextV2,
    RuntimeModulePreSetupContextV2,
} from './types'
export type {KernelRuntimeModuleManifestV2} from './supports/moduleDsl'
