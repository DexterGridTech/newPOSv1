import type {
    ResolveTransportServerConfigOptions,
    TransportServerAddress,
    TransportServerAddressOverride,
    TransportServerConfig,
    TransportServerDefinition,
} from '../types/transport'

const cloneAddress = (address: TransportServerAddress): TransportServerAddress => ({
    ...address,
    metadata: address.metadata == null ? undefined : {...address.metadata},
})

const toAddress = (
    override: TransportServerAddressOverride,
    fallback?: TransportServerAddress,
): TransportServerAddress => ({
    addressName: override.addressName ?? fallback?.addressName ?? 'dynamic',
    baseUrl: override.baseUrl,
    timeoutMs: override.timeoutMs ?? fallback?.timeoutMs,
    metadata: override.metadata == null ? fallback?.metadata : {...override.metadata},
})

export const resolveTransportServers = (
    config: TransportServerConfig,
    options: ResolveTransportServerConfigOptions = {},
): readonly TransportServerDefinition[] => {
    const spaceName = options.selectedSpace ?? config.selectedSpace
    const space = config.spaces.find(item => item.name === spaceName)
    if (space == null) {
        throw new Error(`Server config space not found: ${spaceName}`)
    }

    return space.servers.map(server => {
        const baseUrlOverride = options.baseUrlOverrides?.[server.serverName]
        const serverOverride = options.serverOverrides?.[server.serverName]
        const firstAddress = server.addresses[0]

        const addresses = serverOverride?.addresses != null
            ? serverOverride.addresses.map(address => toAddress(address, firstAddress))
            : baseUrlOverride == null
                ? server.addresses.map(cloneAddress)
                : [{
                    ...cloneAddress(firstAddress),
                    baseUrl: baseUrlOverride,
                }]

        return {
            serverName: server.serverName,
            addresses,
            metadata: serverOverride?.metadata == null
                ? server.metadata == null ? undefined : {...server.metadata}
                : {...serverOverride.metadata},
        }
    })
}
