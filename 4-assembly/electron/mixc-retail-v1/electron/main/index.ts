import {app, BrowserWindow, ipcMain, screen} from 'electron';
import {createHostServiceContainer} from '@impos2/adapter-electron-v1/main';
import {LocalWebServerStatus} from '@impos2/kernel-core-interconnection';
import {
  hostBridgeEventChannel,
  hostBridgeInvokeChannel,
  type HostBridgeApi,
  type HostBridgeEventPayloadMap,
  type HostBridgeEventType,
  type HostBridgeInvokeMethod,
} from '@impos2/adapter-electron-v1/shared/contracts';

declare const PRIMARY_WINDOW_WEBPACK_ENTRY: string;
declare const PRIMARY_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
declare const SECONDARY_WINDOW_WEBPACK_ENTRY: string;
declare const SECONDARY_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

let primaryWindow: BrowserWindow | null = null;
let secondaryWindow: BrowserWindow | null = null;
const hostServices = createHostServiceContainer();
const bridgeApiByWebContentsId = new Map<number, HostBridgeApi>();
let passiveDeepLinkBacklog: Array<{target: string; data: Record<string, unknown>}> = [];

const SECONDARY_START_DELAY_MS = 3000;
const LOCAL_WEB_SERVER_STOP_TIMEOUT_MS = 3000;
const LOCAL_WEB_SERVER_STOP_POLL_INTERVAL_MS = 100;

type StartupMode = 'cold-start' | 'restart';

const startupState: {
  mode: StartupMode;
  primaryReady: boolean;
  pendingSecondaryStart: ReturnType<typeof setTimeout> | null;
  restartPromise: Promise<void> | null;
} = {
  mode: 'cold-start',
  primaryReady: false,
  pendingSecondaryStart: null,
  restartPromise: null,
};

function clearPendingSecondaryStart() {
  if (!startupState.pendingSecondaryStart) {
    return;
  }
  clearTimeout(startupState.pendingSecondaryStart);
  startupState.pendingSecondaryStart = null;
}

function beginStartupCycle(mode: StartupMode) {
  startupState.mode = mode;
  startupState.primaryReady = false;
  clearPendingSecondaryStart();
}

function scheduleSecondaryStart() {
  clearPendingSecondaryStart();
  startupState.pendingSecondaryStart = setTimeout(() => {
    startupState.pendingSecondaryStart = null;
    if (screen.getAllDisplays().length < 2) {
      return;
    }
    if (secondaryWindow && !secondaryWindow.isDestroyed()) {
      secondaryWindow.showInactive();
      return;
    }
    secondaryWindow = createSecondaryWindow();
  }, SECONDARY_START_DELAY_MS);
}

async function stopLocalWebServerIfRunning() {
  const serverInfo = await hostServices.createBridgeApi(async () => hostServices.getLaunchContext('primary', {
    displayCount: screen.getAllDisplays().length,
    isPackaged: app.isPackaged,
    appVersion: app.getVersion(),
  })).localWebServer.getStatus();

  if (serverInfo.status === LocalWebServerStatus.STOPPED) {
    return;
  }

  await hostServices.createBridgeApi(async () => hostServices.getLaunchContext('primary', {
    displayCount: screen.getAllDisplays().length,
    isPackaged: app.isPackaged,
    appVersion: app.getVersion(),
  })).localWebServer.stop();

  const startedAt = Date.now();
  while (Date.now() - startedAt < LOCAL_WEB_SERVER_STOP_TIMEOUT_MS) {
    const nextServerInfo = await hostServices.createBridgeApi(async () => hostServices.getLaunchContext('primary', {
      displayCount: screen.getAllDisplays().length,
      isPackaged: app.isPackaged,
      appVersion: app.getVersion(),
    })).localWebServer.getStatus();
    if (nextServerInfo.status === LocalWebServerStatus.STOPPED) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, LOCAL_WEB_SERVER_STOP_POLL_INTERVAL_MS));
  }

  throw new Error('Timed out waiting for LocalWebServer to stop before restart');
}

async function closeSecondaryWindowForRestart() {
  if (!secondaryWindow || secondaryWindow.isDestroyed()) {
    secondaryWindow = null;
    return;
  }

  const currentWindow = secondaryWindow;
  await new Promise<void>(resolve => {
    let settled = false;
    const finish = () => {
      if (settled) {
        return;
      }
      settled = true;
      resolve();
    };

    currentWindow.once('closed', finish);
    currentWindow.close();

    setTimeout(() => {
      if (!currentWindow.isDestroyed()) {
        currentWindow.destroy();
      }
      finish();
    }, 1000);
  });

  if (secondaryWindow === currentWindow) {
    secondaryWindow = null;
  }
}

async function restartApplication() {
  if (startupState.restartPromise) {
    return startupState.restartPromise;
  }

  startupState.restartPromise = (async () => {
    beginStartupCycle('restart');
    await stopLocalWebServerIfRunning();
    await closeSecondaryWindowForRestart();

    if (!primaryWindow || primaryWindow.isDestroyed()) {
      primaryWindow = createPrimaryWindow();
      return;
    }

    primaryWindow.webContents.reloadIgnoringCache();
  })().finally(() => {
    startupState.restartPromise = null;
  });

  return startupState.restartPromise;
}

function handlePrimaryLoadComplete(displayIndex: number) {
  if (displayIndex > 0) {
    if (secondaryWindow && !secondaryWindow.isDestroyed()) {
      secondaryWindow.showInactive();
    }
    return;
  }

  if (startupState.primaryReady) {
    return;
  }

  startupState.primaryReady = true;

  if (primaryWindow && !primaryWindow.isDestroyed()) {
    primaryWindow.show();
  }

  scheduleSecondaryStart();
  startupState.mode = 'cold-start';
}

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

function buildLaunchArguments(launchContext: ReturnType<typeof hostServices.getLaunchContext>): string[] {
  return [
    `--impos2-window-role=${launchContext.windowRole}`,
    `--impos2-display-index=${launchContext.displayIndex}`,
    `--impos2-display-count=${launchContext.displayCount}`,
    `--impos2-device-id=${launchContext.deviceId}`,
    `--impos2-is-packaged=${String(launchContext.isPackaged)}`,
    `--impos2-app-version=${launchContext.appVersion}`,
    `--impos2-runtime-source=${launchContext.runtimeSource}`,
  ];
}

function registerWindowBridge(window: BrowserWindow, windowRole: 'primary' | 'secondary') {
  const webContentsId = window.webContents.id;
  const ownerId = `${windowRole}:${window.webContents.id}`;
  const launchContext = hostServices.getLaunchContext(windowRole, {
    displayCount: screen.getAllDisplays().length,
    isPackaged: app.isPackaged,
    appVersion: app.getVersion(),
  });

  bridgeApiByWebContentsId.set(
    webContentsId,
    hostServices.createBridgeApi(async () => launchContext, {
      ownerId,
      getPrimaryWindow: () => primaryWindow,
      onRestartRequested: async () => {
        await restartApplication();
      },
      onPrimaryLoadComplete: async displayIndex => {
        handlePrimaryLoadComplete(displayIndex);
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
    const prefix = `[mixc-retail-v1:${windowRole}:renderer:${level}]`;
    console.log(prefix, message, sourceId ? `${sourceId}:${line}` : `line:${line}`);
  });

  window.webContents.on('render-process-gone', (_event, details) => {
    console.error(`[mixc-retail-v1:${windowRole}:renderer] render-process-gone`, details);
  });

  window.webContents.on('unresponsive', () => {
    console.error(`[mixc-retail-v1:${windowRole}:renderer] window became unresponsive`);
  });

  window.on('closed', () => {
    bridgeApiByWebContentsId.delete(webContentsId);
    hostServices.clearOwnerSubscriptions(ownerId);
  });
}

function flushPassiveBacklog() {
  if (!passiveDeepLinkBacklog.length) {
    return;
  }
  passiveDeepLinkBacklog.forEach(item => {
    hostServices.emitPassiveEvent(item.target, item.data);
  });
  passiveDeepLinkBacklog = [];
}

function emitPassiveFromUrl(rawUrl: string) {
  try {
    const parsed = new URL(rawUrl);
    const payload: Record<string, unknown> = {};
    parsed.searchParams.forEach((value, key) => {
      payload[key] = value;
    });
    const target = parsed.searchParams.get('target') || PASSIVE_DEFAULT_TARGET;
    hostServices.emitPassiveEvent(target, {
      source: 'electron-deep-link',
      protocol: parsed.protocol,
      host: parsed.host,
      path: parsed.pathname,
      ...payload,
    });
  } catch {
    hostServices.emitPassiveEvent(PASSIVE_DEFAULT_TARGET, {
      source: 'electron-deep-link',
      rawUrl,
    });
  }
}

const PASSIVE_PROTOCOL = 'impos2';
const PASSIVE_DEFAULT_TARGET = 'com.impos2.connector.PASSIVE';
const singleInstanceLock = app.requestSingleInstanceLock();

if (!singleInstanceLock) {
  app.quit();
}

app.setAsDefaultProtocolClient(PASSIVE_PROTOCOL);

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
  'scriptsExecution.executeScript': async function (
    this: HostBridgeApi,
    options: Record<string, unknown>,
  ) {
    return this.scriptsExecution.executeScript(options as never);
  },
  'externalConnector.call': async function (
    this: HostBridgeApi,
    channel,
    action,
    params,
    timeout,
  ) {
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

ipcMain.handle(
  hostBridgeInvokeChannel,
  async (event, payload: {method: HostBridgeInvokeMethod; args?: unknown[]}) => {
    const bridgeApi = bridgeApiByWebContentsId.get(event.sender.id);
    if (!bridgeApi) {
      throw new Error(`Host bridge API not registered for webContents ${event.sender.id}`);
    }
    const handler = hostBridgeMethodMap[payload.method];
    if (!handler) {
      throw new Error(`Unsupported host bridge method: ${payload.method}`);
    }
    return handler.call(bridgeApi, ...(payload.args ?? []));
  },
);

hostServices.onEvent('device.powerStatusChanged', payload => {
  broadcastHostBridgeEvent('device.powerStatusChanged', payload);
});
hostServices.onEvent('externalConnector.stream', payload => {
  broadcastHostBridgeEvent('externalConnector.stream', payload);
});
hostServices.onEvent('externalConnector.passive', payload => {
  broadcastHostBridgeEvent('externalConnector.passive', payload);
});

function createPrimaryWindow(): BrowserWindow {
  const launchContext = hostServices.getLaunchContext('primary', {
    displayCount: screen.getAllDisplays().length,
    isPackaged: app.isPackaged,
    appVersion: app.getVersion(),
  });
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    title: 'mixc-retail-v1-primary',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: PRIMARY_WINDOW_PRELOAD_WEBPACK_ENTRY,
      additionalArguments: buildLaunchArguments(launchContext),
    },
  });
  registerWindowBridge(win, 'primary');
  beginStartupCycle(startupState.mode);
  win.loadURL(PRIMARY_WINDOW_WEBPACK_ENTRY);
  win.on('closed', () => {
    primaryWindow = null;
  });
  return win;
}

function createSecondaryWindow(): BrowserWindow | null {
  const displays = screen.getAllDisplays();
  if (displays.length < 2) {
    return null;
  }

  const targetDisplay = displays[1];
  const launchContext = hostServices.getLaunchContext('secondary', {
    displayCount: displays.length,
    isPackaged: app.isPackaged,
    appVersion: app.getVersion(),
  });
  const win = new BrowserWindow({
    x: targetDisplay.bounds.x,
    y: targetDisplay.bounds.y,
    width: Math.max(800, targetDisplay.workAreaSize.width),
    height: Math.max(600, targetDisplay.workAreaSize.height),
    show: false,
    title: 'mixc-retail-v1-secondary',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: SECONDARY_WINDOW_PRELOAD_WEBPACK_ENTRY,
      additionalArguments: buildLaunchArguments(launchContext),
    },
  });
  registerWindowBridge(win, 'secondary');
  win.loadURL(SECONDARY_WINDOW_WEBPACK_ENTRY);
  win.on('closed', () => {
    secondaryWindow = null;
  });
  return win;
}

function bootstrapWindows() {
  primaryWindow = createPrimaryWindow();
  flushPassiveBacklog();
}

app.on('second-instance', (_event, commandLine) => {
  const deepLinkArg = commandLine.find(arg => arg.startsWith(`${PASSIVE_PROTOCOL}://`));
  if (deepLinkArg) {
    if (app.isReady()) {
      emitPassiveFromUrl(deepLinkArg);
    } else {
      passiveDeepLinkBacklog.push({
        target: PASSIVE_DEFAULT_TARGET,
        data: {source: 'electron-deep-link', rawUrl: deepLinkArg},
      });
    }
  }

  if (primaryWindow && !primaryWindow.isDestroyed()) {
    if (primaryWindow.isMinimized()) {
      primaryWindow.restore();
    }
    primaryWindow.focus();
  }
});

app.on('open-url', (event, url) => {
  event.preventDefault();
  if (app.isReady()) {
    emitPassiveFromUrl(url);
    return;
  }
  passiveDeepLinkBacklog.push({
    target: PASSIVE_DEFAULT_TARGET,
    data: {source: 'electron-deep-link', rawUrl: url},
  });
});

app.whenReady().then(() => {
  const deepLinkArg = process.argv.find(arg => arg.startsWith(`${PASSIVE_PROTOCOL}://`));
  if (deepLinkArg) {
    passiveDeepLinkBacklog.push({
      target: PASSIVE_DEFAULT_TARGET,
      data: {source: 'electron-deep-link', rawUrl: deepLinkArg},
    });
  }
  bootstrapWindows();

  screen.on('display-added', () => {
    if (startupState.primaryReady && (!secondaryWindow || secondaryWindow.isDestroyed())) {
      scheduleSecondaryStart();
    }
  });

  screen.on('display-removed', () => {
    if (screen.getAllDisplays().length < 2 && secondaryWindow && !secondaryWindow.isDestroyed()) {
      secondaryWindow.close();
      secondaryWindow = null;
    }
  });

  app.on('activate', () => {
    if (!primaryWindow || primaryWindow.isDestroyed()) {
      bootstrapWindows();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
