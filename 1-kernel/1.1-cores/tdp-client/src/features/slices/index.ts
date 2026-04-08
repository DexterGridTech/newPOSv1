import {tdpSessionConfig} from './tdpSession'
import {tdpSyncConfig} from './tdpSync'
import {tdpProjectionConfig} from './tdpProjection'
import {tdpCommandInboxConfig} from './tdpCommandInbox'
import {tdpControlSignalsConfig} from './tdpControlSignals'

export const kernelCoreTdpClientSlice = {
  tdpSession: tdpSessionConfig,
  tdpSync: tdpSyncConfig,
  tdpProjection: tdpProjectionConfig,
  tdpCommandInbox: tdpCommandInboxConfig,
  tdpControlSignals: tdpControlSignalsConfig,
}

export {tdpSessionActions} from './tdpSession'
export {tdpSyncActions} from './tdpSync'
export {tdpProjectionActions} from './tdpProjection'
export {tdpCommandInboxActions} from './tdpCommandInbox'
export {tdpControlSignalsActions} from './tdpControlSignals'
