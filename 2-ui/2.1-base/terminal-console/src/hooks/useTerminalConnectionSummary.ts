import {shallowEqual, useSelector} from 'react-redux'
import {
    selectTcpCredentialSnapshot,
    selectTcpIdentitySnapshot,
} from '@impos2/kernel-base-tcp-control-runtime-v2'
import type {RootState} from '@impos2/kernel-base-state-runtime'
import type {TerminalConnectionSummary} from '../types'

export const useTerminalConnectionSummary = (): TerminalConnectionSummary =>
    useSelector<RootState, TerminalConnectionSummary>((state) => {
        const identity = selectTcpIdentitySnapshot(state)
        const credential = selectTcpCredentialSnapshot(state)

        return {
            status: identity.activationStatus,
            terminalId: identity.terminalId,
            activatedAt: identity.activatedAt as number | undefined,
            credentialStatus: credential.status,
            accessToken: credential.accessToken,
            refreshToken: credential.refreshToken,
            expiresAt: credential.expiresAt as number | undefined,
            updatedAt: credential.updatedAt as number | undefined,
            deviceId: identity.deviceInfo?.id as string | undefined,
            deviceModel: identity.deviceInfo?.model as string | undefined,
        }
    }, shallowEqual)
