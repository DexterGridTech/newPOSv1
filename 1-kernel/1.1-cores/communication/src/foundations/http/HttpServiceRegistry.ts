import {CommunicationError} from '../../types'

export class HttpServiceRegistry {
  private readonly modules = new Map<string, unknown>()

  registerModule<TServices>(moduleName: string, services: TServices): void {
    this.modules.set(moduleName, services)
  }

  getModule<TServices>(moduleName: string): TServices {
    if (!this.modules.has(moduleName)) {
      throw new CommunicationError('NOT_IMPLEMENTED', `HTTP service module 未注册: ${moduleName}`)
    }
    return this.modules.get(moduleName) as TServices
  }

  hasModule(moduleName: string): boolean {
    return this.modules.has(moduleName)
  }

  clear(): void {
    this.modules.clear()
  }
}

export const httpServiceRegistry = new HttpServiceRegistry()
