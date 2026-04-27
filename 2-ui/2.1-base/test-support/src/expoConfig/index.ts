import type {TransportServerConfig, TransportServerDefinition} from '@next/kernel-base-transport-runtime'
import {resolveTransportServers} from '@next/kernel-base-transport-runtime'
import {
    kernelBaseDevServerConfig,
    kernelBaseTestServerConfig,
    SERVER_NAME_DUAL_TOPOLOGY_HOST_V3,
    SERVER_NAME_MOCK_TERMINAL_PLATFORM,
} from '@next/kernel-server-config-v2'
import {overrideServerBaseUrl} from '../transport'

export interface ExpoWebTestShellEnvironment {
    dualTopologyHostBaseUrl: string
    dualTopologyHostWsUrl: string
    mockPlatformBaseUrl: string
    mockPlatformSandboxId: string
    serverConfigProfile: 'dev' | 'test'
    storageMode: 'localStorage' | 'memory'
}

export interface ActivationCodeRecord {
    code: string
    status: string
}

const normalizeProfile = (value: string | undefined): 'dev' | 'test' =>
    value === 'test' ? 'test' : 'dev'

const normalizeStorageMode = (value: string | undefined): 'localStorage' | 'memory' =>
    value === 'memory' ? 'memory' : 'localStorage'

const trimTrailingSlash = (value: string): string =>
    value.endsWith('/') ? value.slice(0, -1) : value

export const readExpoWebTestShellEnvironment = (
    env: Record<string, string | undefined> = process.env,
): ExpoWebTestShellEnvironment => ({
    dualTopologyHostBaseUrl: env.EXPO_PUBLIC_DUAL_TOPOLOGY_HOST_BASE_URL ?? '',
    dualTopologyHostWsUrl: env.EXPO_PUBLIC_DUAL_TOPOLOGY_HOST_WS_URL ?? '',
    mockPlatformBaseUrl: env.EXPO_PUBLIC_MOCK_PLATFORM_BASE_URL ?? '',
    mockPlatformSandboxId: env.EXPO_PUBLIC_MOCK_PLATFORM_SANDBOX_ID ?? '',
    serverConfigProfile: normalizeProfile(env.EXPO_PUBLIC_SERVER_CONFIG_PROFILE),
    storageMode: normalizeStorageMode(
        env.EXPO_PUBLIC_TEST_STORAGE_MODE
        ?? env.EXPO_PUBLIC_CATERING_SHELL_STORAGE_MODE,
    ),
})

export const resolveExpoWebServerConfig = (
    profile: 'dev' | 'test',
): TransportServerConfig => profile === 'test'
    ? kernelBaseTestServerConfig
    : kernelBaseDevServerConfig

export const resolveExpoWebTransportServers = (input: {
    mockPlatformBaseUrl?: string
    serverConfigProfile: 'dev' | 'test'
}): readonly TransportServerDefinition[] => overrideServerBaseUrl(
    resolveTransportServers(resolveExpoWebServerConfig(input.serverConfigProfile)),
    SERVER_NAME_MOCK_TERMINAL_PLATFORM,
    input.mockPlatformBaseUrl,
)

export const resolveExpoWebDualTopologyHostAddress = (input: {
    dualTopologyHostBaseUrl?: string
    dualTopologyHostWsUrl?: string
    serverConfigProfile: 'dev' | 'test'
}): {
    httpBaseUrl?: string
    wsUrl?: string
} => {
    const httpBaseUrl = input.dualTopologyHostBaseUrl
        || resolveTransportServers(resolveExpoWebServerConfig(input.serverConfigProfile))
            .find(item => item.serverName === SERVER_NAME_DUAL_TOPOLOGY_HOST_V3)
            ?.addresses[0]?.baseUrl
    return {
        httpBaseUrl,
        wsUrl: input.dualTopologyHostWsUrl
            || (httpBaseUrl
                ? `${trimTrailingSlash(httpBaseUrl).replace(/^http:/, 'ws:').replace(/^https:/, 'wss:')}/ws`
                : undefined),
    }
}

export const resolveExpoWebActivationHelperBaseUrl = (input: {
    mockPlatformBaseUrl?: string
    serverConfigProfile: 'dev' | 'test'
}): string | undefined => {
    if (input.mockPlatformBaseUrl) {
        return input.mockPlatformBaseUrl
    }
    return resolveExpoWebTransportServers(input)
        .find(item => item.serverName === SERVER_NAME_MOCK_TERMINAL_PLATFORM)
        ?.addresses[0]?.baseUrl
}

export const fetchExpoWebActivationCode = async (input: {
    baseUrl?: string
    fetchImpl?: typeof fetch
    sandboxId?: string
}): Promise<string> => {
    if (!input.baseUrl) {
        return ''
    }
    const fetchImpl = input.fetchImpl ?? fetch
    const response = await fetchImpl(
        `${input.baseUrl}/api/v1/admin/activation-codes${input.sandboxId
            ? `?sandboxId=${encodeURIComponent(input.sandboxId)}`
            : ''}`,
    )
    const payload = await response.json() as {
        success: boolean
        data?: ActivationCodeRecord[]
        error?: {message: string}
    }
    if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? `HTTP ${response.status}`)
    }
    return payload.data?.find(item => item.status === 'AVAILABLE')?.code ?? ''
}

export const tryFetchExpoWebActivationCode = async (input: {
    baseUrl?: string
    fetchImpl?: typeof fetch
    logger?: Pick<Console, 'warn'>
    logPrefix?: string
    sandboxId?: string
}): Promise<string> => {
    try {
        return await fetchExpoWebActivationCode(input)
    } catch (error) {
        input.logger?.warn(
            `${input.logPrefix ?? '[expo-test-shell]'} activation code helper unavailable`,
            error,
        )
        return ''
    }
}
