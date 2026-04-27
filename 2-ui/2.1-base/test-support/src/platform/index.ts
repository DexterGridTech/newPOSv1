import type {
    LogScope,
    PlatformPorts,
    TopologyHostAddressInfo,
    TopologyHostStatus,
} from '@next/kernel-base-platform-ports'
import {createBrowserConsoleLogger} from '../logger'
import {createTestStoragePair, type TestStorageMode} from '../storage'

const trimTrailingSlash = (value: string): string =>
    value.endsWith('/') ? value.slice(0, -1) : value

const toWsUrl = (httpBaseUrl: string): string =>
    `${trimTrailingSlash(httpBaseUrl)
        .replace(/^http:/, 'ws:')
        .replace(/^https:/, 'wss:')}/ws`

const toStatusLabel = (state: unknown): 'RUNNING' | 'STOPPED' =>
    typeof state === 'string' && state.toLowerCase() === 'running'
        ? 'RUNNING'
        : 'STOPPED'

export interface CreateExternalTopologyHostPortInput {
    httpBaseUrl: string
    wsUrl?: string
    fetchImpl?: typeof fetch
}

export const createExternalTopologyHostPort = (
    input: CreateExternalTopologyHostPortInput,
): NonNullable<PlatformPorts['topologyHost']> => {
    const fetchImpl = input.fetchImpl ?? fetch
    const addressInfo: TopologyHostAddressInfo = {
        httpBaseUrl: trimTrailingSlash(input.httpBaseUrl),
        wsUrl: input.wsUrl ? trimTrailingSlash(input.wsUrl) : toWsUrl(input.httpBaseUrl),
    }
    let started = false

    const fetchJson = async <T,>(path: string): Promise<T> => {
        const response = await fetchImpl(`${addressInfo.httpBaseUrl}${path}`)
        if (!response.ok) {
            throw new Error(`topology host ${path} failed: HTTP ${response.status}`)
        }
        return await response.json() as T
    }

    return {
        async start(): Promise<TopologyHostAddressInfo> {
            await fetchJson('/status')
            started = true
            return addressInfo
        },
        async stop(): Promise<void> {
            started = false
        },
        async getStatus(): Promise<TopologyHostStatus> {
            try {
                const status = await fetchJson<Record<string, unknown>>('/status')
                const state = status.state
                return {
                    ...status,
                    status: toStatusLabel(state),
                    running: toStatusLabel(state) === 'RUNNING',
                    externallyManaged: true,
                    started,
                    addressInfo,
                }
            } catch (error) {
                return {
                    status: 'STOPPED',
                    running: false,
                    externallyManaged: true,
                    started,
                    addressInfo,
                    error: error instanceof Error ? error.message : String(error),
                }
            }
        },
        async getDiagnosticsSnapshot(): Promise<Record<string, unknown> | null> {
            try {
                return await fetchJson<Record<string, unknown>>('/diagnostics')
            } catch (error) {
                return {
                    error: error instanceof Error ? error.message : String(error),
                }
            }
        },
    }
}

export interface CreateExpoWebPlatformPortsInput {
    deviceId: string
    deviceModel?: string
    environmentMode?: PlatformPorts['environmentMode']
    loggerScope: LogScope
    storageMode?: TestStorageMode
    storageNamespace: string
    topologyHost?: PlatformPorts['topologyHost']
    onRestartApp?: () => void | Promise<void>
}

export const createExpoWebPlatformPorts = (
    input: CreateExpoWebPlatformPortsInput,
): Partial<PlatformPorts> => {
    const storagePair = createTestStoragePair({
        mode: input.storageMode ?? 'localStorage',
        namespace: input.storageNamespace,
    })

    return {
        environmentMode: input.environmentMode ?? 'DEV',
        logger: createBrowserConsoleLogger({
            environmentMode: input.environmentMode ?? 'DEV',
            scope: input.loggerScope,
        }),
        stateStorage: storagePair.stateStorage,
        secureStateStorage: storagePair.secureStateStorage,
        device: {
            async getDeviceId() {
                return input.deviceId
            },
            async getPlatform() {
                return 'expo-web'
            },
            async getModel() {
                return input.deviceModel ?? 'Expo Web Mock Device'
            },
        },
        topologyHost: input.topologyHost,
        appControl: {
            async restartApp() {
                await input.onRestartApp?.()
            },
        },
    }
}
