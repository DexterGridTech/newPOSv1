export * from './tcpIdentity'
export * from './tcpCredential'
export * from './tcpBinding'
export * from './tcpRuntime'

import {tcpBindingActions, tcpBindingSliceDescriptor} from './tcpBinding'
import {tcpCredentialActions, tcpCredentialSliceDescriptor} from './tcpCredential'
import {tcpIdentityActions, tcpIdentitySliceDescriptor} from './tcpIdentity'
import {tcpRuntimeActions, tcpRuntimeSliceDescriptor} from './tcpRuntime'

export const tcpControlStateActions = {
    ...tcpIdentityActions,
    ...tcpCredentialActions,
    ...tcpBindingActions,
    ...tcpRuntimeActions,
}

export const tcpControlStateSlices = [
    tcpIdentitySliceDescriptor,
    tcpCredentialSliceDescriptor,
    tcpBindingSliceDescriptor,
    tcpRuntimeSliceDescriptor,
]
