import {createModuleStateKeys} from '@impos2/kernel-core-base'
import {moduleName} from '../../moduleName'

export const kernelCoreTcpClientState = createModuleStateKeys(
  moduleName,
  [
    'tcpIdentity',
    'tcpCredential',
    'tcpBinding',
    'tcpRuntime',
  ] as const,
)
