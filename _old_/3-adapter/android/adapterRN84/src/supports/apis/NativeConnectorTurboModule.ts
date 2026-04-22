import type {TurboModule} from 'react-native'
import {TurboModuleRegistry} from 'react-native'

export interface Spec extends TurboModule {
    call(
        channelJson: string,
        action: string,
        paramsJson: string,
        timeout: number,
    ): Promise<Object>

    subscribe(channelJson: string): Promise<string>

    unsubscribe(channelId: string): Promise<void>

    isAvailable(channelJson: string): Promise<boolean>

    getAvailableTargets(type: string): Promise<ReadonlyArray<string>>

    addListener(eventName: string): void

    removeListeners(count: number): void
}

export default TurboModuleRegistry.getEnforcing<Spec>('ConnectorTurboModule')
