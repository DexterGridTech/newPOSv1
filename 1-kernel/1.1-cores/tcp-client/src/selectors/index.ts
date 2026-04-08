import type {RootState} from '@impos2/kernel-core-base'
import type {
  TcpBindingContext,
  TcpCredentialSnapshot,
  TcpIdentitySnapshot,
  TcpBindingState,
  TcpCredentialState,
  TcpIdentityState,
  TcpRuntimeState,
} from '../types'
import {kernelCoreTcpClientState} from '../types'

const fromValue = <T>(entry?: {value: T}) => entry?.value

export const selectTcpIdentityState = (state: RootState): TcpIdentityState =>
  state[kernelCoreTcpClientState.tcpIdentity as keyof RootState] as TcpIdentityState

export const selectTcpCredentialState = (state: RootState): TcpCredentialState =>
  state[kernelCoreTcpClientState.tcpCredential as keyof RootState] as TcpCredentialState

export const selectTcpBindingState = (state: RootState): TcpBindingState =>
  state[kernelCoreTcpClientState.tcpBinding as keyof RootState] as TcpBindingState

export const selectTcpRuntimeState = (state: RootState): TcpRuntimeState =>
  state[kernelCoreTcpClientState.tcpRuntime as keyof RootState] as TcpRuntimeState

export const selectTcpIdentitySnapshot = (state: RootState): TcpIdentitySnapshot => {
  const tcpIdentity = selectTcpIdentityState(state)
  return {
    terminalId: fromValue(tcpIdentity?.terminalId),
    deviceFingerprint: fromValue(tcpIdentity?.deviceFingerprint),
    deviceInfo: fromValue(tcpIdentity?.deviceInfo),
    activationStatus: fromValue(tcpIdentity?.activationStatus) ?? 'UNACTIVATED',
    activatedAt: fromValue(tcpIdentity?.activatedAt),
  }
}

export const selectTcpCredentialSnapshot = (state: RootState): TcpCredentialSnapshot => {
  const tcpCredential = selectTcpCredentialState(state)
  return {
    accessToken: fromValue(tcpCredential?.accessToken),
    refreshToken: fromValue(tcpCredential?.refreshToken),
    expiresAt: fromValue(tcpCredential?.expiresAt),
    refreshExpiresAt: fromValue(tcpCredential?.refreshExpiresAt),
    status: fromValue(tcpCredential?.status) ?? 'EMPTY',
    updatedAt: fromValue(tcpCredential?.updatedAt),
  }
}

export const selectTcpBindingSnapshot = (state: RootState): TcpBindingContext => {
  const tcpBinding = selectTcpBindingState(state)
  return {
    platformId: fromValue(tcpBinding?.platformId),
    tenantId: fromValue(tcpBinding?.tenantId),
    brandId: fromValue(tcpBinding?.brandId),
    projectId: fromValue(tcpBinding?.projectId),
    storeId: fromValue(tcpBinding?.storeId),
    profileId: fromValue(tcpBinding?.profileId),
    templateId: fromValue(tcpBinding?.templateId),
  }
}

export const selectTcpTerminalId = (state: RootState): string | undefined =>
  selectTcpIdentitySnapshot(state).terminalId

export const selectTcpAccessToken = (state: RootState): string | undefined =>
  selectTcpCredentialSnapshot(state).accessToken

export const selectTcpRefreshToken = (state: RootState): string | undefined =>
  selectTcpCredentialSnapshot(state).refreshToken

export const selectTcpIsActivated = (state: RootState): boolean =>
  selectTcpIdentitySnapshot(state).activationStatus === 'ACTIVATED'
