import {tcpBindingV2Actions, tcpBindingV2SliceDescriptor} from './tcpBinding'
import {tcpCredentialV2Actions, tcpCredentialV2SliceDescriptor} from './tcpCredential'
import {tcpIdentityV2Actions, tcpIdentityV2SliceDescriptor} from './tcpIdentity'
import {tcpRuntimeV2Actions, tcpRuntimeV2SliceDescriptor} from './tcpRuntime'

export const tcpControlV2StateSlices = [
    tcpIdentityV2SliceDescriptor,
    tcpCredentialV2SliceDescriptor,
    tcpBindingV2SliceDescriptor,
    tcpRuntimeV2SliceDescriptor,
] as const

export const tcpControlV2StateActions = {
    ...tcpIdentityV2Actions,
    ...tcpCredentialV2Actions,
    ...tcpBindingV2Actions,
    ...tcpRuntimeV2Actions,
}

export {
    tcpBindingV2Actions,
    tcpBindingV2SliceDescriptor,
    tcpCredentialV2Actions,
    tcpCredentialV2SliceDescriptor,
    tcpIdentityV2Actions,
    tcpIdentityV2SliceDescriptor,
    tcpRuntimeV2Actions,
    tcpRuntimeV2SliceDescriptor,
}
