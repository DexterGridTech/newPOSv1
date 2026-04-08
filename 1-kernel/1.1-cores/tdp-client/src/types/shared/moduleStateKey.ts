import {createModuleStateKeys} from '@impos2/kernel-core-base'
import {moduleName} from '../../moduleName'

export const kernelCoreTdpClientState = createModuleStateKeys(
  moduleName,
  [
    'tdpSession',
    'tdpSync',
    'tdpProjection',
    'tdpCommandInbox',
    'tdpControlSignals',
  ] as const,
)
