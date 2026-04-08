import type {SocketServiceModuleDefinition} from '../../types'

export function defineSocketServiceModule<TServices>(
  moduleName: string,
  services: TServices,
): SocketServiceModuleDefinition<TServices> {
  return {
    moduleName,
    services,
  }
}
