import {createAppError} from '@next/kernel-base-contracts'
import {tcpControlV2ErrorDefinitions} from '../../supports'
import type {TcpControlHttpService} from '../../types'
import type {TerminalAssemblyCapabilityManifestV1} from '../../types'

export interface TcpControlServiceRefV2 {
    current?: TcpControlHttpService
    clientRuntime?: TerminalAssemblyCapabilityManifestV1
}

export const requireTcpControlHttpService = (
    serviceRef: TcpControlServiceRefV2,
): TcpControlHttpService => {
    if (!serviceRef.current) {
        throw createAppError(tcpControlV2ErrorDefinitions.bootstrapHydrationFailed, {
            args: {error: 'tcp control http service is not installed'},
        })
    }
    return serviceRef.current
}
