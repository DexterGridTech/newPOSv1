import {kernelCoreTcpClientState} from './shared'
import type {
  TcpBindingState,
  TcpCredentialState,
  TcpIdentityState,
  TcpRuntimeState,
} from './state'

export interface KernelCoreTcpClientState {
  [kernelCoreTcpClientState.tcpIdentity]: TcpIdentityState
  [kernelCoreTcpClientState.tcpCredential]: TcpCredentialState
  [kernelCoreTcpClientState.tcpBinding]: TcpBindingState
  [kernelCoreTcpClientState.tcpRuntime]: TcpRuntimeState
}
