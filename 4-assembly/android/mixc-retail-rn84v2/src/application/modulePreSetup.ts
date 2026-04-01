import {
  registerAppControl,
  registerDevice,
  registerExternalConnector,
  registerLogger,
  registerScriptsExecution,
  registerStateStorage,
} from '@impos2/kernel-core-base';
import {registerLocalWebServer} from '@impos2/kernel-core-interconnection';
import {appControlAdapter} from '../foundations/appControl';
import {deviceAdapter} from '../foundations/device';
import {externalConnectorAdapter} from '../foundations/externalConnector';
import {localWebServerAdapter} from '../foundations/localWebServer';
import {loggerAdapter} from '../foundations/logger';
import {scriptExecutionAdapter} from '../foundations/scriptExecution';
import {stateStorageAdapter} from '../foundations/stateStorage';

let initialized = false;

export function ensureModulePreSetup(): void {
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
