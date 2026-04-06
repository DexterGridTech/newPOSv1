import fs from 'node:fs';
import {EventEmitter} from 'node:events';
import os from 'node:os';
import path from 'node:path';
import {app, BrowserWindow, powerMonitor, screen} from 'electron';
import Database from 'better-sqlite3';
import WebSocket from 'ws';
import {
  ScreenMode,
  type ChannelDescriptor,
  type ConnectorEvent,
  type ConnectorResponse,
  type PowerStatusChangeEvent,
  type ScriptExecutionOptions,
} from '@impos2/kernel-core-base';
import {
  LocalWebServerStatus,
  type LocalWebServerConfig,
  type LocalWebServerInfo,
  type ServerStats,
} from '@impos2/kernel-core-interconnection';
import {MasterSlaveWebSocketServer} from '../../../../../0-mock-server/master-ws-server-dual/src/MasterSlaveWebSocketServer';

import type {
  HostBridgeApi,
  HostBridgeEventPayloadMap,
  HostBridgeEventType,
  HostBridgeHttpRequest,
  HostBridgeHttpResponse,
} from '../shared/contracts';
import type {LaunchContext, LaunchContextOverrides} from '../shared/index';

type StorageValueEnvelope = {
  v: 1;
  payload: unknown;
};

type WebServerState = {
  server: MasterSlaveWebSocketServer | null;
  startedAt: number | null;
  config: LocalWebServerConfig;
};

type LocalRegistrationPayload = {
  type: string;
  deviceId: string;
  masterDeviceId?: string;
  runtimeConfig?: Record<string, unknown>;
};

type HostServiceContainer = {
  getLaunchContext(
    windowRole: LaunchContext['windowRole'],
    overrides: LaunchContextOverrides,
  ): LaunchContext;
  createBridgeApi(
    getLaunchContext: () => Promise<LaunchContext>,
    options?: {
      ownerId?: string;
      getPrimaryWindow?: () => BrowserWindow | null;
      onRestartRequested?: () => Promise<void>;
      onPrimaryLoadComplete?: (displayIndex: number) => Promise<void> | void;
    },
  ): HostBridgeApi;
  dispatchKeyboardInput(
    ownerId: string,
    input: {
      type: string;
      key: string;
      code?: string;
      control?: boolean;
      alt?: boolean;
      shift?: boolean;
      meta?: boolean;
    },
  ): boolean;
  clearOwnerSubscriptions(ownerId: string): void;
  emitPassiveEvent(target: string, data?: Record<string, unknown>): void;
  onEvent<TEventType extends HostBridgeEventType>(
    eventType: TEventType,
    listener: (payload: HostBridgeEventPayloadMap[TEventType]) => void,
  ): () => void;
};

const DEFAULT_WEB_SERVER_CONFIG: LocalWebServerConfig = {
  port: 8888,
  basePath: '/localServer',
  heartbeatInterval: 30000,
  heartbeatTimeout: 60000,
};

const STORAGE_NAMESPACE = 'mixc-retail-v1';
const CONNECTOR_CODES = {
  SUCCESS: 0,
  INVALID_PARAM: 1001,
  NOT_SUPPORTED: 1002,
  TIMEOUT: 1003,
  UNKNOWN: 9999,
} as const;
const DEFAULT_CONNECTOR_TIMEOUT = 30000;
const HID_COMMIT_DELAY_MS = 100;
const PASSIVE_CHANNEL_ID = 'passive.intent';
const PASSIVE_EVENT_TYPE = 'connector.passive';
const PASSIVE_TARGET = 'com.impos2.connector.PASSIVE';
const HID_KEYBOARD_TARGET = 'keyboard';

type KeyboardInputPayload = {
  type: string;
  key: string;
  code?: string;
  control?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
};

type ExternalConnectorSubscription =
  | {
      kind: 'mock';
      ownerId: string;
      channel: ChannelDescriptor;
      timer: ReturnType<typeof setInterval>;
    }
  | {
      kind: 'hid';
      ownerId: string;
      channel: ChannelDescriptor;
      buffer: string;
      commitTimer: ReturnType<typeof setTimeout> | null;
    }
  | {
      kind: 'network.ws';
      ownerId: string;
      channel: ChannelDescriptor;
      socket: WebSocket;
      terminalNotified: boolean;
      closedByUser: boolean;
    }
  | {
      kind: 'serial.stream';
      ownerId: string;
      channel: ChannelDescriptor;
      port: SerialPortInstance;
      baudRate: number;
      terminalNotified: boolean;
    };

type SerialPortInfo = {
  path: string;
  friendlyName: string;
};

type SerialPortBindingInfo = {
  path: string;
  manufacturer?: string;
  friendlyName?: string;
  serialNumber?: string;
  pnpId?: string;
  vendorId?: string;
  productId?: string;
};

type SerialPortInstance = EventEmitter & {
  readonly isOpen: boolean;
  open(callback?: (error: Error | null) => void): void;
  close(callback?: (error: Error | null | undefined) => void): void;
  write(data: string | Buffer, callback?: (error: Error | null | undefined) => void): void;
  drain(callback?: (error: Error | null) => void): void;
};

type SerialPortConstructor = {
  new(options: {path: string; baudRate: number; autoOpen?: boolean}): SerialPortInstance;
  list(): Promise<SerialPortBindingInfo[]>;
};

type SerialPortModule = {
  SerialPort: SerialPortConstructor;
};

declare const __non_webpack_require__: NodeJS.Require | undefined;

const scriptFunctionCache = new Map<string, Function>();
let serialPortModuleCache: SerialPortModule | null | undefined;
let serialPortModuleLoadError: Error | null = null;
const openSerialPortRegistry = new Map<string, {baudRate?: number; ownerId: string; mode: 'request-response' | 'stream'}>();

class LocalScriptExecutionError extends Error {
  constructor(
    message: string,
    public readonly script: string,
    public readonly originalError?: unknown,
  ) {
    super(message);
    this.name = 'ScriptExecutionError';
  }
}

function ensureDirectory(dirPath: string) {
  fs.mkdirSync(dirPath, {recursive: true});
}

function getRuntimeRequire() {
  if (typeof __non_webpack_require__ === 'function') {
    return __non_webpack_require__;
  }
  return (0, eval)('require') as NodeJS.Require;
}

function loadSerialPortModule() {
  if (serialPortModuleCache !== undefined) {
    return serialPortModuleCache;
  }
  try {
    serialPortModuleCache = getRuntimeRequire()('serialport') as SerialPortModule;
    serialPortModuleLoadError = null;
  } catch (error) {
    serialPortModuleCache = null;
    serialPortModuleLoadError = error instanceof Error ? error : new Error(String(error));
    console.warn(`[adapter-electron-v1] serialport unavailable: ${serialPortModuleLoadError.message}`);
  }
  return serialPortModuleCache;
}

function getSerialPortConstructor() {
  return loadSerialPortModule()?.SerialPort ?? null;
}

function getSerialPortUnavailableMessage() {
  return serialPortModuleLoadError?.message ?? 'serialport is unavailable';
}

function registerOpenSerialPort(
  portPath: string,
  payload: {baudRate?: number; ownerId: string; mode: 'request-response' | 'stream'},
) {
  openSerialPortRegistry.set(portPath, payload);
}

function unregisterOpenSerialPort(portPath: string) {
  openSerialPortRegistry.delete(portPath);
}

function createConnectorResponse<T>(
  startedAt: number,
  success: boolean,
  code: number,
  message: string,
  data?: T,
): ConnectorResponse<T> {
  return {
    success,
    code,
    message,
    data,
    duration: Date.now() - startedAt,
    timestamp: Date.now(),
  };
}

function createStreamChannelId(prefix = 'stream') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function safeJsonStringify(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function tryParseJsonPayload(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function normalizeRecord(
  value: unknown,
): Record<string, string> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const normalized = Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>(
    (result, [key, item]) => {
      if (item == null) {
        return result;
      }
      result[key] = String(item);
      return result;
    },
    {},
  );
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function looksLikeNetworkUrl(value?: string) {
  return Boolean(value && /^(https?|wss?):\/\//i.test(value));
}

function resolveNetworkTarget(
  channel: ChannelDescriptor,
  action?: string,
  params?: Record<string, unknown>,
) {
  const explicitUrl = typeof params?.url === 'string' ? params.url : undefined;
  if (looksLikeNetworkUrl(explicitUrl)) {
    return explicitUrl!;
  }
  if (looksLikeNetworkUrl(channel.target)) {
    if (action && action !== channel.target && !looksLikeNetworkUrl(action)) {
      try {
        return new URL(action, channel.target).toString();
      } catch {
        return channel.target;
      }
    }
    return channel.target;
  }
  if (looksLikeNetworkUrl(action)) {
    return action!;
  }
  return undefined;
}

function resolveOutboundPayload(
  params?: Record<string, unknown>,
  channel?: ChannelDescriptor,
) {
  if (params?.message !== undefined) {
    return params.message;
  }
  if (params?.body !== undefined) {
    return params.body;
  }
  if (params?.data !== undefined) {
    return params.data;
  }
  if (channel?.options?.initialMessage !== undefined) {
    return channel.options.initialMessage;
  }
  return undefined;
}

function serializeOutboundPayload(payload: unknown) {
  if (payload == null) {
    return undefined;
  }
  if (typeof payload === 'string' || Buffer.isBuffer(payload) || ArrayBuffer.isView(payload)) {
    return payload;
  }
  if (payload instanceof ArrayBuffer) {
    return Buffer.from(payload);
  }
  return JSON.stringify(payload);
}

function parseWebSocketMessage(data: WebSocket.RawData, isBinary: boolean) {
  if (isBinary) {
    const buffer = Array.isArray(data)
      ? Buffer.concat(data)
      : Buffer.isBuffer(data)
        ? data
        : Buffer.from(data as ArrayBuffer);
    return {
      raw: buffer.toString('base64'),
      data: {
        encoding: 'base64',
        data: buffer.toString('base64'),
      },
    };
  }
  const rawText = data.toString();
  return {
    raw: rawText,
    data: tryParseJsonPayload(rawText),
  };
}

function hexToBuffer(input: string) {
  const normalized = input.replace(/\s+/g, '');
  if (!normalized || normalized.length % 2 !== 0 || /[^0-9a-f]/i.test(normalized)) {
    throw new Error(`Invalid hex payload: ${input}`);
  }
  return Buffer.from(normalized, 'hex');
}

function resolveSerialBaudRate(channel: ChannelDescriptor, params?: Record<string, unknown>) {
  const candidates = [
    params?.baudRate,
    params?.baud,
    channel.options?.baudRate,
    channel.options?.baud,
  ];
  for (const candidate of candidates) {
    const value = Number(candidate);
    if (Number.isFinite(value) && value > 0) {
      return value;
    }
  }
  return 9600;
}

function resolveSerialEncoding(channel: ChannelDescriptor, params?: Record<string, unknown>) {
  const candidate = params?.encoding ?? channel.options?.encoding ?? 'utf8';
  return String(candidate).toLowerCase();
}

function resolveSerialPayload(
  channel: ChannelDescriptor,
  params?: Record<string, unknown>,
) {
  const payload = params?.data ?? params?.body ?? params?.message ?? '';
  const encoding = resolveSerialEncoding(channel, params);
  if (Buffer.isBuffer(payload)) {
    return payload;
  }
  if (payload instanceof ArrayBuffer) {
    return Buffer.from(payload);
  }
  if (ArrayBuffer.isView(payload)) {
    return Buffer.from(payload.buffer, payload.byteOffset, payload.byteLength);
  }
  if (typeof payload !== 'string') {
    return Buffer.from(JSON.stringify(payload), 'utf8');
  }
  if (encoding === 'hex') {
    return hexToBuffer(payload);
  }
  if (encoding === 'base64') {
    return Buffer.from(payload, 'base64');
  }
  return Buffer.from(payload, 'utf8');
}

function resolveSerialResponseMode(channel: ChannelDescriptor, params?: Record<string, unknown>) {
  return String(params?.responseMode ?? channel.options?.responseMode ?? 'idle').toLowerCase();
}

function resolveSerialDelimiter(channel: ChannelDescriptor, params?: Record<string, unknown>) {
  const delimiter = params?.delimiter ?? channel.options?.delimiter;
  if (typeof delimiter !== 'string' || !delimiter.length) {
    return undefined;
  }
  const encoding = resolveSerialEncoding(channel, params);
  if (encoding === 'hex') {
    return hexToBuffer(delimiter);
  }
  if (encoding === 'base64') {
    return Buffer.from(delimiter, 'base64');
  }
  return Buffer.from(delimiter, 'utf8');
}

function resolveSerialReadTimeout(
  channel: ChannelDescriptor,
  params: Record<string, unknown> | undefined,
  fallback: number,
) {
  const candidates = [
    params?.readTimeoutMs,
    params?.idleTimeoutMs,
    channel.options?.readTimeoutMs,
    channel.options?.idleTimeoutMs,
  ];
  for (const candidate of candidates) {
    const value = Number(candidate);
    if (Number.isFinite(value) && value >= 0) {
      return value;
    }
  }
  return fallback;
}

function buildSerialFrameData(buffer: Buffer, encoding: string) {
  if (encoding === 'hex') {
    return buffer.toString('hex').toUpperCase();
  }
  if (encoding === 'base64') {
    return buffer.toString('base64');
  }
  return buffer.toString('utf8');
}

function createSerialPortInfo(port: SerialPortBindingInfo) {
  return {
    path: port.path,
    friendlyName:
      port.friendlyName
      || port.manufacturer
      || port.serialNumber
      || port.pnpId
      || [port.vendorId, port.productId].filter(Boolean).join(':')
      || path.basename(port.path),
  } satisfies SerialPortInfo;
}

function createStateStorageService(rootDir: string) {
  ensureDirectory(rootDir);
  const dbPath = path.join(rootDir, `${STORAGE_NAMESPACE}.sqlite`);
  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS state_storage (
      storage_key TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  const encode = (value: unknown) =>
    JSON.stringify({
      v: 1,
      payload: value,
    } satisfies StorageValueEnvelope);

  const decode = (rawValue: string) => {
    const parsed = JSON.parse(rawValue) as StorageValueEnvelope;
    return parsed.payload;
  };

  const buildStorageKey = (key: string, args: unknown[]) => {
    if (!args.length) {
      return key;
    }
    return `${args.map(item => String(item)).join('::')}::${key}`;
  };

  const getStmt = db.prepare('SELECT payload FROM state_storage WHERE storage_key = ?');
  const setStmt = db.prepare(`
    INSERT INTO state_storage (storage_key, payload, updated_at)
    VALUES (@storage_key, @payload, @updated_at)
    ON CONFLICT(storage_key) DO UPDATE SET
      payload = excluded.payload,
      updated_at = excluded.updated_at
  `);
  const removeStmt = db.prepare('DELETE FROM state_storage WHERE storage_key = ?');

  return {
    getItem(key: string, ...args: unknown[]) {
      const row = getStmt.get(buildStorageKey(key, args)) as {payload: string} | undefined;
      return row ? decode(row.payload) : null;
    },
    setItem(key: string, value: unknown, ...args: unknown[]) {
      const storageKey = buildStorageKey(key, args);
      if (value === undefined) {
        removeStmt.run(storageKey);
        return;
      }
      setStmt.run({
        storage_key: storageKey,
        payload: encode(value),
        updated_at: Date.now(),
      });
    },
    removeItem(key: string, ...args: unknown[]) {
      removeStmt.run(buildStorageKey(key, args));
    },
  };
}

function createLoggerService(logDir: string) {
  ensureDirectory(logDir);
  const logFilePath = path.join(logDir, `${new Date().toISOString().slice(0, 10)}.log`);

  const writeLine = (level: string, tags: string[], message: string, data?: unknown) => {
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      level,
      tags,
      message,
      data,
    });
    fs.appendFileSync(logFilePath, `${line}\n`, 'utf8');
  };

  const listLogFiles = () =>
    fs
      .readdirSync(logDir)
      .filter(fileName => fileName.endsWith('.log'))
      .map(fileName => {
        const filePath = path.join(logDir, fileName);
        const stat = fs.statSync(filePath);
        return {
          fileName,
          filePath,
          fileSize: stat.size,
          lastModified: stat.mtimeMs,
        };
      })
      .sort((left, right) => right.lastModified - left.lastModified);

  return {
    debug(tags: string[], message: string, data?: unknown) {
      writeLine('debug', tags, message, data);
    },
    log(tags: string[], message: string, data?: unknown) {
      writeLine('info', tags, message, data);
    },
    warn(tags: string[], message: string, data?: unknown) {
      writeLine('warn', tags, message, data);
    },
    error(tags: string[], message: string, data?: unknown) {
      writeLine('error', tags, message, data);
    },
    getLogFiles() {
      return listLogFiles();
    },
    getLogContent(fileName: string) {
      return fs.readFileSync(path.join(logDir, fileName), 'utf8');
    },
    deleteLogFile(fileName: string) {
      const filePath = path.join(logDir, fileName);
      if (!fs.existsSync(filePath)) {
        return false;
      }
      fs.unlinkSync(filePath);
      return true;
    },
    clearAllLogs() {
      for (const file of listLogFiles()) {
        fs.unlinkSync(file.filePath);
      }
      return true;
    },
    getLogDirPath() {
      return logDir;
    },
  };
}

function createDeviceService(getDeviceId: () => string) {
  const powerListeners = new Map<string, PowerStatusChangeEvent>();
  const eventEmitter = new EventEmitter();

  const buildDisplays = () =>
    screen.getAllDisplays().map(display => ({
      id: String(display.id),
      displayType: display.internal ? 'internal' : 'external',
      refreshRate: Math.round(display.displayFrequency ?? 60),
      width: display.size.width,
      height: display.size.height,
      physicalWidth: display.size.width,
      physicalHeight: display.size.height,
      touchSupport: true as const,
    }));

  const buildPowerStatus = (): PowerStatusChangeEvent => {
    const onBattery = powerMonitor.isOnBatteryPower();
    return {
      powerConnected: !onBattery,
      isCharging: !onBattery,
      batteryLevel: onBattery ? 50 : 100,
      batteryStatus: onBattery ? 'discharging' : 'full',
      batteryHealth: 'good',
      timestamp: Date.now(),
    };
  };

  const emitPowerState = () => {
    const payload = buildPowerStatus();
    powerListeners.forEach((_, key) => {
      powerListeners.set(key, payload);
      eventEmitter.emit('powerStatusChanged', {listenerId: key, event: payload});
    });
  };

  powerMonitor.on('on-ac', emitPowerState);
  powerMonitor.on('on-battery', emitPowerState);

  const getSerialDevices = async () => {
    const SerialPort = getSerialPortConstructor();
    if (!SerialPort) {
      return [];
    }
    try {
      const ports = await SerialPort.list();
      return ports.map((port: SerialPortBindingInfo) => {
        const info = createSerialPortInfo(port);
        return {
          name: info.friendlyName,
          path: info.path,
          baudRate: openSerialPortRegistry.get(info.path)?.baudRate,
          isOpen: openSerialPortRegistry.has(info.path),
        };
      });
    } catch {
      return [];
    }
  };

  return {
    getDeviceInfo() {
      return {
        id: getDeviceId(),
        manufacturer: 'Electron',
        os: os.platform(),
        osVersion: os.release(),
        cpu: `${os.cpus()[0]?.model ?? 'unknown'} x${os.cpus().length}`,
        memory: `${Math.round(os.totalmem() / 1024 / 1024)}MB`,
        disk: 'unknown',
        network: Object.keys(os.networkInterfaces()).join(', '),
        displays: buildDisplays(),
      };
    },
    async getSystemStatus() {
      return {
        cpu: {
          app: 0,
          cores: os.cpus().length,
        },
        memory: {
          total: Math.round(os.totalmem() / 1024 / 1024),
          app: Math.round(process.memoryUsage().rss / 1024 / 1024),
          appPercentage: Number(((process.memoryUsage().rss / os.totalmem()) * 100).toFixed(2)),
        },
        disk: {
          total: 0,
          used: 0,
          available: 0,
          overall: 0,
          app: 0,
        },
        power: {
          ...buildPowerStatus(),
          batteryHealth: 'good' as const,
        },
        usbDevices: [],
        bluetoothDevices: [],
        serialDevices: await getSerialDevices(),
        networks: [],
        installedApps: [],
        updatedAt: Date.now(),
      };
    },
    subscribePowerStatus(listenerId: string) {
      const payload = buildPowerStatus();
      powerListeners.set(listenerId, payload);
      eventEmitter.emit('powerStatusChanged', {listenerId, event: payload});
      return payload;
    },
    unsubscribePowerStatus(listenerId: string) {
      powerListeners.delete(listenerId);
    },
    onPowerStatusChanged(listener: (payload: {listenerId: string; event: PowerStatusChangeEvent}) => void) {
      eventEmitter.on('powerStatusChanged', listener);
      return () => {
        eventEmitter.off('powerStatusChanged', listener);
      };
    },
  };
}

function createLocalWebServerService() {
  const state: WebServerState = {
    server: null,
    startedAt: null,
    config: DEFAULT_WEB_SERVER_CONFIG,
  };

  const getAddresses = () => {
    const hostnames = new Set<string>(['127.0.0.1', 'localhost']);
    const networkInterfaces = os.networkInterfaces();
    Object.values(networkInterfaces).forEach(entries => {
      entries?.forEach(entry => {
        if (entry.family === 'IPv4' && !entry.internal) {
          hostnames.add(entry.address);
        }
      });
    });
    return Array.from(hostnames).map(hostname => ({
      name: hostname === '127.0.0.1' ? 'loopback' : hostname === 'localhost' ? 'localhost' : hostname,
      address: `http://${hostname}:${state.config.port}${state.config.basePath}`,
    }));
  };

  const getRawStats = () => state.server?.getStats?.() as
    | {
        masterCount?: number;
        slaveCount?: number;
        pendingCount?: number;
        pairs?: Array<{masterDeviceId: string; slaveDeviceId?: string}>;
      }
    | undefined;

  return {
    start(config?: Partial<LocalWebServerConfig>) {
      if (state.server) {
        return getAddresses();
      }
      state.config = {
        ...DEFAULT_WEB_SERVER_CONFIG,
        ...config,
      };
      state.server = new MasterSlaveWebSocketServer({
        port: state.config.port,
        basePath: state.config.basePath,
        logLevel: 'info',
      });
      state.startedAt = Date.now();
      return getAddresses();
    },
    stop() {
      state.server?.close();
      state.server = null;
      state.startedAt = null;
    },
    getStatus(): LocalWebServerInfo {
      return {
        status: state.server ? LocalWebServerStatus.RUNNING : LocalWebServerStatus.STOPPED,
        addresses: state.server ? getAddresses() : [],
        config: state.config,
      };
    },
    getStats(): ServerStats {
      const stats = getRawStats();
      return {
        masterCount: stats?.masterCount ?? 0,
        slaveCount: stats?.slaveCount ?? 0,
        pendingCount: stats?.pendingCount ?? 0,
        uptime: state.startedAt ? Date.now() - state.startedAt : 0,
      };
    },
    health() {
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
      };
    },
    register(payload: LocalRegistrationPayload) {
      if (!state.server) {
        return {
          status: 503,
          data: {success: false, error: 'Local web server is not running'},
        };
      }

      if (!payload || typeof payload !== 'object') {
        return {
          status: 400,
          data: {success: false, error: 'Invalid JSON format'},
        };
      }

      if (!payload.type || !payload.deviceId) {
        return {
          status: 400,
          data: {success: false, error: 'Missing required fields: type, deviceId'},
        };
      }

      const deviceManager = (state.server as unknown as {deviceManager?: {preRegisterDevice: Function}}).deviceManager;
      if (!deviceManager?.preRegisterDevice) {
        return {
          status: 500,
          data: {success: false, error: 'Local device manager unavailable'},
        };
      }

      const token = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const result = deviceManager.preRegisterDevice(payload, token) as {success: boolean; error?: string};
      if (!result.success) {
        return {
          status: 400,
          data: {success: false, error: result.error ?? 'Registration failed'},
        };
      }

      return {
        status: 200,
        data: {
          success: true,
          token,
          deviceInfo: {
            deviceType: payload.type,
            deviceId: payload.deviceId,
          },
        },
      };
    },
    matches(url: URL) {
      const requestPort = Number(url.port || (url.protocol === 'https:' ? 443 : 80));
      return requestPort === state.config.port && url.pathname.startsWith(state.config.basePath);
    },
  };
}

function createHttpService(localWebServerService: ReturnType<typeof createLocalWebServerService>) {
  return {
    async request<T = unknown>(request: HostBridgeHttpRequest): Promise<HostBridgeHttpResponse<T>> {
      const method = (request.method ?? 'GET').toUpperCase();
      const url = new URL(request.url ?? '', request.baseURL);

      if (localWebServerService.matches(url)) {
        const responseHeaders = {'content-type': 'application/json'};
        if (url.pathname === `${localWebServerService.getStatus().config.basePath}/health` && method === 'GET') {
          return {
            data: localWebServerService.health() as T,
            status: 200,
            statusText: 'OK',
            headers: responseHeaders,
            url: url.toString(),
          };
        }
        if (url.pathname === `${localWebServerService.getStatus().config.basePath}/stats` && method === 'GET') {
          const stats = (localWebServerService as {
            getStats(): ServerStats;
          }).getStats();
          return {
            data: stats as T,
            status: 200,
            statusText: 'OK',
            headers: responseHeaders,
            url: url.toString(),
          };
        }
        if (url.pathname === `${localWebServerService.getStatus().config.basePath}/register` && method === 'POST') {
          let payload: LocalRegistrationPayload | null = null;
          if (typeof request.data === 'string') {
            try {
              payload = JSON.parse(request.data) as LocalRegistrationPayload;
            } catch {
              payload = null;
            }
          } else if (request.data && typeof request.data === 'object') {
            payload = request.data as LocalRegistrationPayload;
          }

          const result = localWebServerService.register(payload as LocalRegistrationPayload);
          return {
            data: result.data as T,
            status: result.status,
            statusText: result.status === 200 ? 'OK' : 'Bad Request',
            headers: responseHeaders,
            url: url.toString(),
          };
        }
      }

      if (request.params) {
        Object.entries(request.params).forEach(([key, value]) => {
          if (value == null) {
            return;
          }
          if (Array.isArray(value)) {
            value.forEach(item => {
              url.searchParams.append(key, String(item));
            });
            return;
          }
          url.searchParams.set(key, String(value));
        });
      }

      const headers = new Headers();
      Object.entries(request.headers ?? {}).forEach(([key, value]) => {
        if (value != null) {
          headers.set(key, value);
        }
      });

      let body: BodyInit | undefined;
      if (!['GET', 'HEAD'].includes(method) && request.data !== undefined) {
        const contentType = headers.get('content-type')?.toLowerCase() ?? '';
        if (
          typeof request.data === 'string'
          || request.data instanceof ArrayBuffer
          || ArrayBuffer.isView(request.data)
          || request.data instanceof URLSearchParams
          || request.data instanceof FormData
          || request.data instanceof Blob
        ) {
          body = request.data as BodyInit;
        } else if (contentType.includes('application/x-www-form-urlencoded')) {
          const searchParams = new URLSearchParams();
          Object.entries(request.data as Record<string, unknown>).forEach(([key, value]) => {
            if (value == null) {
              return;
            }
            searchParams.append(key, String(value));
          });
          body = searchParams;
        } else {
          if (!contentType) {
            headers.set('Content-Type', 'application/json');
          }
          body = JSON.stringify(request.data);
        }
      }

      const controller = new AbortController();
      const timeout = request.timeout && request.timeout > 0 ? request.timeout : undefined;
      const timer = timeout
        ? setTimeout(() => controller.abort(new Error(`Request timeout (${timeout}ms)`)), timeout)
        : null;

      try {
        const response = await fetch(url, {
          method,
          headers,
          body,
          signal: controller.signal,
        });

        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });

        const responseType = request.responseType ?? 'json';
        const text = await response.text();
        let data: unknown = text;

        if (responseType === 'json' || responseHeaders['content-type']?.includes('application/json')) {
          if (text.length > 0) {
            try {
              data = JSON.parse(text);
            } catch {
              data = text;
            }
          } else {
            data = null;
          }
        }

        return {
          data: data as T,
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
          url: response.url,
        };
      } finally {
        if (timer) {
          clearTimeout(timer);
        }
      }
    },
  };
}

function createScriptsExecutionService() {
  return {
    async executeScript<T = unknown>(options: ScriptExecutionOptions<T>): Promise<T> {
      const {
        script,
        params = {},
        globals = {},
        nativeFunctions = {},
        timeout = 5000,
      } = options;

      if (!script?.trim()) {
        throw new LocalScriptExecutionError('Script cannot be empty', script);
      }

      return new Promise<T>((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => {
          if (settled) {
            return;
          }
          settled = true;
          reject(new LocalScriptExecutionError(`Script execution timed out (${timeout}ms)`, script));
        }, timeout);

        try {
          const globalKeys = Object.keys(globals);
          const nativeKeys = Object.keys(nativeFunctions);
          const allKeys = ['params', ...globalKeys, ...nativeKeys];
          const allValues = [
            params,
            ...globalKeys.map(key => globals[key]),
            ...nativeKeys.map(key => nativeFunctions[key]),
          ];
          const cacheKey = `${script}|${allKeys.join(',')}`;
          const fn = scriptFunctionCache.get(cacheKey) ?? (() => {
            const compiled = new Function(...allKeys, script);
            scriptFunctionCache.set(cacheKey, compiled);
            return compiled;
          })();

          Promise.resolve(fn(...allValues)).then(
            value => {
              if (settled) {
                return;
              }
              settled = true;
              clearTimeout(timer);
              resolve(value as T);
            },
            error => {
              if (settled) {
                return;
              }
              settled = true;
              clearTimeout(timer);
              reject(new LocalScriptExecutionError(error?.message ?? String(error), script, error));
            },
          );
        } catch (error) {
          if (settled) {
            return;
          }
          settled = true;
          clearTimeout(timer);
          reject(new LocalScriptExecutionError(
            error instanceof Error ? error.message : String(error),
            script,
            error,
          ));
        }
      });
    },
  };
}

function createExternalConnectorService() {
  const eventEmitter = new EventEmitter();
  const streamSubscriptions = new Map<string, ExternalConnectorSubscription>();

  const emitStream = (channelId: string, event: ConnectorEvent) => {
    eventEmitter.emit('stream', {channelId, event});
  };

  const emitPassiveEvent = (target: string, data: Record<string, unknown> = {}) => {
    eventEmitter.emit('passive', {
      eventType: PASSIVE_EVENT_TYPE,
      event: {
        channelId: PASSIVE_CHANNEL_ID,
        type: 'INTENT',
        target,
        data,
        raw: safeJsonStringify(data),
        timestamp: Date.now(),
      },
    });
  };

  const passiveBootstrapTimer = setTimeout(() => {
    emitPassiveEvent(PASSIVE_TARGET, {
      source: 'electron-host',
      status: 'ready',
    });
  }, 1500);
  (passiveBootstrapTimer as unknown as {unref?: () => void}).unref?.();

  const clearSubscription = (channelId: string) => {
    const record = streamSubscriptions.get(channelId);
    if (!record) {
      return;
    }
    if (record.kind === 'mock') {
      clearInterval(record.timer);
    }
    if (record.kind === 'hid') {
      if (record.commitTimer) {
        clearTimeout(record.commitTimer);
      }
    }
    if (record.kind === 'network.ws') {
      record.closedByUser = true;
      record.socket.removeAllListeners();
      if (record.socket.readyState === WebSocket.OPEN || record.socket.readyState === WebSocket.CONNECTING) {
        record.socket.close();
      }
    }
    if (record.kind === 'serial.stream') {
      record.terminalNotified = true;
      unregisterOpenSerialPort(record.channel.target);
      record.port.removeAllListeners();
      if (record.port.isOpen) {
        record.port.close();
      }
    }
    streamSubscriptions.delete(channelId);
  };

  const flushHidBuffer = (channelId: string) => {
    const record = streamSubscriptions.get(channelId);
    if (!record || record.kind !== 'hid') {
      return;
    }
    record.commitTimer = null;
    const text = record.buffer.trim();
    record.buffer = '';
    if (!text) {
      return;
    }
    emitStream(channelId, {
      channelId,
      type: 'HID',
      target: record.channel.target,
      data: {text},
      raw: text,
      timestamp: Date.now(),
    });
  };

  const scheduleHidCommit = (channelId: string) => {
    const record = streamSubscriptions.get(channelId);
    if (!record || record.kind !== 'hid') {
      return;
    }
    if (record.commitTimer) {
      clearTimeout(record.commitTimer);
    }
    record.commitTimer = setTimeout(() => {
      flushHidBuffer(channelId);
    }, HID_COMMIT_DELAY_MS);
    (record.commitTimer as unknown as {unref?: () => void}).unref?.();
  };

  const appendHidCharacter = (channelId: string, char: string) => {
    const record = streamSubscriptions.get(channelId);
    if (!record || record.kind !== 'hid') {
      return;
    }
    record.buffer += char;
    scheduleHidCommit(channelId);
  };

  return {
    async call<T = unknown>(
      channel: ChannelDescriptor,
      action?: string,
      params?: Record<string, unknown>,
      timeout = DEFAULT_CONNECTOR_TIMEOUT,
    ): Promise<ConnectorResponse<T>> {
      const startedAt = Date.now();

      if (channel.type === 'SERIAL' && channel.mode === 'request-response') {
        const SerialPort = getSerialPortConstructor();
        if (!SerialPort) {
          return createConnectorResponse(
            startedAt,
            false,
            CONNECTOR_CODES.NOT_SUPPORTED,
            getSerialPortUnavailableMessage(),
          );
        }
        const serialPath = channel.target;
        const baudRate = resolveSerialBaudRate(channel, params);
        const encoding = resolveSerialEncoding(channel, params);
        const delimiter = resolveSerialDelimiter(channel, params);
        const responseMode = resolveSerialResponseMode(channel, params);
        const readTimeoutMs = resolveSerialReadTimeout(channel, params, timeout);
        const outbound = resolveSerialPayload(channel, params);

        let port: SerialPortInstance | null = null;
        let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
        let idleTimer: ReturnType<typeof setTimeout> | null = null;
        let settled = false;
        let responseChunks: Buffer[] = [];
        let didRegisterOpenPort = false;

        const finalize = async (result: ConnectorResponse<T>) => {
          if (settled) {
            return result;
          }
          settled = true;
          if (timeoutTimer) {
            clearTimeout(timeoutTimer);
          }
          if (idleTimer) {
            clearTimeout(idleTimer);
          }
          if (didRegisterOpenPort) {
            unregisterOpenSerialPort(serialPath);
            didRegisterOpenPort = false;
          }
          if (port?.isOpen) {
            await new Promise<void>(resolve => {
              port!.close(() => resolve());
            });
          }
          return result;
        };

        const buildSuccess = async () => {
          const rawBuffer = Buffer.concat(responseChunks);
          const raw = buildSerialFrameData(rawBuffer, encoding);
          return finalize(
            createConnectorResponse(
              startedAt,
              true,
              CONNECTOR_CODES.SUCCESS,
              'OK',
              {
                path: serialPath,
                baudRate,
                encoding,
                raw,
                data: raw,
                bytes: rawBuffer.length,
              } as T,
            ),
          );
        };

        return new Promise<ConnectorResponse<T>>(resolve => {
          const fail = async (message: string, code: number = CONNECTOR_CODES.UNKNOWN) => {
            resolve(await finalize(createConnectorResponse(startedAt, false, code, message)));
          };

          timeoutTimer = setTimeout(() => {
            void fail(`Serial request timeout after ${timeout}ms`, CONNECTOR_CODES.TIMEOUT);
          }, timeout);
          (timeoutTimer as unknown as {unref?: () => void}).unref?.();

          const scheduleIdleFinalize = () => {
            if (responseMode !== 'idle') {
              return;
            }
            if (idleTimer) {
              clearTimeout(idleTimer);
            }
            idleTimer = setTimeout(() => {
              void buildSuccess().then(resolve);
            }, Math.max(10, readTimeoutMs));
            (idleTimer as unknown as {unref?: () => void}).unref?.();
          };

          try {
            port = new SerialPort({
              path: serialPath,
              baudRate,
              autoOpen: false,
            });
            port.on('error', (error: Error) => {
              void fail(error.message, CONNECTOR_CODES.UNKNOWN);
            });
            port.on('data', (chunk: Buffer) => {
              const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
              responseChunks.push(buffer);
              if (responseMode === 'first-chunk') {
                void buildSuccess().then(resolve);
                return;
              }
              if (responseMode === 'delimiter' && delimiter) {
                const merged = Buffer.concat(responseChunks);
                if (merged.includes(delimiter)) {
                  responseChunks = [merged];
                  void buildSuccess().then(resolve);
                  return;
                }
              }
              scheduleIdleFinalize();
            });
            port.open((error: Error | null) => {
              if (error) {
                void fail(error.message, CONNECTOR_CODES.UNKNOWN);
                return;
              }
              registerOpenSerialPort(serialPath, {
                baudRate,
                ownerId: 'request-response',
                mode: 'request-response',
              });
              didRegisterOpenPort = true;
              if (!outbound.length) {
                scheduleIdleFinalize();
                return;
              }
              port!.write(outbound, (writeError: Error | null | undefined) => {
                if (writeError) {
                  void fail(writeError.message, CONNECTOR_CODES.UNKNOWN);
                  return;
                }
                port!.drain((drainError: Error | null) => {
                  if (drainError) {
                    void fail(drainError.message, CONNECTOR_CODES.UNKNOWN);
                    return;
                  }
                  scheduleIdleFinalize();
                });
              });
            });
          } catch (error) {
            void fail(error instanceof Error ? error.message : String(error), CONNECTOR_CODES.UNKNOWN);
          }
        });
      }

      if (channel.type !== 'NETWORK' || channel.mode !== 'request-response') {
        return createConnectorResponse(
          startedAt,
          false,
          CONNECTOR_CODES.NOT_SUPPORTED,
          `Unsupported channel: ${channel.type}/${channel.target}/${channel.mode}`,
        );
      }

      const targetUrl = resolveNetworkTarget(channel, action, params);
      if (!targetUrl) {
        return createConnectorResponse(
          startedAt,
          false,
          CONNECTOR_CODES.INVALID_PARAM,
          'NETWORK channel requires a valid http(s) target',
        );
      }

      if (!/^https?:\/\//i.test(targetUrl)) {
        return createConnectorResponse(
          startedAt,
          false,
          CONNECTOR_CODES.INVALID_PARAM,
          `NETWORK request-response only supports http(s): ${targetUrl}`,
        );
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      (timer as unknown as {unref?: () => void}).unref?.();

      try {
        const method = String(params?.httpMethod ?? params?.method ?? channel.options?.httpMethod ?? 'GET').toUpperCase();
        const headers = normalizeRecord(params?.headers ?? channel.options?.headers);
        const bodySource = params?.body ?? params?.data;
        const requestInit: RequestInit = {
          method,
          headers,
          signal: controller.signal,
        };

        if (bodySource !== undefined && !['GET', 'HEAD'].includes(method)) {
          requestInit.body =
            typeof bodySource === 'string' || bodySource instanceof ArrayBuffer || ArrayBuffer.isView(bodySource)
              ? (bodySource as BodyInit)
              : JSON.stringify(bodySource);
          if (
            requestInit.body &&
            typeof requestInit.body === 'string' &&
            !headers?.['content-type'] &&
            !headers?.['Content-Type']
          ) {
            requestInit.headers = {
              ...(headers ?? {}),
              'content-type': 'application/json',
            };
          }
        }

        const response = await fetch(targetUrl, requestInit);
        const rawText = await response.text();
        const payload = tryParseJsonPayload(rawText) as T;
        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value: string, key: string) => {
          responseHeaders[key] = value;
        });
        return createConnectorResponse(
          startedAt,
          response.ok,
          response.ok ? CONNECTOR_CODES.SUCCESS : response.status,
          response.ok ? 'OK' : `HTTP ${response.status}`,
          {
            status: response.status,
            ok: response.ok,
            headers: responseHeaders,
            url: response.url,
            method,
            body: payload,
            raw: rawText,
          } as T,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const code =
          error instanceof Error && error.name === 'AbortError'
            ? CONNECTOR_CODES.TIMEOUT
            : CONNECTOR_CODES.UNKNOWN;
        return createConnectorResponse(startedAt, false, code, message);
      } finally {
        clearTimeout(timer);
      }
    },
    async subscribe(channel: ChannelDescriptor, ownerId = 'global') {
      if (channel.type === 'HID' && channel.target === HID_KEYBOARD_TARGET && channel.mode === 'stream') {
        const channelId = createStreamChannelId('hid');
        streamSubscriptions.set(channelId, {
          kind: 'hid',
          ownerId,
          channel,
          buffer: '',
          commitTimer: null,
        });
        return channelId;
      }

      if (channel.type === 'NETWORK' && channel.mode === 'stream') {
        const targetUrl = resolveNetworkTarget(channel, channel.target);
        if (!targetUrl || !/^wss?:\/\//i.test(targetUrl)) {
          throw new Error(`NETWORK stream requires a valid ws(s) target: ${channel.target}`);
        }

        const channelId = createStreamChannelId('network');
        const socket = new WebSocket(targetUrl, {
          handshakeTimeout: Number(channel.options?.handshakeTimeout ?? DEFAULT_CONNECTOR_TIMEOUT),
        });
        const record: ExternalConnectorSubscription = {
          kind: 'network.ws',
          ownerId,
          channel: {
            ...channel,
            target: targetUrl,
          },
          socket,
          terminalNotified: false,
          closedByUser: false,
        };
        streamSubscriptions.set(channelId, record);

        socket.on('open', () => {
          const outbound = serializeOutboundPayload(resolveOutboundPayload(undefined, channel));
          if (outbound !== undefined) {
            socket.send(outbound);
          }
        });
        socket.on('message', (data, isBinary) => {
          const parsed = parseWebSocketMessage(data, isBinary);
          emitStream(channelId, {
            channelId,
            type: 'NETWORK',
            target: targetUrl,
            data: parsed.data,
            raw: parsed.raw,
            timestamp: Date.now(),
          });
        });
        socket.on('error', error => {
          emitStream(channelId, {
            channelId,
            type: 'NETWORK',
            target: targetUrl,
            data: null,
            raw: error.message,
            timestamp: Date.now(),
          });
        });
        socket.on('close', (code, reasonBuffer) => {
          const current = streamSubscriptions.get(channelId);
          if (!current || current.kind !== 'network.ws' || current.terminalNotified) {
            streamSubscriptions.delete(channelId);
            return;
          }
          current.terminalNotified = true;
          if (!current.closedByUser) {
            emitStream(channelId, {
              channelId,
              type: 'NETWORK',
              target: targetUrl,
              data: null,
              raw: `WebSocket closed (${code}) ${reasonBuffer.toString()}`.trim(),
              timestamp: Date.now(),
            });
          }
          streamSubscriptions.delete(channelId);
        });

        return channelId;
      }

      if (channel.type === 'SERIAL' && channel.mode === 'stream') {
        const SerialPort = getSerialPortConstructor();
        const baudRate = resolveSerialBaudRate(channel);
        const encoding = resolveSerialEncoding(channel);
        const channelId = createStreamChannelId('serial');
        if (!SerialPort) {
          queueMicrotask(() => {
            emitStream(channelId, {
              channelId,
              type: 'SERIAL',
              target: channel.target,
              data: null,
              raw: getSerialPortUnavailableMessage(),
              timestamp: Date.now(),
            });
          });
          return channelId;
        }
        const port = new SerialPort({
          path: channel.target,
          baudRate,
          autoOpen: false,
        });
        const record: ExternalConnectorSubscription = {
          kind: 'serial.stream',
          ownerId,
          channel,
          port,
          baudRate,
          terminalNotified: false,
        };
        streamSubscriptions.set(channelId, record);

        port.on('data', (chunk: Buffer) => {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          emitStream(channelId, {
            channelId,
            type: 'SERIAL',
            target: channel.target,
            data: {
              path: channel.target,
              baudRate,
              data: buildSerialFrameData(buffer, encoding),
            },
            raw: buildSerialFrameData(buffer, encoding),
            timestamp: Date.now(),
          });
        });
        port.on('error', (error: Error) => {
          emitStream(channelId, {
            channelId,
            type: 'SERIAL',
            target: channel.target,
            data: null,
            raw: error.message,
            timestamp: Date.now(),
          });
        });
        port.on('close', () => {
          unregisterOpenSerialPort(channel.target);
          const current = streamSubscriptions.get(channelId);
          if (!current || current.kind !== 'serial.stream' || current.terminalNotified) {
            streamSubscriptions.delete(channelId);
            return;
          }
          current.terminalNotified = true;
          emitStream(channelId, {
            channelId,
            type: 'SERIAL',
            target: channel.target,
            data: null,
            raw: 'Serial stream closed',
            timestamp: Date.now(),
          });
          streamSubscriptions.delete(channelId);
        });
        port.open((error: Error | null) => {
          if (error) {
            emitStream(channelId, {
              channelId,
              type: 'SERIAL',
              target: channel.target,
              data: null,
              raw: error.message,
              timestamp: Date.now(),
            });
            streamSubscriptions.delete(channelId);
            return;
          }
          registerOpenSerialPort(channel.target, {
            baudRate,
            ownerId,
            mode: 'stream',
          });
        });

        return channelId;
      }

      const channelId = createStreamChannelId('mock');
      const timer = setInterval(() => {
        emitStream(channelId, {
          channelId,
          type: channel.type,
          target: channel.target,
          data: {
            source: 'electron-host',
            target: channel.target,
            sequence: Date.now(),
          },
          raw: `${channel.type}:${channel.target}:${Date.now()}`,
          timestamp: Date.now(),
        });
      }, 1000);
      (timer as unknown as {unref?: () => void}).unref?.();
      streamSubscriptions.set(channelId, {
        kind: 'mock',
        ownerId,
        channel,
        timer,
      });
      return channelId;
    },
    async unsubscribe(channelId: string) {
      clearSubscription(channelId);
    },
    onStream(listener: (payload: {channelId: string; event: HostBridgeEventPayloadMap['externalConnector.stream']['event']}) => void) {
      eventEmitter.on('stream', listener);
      return () => {
        eventEmitter.off('stream', listener);
      };
    },
    onPassive(listener: (payload: {eventType: string; event: HostBridgeEventPayloadMap['externalConnector.passive']['event']}) => void) {
      eventEmitter.on('passive', listener);
      return () => {
        eventEmitter.off('passive', listener);
      };
    },
    dispatchKeyboardInput(ownerId: string, input: KeyboardInputPayload) {
      const targetSubscription = Array.from(streamSubscriptions.entries()).find(([, subscription]) => {
        return subscription.kind === 'hid' && subscription.ownerId === ownerId;
      });
      if (!targetSubscription) {
        return false;
      }

      const [channelId] = targetSubscription;
      if (input.type !== 'keyDown') {
        return true;
      }
      if (input.control || input.alt || input.meta) {
        return false;
      }

      const normalizedKey = input.key;
      if (normalizedKey === 'Enter' || normalizedKey === 'NumpadEnter') {
        flushHidBuffer(channelId);
        return true;
      }
      if (normalizedKey.length !== 1) {
        return true;
      }
      appendHidCharacter(channelId, normalizedKey);
      return true;
    },
    emitPassiveEvent,
    clearOwnerSubscriptions(ownerId: string) {
      const channelIds = Array.from(streamSubscriptions.entries())
        .filter(([, subscription]) => subscription.ownerId === ownerId)
        .map(([channelId]) => channelId);
      channelIds.forEach(channelId => {
        clearSubscription(channelId);
      });
    },
    async isAvailable(channel: ChannelDescriptor) {
      if (channel.type === 'NETWORK') {
        return true;
      }
      if (channel.type === 'HID') {
        return channel.target === HID_KEYBOARD_TARGET;
      }
      if (channel.type === 'SERIAL') {
        return Boolean(channel.target) && Boolean(getSerialPortConstructor());
      }
      if (channel.type === 'INTENT' && channel.mode === 'passive') {
        return true;
      }
      return ['USB', 'SERIAL', 'BLUETOOTH'].includes(channel.type);
    },
    async getAvailableTargets(type: string) {
      switch (type) {
        case 'NETWORK':
          return ['http://127.0.0.1:8080', 'ws://127.0.0.1:8888'];
        case 'USB':
          return ['usb-mock-scanner'];
        case 'SERIAL': {
          const SerialPort = getSerialPortConstructor();
          if (!SerialPort) {
            return [];
          }
          try {
            return (await SerialPort.list()).map((port: SerialPortBindingInfo) => port.path);
          } catch {
            return [];
          }
        }
        case 'BLUETOOTH':
          return ['AA:BB:CC:DD:EE:FF'];
        case 'HID':
          return [HID_KEYBOARD_TARGET];
        case 'INTENT':
          return [PASSIVE_TARGET];
        default:
          return [];
      }
    },
  };
}

export function createHostServiceContainer(): HostServiceContainer {
  const userDataDir = app.getPath('userData');
  const loggerService = createLoggerService(path.join(userDataDir, 'logs'));
  const stateStorageService = createStateStorageService(path.join(userDataDir, 'storage'));
  const localWebServerService = createLocalWebServerService();
  const httpService = createHttpService(localWebServerService);
  const deviceService = createDeviceService(() => 'electron-device');
  const scriptsExecutionService = createScriptsExecutionService();
  const externalConnectorService = createExternalConnectorService();
  const eventEmitter = new EventEmitter();

  deviceService.onPowerStatusChanged(payload => {
    eventEmitter.emit('device.powerStatusChanged', payload);
  });
  externalConnectorService.onStream(payload => {
    eventEmitter.emit('externalConnector.stream', payload);
  });
  externalConnectorService.onPassive(payload => {
    eventEmitter.emit('externalConnector.passive', payload);
  });

  return {
    getLaunchContext(windowRole, overrides) {
      return {
        windowRole,
        displayIndex: windowRole === 'primary' ? 0 : 1,
        displayCount: overrides.displayCount,
        screenMode: ScreenMode.DESKTOP,
        deviceId: overrides.deviceId ?? 'electron-device',
        isPackaged: overrides.isPackaged,
        appVersion: overrides.appVersion,
        serverSpacePreset: overrides.serverSpacePreset,
        runtimeSource: overrides.isPackaged ? 'bundled' : 'dev-server',
      };
    },
    createBridgeApi(getLaunchContext, options) {
      const ownerId = options?.ownerId ?? 'global';
      return {
        getLaunchContext,
        appControl: {
          async isFullScreen() {
            return Boolean(options?.getPrimaryWindow?.()?.isFullScreen());
          },
          async isAppLocked() {
            return Boolean(options?.getPrimaryWindow?.()?.isKiosk());
          },
          async setFullScreen(isFullScreen: boolean) {
            options?.getPrimaryWindow?.()?.setFullScreen(isFullScreen);
          },
          async setAppLocked(isAppLocked: boolean) {
            options?.getPrimaryWindow?.()?.setKiosk(isAppLocked);
          },
          async restartApp() {
            if (options?.onRestartRequested) {
              await options.onRestartRequested();
              return;
            }
            app.relaunch();
            app.exit(0);
          },
          async onAppLoadComplete(displayIndex: number) {
            await options?.onPrimaryLoadComplete?.(displayIndex);
          },
        },
        device: {
          async getDeviceInfo() {
            return deviceService.getDeviceInfo();
          },
          async getSystemStatus() {
            return deviceService.getSystemStatus();
          },
          async subscribePowerStatus(listenerId: string) {
            return deviceService.subscribePowerStatus(listenerId);
          },
          async unsubscribePowerStatus(listenerId: string) {
            deviceService.unsubscribePowerStatus(listenerId);
          },
        },
        stateStorage: {
          async getItem(key: string, ...args: unknown[]) {
            return stateStorageService.getItem(key, ...args);
          },
          async setItem(key: string, value: unknown, ...args: unknown[]) {
            stateStorageService.setItem(key, value, ...args);
          },
          async removeItem(key: string, ...args: unknown[]) {
            stateStorageService.removeItem(key, ...args);
          },
        },
        logger: {
          async debug(tags: string[], message: string, data?: unknown) {
            loggerService.debug(tags, message, data);
          },
          async log(tags: string[], message: string, data?: unknown) {
            loggerService.log(tags, message, data);
          },
          async warn(tags: string[], message: string, data?: unknown) {
            loggerService.warn(tags, message, data);
          },
          async error(tags: string[], message: string, data?: unknown) {
            loggerService.error(tags, message, data);
          },
          async getLogFiles() {
            return loggerService.getLogFiles();
          },
          async getLogContent(fileName: string) {
            return loggerService.getLogContent(fileName);
          },
          async deleteLogFile(fileName: string) {
            return loggerService.deleteLogFile(fileName);
          },
          async clearAllLogs() {
            return loggerService.clearAllLogs();
          },
          async getLogDirPath() {
            return loggerService.getLogDirPath();
          },
        },
        localWebServer: {
          async start(config?: Partial<LocalWebServerConfig>) {
            return localWebServerService.start(config);
          },
          async stop() {
            localWebServerService.stop();
          },
          async getStatus() {
            return localWebServerService.getStatus();
          },
          async getStats() {
            return localWebServerService.getStats();
          },
          async register(payload: Record<string, unknown>) {
            return localWebServerService.register(payload as LocalRegistrationPayload);
          },
        },
        http: {
          async request<T = unknown>(request: HostBridgeHttpRequest) {
            return httpService.request<T>(request);
          },
        },
        scriptsExecution: {
          async executeScript<T = unknown>(scriptOptions: ScriptExecutionOptions<T>) {
            return scriptsExecutionService.executeScript<T>(scriptOptions);
          },
        },
        externalConnector: {
          call: externalConnectorService.call,
          subscribe: (channel: ChannelDescriptor) => externalConnectorService.subscribe(channel, ownerId),
          unsubscribe: externalConnectorService.unsubscribe,
          on: () => () => {},
          isAvailable: externalConnectorService.isAvailable,
          getAvailableTargets: externalConnectorService.getAvailableTargets,
        },
        events: {
          on: () => () => {},
        },
      };
    },
    dispatchKeyboardInput(ownerId, input) {
      return externalConnectorService.dispatchKeyboardInput(ownerId, input);
    },
    clearOwnerSubscriptions(ownerId: string) {
      externalConnectorService.clearOwnerSubscriptions(ownerId);
    },
    emitPassiveEvent(target, data) {
      externalConnectorService.emitPassiveEvent(target, data);
    },
    onEvent(eventType, listener) {
      eventEmitter.on(eventType, listener);
      return () => {
        eventEmitter.off(eventType, listener);
      };
    },
  };
}
