import type {
    TransportServerConfig,
} from '@next/kernel-base-transport-runtime'
import {
    resolveTransportServers as resolveKernelTransportServers,
    type ResolveTransportServerConfigOptions,
    type TransportServerDefinition,
} from '@next/kernel-base-transport-runtime'

export const resolveTransportServers = (
    config: TransportServerConfig,
    options: ResolveTransportServerConfigOptions = {},
): readonly TransportServerDefinition[] =>
    resolveKernelTransportServers(config, options)
