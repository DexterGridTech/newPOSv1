import type {TurboModule} from 'react-native';
import {TurboModuleRegistry} from 'react-native';

export interface Spec extends TurboModule {
  startLocalWebServer(configJson: string): Promise<Object>;
  stopLocalWebServer(): Promise<void>;
  getLocalWebServerStatus(): Promise<Object>;
  getLocalWebServerStats(): Promise<Object>;
  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('LocalWebServerTurboModule');
