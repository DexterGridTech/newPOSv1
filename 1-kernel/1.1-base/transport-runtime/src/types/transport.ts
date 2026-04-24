export type {
    ResolveTransportServerConfigOptions,
    TransportRequestContext,
    TransportServerAddress,
    TransportServerAddressOverride,
    TransportServerConfig,
    TransportServerConfigSpace,
    TransportServerDefinition,
    TransportServerOverride,
} from '@next/kernel-base-contracts'
import type {
    TransportServerAddress,
    TransportServerDefinition,
} from '@next/kernel-base-contracts'

export interface ServerCatalog {
    registerServer(server: TransportServerDefinition): void
    replaceServers(servers: readonly TransportServerDefinition[]): void
    resolveServer(serverName: string): TransportServerDefinition
    resolveAddresses(serverName: string): readonly TransportServerAddress[]
    listServerNames(): readonly string[]
    clear(): void
}
