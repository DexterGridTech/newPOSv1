import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import {appControl, device, externalConnector, logger, stateStorage} from '@impos2/kernel-core-base';
import type {ConnectorEvent} from '@impos2/kernel-core-base';
import {
  ConnectionEventType,
  ConnectionState,
  type ConnectFailedEvent,
  type ConnectedEvent,
  type DisconnectedEvent,
  DualWebSocketClient,
  InstanceMode,
  SYSTEM_NOTIFICATION,
  type StateChangeEvent,
  type WSErrorEvent,
  type WSMessageEvent,
  localWebServer,
} from '@impos2/kernel-core-interconnection';
import NativeConnectorTurboModule from '../../supports/apis/NativeConnectorTurboModule';
import NativeDeviceTurboModule from '../../supports/apis/NativeDeviceTurboModule';
import NativeLocalWebServerTurboModule from '../../supports/apis/NativeLocalWebServerTurboModule';
import NativeLoggerTurboModule from '../../supports/apis/NativeLoggerTurboModule';
import NativeScriptsTurboModule from '../../supports/apis/NativeScriptsTurboModule';
import {ensureModulePreSetup} from '../../application/modulePreSetup';
import {scriptExecutionAdapter} from '../../foundations/scriptExecution';

type LogFile = {
  fileName: string;
  filePath: string;
  fileSize: number;
  lastModified: number;
};

type PanelKey =
  | 'device'
  | 'logger'
  | 'scripts'
  | 'connector'
  | 'storage'
  | 'webserver'
  | 'interconnection'
  | 'appcontrol'
  | 'stress';

type ActionItem = {
  key: string;
  label: string;
  onPress: () => void | Promise<void>;
};

type WebServerStatus = {
  status?: string;
  addresses?: Array<{name?: string; address?: string}>;
  config?: {
    port?: number;
    basePath?: string;
    heartbeatInterval?: number;
    heartbeatTimeout?: number;
  };
  error?: string | null;
};

const CAMERA_CHANNEL = JSON.stringify({
  type: 'INTENT',
  target: 'camera',
  mode: 'request-response',
});

const CAMERA_ACTION = 'com.impos2.posadapter.action.CAMERA_SCAN';
const PASSIVE_ACTION = 'com.impos2.connector.PASSIVE';
const STORAGE_KEY = 'mixc-retail-rn84v2:mmkv:test';
const WEB_SERVER_CONFIG = JSON.stringify({
  port: 8888,
  basePath: '/localServer',
  heartbeatInterval: 30000,
  heartbeatTimeout: 60000,
});
const INTERCONNECTION_MASTER_ID = 'rn84v2-master-self-test';

function pickPreferredWebServerAddress(addresses?: Array<{name?: string; address?: string}>): string | null {
  if (!addresses?.length) {
    return null;
  }
  return (
    addresses.find(item => item.name === 'loopback')?.address ??
    addresses.find(item => item.name === 'localhost')?.address ??
    addresses[0]?.address ??
    null
  );
}

export function AdapterDebugScreen(): React.JSX.Element {
  ensureModulePreSetup();
  const isDark = useColorScheme() === 'dark';
  const [output, setOutput] = useState('TurboModule + MMKV 验证页');
  const [lastLogFile, setLastLogFile] = useState<string>('');
  const [activePanel, setActivePanel] = useState<PanelKey>('device');
  const [appControlState, setAppControlState] = useState({fullscreen: false, locked: false});
  const passiveRemoveRef = useRef<(() => void) | null>(null);
  const hidChannelIdRef = useRef<string | null>(null);
  const hidRemoveRef = useRef<(() => void) | null>(null);
  const hidEventCountRef = useRef(0);
  const hidErrorCountRef = useRef(0);
  const passiveEventCountRef = useRef(0);
  const dualClientRef = useRef<DualWebSocketClient | null>(null);
  const interconnectionListeningRef = useRef(false);
  const devicePowerUnsubscribeRef = useRef<(() => void) | null>(null);

  const append = (text: string) => {
    setOutput(prev => `${prev}\n${text}`);
  };

  const resetOutput = () => {
    setOutput('TurboModule + MMKV 验证页');
  };

  const fetchWebServerHealth = async (): Promise<string> => {
    const status = (await NativeLocalWebServerTurboModule.getLocalWebServerStatus()) as WebServerStatus;
    const webServerAddress = pickPreferredWebServerAddress(status.addresses);

    if (!webServerAddress) {
      throw new Error('webserver address not found');
    }

    const response = await fetch(`${webServerAddress}/health`);
    const text = await response.text();
    return `status=${response.status}, body=${text}`;
  };

  const getLoopbackServerUrl = async (): Promise<string> => {
    const status = (await NativeLocalWebServerTurboModule.getLocalWebServerStatus()) as WebServerStatus;
    const webServerAddress = pickPreferredWebServerAddress(status.addresses);

    if (!webServerAddress) {
      throw new Error('webserver address not found');
    }

    return webServerAddress;
  };

  useEffect(() => {
    void readAppControlStatus('initial sync');
    return () => {
      devicePowerUnsubscribeRef.current?.();
      devicePowerUnsubscribeRef.current = null;
    };
  }, []);

  const readAppControlStatus = async (reason: string): Promise<void> => {
    const isFullscreen = await appControl.isFullScreen();
    const isLocked = await appControl.isAppLocked();
    setAppControlState({fullscreen: isFullscreen, locked: isLocked});
    const kioskHint = isLocked
      ? 'lock task 已激活'
      : '如果已点击锁定但仍为 false，通常是当前设备/模拟器不满足 lock task 条件';
    append(
      `appControl ${reason} status => fullscreen=${String(isFullscreen)}, locked=${String(isLocked)}, hint=${kioskHint}`,
    );
  };

  const ensureInterconnectionClient = (): DualWebSocketClient => {
    const client = dualClientRef.current ?? DualWebSocketClient.getInstance();

    if (!interconnectionListeningRef.current) {
      client.on(ConnectionEventType.STATE_CHANGE, (event: StateChangeEvent) => {
        append(`interconnection state => ${event.oldState} -> ${event.newState}`);
      });
      client.on(ConnectionEventType.CONNECTED, (event: ConnectedEvent) => {
        append(`interconnection connected => ${event.serverUrl}, device=${event.deviceInfo.deviceId}`);
      });
      client.on(ConnectionEventType.CONNECT_FAILED, (event: ConnectFailedEvent) => {
        append(`interconnection connect failed => ${event.error.type}, ${event.error.message}`);
      });
      client.on(ConnectionEventType.DISCONNECTED, (event: DisconnectedEvent) => {
        append(`interconnection disconnected => ${event.reason ?? 'unknown'}`);
      });
      client.on(ConnectionEventType.ERROR, (event: WSErrorEvent) => {
        append(`interconnection error => ${event.error.type}, ${event.error.message}`);
      });
      client.on(ConnectionEventType.HEARTBEAT_TIMEOUT, () => {
        append('interconnection heartbeat timeout');
      });
      client.on(ConnectionEventType.MESSAGE, (event: WSMessageEvent) => {
        const {message} = event;
        append(`interconnection message => ${message.type}, data=${JSON.stringify(message.data)}`);
        if (message.type === SYSTEM_NOTIFICATION.HEARTBEAT) {
          append('interconnection heartbeat => received');
        }
      });
      interconnectionListeningRef.current = true;
    }

    dualClientRef.current = client;
    return client;
  };

  const deviceActions = useMemo<ActionItem[]>(
    () => [
      {
        key: 'device-info',
        label: '获取 DeviceInfo',
        onPress: async () => {
          try {
            const result = await NativeDeviceTurboModule.getDeviceInfo();
            append(`deviceInfo => ${JSON.stringify(result)}`);
          } catch (error) {
            append(`deviceInfo error => ${String(error)}`);
          }
        },
      },
      {
        key: 'system-status',
        label: '获取 SystemStatus',
        onPress: async () => {
          try {
            const result = await NativeDeviceTurboModule.getSystemStatus();
            append(`systemStatus => ${JSON.stringify(result)}`);
          } catch (error) {
            append(`systemStatus error => ${String(error)}`);
          }
        },
      },
      {
        key: 'device-info-adapter',
        label: '通过 adapter 获取 DeviceInfo',
        onPress: async () => {
          try {
            const result = await device.getDeviceInfo();
            append(`device adapter => ${JSON.stringify(result)}`);
          } catch (error) {
            append(`device adapter error => ${String(error)}`);
          }
        },
      },
      {
        key: 'system-status-adapter',
        label: '通过 adapter 获取 SystemStatus',
        onPress: async () => {
          try {
            const result = await device.getSystemStatus();
            append(`systemStatus adapter => ${JSON.stringify(result)}`);
          } catch (error) {
            append(`systemStatus adapter error => ${String(error)}`);
          }
        },
      },
      {
        key: 'power-listen-start',
        label: '开始监听电源变化',
        onPress: () => {
          if (devicePowerUnsubscribeRef.current) {
            append('device power listener => already active');
            return;
          }
          devicePowerUnsubscribeRef.current = device.addPowerStatusChangeListener(event => {
            append(`powerStatusChanged => ${JSON.stringify(event)}`);
          });
          append('device power listener => started');
        },
      },
      {
        key: 'power-listen-stop',
        label: '停止监听电源变化',
        onPress: () => {
          if (!devicePowerUnsubscribeRef.current) {
            append('device power listener => not active');
            return;
          }
          devicePowerUnsubscribeRef.current();
          devicePowerUnsubscribeRef.current = null;
          append('device power listener => stopped');
        },
      },
      {
        key: 'power-listen-state',
        label: '查看监听状态',
        onPress: () => {
          append(`device power listener => ${devicePowerUnsubscribeRef.current ? 'active' : 'inactive'}`);
        },
      },
    ],
    [],
  );

  const loggerActions = useMemo<ActionItem[]>(
    () => [
      {
        key: 'write-logs-adapter',
        label: '通过 adapter 写入日志',
        onPress: async () => {
          try {
            logger.debug(['RN84v2', 'adapter'], 'debug message from adapter');
            logger.log(['RN84v2', 'adapter'], 'info message from adapter');
            logger.warn(['RN84v2', 'adapter'], 'warn message from adapter');
            logger.error(['RN84v2', 'adapter'], 'error message from adapter');
            append('logger adapter => write done');
          } catch (error) {
            append(`logger adapter write error => ${String(error)}`);
          }
        },
      },
      {
        key: 'read-log-files-adapter',
        label: '通过 adapter 读取日志列表',
        onPress: async () => {
          try {
            const files = (await logger.getLogFiles()) as LogFile[];
            append(`logger adapter files => ${JSON.stringify(files)}`);
            if (files[0]?.fileName) {
              setLastLogFile(files[0].fileName);
            }
          } catch (error) {
            append(`logger adapter files error => ${String(error)}`);
          }
        },
      },
      {
        key: 'read-log-content-adapter',
        label: '通过 adapter 读取最近日志',
        onPress: async () => {
          try {
            if (!lastLogFile) {
              append('logger adapter content => no file selected');
              return;
            }
            const content = await logger.getLogContent(lastLogFile);
            append(`logger adapter content(${lastLogFile}) => ${content}`);
          } catch (error) {
            append(`logger adapter content error => ${String(error)}`);
          }
        },
      },
      {
        key: 'clear-logs-adapter',
        label: '通过 adapter 清空日志',
        onPress: async () => {
          try {
            const result = await logger.clearAllLogs();
            setLastLogFile('');
            append(`logger adapter clear => ${String(result)}`);
          } catch (error) {
            append(`logger adapter clear error => ${String(error)}`);
          }
        },
      },
      {
        key: 'logger-native-smoke',
        label: 'Native 直连写日志(辅助)',
        onPress: async () => {
          try {
            NativeLoggerTurboModule.debug('RN84v2', 'debug message from JS');
            NativeLoggerTurboModule.log('RN84v2', 'info message from JS');
            NativeLoggerTurboModule.warn('RN84v2', 'warn message from JS');
            NativeLoggerTurboModule.error('RN84v2', 'error message from JS');
            append('logger native => smoke done');
          } catch (error) {
            append(`logger native smoke error => ${String(error)}`);
          }
        },
      },
    ],
    [lastLogFile],
  );

  const scriptsActions = useMemo<ActionItem[]>(
    () => [
      {
        key: 'simple-script',
        label: '执行简单脚本',
        onPress: async () => {
          try {
            const result = await NativeScriptsTurboModule.executeScript(
              'return 1 + 2 + 3;',
              '{}',
              '{}',
              [],
              5000,
            );
            append(`script simple => ${JSON.stringify(result)}`);
          } catch (error) {
            append(`script simple error => ${String(error)}`);
          }
        },
      },
      {
        key: 'params-script',
        label: '执行参数脚本',
        onPress: async () => {
          try {
            const result = await NativeScriptsTurboModule.executeScript(
              'return params.a + params.b;',
              '{"a":10,"b":20}',
              '{}',
              [],
              5000,
            );
            append(`script params => ${JSON.stringify(result)}`);
          } catch (error) {
            append(`script params error => ${String(error)}`);
          }
        },
      },
      {
        key: 'error-script',
        label: '执行异常脚本',
        onPress: async () => {
          try {
            const result = await NativeScriptsTurboModule.executeScript(
              "throw new Error('boom')",
              '{}',
              '{}',
              [],
              5000,
            );
            append(`script error => ${JSON.stringify(result)}`);
          } catch (error) {
            append(`script error host => ${String(error)}`);
          }
        },
      },
      {
        key: 'native-function-success',
        label: '执行 nativeFunction 成功脚本',
        onPress: async () => {
          try {
            const result = await scriptExecutionAdapter.executeScript<number>({
              script: 'return nativeAdd(params.a, params.b);',
              params: {a: 7, b: 8},
              nativeFunctions: {
                nativeAdd: async (a: number, b: number) => a + b,
              },
              timeout: 5000,
            });
            append(`script native success => ${JSON.stringify(result)}`);
          } catch (error) {
            append(`script native success error => ${String(error)}`);
          }
        },
      },
      {
        key: 'native-function-error',
        label: '执行 nativeFunction 异常脚本',
        onPress: async () => {
          try {
            const result = await scriptExecutionAdapter.executeScript({
              script: 'return nativeBoom(params.reason);',
              params: {reason: 'boom-from-js'},
              nativeFunctions: {
                nativeBoom: async (reason: string) => {
                  throw new Error(reason);
                },
              },
              timeout: 5000,
            });
            append(`script native error unexpected => ${JSON.stringify(result)}`);
          } catch (error) {
            append(`script native error => ${String(error)}`);
          }
        },
      },
      {
        key: 'native-function-concurrent',
        label: '并发执行 nativeFunction 脚本',
        onPress: async () => {
          try {
            const values = await Promise.all([
              scriptExecutionAdapter.executeScript<number>({
                script: 'return nativeAdd(params.a, params.b);',
                params: {a: 1, b: 2},
                nativeFunctions: {
                  nativeAdd: async (a: number, b: number) => {
                    await new Promise<void>(resolve => setTimeout(resolve, 120));
                    return a + b;
                  },
                },
                timeout: 5000,
              }),
              scriptExecutionAdapter.executeScript<number>({
                script: 'return nativeAdd(params.a, params.b);',
                params: {a: 10, b: 20},
                nativeFunctions: {
                  nativeAdd: async (a: number, b: number) => {
                    await new Promise<void>(resolve => setTimeout(resolve, 80));
                    return a + b;
                  },
                },
                timeout: 5000,
              }),
            ]);
            append(`script native concurrent => ${JSON.stringify(values)}`);
          } catch (error) {
            append(`script native concurrent error => ${String(error)}`);
          }
        },
      },
      {
        key: 'script-stats',
        label: '查看脚本统计',
        onPress: async () => {
          try {
            const result = await NativeScriptsTurboModule.getStats();
            append(`script stats => ${JSON.stringify(result)}`);
          } catch (error) {
            append(`script stats error => ${String(error)}`);
          }
        },
      },
      {
        key: 'clear-script-stats',
        label: '清空脚本统计',
        onPress: () => {
          try {
            NativeScriptsTurboModule.clearStats();
            append('script stats => cleared');
          } catch (error) {
            append(`script clear error => ${String(error)}`);
          }
        },
      },
    ],
    [],
  );

  const connectorActions = useMemo<ActionItem[]>(
    () => [
      {
        key: 'connector-available-adapter',
        label: '通过 adapter 检查 camera 可用性',
        onPress: async () => {
          try {
            const available = await externalConnector.isAvailable({
              type: 'INTENT',
              target: 'camera',
              mode: 'request-response',
            });
            const targets = await externalConnector.getAvailableTargets('INTENT');
            append(`connector adapter available => ${String(available)}, targets=${JSON.stringify(targets)}`);
          } catch (error) {
            append(`connector adapter available error => ${String(error)}`);
          }
        },
      },
      {
        key: 'connector-camera-all-adapter',
        label: '通过 adapter 摄像头扫码(ALL)',
        onPress: async () => {
          try {
            const result = await externalConnector.call(
              {type: 'INTENT', target: 'camera', mode: 'request-response'},
              CAMERA_ACTION,
              {waitResult: true, SCAN_MODE: 'ALL'},
              29000,
            );
            append(`connector adapter camera all => ${JSON.stringify(result)}`);
          } catch (error) {
            append(`connector adapter camera all error => ${String(error)}`);
          }
        },
      },
      {
        key: 'connector-camera-qr-adapter',
        label: '通过 adapter 摄像头扫码(QR)',
        onPress: async () => {
          try {
            const result = await externalConnector.call(
              {type: 'INTENT', target: 'camera', mode: 'request-response'},
              CAMERA_ACTION,
              {waitResult: true, SCAN_MODE: 'QR_CODE_MODE'},
              29000,
            );
            append(`connector adapter camera qr => ${JSON.stringify(result)}`);
          } catch (error) {
            append(`connector adapter camera qr error => ${String(error)}`);
          }
        },
      },
      {
        key: 'connector-system-file-adapter',
        label: '通过 adapter 系统文件选择器',
        onPress: async () => {
          try {
            const result = await externalConnector.call(
              {type: 'INTENT', target: 'system', mode: 'request-response'},
              'android.intent.action.OPEN_DOCUMENT',
              {
                waitResult: true,
                systemIntent: true,
                type: '*/*',
                category: 'android.intent.category.OPENABLE',
              },
              59000,
            );
            append(`connector adapter system file => ${JSON.stringify(result)}`);
          } catch (error) {
            append(`connector adapter system file error => ${String(error)}`);
          }
        },
      },
      {
        key: 'connector-hid-subscribe-adapter',
        label: '通过 adapter 开启 HID 监听',
        onPress: async () => {
          try {
            if (hidChannelIdRef.current) {
              append(`hid stream => already active: ${hidChannelIdRef.current}`);
              return;
            }
            hidEventCountRef.current = 0;
            hidErrorCountRef.current = 0;
            const channelId = await externalConnector.subscribe(
              {type: 'HID', target: 'keyboard', mode: 'stream'},
              (event: ConnectorEvent) => {
                hidEventCountRef.current += 1;
                append(`hid stream event[${hidEventCountRef.current}] => ${JSON.stringify(event)}`);
              },
              (errorEvent: ConnectorEvent) => {
                hidErrorCountRef.current += 1;
                append(`hid stream error[${hidErrorCountRef.current}] => ${JSON.stringify(errorEvent)}`);
              },
            );
            hidChannelIdRef.current = channelId;
            append(`hid stream subscribed => ${channelId}`);
          } catch (error) {
            append(`hid stream subscribe error => ${String(error)}`);
          }
        },
      },
      {
        key: 'connector-hid-state-adapter',
        label: '查看 HID 监听状态',
        onPress: () => {
          append(
            `hid stream state => channelId=${hidChannelIdRef.current ?? 'none'}, eventCount=${hidEventCountRef.current}, errorCount=${hidErrorCountRef.current}`,
          );
        },
      },
      {
        key: 'connector-hid-unsubscribe-adapter',
        label: '通过 adapter 关闭 HID 监听',
        onPress: async () => {
          try {
            if (!hidChannelIdRef.current) {
              append('hid stream => no active subscription');
              return;
            }
            const currentChannelId = hidChannelIdRef.current;
            await externalConnector.unsubscribe(currentChannelId);
            hidChannelIdRef.current = null;
            append(`hid stream unsubscribed => ${currentChannelId}`);
            append('hid stream verify => press keyboard/scanner again, eventCount should remain unchanged');
          } catch (error) {
            append(`hid stream unsubscribe error => ${String(error)}`);
          }
        },
      },
      {
        key: 'connector-passive-listen-adapter',
        label: '通过 adapter 开始 passive 监听',
        onPress: () => {
          try {
            if (passiveRemoveRef.current) {
              append('passive => already listening');
              return;
            }
            passiveEventCountRef.current = 0;
            passiveRemoveRef.current = externalConnector.on('connector.passive', (event: ConnectorEvent) => {
              passiveEventCountRef.current += 1;
              append(`passive event[${passiveEventCountRef.current}] => ${JSON.stringify(event)}`);
            });
            append(`passive listen => started, adb: adb shell am broadcast -a ${PASSIVE_ACTION} --es source rn84v2 --es message hello`);
          } catch (error) {
            append(`passive listen error => ${String(error)}`);
          }
        },
      },
      {
        key: 'connector-passive-state-adapter',
        label: '查看 passive 监听状态',
        onPress: () => {
          append(
            `passive state => listening=${String(Boolean(passiveRemoveRef.current))}, eventCount=${passiveEventCountRef.current}`,
          );
        },
      },
      {
        key: 'connector-passive-stop-adapter',
        label: '停止 passive 监听',
        onPress: () => {
          passiveRemoveRef.current?.();
          passiveRemoveRef.current = null;
          append('passive listen => stopped');
          append('passive verify => send adb broadcast again, eventCount should remain unchanged');
        },
      },
      {
        key: 'connector-invalid-action-adapter',
        label: '通过 adapter 非法 action(失败分支)',
        onPress: async () => {
          try {
            const result = await externalConnector.call(
              {type: 'INTENT', target: 'camera', mode: 'request-response'},
              'invalid.action',
              {waitResult: true, SCAN_MODE: 'ALL'},
              10000,
            );
            append(`connector adapter invalid action => ${JSON.stringify(result)}`);
          } catch (error) {
            append(`connector adapter invalid action error => ${String(error)}`);
          }
        },
      },
      {
        key: 'connector-native-smoke',
        label: 'Native 直连 camera(辅助)',
        onPress: async () => {
          try {
            const result = await NativeConnectorTurboModule.call(
              CAMERA_CHANNEL,
              CAMERA_ACTION,
              JSON.stringify({waitResult: true, SCAN_MODE: 'ALL'}),
              29000,
            );
            append(`connector native smoke => ${JSON.stringify(result)}`);
          } catch (error) {
            append(`connector native smoke error => ${String(error)}`);
          }
        },
      },
    ],
    [],
  );

  const storageActions = useMemo<ActionItem[]>(
    () => [
      {
        key: 'storage-write',
        label: 'MMKV 写入对象',
        onPress: async () => {
          try {
            const payload = {source: 'mixc-retail-rn84v2', ts: Date.now(), ok: true};
            await stateStorage.setItem(STORAGE_KEY, payload);
            append(`storage write object => ${JSON.stringify(payload)}`);
          } catch (error) {
            append(`storage write object error => ${String(error)}`);
          }
        },
      },
      {
        key: 'storage-write-string',
        label: 'MMKV 写入字符串',
        onPress: async () => {
          try {
            const payload = 'plain-string-value';
            await stateStorage.setItem(STORAGE_KEY, payload);
            append(`storage write string => ${JSON.stringify(payload)}`);
          } catch (error) {
            append(`storage write string error => ${String(error)}`);
          }
        },
      },
      {
        key: 'storage-write-array',
        label: 'MMKV 写入数组',
        onPress: async () => {
          try {
            const payload = ['alpha', 2, true, {nested: 'ok'}];
            await stateStorage.setItem(STORAGE_KEY, payload);
            append(`storage write array => ${JSON.stringify(payload)}`);
          } catch (error) {
            append(`storage write array error => ${String(error)}`);
          }
        },
      },
      {
        key: 'storage-write-null',
        label: 'MMKV 写入 null',
        onPress: async () => {
          try {
            await stateStorage.setItem(STORAGE_KEY, null);
            append('storage write null => done');
          } catch (error) {
            append(`storage write null error => ${String(error)}`);
          }
        },
      },
      {
        key: 'storage-overwrite',
        label: 'MMKV 覆盖写',
        onPress: async () => {
          try {
            await stateStorage.setItem(STORAGE_KEY, {version: 1, step: 'before'});
            await stateStorage.setItem(STORAGE_KEY, {version: 2, step: 'after'});
            const value = await stateStorage.getItem(STORAGE_KEY);
            append(`storage overwrite => ${JSON.stringify(value)}`);
          } catch (error) {
            append(`storage overwrite error => ${String(error)}`);
          }
        },
      },
      {
        key: 'storage-read',
        label: 'MMKV 读取',
        onPress: async () => {
          try {
            const value = await stateStorage.getItem(STORAGE_KEY);
            append(`storage read => ${JSON.stringify(value)}`);
          } catch (error) {
            append(`storage read error => ${String(error)}`);
          }
        },
      },
      {
        key: 'storage-remove',
        label: 'MMKV 删除',
        onPress: async () => {
          try {
            await stateStorage.removeItem(STORAGE_KEY);
            append('storage remove => done');
          } catch (error) {
            append(`storage remove error => ${String(error)}`);
          }
        },
      },
      {
        key: 'storage-read-after-remove',
        label: '删除后读取',
        onPress: async () => {
          try {
            const value = await stateStorage.getItem(STORAGE_KEY);
            append(`storage read after remove => ${JSON.stringify(value)}`);
          } catch (error) {
            append(`storage read after remove error => ${String(error)}`);
          }
        },
      },
    ],
    [],
  );

  const webServerActions = useMemo<ActionItem[]>(
    () => [
      {
        key: 'webserver-start-adapter',
        label: '通过 adapter 启动 LocalWebServer',
        onPress: async () => {
          try {
            const result = await localWebServer.startLocalWebServer({
              port: 8888,
              basePath: '/localServer',
              heartbeatInterval: 30000,
              heartbeatTimeout: 60000,
            });
            append(`webserver adapter start => ${JSON.stringify(result)}`);
          } catch (error) {
            append(`webserver adapter start error => ${String(error)}`);
          }
        },
      },
      {
        key: 'webserver-status-adapter',
        label: '通过 adapter 查看状态',
        onPress: async () => {
          try {
            const result = await localWebServer.getLocalWebServerStatus();
            append(`webserver adapter status => ${JSON.stringify(result)}`);
          } catch (error) {
            append(`webserver adapter status error => ${String(error)}`);
          }
        },
      },
      {
        key: 'webserver-health',
        label: '请求 /health',
        onPress: async () => {
          try {
            const result = await fetchWebServerHealth();
            append(`webserver health => ${result}`);
          } catch (error) {
            append(`webserver health error => ${String(error)}`);
          }
        },
      },
      {
        key: 'webserver-http-stats',
        label: '请求 /stats',
        onPress: async () => {
          try {
            const status = await localWebServer.getLocalWebServerStatus();
            const webServerAddress = pickPreferredWebServerAddress(status.addresses);
            if (!webServerAddress) {
              throw new Error('webserver address not found');
            }
            const response = await fetch(`${webServerAddress}/stats`);
            const text = await response.text();
            append(`webserver http stats => status=${response.status}, body=${text}`);
          } catch (error) {
            append(`webserver http stats error => ${String(error)}`);
          }
        },
      },
      {
        key: 'webserver-http-register',
        label: 'POST /register',
        onPress: async () => {
          try {
            const status = await localWebServer.getLocalWebServerStatus();
            const webServerAddress = pickPreferredWebServerAddress(status.addresses);
            if (!webServerAddress) {
              throw new Error('webserver address not found');
            }
            const response = await fetch(`${webServerAddress}/register`, {method: 'POST'});
            const text = await response.text();
            append(`webserver register => status=${response.status}, body=${text}`);
          } catch (error) {
            append(`webserver register error => ${String(error)}`);
          }
        },
      },
      {
        key: 'webserver-stats-adapter',
        label: '通过 adapter 查看统计',
        onPress: async () => {
          try {
            const result = await localWebServer.getLocalWebServerStats();
            append(`webserver adapter stats => ${JSON.stringify(result)}`);
          } catch (error) {
            append(`webserver adapter stats error => ${String(error)}`);
          }
        },
      },
      {
        key: 'webserver-stop-adapter',
        label: '通过 adapter 停止 LocalWebServer',
        onPress: async () => {
          try {
            await localWebServer.stopLocalWebServer();
            append('webserver adapter stop => done');
          } catch (error) {
            append(`webserver adapter stop error => ${String(error)}`);
          }
        },
      },
      {
        key: 'webserver-native-smoke',
        label: 'Native 直连查看状态(辅助)',
        onPress: async () => {
          try {
            const result = await NativeLocalWebServerTurboModule.getLocalWebServerStatus();
            append(`webserver native status => ${JSON.stringify(result)}`);
          } catch (error) {
            append(`webserver native status error => ${String(error)}`);
          }
        },
      },
    ],
    [],
  );

  const interconnectionActions = useMemo<ActionItem[]>(
    () => [
      {
        key: 'interconnection-self-connect',
        label: '启动服务并自连',
        onPress: async () => {
          try {
            await localWebServer.startLocalWebServer({
              port: 8888,
              basePath: '/localServer',
              heartbeatInterval: 30000,
              heartbeatTimeout: 60000,
            });
            const serverUrl = await getLoopbackServerUrl();
            const client = ensureInterconnectionClient();

            if (client.getState() !== ConnectionState.DISCONNECTED) {
              client.disconnect('restart-self-connect');
            }

            append(`interconnection self connect => server=${serverUrl}`);
            await client.connect({
              deviceRegistration: {
                type: InstanceMode.MASTER,
                deviceId: INTERCONNECTION_MASTER_ID,
                runtimeConfig: {
                  heartbeatInterval: 30000,
                  heartbeatTimeout: 60000,
                  retryCacheTimeout: 30000,
                },
              },
              serverUrls: [serverUrl],
              connectionTimeout: 10000,
              heartbeatTimeout: 60000,
            });
            append(`interconnection self connect done => state=${client.getState()}`);
          } catch (error) {
            append(`interconnection self connect error => ${String(error)}`);
          }
        },
      },
      {
        key: 'interconnection-state',
        label: '查看连接状态',
        onPress: () => {
          try {
            const client = ensureInterconnectionClient();
            append(
              `interconnection status => state=${client.getState()}, connected=${String(client.isConnected())}, server=${client.getCurrentServerUrl()}`,
            );
          } catch (error) {
            append(`interconnection status error => ${String(error)}`);
          }
        },
      },
      {
        key: 'interconnection-send-message',
        label: '发送测试消息',
        onPress: () => {
          try {
            const client = ensureInterconnectionClient();
            client.sendMessage('RN84V2_SELF_TEST', {sentAt: Date.now(), source: 'mixc-retail-rn84v2'});
            append('interconnection send => RN84V2_SELF_TEST');
          } catch (error) {
            append(`interconnection send error => ${String(error)}`);
          }
        },
      },
      {
        key: 'interconnection-disconnect',
        label: '断开自连',
        onPress: () => {
          try {
            dualClientRef.current?.disconnect('manual-disconnect');
            append('interconnection disconnect => requested');
          } catch (error) {
            append(`interconnection disconnect error => ${String(error)}`);
          }
        },
      },
      {
        key: 'interconnection-destroy',
        label: '销毁客户端',
        onPress: () => {
          try {
            dualClientRef.current?.destroy();
            dualClientRef.current = null;
            interconnectionListeningRef.current = false;
            append('interconnection client => destroyed');
          } catch (error) {
            append(`interconnection destroy error => ${String(error)}`);
          }
        },
      },
      {
        key: 'interconnection-clear-output',
        label: '清空输出',
        onPress: () => {
          resetOutput();
        },
      },
    ],
    [],
  );

  const appControlActions = useMemo<ActionItem[]>(
    () => [
      {
        key: 'appcontrol-status',
        label: '查看 AppControl 状态',
        onPress: async () => {
          try {
            await readAppControlStatus('manual');
          } catch (error) {
            append(`appControl status error => ${String(error)}`);
          }
        },
      },
      {
        key: 'appcontrol-fullscreen-on',
        label: '开启全屏',
        onPress: async () => {
          try {
            await appControl.setFullScreen(true);
            append('appControl fullscreen => requested true');
            await readAppControlStatus('after fullscreen on');
          } catch (error) {
            append(`appControl fullscreen on error => ${String(error)}`);
          }
        },
      },
      {
        key: 'appcontrol-fullscreen-off',
        label: '关闭全屏',
        onPress: async () => {
          try {
            await appControl.setFullScreen(false);
            append('appControl fullscreen => requested false');
            await readAppControlStatus('after fullscreen off');
          } catch (error) {
            append(`appControl fullscreen off error => ${String(error)}`);
          }
        },
      },
      {
        key: 'appcontrol-lock-on',
        label: '开启锁定模式',
        onPress: async () => {
          try {
            await appControl.setAppLocked(true);
            append('appControl lock => requested true');
            await readAppControlStatus('after lock on');
          } catch (error) {
            append(`appControl lock on error => ${String(error)}`);
          }
        },
      },
      {
        key: 'appcontrol-lock-off',
        label: '关闭锁定模式',
        onPress: async () => {
          try {
            await appControl.setAppLocked(false);
            append('appControl lock => requested false');
            await readAppControlStatus('after lock off');
          } catch (error) {
            append(`appControl lock off error => ${String(error)}`);
          }
        },
      },
      {
        key: 'appcontrol-load-complete',
        label: '触发 onAppLoadComplete',
        onPress: async () => {
          try {
            await appControl.onAppLoadComplete(0);
            append('appControl onAppLoadComplete => done');
          } catch (error) {
            append(`appControl onAppLoadComplete error => ${String(error)}`);
          }
        },
      },
      {
        key: 'appcontrol-restart',
        label: '重启 App',
        onPress: async () => {
          try {
            append('appControl restart => requested');
            await appControl.restartApp();
          } catch (error) {
            append(`appControl restart error => ${String(error)}`);
          }
        },
      },
      {
        key: 'appcontrol-clear-output',
        label: '清空输出',
        onPress: () => {
          resetOutput();
        },
      },
    ],
    [],
  );

  const stressActions = useMemo<ActionItem[]>(
    () => [
      {
        key: 'stress-script-100',
        label: '脚本执行 100 次',
        onPress: async () => {
          try {
            const total = 100;
            const startedAt = Date.now();
            for (let index = 0; index < total; index += 1) {
              const result = await NativeScriptsTurboModule.executeScript(
                'return params.index * 2;',
                JSON.stringify({index}),
                '{}',
                [],
                5000,
              );
              if (index === 0 || index === total - 1 || (index + 1) % 25 === 0) {
                append(`stress script progress => ${index + 1}/${total}, result=${JSON.stringify(result)}`);
              }
            }
            append(`stress script done => total=${total}, cost=${Date.now() - startedAt}ms`);
          } catch (error) {
            append(`stress script error => ${String(error)}`);
          }
        },
      },
      {
        key: 'stress-logger-500',
        label: '日志写入 500 条',
        onPress: async () => {
          try {
            const total = 500;
            const startedAt = Date.now();
            for (let index = 0; index < total; index += 1) {
              NativeLoggerTurboModule.log('Stress', `log item ${index}`);
            }
            append(`stress logger done => total=${total}, cost=${Date.now() - startedAt}ms`);
          } catch (error) {
            append(`stress logger error => ${String(error)}`);
          }
        },
      },
      {
        key: 'stress-webserver-cycle-10',
        label: 'WebServer 启停回归 10 次',
        onPress: async () => {
          try {
            const total = 10;
            const startedAt = Date.now();
            for (let index = 0; index < total; index += 1) {
              await NativeLocalWebServerTurboModule.startLocalWebServer(WEB_SERVER_CONFIG);
              const health = await fetchWebServerHealth();
              append(`stress webserver progress => ${index + 1}/${total}, ${health}`);
              await NativeLocalWebServerTurboModule.stopLocalWebServer();
            }
            append(`stress webserver done => total=${total}, cost=${Date.now() - startedAt}ms`);
          } catch (error) {
            append(`stress webserver error => ${String(error)}`);
          }
        },
      },
      {
        key: 'clear-output',
        label: '清空输出',
        onPress: () => {
          resetOutput();
        },
      },
    ],
    [],
  );

  const activeActions =
    activePanel === 'device'
      ? deviceActions
      : activePanel === 'logger'
        ? loggerActions
        : activePanel === 'scripts'
          ? scriptsActions
          : activePanel === 'connector'
            ? connectorActions
            : activePanel === 'storage'
              ? storageActions
              : activePanel === 'webserver'
                ? webServerActions
                : activePanel === 'interconnection'
                  ? interconnectionActions
                  : activePanel === 'appcontrol'
                    ? appControlActions
                : stressActions;

  const rootPaddingTop = appControlState.fullscreen ? 16 : (StatusBar.currentHeight ?? 0) + 16;

  return (
    <View style={[styles.safeArea, isDark ? styles.darkBg : styles.lightBg]}>
      <StatusBar
        hidden={appControlState.fullscreen}
        translucent={appControlState.fullscreen}
        backgroundColor="transparent"
        barStyle={isDark ? 'light-content' : 'dark-content'}
      />
      <View style={[styles.header, {paddingTop: rootPaddingTop}]}>
        <Text style={[styles.title, isDark ? styles.darkText : styles.lightText]}>
          mixc-retail-rn84v2
        </Text>
        <Text style={[styles.subtitle, isDark ? styles.darkSubText : styles.lightSubText]}>
          TurboModule + MMKV + WebServer 验证面板
        </Text>
      </View>

      <View style={styles.tabRow}>
        <TabButton label="Device" active={activePanel === 'device'} onPress={() => setActivePanel('device')} />
        <TabButton label="Logger" active={activePanel === 'logger'} onPress={() => setActivePanel('logger')} />
        <TabButton label="Scripts" active={activePanel === 'scripts'} onPress={() => setActivePanel('scripts')} />
        <TabButton label="Connector" active={activePanel === 'connector'} onPress={() => setActivePanel('connector')} />
        <TabButton label="Storage" active={activePanel === 'storage'} onPress={() => setActivePanel('storage')} />
        <TabButton label="WebServer" active={activePanel === 'webserver'} onPress={() => setActivePanel('webserver')} />
        <TabButton label="Interconnect" active={activePanel === 'interconnection'} onPress={() => setActivePanel('interconnection')} />
        <TabButton label="AppControl" active={activePanel === 'appcontrol'} onPress={() => setActivePanel('appcontrol')} />
        <TabButton label="Stress" active={activePanel === 'stress'} onPress={() => setActivePanel('stress')} />
      </View>

      <ScrollView
        style={styles.actionsScroll}
        contentContainerStyle={styles.actionsContent}
        keyboardShouldPersistTaps="handled">
        {activeActions.map(action => (
          <ActionButton key={action.key} label={action.label} onPress={action.onPress} />
        ))}
      </ScrollView>

      <View style={styles.outputPanel}>
        <Text style={styles.outputLabel}>运行日志</Text>
        <ScrollView
          style={styles.outputScroll}
          contentContainerStyle={styles.outputContent}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled">
          <Text style={styles.outputText}>{output}</Text>
        </ScrollView>
      </View>
    </View>
  );
}

function TabButton({label, active, onPress}: {label: string; active: boolean; onPress: () => void}) {
  return (
    <Pressable style={[styles.tabButton, active && styles.tabButtonActive]} onPress={onPress}>
      <Text style={[styles.tabButtonText, active && styles.tabButtonTextActive]}>{label}</Text>
    </Pressable>
  );
}

function ActionButton({label, onPress}: {label: string; onPress: () => void | Promise<void>}) {
  return (
    <Pressable style={styles.button} onPress={() => void onPress()}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {flex: 1},
  lightBg: {backgroundColor: '#f3efe6'},
  darkBg: {backgroundColor: '#102027'},
  header: {paddingHorizontal: 20, paddingBottom: 10},
  title: {fontSize: 28, fontWeight: '700'},
  subtitle: {marginTop: 6, fontSize: 14},
  lightText: {color: '#1c1b19'},
  darkText: {color: '#f6f4ee'},
  lightSubText: {color: '#5f5a52'},
  darkSubText: {color: '#c7d4d9'},
  tabRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  tabButton: {
    minWidth: '22%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d0c3b3',
    backgroundColor: '#fff8ef',
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  tabButtonActive: {backgroundColor: '#b55233', borderColor: '#b55233'},
  tabButtonText: {color: '#6c584a', fontSize: 14, fontWeight: '700'},
  tabButtonTextActive: {color: '#fff8ef'},
  actionsScroll: {flexGrow: 0, maxHeight: 260},
  actionsContent: {paddingHorizontal: 20, paddingBottom: 16, gap: 12},
  button: {
    borderRadius: 16,
    backgroundColor: '#b55233',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  buttonText: {color: '#fff8ef', fontSize: 16, fontWeight: '600'},
  outputPanel: {
    flex: 1,
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 20,
    backgroundColor: '#171412',
    overflow: 'hidden',
  },
  outputLabel: {
    color: '#f0d7c6',
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  outputScroll: {flex: 1},
  outputContent: {paddingHorizontal: 16, paddingBottom: 16},
  outputText: {color: '#d9f3dc', fontSize: 12, lineHeight: 18},
});

