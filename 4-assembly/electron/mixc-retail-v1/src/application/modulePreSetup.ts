import {
  registerAppControl,
  registerDevice,
  registerExternalConnector,
  registerLogger,
  registerScriptsExecution,
  registerStateStorage,
} from '@impos2/kernel-core-base';
import {registerLocalWebServer} from '@impos2/kernel-core-interconnection';
import {
  appControlAdapter,
  deviceAdapter,
  externalConnectorAdapter,
  localWebServerAdapter,
  loggerAdapter,
  scriptExecutionAdapter,
  stateStorageAdapter,
} from '@impos2/adapter-electron-v1/renderer';

let initialized = false;

export function ensureModulePreSetup() {
  if (initialized) {
    return;
  }

  registerLogger(loggerAdapter);
  registerDevice(deviceAdapter);
  registerStateStorage(stateStorageAdapter);
  registerExternalConnector(externalConnectorAdapter);
  registerScriptsExecution(scriptExecutionAdapter);
  registerLocalWebServer(localWebServerAdapter);
  registerAppControl(appControlAdapter);
  initialized = true;
}
