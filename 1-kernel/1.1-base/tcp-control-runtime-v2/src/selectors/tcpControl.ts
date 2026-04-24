import {createSelector} from '@reduxjs/toolkit'
import type {RootState} from '@next/kernel-base-state-runtime'
import {
    TCP_BINDING_STATE_KEY,
    TCP_CREDENTIAL_STATE_KEY,
    TCP_IDENTITY_STATE_KEY,
    TCP_RUNTIME_STATE_KEY,
    TCP_SANDBOX_STATE_KEY,
} from '../foundations/stateKeys'
import type {
    TcpBindingContext,
    TcpBindingState,
    TcpCredentialSnapshot,
    TcpCredentialState,
    TcpIdentitySnapshot,
    TcpIdentityState,
    TcpRuntimeState,
    TcpSandboxSnapshot,
    TcpSandboxState,
} from '../types'

export const selectTcpIdentityState = (state: RootState) =>
    state[TCP_IDENTITY_STATE_KEY as keyof RootState] as TcpIdentityState | undefined

export const selectTcpCredentialState = (state: RootState) =>
    state[TCP_CREDENTIAL_STATE_KEY as keyof RootState] as TcpCredentialState | undefined

export const selectTcpBindingState = (state: RootState) =>
    state[TCP_BINDING_STATE_KEY as keyof RootState] as TcpBindingState | undefined

export const selectTcpRuntimeState = (state: RootState) =>
    state[TCP_RUNTIME_STATE_KEY as keyof RootState] as TcpRuntimeState | undefined

export const selectTcpSandboxState = (state: RootState) =>
    state[TCP_SANDBOX_STATE_KEY as keyof RootState] as TcpSandboxState | undefined

export const selectTcpIdentitySnapshot = createSelector(
    [selectTcpIdentityState],
    (tcpIdentity): TcpIdentitySnapshot => ({
        terminalId: tcpIdentity?.terminalId,
        deviceFingerprint: tcpIdentity?.deviceFingerprint,
        deviceInfo: tcpIdentity?.deviceInfo,
        activationStatus: tcpIdentity?.activationStatus ?? 'UNACTIVATED',
        activatedAt: tcpIdentity?.activatedAt,
    }),
)

export const selectTcpCredentialSnapshot = createSelector(
    [selectTcpCredentialState],
    (tcpCredential): TcpCredentialSnapshot => ({
        accessToken: tcpCredential?.accessToken,
        refreshToken: tcpCredential?.refreshToken,
        expiresAt: tcpCredential?.expiresAt,
        refreshExpiresAt: tcpCredential?.refreshExpiresAt,
        status: tcpCredential?.status ?? 'EMPTY',
        updatedAt: tcpCredential?.updatedAt,
    }),
)

export const selectTcpBindingSnapshot = createSelector(
    [selectTcpBindingState],
    (tcpBinding): TcpBindingContext => ({
        platformId: tcpBinding?.platformId,
        tenantId: tcpBinding?.tenantId,
        brandId: tcpBinding?.brandId,
        projectId: tcpBinding?.projectId,
        storeId: tcpBinding?.storeId,
        profileId: tcpBinding?.profileId,
        templateId: tcpBinding?.templateId,
    }),
)

export const selectTcpSandboxSnapshot = createSelector(
    [selectTcpSandboxState],
    (tcpSandbox): TcpSandboxSnapshot => ({
        sandboxId: tcpSandbox?.sandboxId,
        updatedAt: tcpSandbox?.updatedAt,
    }),
)

export const selectTcpTerminalId = (state: RootState) =>
    selectTcpIdentitySnapshot(state).terminalId

export const selectTcpAccessToken = (state: RootState) =>
    selectTcpCredentialSnapshot(state).accessToken

export const selectTcpRefreshToken = (state: RootState) =>
    selectTcpCredentialSnapshot(state).refreshToken

export const selectTcpSandboxId = (state: RootState) =>
    selectTcpSandboxSnapshot(state).sandboxId

export const selectTcpIsActivated = (state: RootState) =>
    selectTcpIdentitySnapshot(state).activationStatus === 'ACTIVATED'
