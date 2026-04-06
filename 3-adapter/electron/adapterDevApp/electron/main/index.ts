import {app, BrowserWindow, ipcMain} from 'electron';
import {createHostServiceContainer} from '@impos2/adapter-electron-v1/main';
import {
  hostBridgeEventChannel,
  hostBridgeInvokeChannel,
  type HostBridgeApi,
  type HostBridgeEventPayloadMap,
  type HostBridgeEventType,
  type HostBridgeInvokeMethod,
} from '@impos2/adapter-electron-v1/shared/contracts';

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

let mainWindow: BrowserWindow | null = null;
const hostServices = createHostServiceContainer();
const bridgeApiByWebContentsId = new Map<number, HostBridgeApi>();

function broadcastHostBridgeEvent<TEventType extends HostBridgeEventType>(
  eventType: TEventType,
  data: HostBridgeEventPayloadMap[TEventType],
) {
  BrowserWindow.getAllWindows().forEach(window => {
    if (window.isDestroyed()) {
      return;
    }
    window.webContents.send(hostBridgeEventChannel, {eventType, data});
  });
}

function registerWindowBridge(window: BrowserWindow) {
  const webContentsId = window.webContents.id;
  const ownerId = `dev-app:${window.webContents.id}`;
  const launchContext = hostServices.getLaunchContext('primary', {
    displayCount: 1,
    isPackaged: app.isPackaged,
    appVersion: app.getVersion(),
    deviceId: 'electron-adapter-dev',
    serverSpacePreset: 'dev',
  });

  bridgeApiByWebContentsId.set(
    webContentsId,
    hostServices.createBridgeApi(async () => launchContext, {
      ownerId,
      getPrimaryWindow: () => mainWindow,
      onRestartRequested: async () => {
        app.relaunch();
        app.exit(0);
      },
      onPrimaryLoadComplete: async () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.show();
        }
      },
    }),
  );

  window.webContents.on('before-input-event', (event, input) => {
    const consumed = hostServices.dispatchKeyboardInput(ownerId, {
      type: input.type,
      key: input.key,
      code: input.code,
      control: input.control,
      alt: input.alt,
      shift: input.shift,
      meta: input.meta,
    });
    if (consumed) {
      event.preventDefault();
    }
  });

  window.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    const prefix = `[adapterDevApp:renderer:${level}]`;
    console.log(prefix, message, sourceId ? `${sourceId}:${line}` : `line:${line}`);
  });

  window.webContents.on('render-process-gone', (_event, details) => {
    console.error('[adapterDevApp:renderer] render-process-gone', details);
  });

  window.webContents.on('unresponsive', () => {
    console.error('[adapterDevApp:renderer] window became unresponsive');
  });

  window.on('closed', () => {
    bridgeApiByWebContentsId.delete(webContentsId);
    hostServices.clearOwnerSubscriptions(ownerId);
  });
}

const hostBridgeMethodMap: Record<HostBridgeInvokeMethod, (...args: any[]) => Promise<unknown>> = {
  'getLaunchContext': async function (this: HostBridgeApi) {
    return this.getLaunchContext();
  },
  'appControl.isFullScreen': async function (this: HostBridgeApi) {
    return this.appControl.isFullScreen();
  },
  'appControl.isAppLocked': async function (this: HostBridgeApi) {
    return this.appControl.isAppLocked();
  },
  'appControl.setFullScreen': async function (this: HostBridgeApi, isFullScreen: boolean) {
    return this.appControl.setFullScreen(isFullScreen);
  },
  'appControl.setAppLocked': async function (this: HostBridgeApi, isAppLocked: boolean) {
    return this.appControl.setAppLocked(isAppLocked);
  },
  'appControl.restartApp': async function (this: HostBridgeApi) {
    return this.appControl.restartApp();
  },
  'appControl.onAppLoadComplete': async function (this: HostBridgeApi, displayIndex: number) {
    return this.appControl.onAppLoadComplete(displayIndex);
  },
  'device.getDeviceInfo': async function (this: HostBridgeApi) {
    return this.device.getDeviceInfo();
  },
  'device.getSystemStatus': async function (this: HostBridgeApi) {
    return this.device.getSystemStatus();
  },
  'device.subscribePowerStatus': async function (this: HostBridgeApi, listenerId: string) {
    return this.device.subscribePowerStatus(listenerId);
  },
  'device.unsubscribePowerStatus': async function (this: HostBridgeApi, listenerId: string) {
    return this.device.unsubscribePowerStatus(listenerId);
  },
  'stateStorage.getItem': async function (this: HostBridgeApi, ...args: unknown[]) {
    return this.stateStorage.getItem(args[0] as string, ...args.slice(1));
  },
  'stateStorage.setItem': async function (this: HostBridgeApi, ...args: unknown[]) {
    return this.stateStorage.setItem(args[0] as string, args[1], ...args.slice(2));
  },
  'stateStorage.removeItem': async function (this: HostBridgeApi, ...args: unknown[]) {
    return this.stateStorage.removeItem(args[0] as string, ...args.slice(1));
  },
  'logger.debug': async function (this: HostBridgeApi, tags: string[], message: string, data?: unknown) {
    return this.logger.debug(tags, message, data);
  },
  'logger.log': async function (this: HostBridgeApi, tags: string[], message: string, data?: unknown) {
    return this.logger.log(tags, message, data);
  },
  'logger.warn': async function (this: HostBridgeApi, tags: string[], message: string, data?: unknown) {
    return this.logger.warn(tags, message, data);
  },
  'logger.error': async function (this: HostBridgeApi, tags: string[], message: string, data?: unknown) {
    return this.logger.error(tags, message, data);
  },
  'logger.getLogFiles': async function (this: HostBridgeApi) {
    return this.logger.getLogFiles();
  },
  'logger.getLogContent': async function (this: HostBridgeApi, fileName: string) {
    return this.logger.getLogContent(fileName);
  },
  'logger.deleteLogFile': async function (this: HostBridgeApi, fileName: string) {
    return this.logger.deleteLogFile(fileName);
  },
  'logger.clearAllLogs': async function (this: HostBridgeApi) {
    return this.logger.clearAllLogs();
  },
  'logger.getLogDirPath': async function (this: HostBridgeApi) {
    return this.logger.getLogDirPath();
  },
  'localWebServer.start': async function (this: HostBridgeApi, config?: Record<string, unknown>) {
    return this.localWebServer.start(config);
  },
  'localWebServer.stop': async function (this: HostBridgeApi) {
    return this.localWebServer.stop();
  },
  'localWebServer.getStatus': async function (this: HostBridgeApi) {
    return this.localWebServer.getStatus();
  },
  'localWebServer.getStats': async function (this: HostBridgeApi) {
    return this.localWebServer.getStats();
  },
  'localWebServer.register': async function (this: HostBridgeApi, payload) {
    return this.localWebServer.register(payload as never);
  },
  'http.request': async function (this: HostBridgeApi, request) {
    return this.http.request(request as never);
  },
  'scriptsExecution.executeScript': async function (this: HostBridgeApi, options) {
    return this.scriptsExecution.executeScript(options as never);
  },
  'externalConnector.call': async function (this: HostBridgeApi, channel, action, params, timeout) {
    return this.externalConnector.call(channel as never, action as string, params as never, timeout as number);
  },
  'externalConnector.subscribe': async function (this: HostBridgeApi, channel) {
    return this.externalConnector.subscribe(channel as never);
  },
  'externalConnector.unsubscribe': async function (this: HostBridgeApi, channelId: string) {
    return this.externalConnector.unsubscribe(channelId);
  },
  'externalConnector.isAvailable': async function (this: HostBridgeApi, channel) {
    return this.externalConnector.isAvailable(channel as never);
  },
  'externalConnector.getAvailableTargets': async function (this: HostBridgeApi, type) {
    return this.externalConnector.getAvailableTargets(type as never);
  },
};

hostServices.onEvent('device.powerStatusChanged', payload => {
  broadcastHostBridgeEvent('device.powerStatusChanged', payload);
});
hostServices.onEvent('externalConnector.stream', payload => {
  broadcastHostBridgeEvent('externalConnector.stream', payload);
});
hostServices.onEvent('externalConnector.passive', payload => {
  broadcastHostBridgeEvent('externalConnector.passive', payload);
});

app.whenReady().then(() => {
  ipcMain.handle(hostBridgeInvokeChannel, async (event, invocation: {method: HostBridgeInvokeMethod; args: unknown[]}) => {
    const bridgeApi = bridgeApiByWebContentsId.get(event.sender.id);
    if (!bridgeApi) {
      throw new Error(`Host bridge is not registered for webContents ${event.sender.id}`);
    }

    const handler = hostBridgeMethodMap[invocation.method];
    if (!handler) {
      throw new Error(`Unsupported host bridge method: ${invocation.method}`);
    }

    return handler.apply(bridgeApi, invocation.args);
  });

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0b1020',
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  registerWindowBridge(mainWindow);
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
  mainWindow.once('ready-to-show', () => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.show();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void app.relaunch();
      app.exit(0);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
