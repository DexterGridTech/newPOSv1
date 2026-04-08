import {tcpIdentityConfig} from './tcpIdentity'
import {tcpCredentialConfig} from './tcpCredential'
import {tcpBindingConfig} from './tcpBinding'
import {tcpRuntimeConfig} from './tcpRuntime'

export const kernelCoreTcpClientSlice = {
  tcpIdentity: tcpIdentityConfig,
  tcpCredential: tcpCredentialConfig,
  tcpBinding: tcpBindingConfig,
  tcpRuntime: tcpRuntimeConfig,
}

export {tcpIdentityActions} from './tcpIdentity'
export {tcpCredentialActions} from './tcpCredential'
export {tcpBindingActions} from './tcpBinding'
export {tcpRuntimeActions} from './tcpRuntime'
