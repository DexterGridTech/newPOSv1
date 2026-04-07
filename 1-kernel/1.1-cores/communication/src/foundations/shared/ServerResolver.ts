import {CommunicationError} from '../../types'
import type {CommunicationServerConfig} from '../../types'

export class ServerResolver {
  private readonly serverMap = new Map<string, CommunicationServerConfig>()

  registerServer(config: CommunicationServerConfig): void {
    if (!config.addresses.length) {
      throw new CommunicationError('SERVER_HAS_NO_ADDRESS', `服务 ${config.serverName} 没有可用地址`, config)
    }
    this.serverMap.set(config.serverName, config)
  }

  registerServers(configs: CommunicationServerConfig[]): void {
    configs.forEach(config => this.registerServer(config))
  }

  resolve(serverName: string): CommunicationServerConfig {
    const config = this.serverMap.get(serverName)
    if (!config) {
      throw new CommunicationError('SERVER_NOT_FOUND', `未找到服务配置: ${serverName}`, {serverName})
    }
    if (!config.addresses.length) {
      throw new CommunicationError('SERVER_HAS_NO_ADDRESS', `服务 ${serverName} 没有可用地址`, {serverName})
    }
    return config
  }

  getFirstAddress(serverName: string) {
    return this.resolve(serverName).addresses[0]
  }

  listServerNames(): string[] {
    return Array.from(this.serverMap.keys())
  }

  clear(): void {
    this.serverMap.clear()
  }
}
