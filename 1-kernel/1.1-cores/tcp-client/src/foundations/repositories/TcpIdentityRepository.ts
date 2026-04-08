import {storeEntry} from '@impos2/kernel-core-base'
import type {DeviceInfo} from '@impos2/kernel-core-base'
import {selectTcpBindingSnapshot, selectTcpIdentitySnapshot} from '../../selectors'
import type {TcpBindingContext, TcpIdentitySnapshot, TcpPersistedSnapshot} from '../../types'

export class TcpIdentityRepository {
  readIdentity(): TcpIdentitySnapshot {
    return selectTcpIdentitySnapshot(storeEntry.getState())
  }

  readBinding(): TcpBindingContext {
    return selectTcpBindingSnapshot(storeEntry.getState())
  }

  readSnapshot(): Pick<TcpPersistedSnapshot, 'identity' | 'binding'> {
    return {
      identity: this.readIdentity(),
      binding: this.readBinding(),
    }
  }

  getTerminalId(): string | undefined {
    return this.readIdentity().terminalId
  }

  getDeviceFingerprint(): string | undefined {
    return this.readIdentity().deviceFingerprint
  }

  getDeviceInfo(): DeviceInfo | undefined {
    return this.readIdentity().deviceInfo
  }
}

export const tcpIdentityRepository = new TcpIdentityRepository()
