import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {
  LocalWebServerInfo,
  LocalWebServerStatus,
  ServerConnectionStatus,
  ServerStats,
  localWebServer,
} from '@impos2/kernel-core-interconnection';
import {useLocalServerStatus} from '../../hooks/useLocalServerStatus';

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
  err: '#D14343',
  errSoft: '#FDECEC',
  warn: '#C47A10',
  warnSoft: '#FFF7E8',
  divider: '#EDF2F7',
  shadow: 'rgba(15, 23, 42, 0.06)',
} as const;

const formatUptime = (ms: number): string => {
  if (ms <= 0) return '—';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
};

const serverStatusLabel: Record<LocalWebServerStatus, string> = {
  [LocalWebServerStatus.STOPPED]: '已停止',
  [LocalWebServerStatus.STARTING]: '启动中',
  [LocalWebServerStatus.RUNNING]: '运行中',
  [LocalWebServerStatus.STOPPING]: '停止中',
  [LocalWebServerStatus.ERROR]: '错误',
};

const connStatusLabel: Record<ServerConnectionStatus, string> = {
  [ServerConnectionStatus.CONNECTED]: '已连接',
  [ServerConnectionStatus.CONNECTING]: '连接中',
  [ServerConnectionStatus.DISCONNECTED]: '未连接',
};

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

const MetricCard: React.FC<{label: string; value: string; helper?: string; tone?: 'accent' | 'ok' | 'warn' | 'err'}> = ({
  label,
  value,
  helper,
  tone = 'accent',
}) => {
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

const Section: React.FC<{title: string; description?: string; children: React.ReactNode}> = ({title, description, children}) => (
  <View style={s.section}>
    <View style={s.sectionHeader}>
      <Text style={s.sectionTitle}>{title}</Text>
      {description ? <Text style={s.sectionDescription}>{description}</Text> : null}
    </View>
    <View style={s.sectionCard}>{children}</View>
  </View>
);

const Row: React.FC<{label: string; value?: string | number | null; mono?: boolean}> = ({label, value, mono}) => (
  <View style={s.row}>
    <Text style={s.rowLabel}>{label}</Text>
    <Text style={[s.rowValue, mono ? s.mono : null]} numberOfLines={1} ellipsizeMode="tail">
      {value ?? '—'}
    </Text>
  </View>
);

const Divider = () => <View style={s.divider} />;

const ActionButton: React.FC<{label: string; onPress: () => void}> = ({label, onPress}) => (
  <TouchableOpacity style={s.actionButton} onPress={onPress} activeOpacity={0.85}>
    <Text style={s.actionButtonText}>{label}</Text>
  </TouchableOpacity>
);

export const LocalServerStatusScreen: React.FC = () => {
  const {connStatus, masterInfo, slaveConnection} = useLocalServerStatus();
  const [info, setInfo] = useState<LocalWebServerInfo | null>(null);
  const [stats, setStats] = useState<ServerStats | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    Promise.all([localWebServer.getLocalWebServerStatus(), localWebServer.getLocalWebServerStats()])
      .then(([serverInfo, serverStats]) => {
        setInfo(serverInfo);
        setStats(serverStats);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 5000);
    return () => clearInterval(timer);
  }, [refresh]);

  const serverStatus = info?.status ?? LocalWebServerStatus.STOPPED;
  const statusTone: 'ok' | 'warn' | 'err' =
    serverStatus === LocalWebServerStatus.RUNNING
      ? 'ok'
      : serverStatus === LocalWebServerStatus.ERROR
        ? 'err'
        : 'warn';

  const wsTone: 'ok' | 'warn' | 'err' =
    connStatus === ServerConnectionStatus.CONNECTED
      ? 'ok'
      : connStatus === ServerConnectionStatus.CONNECTING
        ? 'warn'
        : 'err';

  const addressCount = info?.addresses.length ?? 0;
  const uptimeText = stats ? formatUptime(stats.uptime) : '—';
  const statsSummary = useMemo(() => {
    if (!stats) {
      return {masters: '0', slaves: '0', pending: '0'};
    }
    return {
      masters: String(stats.masterCount),
      slaves: String(stats.slaveCount),
      pending: String(stats.pendingCount),
    };
  }, [stats]);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={C.accent} />
        <Text style={s.loadingText}>正在刷新本地服务状态...</Text>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <ScrollView style={{flex: 1}} contentContainerStyle={s.content}>
        <View style={s.heroCard}>
          <View style={s.heroHeader}>
            <View>
              <Text style={s.heroEyebrow}>服务监控面板</Text>
              <Text style={s.heroTitle}>LocalWebServer 运行总览</Text>
              <Text style={s.heroDesc}>集中查看服务状态、监听地址、主从连接与运行统计。</Text>
            </View>
            <View style={s.heroActions}>
              <StatusBadge text={serverStatusLabel[serverStatus]} tone={statusTone} />
              <ActionButton label="立即刷新" onPress={refresh} />
            </View>
          </View>

          <View style={s.metricRow}>
            <MetricCard label="服务状态" value={serverStatusLabel[serverStatus]} helper="本地服务生命周期状态" tone={statusTone} />
            <MetricCard label="主从通道" value={connStatusLabel[connStatus]} helper="当前业务连接通道状态" tone={wsTone} />
            <MetricCard label="监听地址" value={String(addressCount)} helper="当前已暴露的访问地址数量" tone="accent" />
            <MetricCard label="运行时长" value={uptimeText} helper="从服务启动开始累计" tone="ok" />
          </View>
        </View>

        {info ? (
          <Section title="服务配置" description="基础监听配置与心跳参数。">
            <Row label="基础路径" value={info.config.basePath} mono />
            <Divider />
            <Row label="端口" value={info.config.port} />
            <Divider />
            <Row label="心跳间隔" value={`${info.config.heartbeatInterval / 1000}s`} />
            <Divider />
            <Row label="心跳超时" value={`${info.config.heartbeatTimeout / 1000}s`} />
          </Section>
        ) : null}

        {info && addressCount > 0 ? (
          <Section title="监听地址" description="当前服务对外提供的可访问地址。">
            {info.addresses.map((address, index) => (
              <React.Fragment key={address.address}>
                <View style={s.addressRow}>
                  <View style={s.addressTag}>
                    <Text style={s.addressTagText}>{address.name}</Text>
                  </View>
                  <Text style={s.addressValue} numberOfLines={1}>{address.address}</Text>
                </View>
                {index < info.addresses.length - 1 ? <Divider /> : null}
              </React.Fragment>
            ))}
          </Section>
        ) : null}

        {stats ? (
          <Section title="连接统计" description="服务内部识别到的主屏、副屏与待注册终端数量。">
            <View style={s.metricRowCompact}>
              <MetricCard label="主屏连接" value={statsSummary.masters} helper="Master 数量" tone="accent" />
              <MetricCard label="副屏连接" value={statsSummary.slaves} helper="Slave 数量" tone="ok" />
              <MetricCard label="待注册" value={statsSummary.pending} helper="尚未配对终端" tone="warn" />
            </View>
          </Section>
        ) : null}

        {masterInfo ? (
          <Section title="Master 信息" description="当前主设备识别结果。">
            <Row label="设备 ID" value={masterInfo.deviceId} mono />
            <Divider />
            <Row label="注册时间" value={new Date(masterInfo.addedAt).toLocaleString('zh-CN')} />
          </Section>
        ) : null}

        {slaveConnection ? (
          <Section title="Slave 信息" description="当前副设备连接信息。">
            <Row label="设备 ID" value={slaveConnection.deviceId} mono />
            <Divider />
            <Row label="连接时间" value={new Date(slaveConnection.connectedAt).toLocaleString('zh-CN')} />
            {slaveConnection.disconnectedAt ? (
              <>
                <Divider />
                <Row label="断开时间" value={new Date(slaveConnection.disconnectedAt).toLocaleString('zh-CN')} />
              </>
            ) : null}
          </Section>
        ) : null}

        {info?.error ? (
          <Section title="错误告警" description="当服务进入错误状态时，这里会显示最近一次错误信息。">
            <View style={s.errorCard}>
              <Text style={s.errorText}>{info.error}</Text>
            </View>
          </Section>
        ) : null}
      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  root: {flex: 1, backgroundColor: 'transparent'},
  content: {paddingHorizontal: 4, paddingTop: 4, paddingBottom: 28, gap: 12},
  center: {flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12},
  loadingText: {fontSize: 14, color: C.textSecondary},

  heroCard: {
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
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    flexWrap: 'wrap',
  },
  heroEyebrow: {
    color: C.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    marginBottom: 6,
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
    marginTop: 8,
  },
  heroActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  actionButton: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: C.accentSoft,
    borderWidth: 1,
    borderColor: C.borderStrong,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonText: {
    color: C.accentDeep,
    fontSize: 13,
    fontWeight: '700',
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

  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricRowCompact: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    padding: 14,
  },
  metricCard: {
    flexGrow: 1,
    minWidth: 148,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 18,
  },
  metricLabel: {
    color: C.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 8,
  },
  metricValue: {
    color: C.text,
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
    paddingVertical: 14,
    gap: 12,
  },
  rowLabel: {
    flex: 1,
    color: C.textSecondary,
    fontSize: 13,
  },
  rowValue: {
    flex: 1.5,
    textAlign: 'right',
    color: C.text,
    fontSize: 13,
    fontWeight: '600',
  },
  mono: {
    fontFamily: 'monospace',
    fontSize: 12,
  },
  divider: {
    height: 1,
    backgroundColor: C.divider,
    marginHorizontal: 16,
  },

  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  addressTag: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: C.accentSoft,
  },
  addressTagText: {
    color: C.accentDeep,
    fontSize: 11,
    fontWeight: '700',
  },
  addressValue: {
    flex: 1,
    color: C.text,
    fontSize: 12,
    fontFamily: 'monospace',
  },

  errorCard: {
    padding: 16,
    margin: 14,
    borderRadius: 16,
    backgroundColor: C.errSoft,
    borderWidth: 1,
    borderColor: '#F1C8C8',
  },
  errorText: {
    color: C.err,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: 'monospace',
  },
});
