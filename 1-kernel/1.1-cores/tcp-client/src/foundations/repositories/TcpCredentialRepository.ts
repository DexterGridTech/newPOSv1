import {storeEntry} from '@impos2/kernel-core-base'
import {selectTcpCredentialSnapshot} from '../../selectors'
import type {TcpCredentialSnapshot} from '../../types'

export class TcpCredentialRepository {
  readCredential(): TcpCredentialSnapshot {
    return selectTcpCredentialSnapshot(storeEntry.getState())
  }

  getAccessToken(): string | undefined {
    return this.readCredential().accessToken
  }

  getRefreshToken(): string | undefined {
    return this.readCredential().refreshToken
  }

  isExpired(now = Date.now()): boolean {
    const snapshot = this.readCredential()
    return !!snapshot.expiresAt && snapshot.expiresAt <= now
  }
}

export const tcpCredentialRepository = new TcpCredentialRepository()
