import type {
    ServerCatalog,
    TransportServerDefinition,
} from '../types/transport'
import {createTransportConfigurationError} from './shared'

export const createServerCatalog = (): ServerCatalog => {
    /**
     * 设计意图：
     * ServerCatalog 只保存“服务器名 -> 地址列表”的运行时配置，不内置任何业务服务名。
     * 地址切换、失败重试和有效地址保持由 HTTP runtime 使用 catalog 完成，server-config-v2 只负责提供配置数据。
     */
    const servers = new Map<string, TransportServerDefinition>()

    const ensureServer = (serverName: string): TransportServerDefinition => {
        const server = servers.get(serverName)
        if (!server) {
            throw createTransportConfigurationError(`Server not found: ${serverName}`, {serverName})
        }
        if (!server.addresses.length) {
            throw createTransportConfigurationError(`Server has no addresses: ${serverName}`, {serverName})
        }
        return server
    }

    return {
        registerServer(server) {
            if (!server.addresses.length) {
                throw createTransportConfigurationError(`Server has no addresses: ${server.serverName}`, {
                    serverName: server.serverName,
                })
            }

            servers.set(server.serverName, server)
        },
        replaceServers(nextServers) {
            nextServers.forEach(server => {
                if (!server.addresses.length) {
                    throw createTransportConfigurationError(`Server has no addresses: ${server.serverName}`, {
                        serverName: server.serverName,
                    })
                }
            })

            servers.clear()
            nextServers.forEach(server => {
                servers.set(server.serverName, server)
            })
        },
        resolveServer(serverName) {
            return ensureServer(serverName)
        },
        resolveAddresses(serverName) {
            return ensureServer(serverName).addresses
        },
        listServerNames() {
            return Array.from(servers.keys())
        },
        clear() {
            servers.clear()
        },
    }
}
