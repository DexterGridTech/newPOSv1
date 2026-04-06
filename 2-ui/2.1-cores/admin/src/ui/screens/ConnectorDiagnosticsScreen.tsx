import React, {useEffect, useMemo, useRef, useState} from 'react';
import {ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View} from 'react-native';
import {externalConnector, type ChannelDescriptor, type ConnectorEvent, type ConnectorResponse} from '@impos2/kernel-core-base';

const C = {
  surface: '#FFFFFF',
  surfaceMuted: '#F7FAFC',
  border: '#D9E3EE',
  text: '#0F172A',
  textSecondary: '#516173',
  textMuted: '#7B8A9F',
  accent: '#0B5FFF',
  accentSoft: '#EAF1FF',
  accentDeep: '#163A74',
  ok: '#109669',
  okSoft: '#EAF8F2',
  warn: '#C47A10',
  warnSoft: '#FFF7E8',
  err: '#D14343',
  errSoft: '#FDECEC',
  divider: '#EDF2F7',
  shadow: 'rgba(15, 23, 42, 0.06)',
} as const;

type ConnectorSection = 'serial' | 'network' | 'hid' | 'passive';

type DiagnosticLog = {
  id: string;
  level: 'info' | 'ok' | 'warn' | 'err';
  title: string;
  body: string;
  ts: number;
};

const Section: React.FC<{title: string; description: string; children: React.ReactNode}> = ({
  title,
  description,
  children,
}) => (
  <View style={s.section}>
    <View style={s.sectionHeader}>
      <Text style={s.sectionTitle}>{title}</Text>
      <Text style={s.sectionDescription}>{description}</Text>
    </View>
    <View style={s.sectionCard}>{children}</View>
  </View>
);

const Divider = () => <View style={s.divider} />;

const Field: React.FC<{
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
}> = ({label, value, onChangeText, placeholder, multiline}) => (
  <View style={s.fieldBlock}>
    <Text style={s.fieldLabel}>{label}</Text>
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={C.textMuted}
      multiline={multiline}
      style={[s.input, multiline ? s.inputMultiline : null]}
    />
  </View>
);

const ActionButton: React.FC<{
  label: string;
  tone?: 'accent' | 'ok' | 'warn' | 'err';
  disabled?: boolean;
  onPress: () => void | Promise<void>;
}> = ({label, tone = 'accent', disabled, onPress}) => {
  const palette = {
    accent: {bg: C.accent, color: '#FFFFFF'},
    ok: {bg: C.ok, color: '#FFFFFF'},
    warn: {bg: C.warn, color: '#FFFFFF'},
    err: {bg: C.err, color: '#FFFFFF'},
  }[tone];
  return (
    <TouchableOpacity
      disabled={disabled}
      onPress={() => void onPress()}
      style={[s.actionButton, {backgroundColor: palette.bg}, disabled ? s.actionButtonDisabled : null]}>
      <Text style={[s.actionButtonText, {color: palette.color}]}>{label}</Text>
    </TouchableOpacity>
  );
};

const LogBadge: React.FC<{level: DiagnosticLog['level']}> = ({level}) => {
  const palette = {
    info: {bg: C.accentSoft, color: C.accentDeep, text: 'INFO'},
    ok: {bg: C.okSoft, color: C.ok, text: 'OK'},
    warn: {bg: C.warnSoft, color: C.warn, text: 'WARN'},
    err: {bg: C.errSoft, color: C.err, text: 'ERR'},
  }[level];
  return (
    <View style={[s.logBadge, {backgroundColor: palette.bg}]}>
      <Text style={[s.logBadgeText, {color: palette.color}]}>{palette.text}</Text>
    </View>
  );
};

function formatJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export const ConnectorDiagnosticsScreen: React.FC = () => {
  const [activeSection, setActiveSection] = useState<ConnectorSection>('serial');
  const [serialTarget, setSerialTarget] = useState('');
  const [serialData, setSerialData] = useState('Hello from Electron');
  const [serialBaudRate, setSerialBaudRate] = useState('9600');
  const [serialEncoding, setSerialEncoding] = useState('utf8');
  const [serialResponseMode, setSerialResponseMode] = useState<'idle' | 'delimiter' | 'first-chunk'>('idle');
  const [serialDelimiter, setSerialDelimiter] = useState('\\n');
  const [serialTimeout, setSerialTimeout] = useState('3000');
  const [serialReadTimeout, setSerialReadTimeout] = useState('600');
  const [serialStreamChannelId, setSerialStreamChannelId] = useState<string | null>(null);

  const [networkHttpUrl, setNetworkHttpUrl] = useState('http://127.0.0.1:8888/localServer/health');
  const [networkHttpMethod, setNetworkHttpMethod] = useState('GET');
  const [networkWsUrl, setNetworkWsUrl] = useState('ws://127.0.0.1:8888/localServer/ws/master');
  const [networkWsChannelId, setNetworkWsChannelId] = useState<string | null>(null);

  const [hidChannelId, setHidChannelId] = useState<string | null>(null);
  const [hidEventCount, setHidEventCount] = useState(0);

  const [passiveListening, setPassiveListening] = useState(false);
  const [passiveTargetFilter, setPassiveTargetFilter] = useState('');

  const passiveRemoveRef = useRef<(() => void) | null>(null);
  const logsRef = useRef<DiagnosticLog[]>([]);
  const [logs, setLogs] = useState<DiagnosticLog[]>([]);

  const pushLog = (level: DiagnosticLog['level'], title: string, body: string) => {
    const next = [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        level,
        title,
        body,
        ts: Date.now(),
      },
      ...logsRef.current,
    ].slice(0, 80);
    logsRef.current = next;
    setLogs(next);
  };

  const parseObject = (input: string) => {
    if (!input.trim()) {
      return {};
    }
    return JSON.parse(input) as Record<string, unknown>;
  };

  const serialOptions = useMemo<Record<string, unknown>>(() => {
    const baudRate = Number(serialBaudRate);
    const readTimeoutMs = Number(serialReadTimeout);
    const options: Record<string, unknown> = {};

    if (Number.isFinite(baudRate) && baudRate > 0) {
      options.baudRate = baudRate;
    }
    if (serialEncoding.trim()) {
      options.encoding = serialEncoding.trim();
    }
    if (serialResponseMode) {
      options.responseMode = serialResponseMode;
    }
    if (serialDelimiter.trim()) {
      options.delimiter = serialDelimiter;
    }
    if (Number.isFinite(readTimeoutMs) && readTimeoutMs >= 0) {
      options.readTimeoutMs = readTimeoutMs;
    }
    return options;
  }, [serialBaudRate, serialDelimiter, serialEncoding, serialReadTimeout, serialResponseMode]);

  const serialChannel = useMemo<ChannelDescriptor>(() => ({
    type: 'SERIAL',
    target: serialTarget,
    mode: 'request-response',
    options: serialOptions,
  }), [serialOptions, serialTarget]);

  const serialStreamChannel = useMemo<ChannelDescriptor>(() => {
    return {
      type: 'SERIAL',
      target: serialTarget,
      mode: 'stream',
      options: serialOptions,
    };
  }, [serialOptions, serialTarget]);

  const networkHttpChannel = useMemo<ChannelDescriptor>(() => ({
    type: 'NETWORK',
    target: networkHttpUrl,
    mode: 'request-response',
  }), [networkHttpUrl]);

  const networkWsChannel = useMemo<ChannelDescriptor>(() => ({
    type: 'NETWORK',
    target: networkWsUrl,
    mode: 'stream',
  }), [networkWsUrl]);

  useEffect(() => {
    return () => {
      passiveRemoveRef.current?.();
      if (serialStreamChannelId) {
        externalConnector.unsubscribe(serialStreamChannelId).catch(() => {});
      }
      if (networkWsChannelId) {
        externalConnector.unsubscribe(networkWsChannelId).catch(() => {});
      }
      if (hidChannelId) {
        externalConnector.unsubscribe(hidChannelId).catch(() => {});
      }
    };
  }, [hidChannelId, networkWsChannelId, serialStreamChannelId]);

  const fetchSerialTargets = async () => {
    try {
      const targets = await externalConnector.getAvailableTargets('SERIAL');
      if (!serialTarget && targets[0]) {
        setSerialTarget(targets[0]);
      }
      pushLog('info', 'SERIAL 可用目标', targets.length ? targets.join('\n') : '未发现串口设备');
    } catch (error) {
      pushLog('err', 'SERIAL 可用目标失败', String(error));
    }
  };

  const checkSerialAvailable = async () => {
    try {
      const available = await externalConnector.isAvailable(serialChannel);
      pushLog(available ? 'ok' : 'warn', 'SERIAL 可用性', available ? '当前通道可用' : '当前通道不可用');
    } catch (error) {
      pushLog('err', 'SERIAL 可用性失败', String(error));
    }
  };

  const callSerialRequest = async () => {
    try {
      const timeout = Number(serialTimeout);
      const params: Record<string, unknown> = {
        data: serialData,
        baudRate: Number(serialBaudRate),
        encoding: serialEncoding,
        responseMode: serialResponseMode,
        readTimeoutMs: Number(serialReadTimeout),
      };
      if (serialDelimiter.trim()) {
        params.delimiter = serialDelimiter;
      }
      const response = await externalConnector.call(
        serialChannel,
        serialTarget,
        params,
        Number.isFinite(timeout) && timeout > 0 ? timeout : 3000,
      );
      pushLog(response.success ? 'ok' : 'warn', 'SERIAL 请求结果', formatJson(response));
    } catch (error) {
      pushLog('err', 'SERIAL 请求失败', String(error));
    }
  };

  const subscribeSerialStream = async () => {
    if (serialStreamChannelId) {
      pushLog('warn', 'SERIAL Stream', `已在监听: ${serialStreamChannelId}`);
      return;
    }
    try {
      const channelId = await externalConnector.subscribe(
        serialStreamChannel,
        (event: ConnectorEvent) => {
          pushLog('ok', 'SERIAL Stream 数据', formatJson(event));
        },
        (errorEvent: ConnectorEvent) => {
          pushLog('err', 'SERIAL Stream 错误', formatJson(errorEvent));
          setSerialStreamChannelId(null);
        },
      );
      setSerialStreamChannelId(channelId);
      pushLog('ok', 'SERIAL Stream 已开启', channelId);
    } catch (error) {
      pushLog('err', 'SERIAL Stream 开启失败', String(error));
    }
  };

  const unsubscribeSerialStream = async () => {
    if (!serialStreamChannelId) {
      pushLog('warn', 'SERIAL Stream', '当前没有活动订阅');
      return;
    }
    try {
      await externalConnector.unsubscribe(serialStreamChannelId);
      pushLog('ok', 'SERIAL Stream 已关闭', serialStreamChannelId);
      setSerialStreamChannelId(null);
    } catch (error) {
      pushLog('err', 'SERIAL Stream 关闭失败', String(error));
    }
  };

  const callNetworkHttp = async () => {
    try {
      const response = await externalConnector.call<ConnectorResponse<unknown>>(
        networkHttpChannel,
        networkHttpUrl,
        {httpMethod: networkHttpMethod},
        3000,
      );
      pushLog(response.success ? 'ok' : 'warn', 'NETWORK HTTP 结果', formatJson(response));
    } catch (error) {
      pushLog('err', 'NETWORK HTTP 失败', String(error));
    }
  };

  const subscribeNetworkWs = async () => {
    if (networkWsChannelId) {
      pushLog('warn', 'NETWORK WS', `已在监听: ${networkWsChannelId}`);
      return;
    }
    try {
      const channelId = await externalConnector.subscribe(
        networkWsChannel,
        event => {
          pushLog('ok', 'NETWORK WS 数据', formatJson(event));
        },
        errorEvent => {
          pushLog('err', 'NETWORK WS 错误', formatJson(errorEvent));
          setNetworkWsChannelId(null);
        },
      );
      setNetworkWsChannelId(channelId);
      pushLog('ok', 'NETWORK WS 已开启', channelId);
    } catch (error) {
      pushLog('err', 'NETWORK WS 开启失败', String(error));
    }
  };

  const unsubscribeNetworkWs = async () => {
    if (!networkWsChannelId) {
      pushLog('warn', 'NETWORK WS', '当前没有活动订阅');
      return;
    }
    try {
      await externalConnector.unsubscribe(networkWsChannelId);
      pushLog('ok', 'NETWORK WS 已关闭', networkWsChannelId);
      setNetworkWsChannelId(null);
    } catch (error) {
      pushLog('err', 'NETWORK WS 关闭失败', String(error));
    }
  };

  const subscribeHid = async () => {
    if (hidChannelId) {
      pushLog('warn', 'HID 监听', `已在监听: ${hidChannelId}`);
      return;
    }
    try {
      setHidEventCount(0);
      const channelId = await externalConnector.subscribe(
        {type: 'HID', target: 'keyboard', mode: 'stream'},
        event => {
          setHidEventCount(count => count + 1);
          pushLog('ok', 'HID 数据', formatJson(event));
        },
        errorEvent => {
          pushLog('err', 'HID 错误', formatJson(errorEvent));
          setHidChannelId(null);
        },
      );
      setHidChannelId(channelId);
      pushLog('ok', 'HID 监听已开启', channelId);
    } catch (error) {
      pushLog('err', 'HID 监听失败', String(error));
    }
  };

  const unsubscribeHid = async () => {
    if (!hidChannelId) {
      pushLog('warn', 'HID 监听', '当前没有活动订阅');
      return;
    }
    try {
      await externalConnector.unsubscribe(hidChannelId);
      pushLog('ok', 'HID 监听已关闭', hidChannelId);
      setHidChannelId(null);
    } catch (error) {
      pushLog('err', 'HID 关闭失败', String(error));
    }
  };

  const startPassive = () => {
    if (passiveRemoveRef.current) {
      pushLog('warn', 'Passive 监听', '当前已经在监听');
      return;
    }
    passiveRemoveRef.current = externalConnector.on('connector.passive', event => {
      if (passiveTargetFilter && event.target !== passiveTargetFilter) {
        return;
      }
      pushLog('ok', 'Passive 事件', formatJson(event));
    });
    setPassiveListening(true);
    pushLog(
      'ok',
      'Passive 监听已开启',
      passiveTargetFilter
        ? `过滤 target: ${passiveTargetFilter}`
        : '接收所有 connector.passive 事件',
    );
  };

  const stopPassive = () => {
    if (!passiveRemoveRef.current) {
      pushLog('warn', 'Passive 监听', '当前没有活动监听');
      return;
    }
    passiveRemoveRef.current();
    passiveRemoveRef.current = null;
    setPassiveListening(false);
    pushLog('ok', 'Passive 监听已关闭', '已停止接收 connector.passive');
  };

  return (
    <View style={s.root}>
      <ScrollView style={{flex: 1}} contentContainerStyle={s.content}>
        <View style={s.heroCard}>
          <Text style={s.heroEyebrow}>Host Bridge</Text>
          <Text style={s.heroTitle}>Connector Diagnostics</Text>
          <Text style={s.heroDesc}>
            用于桌面端验证严格桥接下的 connector 能力面。当前聚焦 SERIAL、NETWORK、HID 和 passive 四类能力。
          </Text>
        </View>

        <View style={s.tabRow}>
          {([
            ['serial', '串口'],
            ['network', '网络'],
            ['hid', 'HID'],
            ['passive', 'Passive'],
          ] as Array<[ConnectorSection, string]>).map(([key, label]) => {
            const active = activeSection === key;
            return (
              <TouchableOpacity
                key={key}
                style={[s.tabItem, active ? s.tabItemActive : null]}
                onPress={() => setActiveSection(key)}>
                <Text style={[s.tabItemText, active ? s.tabItemTextActive : null]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {activeSection === 'serial' ? (
          <Section title="SERIAL" description="验证串口枚举、request-response 与 stream 监听。">
            <Field
              label="目标串口"
              value={serialTarget}
              onChangeText={setSerialTarget}
              placeholder="例如 /dev/tty.usbserial-0001"
            />
            <Field
              label="发送数据"
              value={serialData}
              onChangeText={setSerialData}
              placeholder="Hello from Electron"
            />
            <Field
              label="波特率"
              value={serialBaudRate}
              onChangeText={setSerialBaudRate}
              placeholder="9600"
            />
            <Field
              label="编码"
              value={serialEncoding}
              onChangeText={setSerialEncoding}
              placeholder="utf8 / hex / base64"
            />
            <View style={s.fieldBlock}>
              <Text style={s.fieldLabel}>响应模式</Text>
              <View style={s.optionRow}>
                {(['idle', 'delimiter', 'first-chunk'] as const).map(mode => {
                  const active = serialResponseMode === mode;
                  return (
                    <TouchableOpacity
                      key={mode}
                      onPress={() => setSerialResponseMode(mode)}
                      style={[s.optionChip, active ? s.optionChipActive : null]}>
                      <Text style={[s.optionChipText, active ? s.optionChipTextActive : null]}>{mode}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
            <Field
              label="分隔符"
              value={serialDelimiter}
              onChangeText={setSerialDelimiter}
              placeholder="delimiter 模式下用于截帧"
            />
            <Field
              label="读取超时(ms)"
              value={serialReadTimeout}
              onChangeText={setSerialReadTimeout}
              placeholder="600"
            />
            <Field
              label="调用超时(ms)"
              value={serialTimeout}
              onChangeText={setSerialTimeout}
              placeholder="3000"
            />
            <View style={s.actionRow}>
              <ActionButton label="读取目标" tone="accent" onPress={fetchSerialTargets} />
              <ActionButton label="检查可用" tone="ok" onPress={checkSerialAvailable} />
              <ActionButton label="发起请求" tone="warn" onPress={callSerialRequest} />
            </View>
            <Divider />
            <View style={s.actionRow}>
              <ActionButton label="开启 Stream" tone="accent" disabled={Boolean(serialStreamChannelId)} onPress={subscribeSerialStream} />
              <ActionButton label="关闭 Stream" tone="err" disabled={!serialStreamChannelId} onPress={unsubscribeSerialStream} />
            </View>
            <Text style={s.statusText}>
              当前 Stream: {serialStreamChannelId ?? '未开启'}
            </Text>
          </Section>
        ) : null}

        {activeSection === 'network' ? (
          <Section title="NETWORK" description="验证 HTTP request-response 与 WebSocket stream。">
            <Field
              label="HTTP URL"
              value={networkHttpUrl}
              onChangeText={setNetworkHttpUrl}
              placeholder="http://127.0.0.1:8888/localServer/health"
            />
            <Field
              label="HTTP Method"
              value={networkHttpMethod}
              onChangeText={setNetworkHttpMethod}
              placeholder="GET"
            />
            <View style={s.actionRow}>
              <ActionButton label="执行 HTTP" tone="warn" onPress={callNetworkHttp} />
            </View>
            <Divider />
            <Field
              label="WS URL"
              value={networkWsUrl}
              onChangeText={setNetworkWsUrl}
              placeholder="ws://127.0.0.1:8888/localServer/ws/master"
            />
            <View style={s.actionRow}>
              <ActionButton label="开启 WS" tone="accent" disabled={Boolean(networkWsChannelId)} onPress={subscribeNetworkWs} />
              <ActionButton label="关闭 WS" tone="err" disabled={!networkWsChannelId} onPress={unsubscribeNetworkWs} />
            </View>
            <Text style={s.statusText}>
              当前 WS: {networkWsChannelId ?? '未开启'}
            </Text>
          </Section>
        ) : null}

        {activeSection === 'hid' ? (
          <Section title="HID" description="验证 Electron before-input-event 到 HID stream 的桥接。">
            <View style={s.callout}>
              <Text style={s.calloutText}>
                开启监听后，在当前 Electron 窗口内输入键盘或扫码枪数据。字符会按 100ms commit 语义聚合，按 Enter 立即提交。
              </Text>
            </View>
            <View style={s.actionRow}>
              <ActionButton label="开启 HID" tone="accent" disabled={Boolean(hidChannelId)} onPress={subscribeHid} />
              <ActionButton label="关闭 HID" tone="err" disabled={!hidChannelId} onPress={unsubscribeHid} />
            </View>
            <Text style={s.statusText}>
              当前 HID: {hidChannelId ?? '未开启'} · 事件数 {hidEventCount}
            </Text>
          </Section>
        ) : null}

        {activeSection === 'passive' ? (
          <Section title="Passive" description="验证主进程 passive 事件转发和 deep-link 注入。">
            <Field
              label="Target 过滤"
              value={passiveTargetFilter}
              onChangeText={setPassiveTargetFilter}
              placeholder="留空表示接收全部"
            />
            <View style={s.callout}>
              <Text style={s.calloutText}>
                可通过 `impos2://open?target=com.impos2.connector.PASSIVE&foo=bar` 触发主进程被动事件，再观察此处日志。
              </Text>
            </View>
            <View style={s.actionRow}>
              <ActionButton label="开启 Passive" tone="accent" disabled={passiveListening} onPress={startPassive} />
              <ActionButton label="关闭 Passive" tone="err" disabled={!passiveListening} onPress={stopPassive} />
            </View>
            <Text style={s.statusText}>
              Passive 状态: {passiveListening ? '监听中' : '未监听'}
            </Text>
          </Section>
        ) : null}

        <Section title="事件日志" description="展示最近的桥接诊断结果与流事件。">
          <View style={s.actionRow}>
            <ActionButton
              label="清空日志"
              tone="warn"
              onPress={() => {
                logsRef.current = [];
                setLogs([]);
              }}
            />
          </View>
          {logs.length ? (
            logs.map((log, index) => (
              <React.Fragment key={log.id}>
                {index > 0 ? <Divider /> : null}
                <View style={s.logRow}>
                  <View style={s.logMetaRow}>
                    <LogBadge level={log.level} />
                    <Text style={s.logTitle}>{log.title}</Text>
                    <Text style={s.logTime}>{new Date(log.ts).toLocaleTimeString('zh-CN')}</Text>
                  </View>
                  <Text style={s.logBody}>{log.body}</Text>
                </View>
              </React.Fragment>
            ))
          ) : (
            <Text style={s.emptyText}>暂无日志</Text>
          )}
        </Section>
      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  root: {flex: 1, backgroundColor: 'transparent'},
  content: {paddingHorizontal: 4, paddingTop: 4, paddingBottom: 28, gap: 12},

  heroCard: {
    backgroundColor: C.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.border,
    padding: 18,
    gap: 10,
    shadowColor: C.shadow,
    shadowOffset: {width: 0, height: 12},
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 4,
  },
  heroEyebrow: {
    color: C.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: C.text,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.7,
  },
  heroDesc: {
    color: C.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },

  tabRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  tabItem: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  tabItemActive: {
    backgroundColor: C.accentSoft,
    borderColor: '#C9D8FF',
  },
  tabItemText: {
    color: C.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  tabItemTextActive: {
    color: C.accentDeep,
  },

  section: {
    gap: 8,
  },
  sectionHeader: {
    paddingHorizontal: 2,
    gap: 4,
  },
  sectionTitle: {
    color: C.text,
    fontSize: 18,
    fontWeight: '800',
  },
  sectionDescription: {
    color: C.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  sectionCard: {
    backgroundColor: C.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    gap: 12,
  },

  fieldBlock: {
    gap: 6,
  },
  fieldLabel: {
    color: C.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  input: {
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: C.text,
    fontSize: 14,
  },
  inputMultiline: {
    minHeight: 108,
    textAlignVertical: 'top',
  },

  actionRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  optionRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  optionChip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: C.surfaceMuted,
    borderWidth: 1,
    borderColor: C.border,
  },
  optionChipActive: {
    backgroundColor: C.accentSoft,
    borderColor: '#C9D8FF',
  },
  optionChipText: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  optionChipTextActive: {
    color: C.accentDeep,
  },
  actionButton: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  actionButtonDisabled: {
    opacity: 0.45,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  callout: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#C9D8FF',
    backgroundColor: C.accentSoft,
    padding: 12,
  },
  calloutText: {
    color: C.accentDeep,
    fontSize: 13,
    lineHeight: 19,
  },

  statusText: {
    color: C.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: C.divider,
  },

  logRow: {
    gap: 8,
  },
  logMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
  },
  logBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  logTitle: {
    flex: 1,
    color: C.text,
    fontSize: 13,
    fontWeight: '700',
  },
  logTime: {
    color: C.textMuted,
    fontSize: 11,
  },
  logBody: {
    color: C.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Courier',
  },
  emptyText: {
    color: C.textMuted,
    fontSize: 13,
  },
});
