import type {CommunicationServerConfig} from '../../types'
import {storeEntry, type ServerSpace} from '@impos2/kernel-core-base'

export function mapServerSpaceToCommunicationServers(serverSpace: ServerSpace): CommunicationServerConfig[] {
  const selected = serverSpace.spaces.find(item => item.name === serverSpace.selectedSpace)
  if (!selected) {
    return []
  }

  return selected.serverAddresses.map(serverAddress => ({
    serverName: serverAddress.serverName,
    retryCount: serverAddress.retryCount,
    retryInterval: serverAddress.retryInterval,
    addresses: serverAddress.addresses.map(address => ({
      addressName: address.addressName,
      baseURL: address.baseURL,
      timeout: address.timeout,
    })),
  }))
}

export function getCommunicationServersFromStoreEntry(): CommunicationServerConfig[] {
  return mapServerSpaceToCommunicationServers(storeEntry.getServerSpace())
}
