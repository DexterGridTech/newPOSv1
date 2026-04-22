import type {
    TransportServerConfig,
} from '@impos2/kernel-base-transport-runtime'
import {
    resolveTransportServers as resolveKernelTransportServers,
    type ResolveTransportServerConfigOptions,
    type TransportServerDefinition,
} from '@impos2/kernel-base-transport-runtime'

export const resolveTransportServers = (
    config: TransportServerConfig,
    options: ResolveTransportServerConfigOptions = {},
): readonly TransportServerDefinition[] =>
    resolveKernelTransportServers(config, options)
