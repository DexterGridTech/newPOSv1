import type {
    AppControlPort,
    ConnectorPort,
    DevicePort,
    HotUpdatePort,
    PlatformPorts,
} from '@next/kernel-base-platform-ports'
import type {
    AdminAppControlHost,
    AdminConnectorHost,
    AdminConnectorProbeResult,
    AdminControlSnapshot,
    AdminDeviceHost,
    AdminDeviceSnapshot,
    AdminDetailItem,
    AdminHostTools,
    AdminLogFileSummary,
    AdminLogHost,
    AdminStatusItem,
    AdminStatusTone,
    AdminTopologyHost,
    AdminVersionHost,
    AdminVersionSnapshot,
} from '../types'

export interface AdminDeviceHostSource extends Partial<DevicePort> {
    getDeviceInfo?(): Promise<Record<string, unknown>>
    getSystemStatus?(): Promise<Record<string, unknown>>
}

export interface AdminLogHostSource {
    getLogFiles(): Promise<readonly Record<string, unknown>[]>
    getLogContent(fileName: string): Promise<string>
    deleteLogFile(fileName: string): Promise<void | boolean>
    clearAllLogs(): Promise<void | boolean>
    getLogDirPath(): Promise<string | undefined>
}

export interface AdminControlHostSource extends Partial<AppControlPort> {
    isFullScreen?(): Promise<boolean>
    isAppLocked?(): Promise<boolean>
    setFullScreen?(next: boolean): Promise<void>
    setAppLocked?(next: boolean): Promise<void>
    clearCache?(): Promise<void>
    getServerSpaceSnapshot?(): Promise<{
        selectedSpace?: string
        availableSpaces?: readonly string[]
    }>
}

export interface AdminConnectorChannelDefinition {
    key: string
    title: string
    type?: string
    target?: string
    detail?: string
    channel?: Record<string, unknown>
    action?: string
    params?: Record<string, unknown>
    timeoutMs?: number
}

export interface AdminConnectorHostSource extends Partial<ConnectorPort> {
    isAvailable?(channel: Record<string, unknown>): Promise<boolean>
    getAvailableTargets?(type: string): Promise<readonly string[]>
}

export interface AdminVersionHostSource {
    hotUpdate?: Partial<HotUpdatePort>
    embeddedRelease?: unknown
}

export interface CreateAdminConnectorHostInput {
    connector: AdminConnectorHostSource
    channels?: readonly AdminConnectorChannelDefinition[]
}

export interface CreateAdminHostToolsInput {
    platformPorts?: Partial<PlatformPorts>
    device?: AdminDeviceHostSource
    logs?: AdminLogHostSource
    control?: AdminControlHostSource
    connector?: AdminConnectorHostSource
    connectorChannels?: readonly AdminConnectorChannelDefinition[]
    topology?: AdminTopologyHost
    version?: AdminVersionHostSource | AdminVersionHost
}

const toRecord = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {}

const readString = (
    record: Record<string, unknown>,
    key: string,
): string | undefined => {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) {
        return value
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
        return `${value}`
    }
    return undefined
}

const readNumber = (
    record: Record<string, unknown>,
    key: string,
): number | undefined => {
    const value = record[key]
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

const detail = (
    key: string,
    label: string,
    value: AdminDetailItem['value'],
): AdminDetailItem => ({
    key,
    label,
    value,
})

const countStatus = (
    key: string,
    label: string,
    value: unknown,
): AdminStatusItem | undefined => {
    if (!Array.isArray(value)) {
        return undefined
    }
    return {
        key,
        label,
        tone: value.length > 0 ? 'ok' : 'neutral',
        value: `${value.length}`,
    }
}

const compactDetails = (
    items: readonly AdminDetailItem[],
): readonly AdminDetailItem[] =>
    items.filter(item => item.value !== undefined && item.value !== null && item.value !== '')

const compactStatuses = (
    items: readonly (AdminStatusItem | undefined)[],
): readonly AdminStatusItem[] =>
    items.filter((item): item is AdminStatusItem => Boolean(item))

const createCapabilityStatus = (
    key: string,
    label: string,
    supported: boolean,
): AdminStatusItem => ({
    key,
    label,
    tone: supported ? 'ok' : 'neutral',
    value: supported ? '已支持' : '未提供',
})

const buildStatusDetails = (
    status: Record<string, unknown>,
): readonly AdminDetailItem[] => {
    const cpu = toRecord(status.cpu)
    const memory = toRecord(status.memory)
    const disk = toRecord(status.disk)
    const power = toRecord(status.power)

    return compactDetails([
        detail('cpu.app', 'CPU 使用率', readNumber(cpu, 'app')),
        detail('cpu.cores', 'CPU 核心数', readNumber(cpu, 'cores')),
        detail('memory.app', '应用内存 MB', readNumber(memory, 'app')),
        detail('memory.total', '总内存 MB', readNumber(memory, 'total')),
        detail('disk.available', '可用磁盘 GB', readNumber(disk, 'available')),
        detail('disk.total', '总磁盘 GB', readNumber(disk, 'total')),
        detail('power.connected', '电源连接', power.powerConnected as boolean | undefined),
        detail('power.level', '电量', readNumber(power, 'batteryLevel')),
        detail('updatedAt', '采集时间', readNumber(status, 'updatedAt')),
    ])
}

const toRecordArray = (value: unknown): readonly Record<string, unknown>[] =>
    Array.isArray(value)
        ? value
            .map(item => toRecord(item))
            .filter(item => Object.keys(item).length > 0)
        : []

export const createAdminDeviceHost = (
    source: AdminDeviceHostSource,
): AdminDeviceHost => ({
    async getSnapshot(): Promise<AdminDeviceSnapshot> {
        const [deviceId, platform, model, deviceInfo, systemStatus] = await Promise.all([
            source.getDeviceId?.(),
            source.getPlatform?.(),
            source.getModel?.(),
            source.getDeviceInfo?.(),
            source.getSystemStatus?.(),
        ])
        const info = toRecord(deviceInfo)
        const status = toRecord(systemStatus)

        return {
            identity: compactDetails([
                detail('deviceId', '设备ID', deviceId ?? readString(info, 'id')),
                detail('platform', '平台', platform ?? readString(info, 'os')),
                detail('model', '型号', model ?? readString(info, 'model')),
                detail('manufacturer', '制造商', readString(info, 'manufacturer')),
                detail('osVersion', '系统版本', readString(info, 'osVersion')),
            ]),
            runtime: compactDetails([
                detail('cpu', 'CPU', readString(info, 'cpu')),
                detail('memory', '内存', readString(info, 'memory')),
                detail('disk', '磁盘', readString(info, 'disk')),
                detail('network', '网络', readString(info, 'network')),
                detail('displayCount', '屏幕数量', Array.isArray(info.displays) ? info.displays.length : undefined),
                ...buildStatusDetails(status),
            ]),
            peripherals: compactStatuses([
                countStatus('usb', 'USB 设备', status.usbDevices),
                countStatus('bluetooth', '蓝牙设备', status.bluetoothDevices),
                countStatus('serial', '串口设备', status.serialDevices),
                countStatus('networks', '网络连接', status.networks),
                countStatus('apps', '安装应用', status.installedApps),
            ]),
            resourceDetails: {
                usbDevices: toRecordArray(status.usbDevices),
                bluetoothDevices: toRecordArray(status.bluetoothDevices),
                serialDevices: toRecordArray(status.serialDevices),
                networks: toRecordArray(status.networks),
                installedApps: toRecordArray(status.installedApps),
            },
        }
    },
})

export const createAdminLogHost = (
    source: AdminLogHostSource,
): AdminLogHost => ({
    async listFiles(): Promise<readonly AdminLogFileSummary[]> {
        const files = await source.getLogFiles()
        return files.map(file => ({
            fileName: readString(file, 'fileName') ?? readString(file, 'name') ?? 'unknown.log',
            fileSizeBytes: readNumber(file, 'fileSize') ?? readNumber(file, 'fileSizeBytes'),
            lastModifiedAt: readNumber(file, 'lastModified') ?? readNumber(file, 'lastModifiedAt'),
        }))
    },
    readFile(fileName) {
        return source.getLogContent(fileName)
    },
    deleteFile(fileName) {
        return source.deleteLogFile(fileName)
    },
    clearAll() {
        return source.clearAllLogs()
    },
    getDirectoryPath() {
        return source.getLogDirPath()
    },
})

export const createAdminControlHost = (
    source: AdminControlHostSource,
): AdminAppControlHost => ({
    async getSnapshot(): Promise<AdminControlSnapshot> {
        const [isFullScreen, isAppLocked, serverSpaceSnapshot] = await Promise.all([
            source.isFullScreen?.(),
            source.isAppLocked?.(),
            source.getServerSpaceSnapshot?.(),
        ])

        return {
            isFullScreen,
            isAppLocked,
            selectedSpace: serverSpaceSnapshot?.selectedSpace,
            availableSpaces: serverSpaceSnapshot?.availableSpaces,
            supportsRestart: Boolean(source.restartApp),
            supportsClearCache: Boolean(source.clearDataCache || source.clearCache),
            supportsLockControl: Boolean(source.setAppLocked),
            supportsFullScreenControl: Boolean(source.setFullScreen),
        }
    },
    setFullScreen: source.setFullScreen
        ? next => source.setFullScreen?.(next) ?? Promise.resolve()
        : undefined,
    setAppLocked: source.setAppLocked
        ? next => source.setAppLocked?.(next) ?? Promise.resolve()
        : undefined,
    restartApp: source.restartApp
        ? () => source.restartApp?.() ?? Promise.resolve()
        : undefined,
    clearCache: source.clearDataCache
        ? () => source.clearDataCache?.() ?? Promise.resolve()
        : source.clearCache
            ? () => source.clearCache?.() ?? Promise.resolve()
            : undefined,
})

const buildConnectorChannel = (
    definition: AdminConnectorChannelDefinition,
): Record<string, unknown> => ({
    type: definition.type,
    target: definition.target,
    mode: 'request-response',
    ...(definition.channel ?? {}),
})

const normalizeProbeResult = (
    channelKey: string,
    value: unknown,
): AdminConnectorProbeResult => {
    const record = toRecord(value)
    if (typeof record.success === 'boolean') {
        return {
            channelKey,
            tone: record.success ? 'ok' : 'warn',
            message: readString(record, 'message') ?? (record.success ? '通道可用' : '通道不可用'),
        }
    }
    return {
        channelKey,
        tone: 'ok',
        message: '探测完成',
    }
}

const toProbeTone = (available: boolean): AdminStatusTone => available ? 'ok' : 'warn'

export const createAdminConnectorHost = (
    input: CreateAdminConnectorHostInput,
): AdminConnectorHost => ({
    async getChannels() {
        const fromDefinition = input.channels ?? []
        const dynamicChannels = await Promise.all(
            fromDefinition
                .filter(channel => channel.type && input.connector.getAvailableTargets)
                .map(async channel => {
                    const targets = await input.connector.getAvailableTargets?.(channel.type ?? '')
                    return (targets ?? []).map(target => ({
                        key: `${channel.key}:${target}`,
                        title: `${channel.title}: ${target}`,
                        target,
                        detail: channel.detail,
                        channel: {
                            ...buildConnectorChannel(channel),
                            target,
                        },
                        action: channel.action,
                        params: channel.params,
                        timeoutMs: channel.timeoutMs,
                    }))
                }),
        )

        return [
            ...fromDefinition,
            ...dynamicChannels.flat(),
        ].map(channel => ({
            key: channel.key,
            title: channel.title,
            target: channel.target,
            detail: channel.detail,
        }))
    },
    async probe(channelKey: string): Promise<AdminConnectorProbeResult> {
        const definitions = input.channels ?? []
        const channelDefinition = definitions.find(item => item.key === channelKey)
        const dynamicParent = definitions.find(item => channelKey.startsWith(`${item.key}:`))
        const definition = channelDefinition ?? dynamicParent
        if (!definition) {
            return {
                channelKey,
                tone: 'error',
                message: `未知连接器通道: ${channelKey}`,
            }
        }

        const dynamicTarget = channelDefinition ? undefined : channelKey.slice(`${definition.key}:`.length)
        const channel = {
            ...buildConnectorChannel(definition),
            ...(dynamicTarget ? {target: dynamicTarget} : {}),
        }

        if (input.connector.isAvailable) {
            const available = await input.connector.isAvailable(channel)
            return {
                channelKey,
                tone: toProbeTone(available),
                message: available ? '通道可用' : '通道不可用',
            }
        }

        if (input.connector.call && definition.action) {
            const output = await input.connector.call({
                channel,
                action: definition.action,
                params: definition.params,
                timeoutMs: definition.timeoutMs,
            })
            return normalizeProbeResult(channelKey, output)
        }

        return {
            channelKey,
            tone: 'warn',
            message: '连接器未提供可探测能力',
        }
    },
})

const isAdminVersionHost = (
    source: AdminVersionHostSource | AdminVersionHost,
): source is AdminVersionHost =>
    typeof (source as AdminVersionHost).getSnapshot === 'function'

const createReleaseDetail = (
    value: unknown,
): readonly AdminDetailItem[] | undefined => {
    const release = toRecord(value)
    if (!release || Object.keys(release).length === 0) {
        return undefined
    }
    const git = toRecord(release.git)
    return compactDetails([
        detail('appId', 'App ID', readString(release, 'appId')),
        detail('platform', '平台', readString(release, 'platform')),
        detail('assemblyVersion', 'Assembly 版本', readString(release, 'assemblyVersion')),
        detail('buildNumber', 'Build Number', readNumber(release, 'buildNumber')),
        detail('runtimeVersion', 'Runtime 版本', readString(release, 'runtimeVersion')),
        detail('bundleVersion', 'Bundle 版本', readString(release, 'bundleVersion')),
        detail('channel', '发布通道', readString(release, 'channel')),
        detail('minSupportedAppVersion', '最低支持版本', readString(release, 'minSupportedAppVersion')),
        detail('gitCommit', 'Git Commit', readString(git, 'commit')),
        detail('gitBranch', 'Git Branch', readString(git, 'branch')),
        detail('updatedAt', '生成时间', readString(release, 'updatedAt') ?? readString(release, 'generatedAt')),
    ])
}

export const createAdminVersionHost = (
    source: AdminVersionHostSource,
): AdminVersionHost => {
    const hotUpdate = source.hotUpdate

    return {
        async getSnapshot(): Promise<AdminVersionSnapshot> {
            const [boot, active, rollback] = await Promise.all([
                hotUpdate?.readBootMarker?.() ?? Promise.resolve(null),
                hotUpdate?.readActiveMarker?.() ?? Promise.resolve(null),
                hotUpdate?.readRollbackMarker?.() ?? Promise.resolve(null),
            ])

            return {
                embeddedRelease: createReleaseDetail(source.embeddedRelease),
                nativeMarkers: {
                    boot,
                    active,
                    rollback,
                },
                capabilities: compactStatuses([
                    createCapabilityStatus('readBootMarker', '读取 Boot Marker', Boolean(hotUpdate?.readBootMarker)),
                    createCapabilityStatus('readActiveMarker', '读取 Active Marker', Boolean(hotUpdate?.readActiveMarker)),
                    createCapabilityStatus('readRollbackMarker', '读取 Rollback Marker', Boolean(hotUpdate?.readRollbackMarker)),
                    createCapabilityStatus('clearBootMarker', '清除 Boot Marker', Boolean(hotUpdate?.clearBootMarker)),
                    createCapabilityStatus('confirmLoadComplete', '确认加载完成', Boolean(hotUpdate?.confirmLoadComplete)),
                    createCapabilityStatus('reportLoadComplete', '上报加载完成', Boolean(hotUpdate?.reportLoadComplete)),
                ]),
            }
        },
        clearBootMarker: hotUpdate?.clearBootMarker
            ? () => hotUpdate.clearBootMarker?.() ?? Promise.resolve()
            : undefined,
    }
}

export const createAdminHostTools = (
    input: CreateAdminHostToolsInput,
): AdminHostTools => {
    const device = input.device ?? input.platformPorts?.device
    const control = input.control ?? input.platformPorts?.appControl
    const connector = input.connector ?? input.platformPorts?.connector
    const versionSource = input.version ?? (input.platformPorts?.hotUpdate
        ? {hotUpdate: input.platformPorts.hotUpdate}
        : undefined)

    return {
        device: device ? createAdminDeviceHost(device) : undefined,
        logs: input.logs ? createAdminLogHost(input.logs) : undefined,
        control: control ? createAdminControlHost(control) : undefined,
        connector: connector ? createAdminConnectorHost({
            connector,
            channels: input.connectorChannels,
        }) : undefined,
        topology: input.topology,
        version: versionSource
            ? isAdminVersionHost(versionSource)
                ? versionSource
                : createAdminVersionHost(versionSource)
            : undefined,
    }
}
