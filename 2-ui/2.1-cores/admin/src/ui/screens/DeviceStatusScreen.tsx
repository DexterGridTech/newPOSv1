import React, {memo, useCallback, useEffect, useState} from 'react';
import {ActivityIndicator, FlatList, ScrollView, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {DeviceInfo, InstalledApp, SystemStatus, device} from '@impos2/kernel-core-base';

const C = {
  surface: '#FFFFFF',
  surfaceMuted: '#F7FAFC',
  border: '#D9E3EE',
  borderStrong: '#C6D4E4',
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

const Row: React.FC<{label: string; value?: string | number | null; mono?: boolean}> = ({label, value, mono}) => (
  <View style={s.row}>
    <Text style={s.rowLabel}>{label}</Text>
    <Text style={[s.rowValue, mono ? s.mono : null]} numberOfLines={1} ellipsizeMode="tail">
      {value ?? '—'}
    </Text>
  </View>
);

const Divider = () => <View style={s.divider} />;

const StatusBadge: React.FC<{text: string; tone: 'ok' | 'warn' | 'err' | 'accent'}> = ({text, tone}) => {
  const toneStyle = {
    ok: {bg: C.okSoft, color: C.ok},
    warn: {bg: C.warnSoft, color: C.warn},
    err: {bg: C.errSoft, color: C.err},
    accent: {bg: C.accentSoft, color: C.accentDeep},
  }[tone];
  return (
    <View style={[s.badge, {backgroundColor: toneStyle.bg}]}> 
      <Text style={[s.badgeText, {color: toneStyle.color}]}>{text}</Text>
    </View>
  );
};

const MetricCard: React.FC<{
  label: string;
  value: string;
  helper?: string;
  tone?: 'accent' | 'ok' | 'warn' | 'err';
}> = ({label, value, helper, tone = 'accent'}) => {
  const toneStyle = {
    accent: {bg: C.accentSoft, valueColor: C.accentDeep},
    ok: {bg: C.okSoft, valueColor: C.ok},
    warn: {bg: C.warnSoft, valueColor: C.warn},
    err: {bg: C.errSoft, valueColor: C.err},
  }[tone];

  return (
    <View style={[s.metricCard, {backgroundColor: toneStyle.bg}]}> 
      <Text style={s.metricLabel}>{label}</Text>
      <Text style={[s.metricValue, {color: toneStyle.valueColor}]}>{value}</Text>
      {helper ? <Text style={s.metricHelper}>{helper}</Text> : null}
    </View>
  );
};

const Section: React.FC<{
  title: string;
  description?: string;
  children: React.ReactNode;
}> = ({title, description, children}) => (
  <View style={s.section}>
    <View style={s.sectionHeader}>
      <Text style={s.sectionTitle}>{title}</Text>
      {description ? <Text style={s.sectionDescription}>{description}</Text> : null}
    </View>
    <View style={s.sectionCard}>{children}</View>
  </View>
);

const BarRow: React.FC<{label: string; value: number; unit?: string; warn?: number; err?: number}> = ({
  label,
  value,
  unit = '%',
  warn = 70,
  err = 90,
}) => {
  const color = value >= err ? C.err : value >= warn ? C.warn : C.ok;
  return (
    <View style={s.barRow}>
      <View style={s.barHeader}>
        <Text style={s.rowLabel}>{label}</Text>
        <Text style={[s.barValue, {color}]}>{value.toFixed(1)}{unit}</Text>
      </View>
      <View style={s.barTrack}>
        <View style={[s.barFill, {width: `${Math.min(value, 100)}%` as const, backgroundColor: color}]} />
      </View>
    </View>
  );
};

const AppItem = memo<{item: InstalledApp; isLast: boolean}>(({item, isLast}) => (
  <>
    <View style={s.row}>
      <View style={{flex: 1}}>
        <Text style={s.rowValueStrong}>{item.appName}</Text>
        <Text style={s.subText}>{item.packageName} · v{item.versionName}</Text>
      </View>
      {item.isSystemApp ? <StatusBadge text="系统" tone="accent" /> : null}
    </View>
    {!isLast ? <Divider /> : null}
  </>
));

type PeripheralTab = 'usb' | 'bluetooth' | 'serial' | 'apps';

const PeripheralSection: React.FC<{status: SystemStatus}> = ({status}) => {
  const [tab, setTab] = useState<PeripheralTab>('usb');

  const tabs: Array<{key: PeripheralTab; label: string; count: number}> = [
    {key: 'usb', label: 'USB', count: status.usbDevices.length},
    {key: 'bluetooth', label: '蓝牙', count: status.bluetoothDevices.length},
    {key: 'serial', label: '串口', count: status.serialDevices.length},
    {key: 'apps', label: '应用', count: status.installedApps.length},
  ];

  const renderAppItem = useCallback(
    ({item, index}: {item: InstalledApp; index: number}) => (
      <AppItem item={item} isLast={index === status.installedApps.length - 1} />
    ),
    [status.installedApps.length],
  );

  const keyExtractor = useCallback((item: InstalledApp) => item.packageName, []);

  return (
    <Section title="外设与安装应用" description="切换不同资源视图，查看当前终端接入能力。">
      <View style={s.tabBar}>
        {tabs.map(tabItem => {
          const active = tab === tabItem.key;
          return (
            <TouchableOpacity
              key={tabItem.key}
              style={[s.tabItem, active ? s.tabItemActive : null]}
              onPress={() => setTab(tabItem.key)}>
              <Text style={[s.tabLabel, active ? s.tabLabelActive : null]}>{tabItem.label}</Text>
              <View style={[s.tabCount, active ? s.tabCountActive : null]}>
                <Text style={[s.tabCountText, active ? s.tabCountTextActive : null]}>{tabItem.count}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={s.tabContent}>
        {tab === 'usb' ? (
          status.usbDevices.length > 0 ? (
            status.usbDevices.map((usb, index) => (
              <React.Fragment key={`${usb.deviceId}-${index}`}>
                <View style={s.row}>
                  <View style={{flex: 1}}>
                    <Text style={s.rowValueStrong}>{usb.name}</Text>
                    <Text style={s.subText}>VID {usb.vendorId} · PID {usb.productId}</Text>
                  </View>
                  <StatusBadge text={usb.deviceClass} tone="accent" />
                </View>
                {index < status.usbDevices.length - 1 ? <Divider /> : null}
              </React.Fragment>
            ))
          ) : (
            <View style={s.emptyState}><Text style={s.emptyStateText}>未检测到 USB 设备</Text></View>
          )
        ) : null}

        {tab === 'bluetooth' ? (
          status.bluetoothDevices.length > 0 ? (
            status.bluetoothDevices.map((bt, index) => (
              <React.Fragment key={`${bt.address}-${index}`}>
                <View style={s.row}>
                  <View style={{flex: 1}}>
                    <Text style={s.rowValueStrong}>{bt.name || '未知蓝牙设备'}</Text>
                    <Text style={s.subText}>{bt.address}</Text>
                  </View>
                  <StatusBadge text={bt.connected ? '已连接' : '未连接'} tone={bt.connected ? 'ok' : 'warn'} />
                </View>
                {index < status.bluetoothDevices.length - 1 ? <Divider /> : null}
              </React.Fragment>
            ))
          ) : (
            <View style={s.emptyState}><Text style={s.emptyStateText}>未检测到蓝牙设备</Text></View>
          )
        ) : null}

        {tab === 'serial' ? (
          status.serialDevices.length > 0 ? (
            status.serialDevices.map((serial, index) => (
              <React.Fragment key={`${serial.path}-${index}`}>
                <View style={s.row}>
                  <View style={{flex: 1}}>
                    <Text style={s.rowValueStrong}>{serial.name}</Text>
                    <Text style={s.subText}>
                      {serial.path}
                      {serial.baudRate ? ` · ${serial.baudRate} baud` : ''}
                    </Text>
                  </View>
                  <StatusBadge text={serial.isOpen ? '已打开' : '未打开'} tone={serial.isOpen ? 'ok' : 'warn'} />
                </View>
                {index < status.serialDevices.length - 1 ? <Divider /> : null}
              </React.Fragment>
            ))
          ) : (
            <View style={s.emptyState}><Text style={s.emptyStateText}>未检测到串口设备</Text></View>
          )
        ) : null}

        {tab === 'apps' ? (
          status.installedApps.length > 0 ? (
            <FlatList
              scrollEnabled={false}
              data={status.installedApps}
              renderItem={renderAppItem}
              keyExtractor={keyExtractor}
              initialNumToRender={12}
              maxToRenderPerBatch={24}
              windowSize={5}
            />
          ) : (
            <View style={s.emptyState}><Text style={s.emptyStateText}>未读取到应用列表</Text></View>
          )
        ) : null}
      </View>
    </Section>
  );
};

export const DeviceStatusScreen = () => {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [info, status] = await Promise.all([device.getDeviceInfo(), device.getSystemStatus()]);
        setDeviceInfo(info);
        setSystemStatus(status);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={C.accent} />
        <Text style={s.loadingText}>正在加载设备诊断数据...</Text>
      </View>
    );
  }

  const cpuValue = systemStatus?.cpu.app ?? 0;
  const memoryValue = systemStatus?.memory.appPercentage ?? 0;
  const diskValue = systemStatus?.disk.overall ?? 0;
  const batteryLevel = systemStatus?.power.batteryLevel ?? 0;

  return (
    <View style={s.root}>
      <ScrollView style={{flex: 1}} contentContainerStyle={s.content}>
        <View style={s.overviewCard}>
          <View style={s.overviewHeader}>
            <View>
              <Text style={s.overviewEyebrow}>设备诊断总览</Text>
              <Text style={s.overviewTitle}>{deviceInfo?.manufacturer || '未知厂商'} · {deviceInfo?.osVersion || '未知系统'}</Text>
              <Text style={s.overviewSubtext}>实时查看终端硬件、系统负载、显示与网络状态。</Text>
            </View>
            <StatusBadge text={systemStatus?.power.isCharging ? '充电中' : '运行中'} tone={systemStatus?.power.isCharging ? 'ok' : 'accent'} />
          </View>

          <View style={s.metricGrid}>
            <MetricCard label="应用 CPU" value={`${cpuValue.toFixed(1)}%`} helper={`${systemStatus?.cpu.cores ?? 0} 核`} tone={cpuValue >= 90 ? 'err' : cpuValue >= 70 ? 'warn' : 'accent'} />
            <MetricCard label="应用内存" value={`${memoryValue.toFixed(1)}%`} helper={`${systemStatus?.memory.app ?? 0} MB`} tone={memoryValue >= 90 ? 'err' : memoryValue >= 70 ? 'warn' : 'ok'} />
            <MetricCard label="磁盘占用" value={`${diskValue.toFixed(1)}%`} helper={`${systemStatus?.disk.available ?? 0} GB 可用`} tone={diskValue >= 90 ? 'err' : diskValue >= 70 ? 'warn' : 'accent'} />
            <MetricCard label="电池电量" value={`${batteryLevel}%`} helper={systemStatus?.power.batteryStatus || '未知'} tone={batteryLevel <= 15 ? 'err' : batteryLevel <= 35 ? 'warn' : 'ok'} />
          </View>
        </View>

        {deviceInfo ? (
          <Section title="基础信息" description="设备身份、系统版本、硬件规格与主网络信息。">
            <Row label="设备 ID" value={deviceInfo.id} mono />
            <Divider />
            <Row label="厂商" value={deviceInfo.manufacturer} />
            <Divider />
            <Row label="系统" value={deviceInfo.os} />
            <Divider />
            <Row label="系统版本" value={deviceInfo.osVersion} />
            <Divider />
            <Row label="CPU" value={deviceInfo.cpu} />
            <Divider />
            <Row label="内存" value={deviceInfo.memory} />
            <Divider />
            <Row label="磁盘" value={deviceInfo.disk} />
            <Divider />
            <Row label="主网络" value={deviceInfo.network} />
          </Section>
        ) : null}

        {systemStatus ? (
          <Section title="系统负载" description="通过当前进程侧视角查看 CPU、内存与磁盘压力。">
            <BarRow label="应用 CPU 使用率" value={systemStatus.cpu.app} />
            <Divider />
            <BarRow label="应用内存使用率" value={systemStatus.memory.appPercentage} />
            <Divider />
            <BarRow label="磁盘总体占用率" value={systemStatus.disk.overall} />
          </Section>
        ) : null}

        {deviceInfo?.displays?.length ? (
          <Section title="显示设备" description="当前终端检测到的显示输出信息。">
            {deviceInfo.displays.map((display, index) => (
              <React.Fragment key={`${display.id}-${index}`}>
                <View style={s.displayRow}>
                  <View style={s.displayIndex}><Text style={s.displayIndexText}>{index + 1}</Text></View>
                  <View style={s.displayInfo}>
                    <Text style={s.displayTitle}>{display.displayType}</Text>
                    <Text style={s.displaySpec}>{display.width} × {display.height} · {display.refreshRate}Hz</Text>
                    <Text style={s.displayMeta}>{display.physicalWidth}mm × {display.physicalHeight}mm · 触控 {display.touchSupport ? '支持' : '不支持'}</Text>
                  </View>
                </View>
                {index < deviceInfo.displays.length - 1 ? <Divider /> : null}
              </React.Fragment>
            ))}
          </Section>
        ) : null}

        {systemStatus?.networks?.length ? (
          <Section title="网络连接" description="查看网络接口、连接状态与当前 IP。">
            {systemStatus.networks.map((network, index) => (
              <React.Fragment key={`${network.name}-${index}`}>
                <View style={s.netRow}>
                  <View style={s.netLeft}>
                    <Text style={s.netName}>{network.name}</Text>
                    <Text style={s.netType}>{network.type.toUpperCase()}</Text>
                  </View>
                  <View style={s.netRight}>
                    <StatusBadge text={network.connected ? '已连接' : '未连接'} tone={network.connected ? 'ok' : 'err'} />
                    {network.connected ? <Text style={s.netIp}>{network.ipAddress}</Text> : null}
                  </View>
                </View>
                {index < systemStatus.networks.length - 1 ? <Divider /> : null}
              </React.Fragment>
            ))}
          </Section>
        ) : null}

        {systemStatus ? <PeripheralSection status={systemStatus} /> : null}
      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  root: {flex: 1, backgroundColor: 'transparent'},
  content: {paddingHorizontal: 4, paddingTop: 4, paddingBottom: 28, gap: 12},
  center: {flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12},
  loadingText: {fontSize: 14, color: C.textSecondary},

  overviewCard: {
    backgroundColor: C.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.border,
    padding: 18,
    gap: 16,
    shadowColor: C.shadow,
    shadowOffset: {width: 0, height: 12},
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 4,
  },
  overviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    flexWrap: 'wrap',
  },
  overviewEyebrow: {
    color: C.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  overviewTitle: {
    color: C.text,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.7,
  },
  overviewSubtext: {
    color: C.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    flexGrow: 1,
    minWidth: 148,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  metricLabel: {
    color: C.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  metricHelper: {
    color: C.textSecondary,
    fontSize: 12,
    marginTop: 6,
  },

  section: {
    gap: 6,
  },
  sectionHeader: {
    paddingHorizontal: 2,
    gap: 4,
  },
  sectionTitle: {
    color: C.text,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  sectionDescription: {
    color: C.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  sectionCard: {
    backgroundColor: C.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 12,
  },
  rowLabel: {
    flex: 1,
    fontSize: 13,
    color: C.textSecondary,
  },
  rowValue: {
    flex: 1.4,
    textAlign: 'right',
    fontSize: 13,
    color: C.text,
    fontWeight: '600',
  },
  rowValueStrong: {
    fontSize: 14,
    color: C.text,
    fontWeight: '700',
  },
  mono: {
    fontFamily: 'monospace',
    fontSize: 12,
  },
  divider: {
    height: 1,
    marginHorizontal: 16,
    backgroundColor: C.divider,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },

  barRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  barHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 10,
  },
  barValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  barTrack: {
    height: 8,
    backgroundColor: C.divider,
    borderRadius: 999,
    overflow: 'hidden',
  },
  barFill: {
    height: 8,
    borderRadius: 999,
  },

  displayRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  displayIndex: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: C.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  displayIndexText: {
    color: C.accentDeep,
    fontSize: 14,
    fontWeight: '800',
  },
  displayInfo: {
    flex: 1,
    gap: 4,
  },
  displayTitle: {
    color: C.text,
    fontSize: 14,
    fontWeight: '700',
  },
  displaySpec: {
    color: C.textSecondary,
    fontSize: 12,
  },
  displayMeta: {
    color: C.textMuted,
    fontSize: 12,
  },

  netRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  netLeft: {
    flex: 1,
    gap: 4,
  },
  netName: {
    color: C.text,
    fontSize: 14,
    fontWeight: '700',
  },
  netType: {
    color: C.textMuted,
    fontSize: 12,
  },
  netRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  netIp: {
    color: C.textSecondary,
    fontSize: 12,
    fontFamily: 'monospace',
  },

  tabBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 6,
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: C.surfaceMuted,
    borderWidth: 1,
    borderColor: C.border,
  },
  tabItemActive: {
    backgroundColor: C.accentSoft,
    borderColor: C.borderStrong,
  },
  tabLabel: {
    color: C.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  tabLabelActive: {
    color: C.accentDeep,
  },
  tabCount: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: C.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabCountActive: {
    backgroundColor: C.accent,
  },
  tabCountText: {
    color: C.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  tabCountTextActive: {
    color: C.surface,
  },
  tabContent: {
    paddingTop: 4,
    paddingBottom: 6,
  },

  subText: {
    color: C.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  emptyState: {
    paddingHorizontal: 16,
    paddingVertical: 26,
    alignItems: 'center',
  },
  emptyStateText: {
    color: C.textMuted,
    fontSize: 13,
  },
});
