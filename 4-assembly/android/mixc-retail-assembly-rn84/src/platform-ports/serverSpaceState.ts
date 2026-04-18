import type {TransportServerConfigSpace} from '@impos2/kernel-base-transport-runtime'
import {
    kernelBaseDevServerConfig,
    SERVER_NAME_MOCK_TERMINAL_PLATFORM,
} from '@impos2/kernel-server-config-v2'

/**
 * 设计意图：
 * server-config-v2 负责提供静态候选空间；assembly 负责维护“当前运行中选中哪个空间”。
 * 这样 admin-console 可以切换空间，而 createApp / HTTP runtime 只消费统一查询接口。
 */
const availableSpaces = [...kernelBaseDevServerConfig.spaces]
let selectedSpaceName = kernelBaseDevServerConfig.selectedSpace

const ensureSpace = (
    spaceName: string,
): TransportServerConfigSpace => {
    const matched = availableSpaces.find(item => item.name === spaceName)
    if (!matched) {
        throw new Error(`Unknown assembly server space: ${spaceName}`)
    }
    return matched
}

export const getAssemblyServerSpaceSnapshot = (): {
    selectedSpace: string
    availableSpaces: readonly string[]
} => ({
    selectedSpace: selectedSpaceName,
    availableSpaces: availableSpaces.map(item => item.name),
})

export const setAssemblySelectedServerSpace = (
    spaceName: string,
): void => {
    ensureSpace(spaceName)
    selectedSpaceName = spaceName
}

export const getAssemblySelectedServerSpace = (): TransportServerConfigSpace =>
    ensureSpace(selectedSpaceName)

export const resolveAssemblyTransportServers = (
    options: {
        mockTerminalPlatformBaseUrl?: string
        selectedSpace?: string
    } = {},
) => {
    const selectedSpace = ensureSpace(options.selectedSpace ?? selectedSpaceName)
    if (!options.mockTerminalPlatformBaseUrl) {
        return selectedSpace.servers
    }
    return selectedSpace.servers.map(server => server.serverName === SERVER_NAME_MOCK_TERMINAL_PLATFORM
        ? {
            ...server,
            addresses: server.addresses.map((address, index) => index === 0
                ? {
                    ...address,
                    baseUrl: options.mockTerminalPlatformBaseUrl as string,
                }
                : address),
        }
        : server)
}

export const resetAssemblyServerSpaceStateForTests = (): void => {
    selectedSpaceName = kernelBaseDevServerConfig.selectedSpace
}
