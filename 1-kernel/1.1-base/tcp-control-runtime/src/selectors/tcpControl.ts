import type {RootState} from '@impos2/kernel-base-state-runtime'
import {
    TCP_BINDING_STATE_KEY,
    TCP_CREDENTIAL_STATE_KEY,
    TCP_IDENTITY_STATE_KEY,
    TCP_RUNTIME_STATE_KEY,
} from '../foundations/stateKeys'
import type {
    TcpBindingContext,
    TcpBindingState,
    TcpCredentialSnapshot,
    TcpCredentialState,
    TcpIdentitySnapshot,
    TcpIdentityState,
    TcpRuntimeState,
} from '../types'

export const selectTcpIdentityState = (state: RootState) =>
    state[TCP_IDENTITY_STATE_KEY as keyof RootState] as TcpIdentityState | undefined

export const selectTcpCredentialState = (state: RootState) =>
    state[TCP_CREDENTIAL_STATE_KEY as keyof RootState] as TcpCredentialState | undefined

export const selectTcpBindingState = (state: RootState) =>
    state[TCP_BINDING_STATE_KEY as keyof RootState] as TcpBindingState | undefined

export const selectTcpRuntimeState = (state: RootState) =>
    state[TCP_RUNTIME_STATE_KEY as keyof RootState] as TcpRuntimeState | undefined

export const selectTcpIdentitySnapshot = (state: RootState): TcpIdentitySnapshot => {
    const tcpIdentity = selectTcpIdentityState(state)
    return {
        terminalId: tcpIdentity?.terminalId,
        deviceFingerprint: tcpIdentity?.deviceFingerprint,
        deviceInfo: tcpIdentity?.deviceInfo,
        activationStatus: tcpIdentity?.activationStatus ?? 'UNACTIVATED',
        activatedAt: tcpIdentity?.activatedAt,
    }
}

export const selectTcpCredentialSnapshot = (state: RootState): TcpCredentialSnapshot => {
    const tcpCredential = selectTcpCredentialState(state)
    return {
        accessToken: tcpCredential?.accessToken,
        refreshToken: tcpCredential?.refreshToken,
        expiresAt: tcpCredential?.expiresAt,
        refreshExpiresAt: tcpCredential?.refreshExpiresAt,
        status: tcpCredential?.status ?? 'EMPTY',
        updatedAt: tcpCredential?.updatedAt,
    }
}

export const selectTcpBindingSnapshot = (state: RootState): TcpBindingContext => {
    const tcpBinding = selectTcpBindingState(state)
    return {
        platformId: tcpBinding?.platformId,
        tenantId: tcpBinding?.tenantId,
        brandId: tcpBinding?.brandId,
        projectId: tcpBinding?.projectId,
        storeId: tcpBinding?.storeId,
        profileId: tcpBinding?.profileId,
        templateId: tcpBinding?.templateId,
    }
}

export const selectTcpTerminalId = (state: RootState) =>
    selectTcpIdentitySnapshot(state).terminalId

export const selectTcpAccessToken = (state: RootState) =>
    selectTcpCredentialSnapshot(state).accessToken

export const selectTcpRefreshToken = (state: RootState) =>
    selectTcpCredentialSnapshot(state).refreshToken

export const selectTcpIsActivated = (state: RootState) =>
    selectTcpIdentitySnapshot(state).activationStatus === 'ACTIVATED'
