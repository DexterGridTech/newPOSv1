import type {HttpServiceModuleDefinition} from '../../types'

export function defineHttpServiceModule<TServices>(
  moduleName: string,
  services: TServices,
): HttpServiceModuleDefinition<TServices> {
  return {
    moduleName,
    services,
  }
}
