import {
    createAdminConsoleModuleInputFromHost,
} from '@impos2/ui-base-admin-console/supports'
import type {
    AdapterDiagnosticScenario,
    AdminTopologyHost,
    AdminTopologySharePayload,
} from '@impos2/ui-base-admin-console/types'
import type {CreateAdminConsoleModuleInput} from '@impos2/ui-base-admin-console/application'
import {createCommand, type KernelRuntimeV2} from '@impos2/kernel-base-runtime-shell-v2'
import {
    selectTransportServerSpaceState,
} from '@impos2/kernel-base-transport-runtime'
import {kernelBaseDevServerConfig} from '@impos2/kernel-server-config-v2'
import {
    createTopologyV3MasterLocatorFromSharePayload,
    createTopologyV3SharePayload,
    topologyRuntimeV3CommandDefinitions,
} from '@impos2/kernel-base-topology-runtime-v3'
import {nativeLogger} from '../turbomodules/logger'
import {nativeAppControl} from '../turbomodules/appControl'
import {nativeConnector} from '../turbomodules/connector'
import {nativeDevice} from '../turbomodules/device'
import {nativeScriptExecutor} from '../turbomodules/scripts'
import {nativeTopologyHost} from '../turbomodules/topologyHost'
import {createAssemblyStateStorage} from '../platform-ports/stateStorage'
import {
    AssemblyTopologyBindingSource,
    AssemblyTopologyStorageGateSnapshot,
} from './topology'

const ADAPTER_KEY_DEVICE = 'device'
const ADAPTER_KEY_LOGGER = 'logger'
const ADAPTER_KEY_CONNECTOR = 'connector'
const ADAPTER_KEY_STORAGE = 'storage'
const ADAPTER_KEY_SCRIPTS = 'scripts'
const ADAPTER_KEY_TOPOLOGY = 'topology'
const ADAPTER_KEY_APPCONTROL = 'app-control'

export interface AssemblyAdminTopologyInput {
    bindingSource?: AssemblyTopologyBindingSource
    getTopologyContextSnapshot?: () => AssemblyTopologyStorageGateSnapshot
    getRuntime?: () => KernelRuntimeV2 | undefined
}

interface CreateAssemblyAdminConsoleInputOptions {
    topology?: AssemblyAdminTopologyInput
    getRuntime?: () => KernelRuntimeV2 | undefined
}

type TopologyDiagnosticsSnapshot = {
    hostRuntime?: {
        nodeId?: string
        deviceId?: string
    }
    peers?: Array<{
        role?: string
        nodeId?: string
        deviceId?: string
    }>
}

type TopologyHostStatus = {
    addressInfo?: {
        httpBaseUrl?: string
        wsUrl?: string
        localHttpBaseUrl?: string
        localWsUrl?: string
    }
}

const createAssemblyAdminTopologyHost = (
    input: AssemblyAdminTopologyInput | undefined,
): AdminTopologyHost | undefined => {
    const bindingSource = input?.bindingSource
    const getRuntime = input?.getRuntime
    if (!bindingSource) {
        return undefined
    }

    const dispatchTopologyCommand = async (
        command: ReturnType<typeof createCommand>,
    ): Promise<void> => {
        const runtime = getRuntime?.()
        if (!runtime?.dispatchCommand) {
            return
        }
        await runtime.dispatchCommand(command)
    }

    return {
        async getSharePayload(): Promise<AdminTopologySharePayload | null> {
            const [diagnosticsSnapshot, status] = await Promise.all([
                nativeTopologyHost.getDiagnosticsSnapshot() as Promise<TopologyDiagnosticsSnapshot | null>,
                nativeTopologyHost.getStatus() as Promise<TopologyHostStatus>,
            ])
            const masterPeer = diagnosticsSnapshot?.peers?.find(peer => peer.role === 'MASTER')
            const nodeId = diagnosticsSnapshot?.hostRuntime?.nodeId ?? masterPeer?.nodeId
            const deviceId = diagnosticsSnapshot?.hostRuntime?.deviceId ?? masterPeer?.deviceId
            const httpBaseUrl = status?.addressInfo?.httpBaseUrl
            const wsUrl = status?.addressInfo?.wsUrl
            if (!nodeId || !deviceId || (!httpBaseUrl && !wsUrl)) {
                return null
            }
            return createTopologyV3SharePayload({
                deviceId,
                masterNodeId: nodeId,
                wsUrl,
                httpBaseUrl,
            }) as AdminTopologySharePayload
        },
        async importSharePayload(payload): Promise<void> {
            const masterLocator = createTopologyV3MasterLocatorFromSharePayload(payload)
            bindingSource.set({
                role: 'slave',
                masterNodeId: masterLocator.masterNodeId,
                masterDeviceId: masterLocator.masterDeviceId,
                wsUrl: masterLocator.serverAddress[0]?.address,
                httpBaseUrl: masterLocator.httpBaseUrl,
            })
            await dispatchTopologyCommand(createCommand(
                topologyRuntimeV3CommandDefinitions.setInstanceMode,
                {
                    instanceMode: 'SLAVE',
                },
            ))
            await dispatchTopologyCommand(createCommand(
                topologyRuntimeV3CommandDefinitions.setMasterLocator,
                {
                    masterLocator: masterLocator as any,
                },
            ))
        },
        async clearMasterLocator(): Promise<void> {
            bindingSource.clear()
            await dispatchTopologyCommand(createCommand(
                topologyRuntimeV3CommandDefinitions.clearMasterLocator,
                {},
            ))
        },
        async reconnect(): Promise<void> {
            await dispatchTopologyCommand(createCommand(
                topologyRuntimeV3CommandDefinitions.restartTopologyConnection,
                {},
            ))
        },
        async stop(): Promise<void> {
            nativeLogger.log(
                'assembly.android.mixc-retail-rn84.topology',
                JSON.stringify({
                    event: 'topology-host-stop-requested',
                    source: 'admin-console',
                }),
            )
            await dispatchTopologyCommand(createCommand(
                topologyRuntimeV3CommandDefinitions.setEnableSlave,
                {enableSlave: false},
            ))
        },
        async getTopologyHostStatus(): Promise<Record<string, unknown> | null> {
            return await nativeTopologyHost.getStatus()
        },
        async getTopologyHostDiagnostics(): Promise<Record<string, unknown> | null> {
            return await nativeTopologyHost.getDiagnosticsSnapshot()
        },
    }
}

const createAdapterDiagnosticScenarios = (): readonly AdapterDiagnosticScenario[] => {
    const stateStorage = createAssemblyStateStorage('state')

    return [
        {
            adapterKey: ADAPTER_KEY_DEVICE,
            scenarioKey: 'device-info',
            title: '设备信息读取',
            async run() {
                const info = await nativeDevice.getDeviceInfo()
                return {
                    status: typeof info.id === 'string' && info.id.length > 0 ? 'passed' : 'failed',
                    message: typeof info.id === 'string' && info.id.length > 0 ? '设备信息可用' : '设备信息缺少 id',
                    detail: info,
                }
            },
        },
        {
            adapterKey: ADAPTER_KEY_DEVICE,
            scenarioKey: 'system-status',
            title: '系统状态读取',
            async run() {
                const status = await nativeDevice.getSystemStatus()
                return {
                    status: typeof status === 'object' && status != null ? 'passed' : 'failed',
                    message: '系统状态读取完成',
                    detail: status,
                }
            },
        },
        {
            adapterKey: ADAPTER_KEY_LOGGER,
            scenarioKey: 'write-and-list',
            title: '日志写入与读取',
            async run() {
                nativeLogger.log('assembly.android.mixc-retail-rn84.admin', 'adapter-diagnostics-log')
                const files = await nativeLogger.getLogFiles()
                return {
                    status: files.length > 0 ? 'passed' : 'failed',
                    message: files.length > 0 ? '日志文件列表可用' : '日志文件列表为空',
                    detail: {files},
                }
            },
        },
        {
            adapterKey: ADAPTER_KEY_CONNECTOR,
            scenarioKey: 'camera-availability',
            title: '摄像头通道探测',
            async run() {
                const available = await nativeConnector.isAvailable({
                    type: 'INTENT',
                    target: 'camera',
                    mode: 'request-response',
                })
                const targets = await nativeConnector.getAvailableTargets('INTENT')
                return {
                    status: available ? 'passed' : 'skipped',
                    message: available ? '摄像头通道可用' : '摄像头通道不可用',
                    detail: {available, targets},
                }
            },
        },
        {
            adapterKey: ADAPTER_KEY_CONNECTOR,
            scenarioKey: 'hid-availability',
            title: 'HID 目标探测',
            async run() {
                const targets = await nativeConnector.getAvailableTargets('HID')
                return {
                    status: targets.length > 0 ? 'passed' : 'skipped',
                    message: targets.length > 0 ? '发现 HID 目标' : '未发现 HID 目标',
                    detail: {targets},
                }
            },
        },
        {
            adapterKey: ADAPTER_KEY_STORAGE,
            scenarioKey: 'read-write',
            title: '状态存储读写',
            async run() {
                const key = 'admin.diagnostics.storage'
                const value = JSON.stringify({ok: true})
                await stateStorage.setItem(key, value)
                const saved = await stateStorage.getItem(key)
                await stateStorage.removeItem(key)
                return {
                    status: saved === value ? 'passed' : 'failed',
                    message: saved === value ? '存储读写正常' : '存储读写不一致',
                    detail: {saved},
                }
            },
        },
        {
            adapterKey: ADAPTER_KEY_SCRIPTS,
            scenarioKey: 'execute',
            title: '脚本执行',
            async run() {
                const result = await nativeScriptExecutor.execute<number>({
                    source: 'return params.left + params.right',
                    params: {left: 2, right: 3},
                })
                return {
                    status: result === 5 ? 'passed' : 'failed',
                    message: result === 5 ? '脚本执行成功' : '脚本返回值异常',
                    detail: {result},
                }
            },
        },
        {
            adapterKey: ADAPTER_KEY_TOPOLOGY,
            scenarioKey: 'host-status',
            title: '拓扑宿主状态',
            async run() {
                const status = await nativeTopologyHost.getStatus()
                return {
                    status: 'passed',
                    message: '拓扑宿主状态读取完成',
                    detail: status,
                }
            },
        },
        {
            adapterKey: ADAPTER_KEY_APPCONTROL,
            scenarioKey: 'control-state',
            title: '宿主控制状态',
            async run() {
                const [isFullScreen, isAppLocked] = await Promise.all([
                    nativeAppControl.isFullScreen(),
                    nativeAppControl.isAppLocked(),
                ])
                return {
                    status: 'passed',
                    message: '宿主控制状态读取完成',
                    detail: {isFullScreen, isAppLocked},
                }
            },
        },
    ]
}

export const createAssemblyAdminConsoleInput = (
    input: CreateAssemblyAdminConsoleInputOptions = {},
): CreateAdminConsoleModuleInput => ({
    ...createAdminConsoleModuleInputFromHost({
        device: {
            ...nativeDevice,
            getModel: nativeDevice.getModel,
            getDeviceInfo: nativeDevice.getDeviceInfo,
            getSystemStatus: nativeDevice.getSystemStatus,
        },
        logs: {
            getLogFiles: () => nativeLogger.getLogFiles(),
            getLogContent: (fileName: string) => nativeLogger.getLogContent(fileName, 1024 * 1024),
            deleteLogFile: (fileName: string) => nativeLogger.deleteLogFile(fileName),
            clearAllLogs: () => nativeLogger.clearAllLogs(),
            getLogDirPath: () => nativeLogger.getLogDirPath(),
        },
        control: {
            restartApp: () => nativeAppControl.restartApp(),
            clearCache: async () => {
                const stateStorage = createAssemblyStateStorage('state')
                const secureStateStorage = createAssemblyStateStorage('secure-state')
                await stateStorage.clear?.()
                await secureStateStorage.clear?.()
            },
            getServerSpaceSnapshot: async () => {
                const runtime = input.getRuntime?.()
                const runtimeState = runtime?.getState()
                const serverSpace = runtimeState
                    ? selectTransportServerSpaceState(runtimeState)
                    : undefined
                return {
                    selectedSpace: serverSpace?.selectedSpace ?? kernelBaseDevServerConfig.selectedSpace,
                    availableSpaces: serverSpace?.availableSpaces
                        ?? kernelBaseDevServerConfig.spaces.map(space => space.name),
                }
            },
            isFullScreen: () => nativeAppControl.isFullScreen(),
            isAppLocked: () => nativeAppControl.isAppLocked(),
            setFullScreen: (next: boolean) => nativeAppControl.setFullScreen(next),
            setAppLocked: (next: boolean) => nativeAppControl.setAppLocked(next),
        },
        connector: nativeConnector,
        connectorChannels: [
            {
                key: 'camera',
                title: '摄像头扫码',
                type: 'INTENT',
                target: 'camera',
                detail: '探测摄像头扫码意图通道。',
            },
            {
                key: 'system',
                title: '系统文件选择器',
                type: 'INTENT',
                target: 'system',
                detail: '探测系统文件选择器通道。',
            },
            {
                key: 'hid',
                title: 'HID 键盘',
                type: 'HID',
                target: 'keyboard',
                detail: '探测 HID 键盘或扫码枪通道。',
            },
        ],
        topology: createAssemblyAdminTopologyHost(input.topology),
    }),
    adapterDiagnosticScenarios: createAdapterDiagnosticScenarios(),
})
