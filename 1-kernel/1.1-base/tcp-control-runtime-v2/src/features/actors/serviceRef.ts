import {createAppError} from '@next/kernel-base-contracts'
import {tcpControlV2ErrorDefinitions} from '../../supports'
import type {TcpControlHttpService} from '../../types'

export interface TcpControlServiceRefV2 {
    current?: TcpControlHttpService
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
