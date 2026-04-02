import React, {useMemo} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {ServerConnectionStatus} from '@impos2/kernel-core-interconnection';
import {useTerminalConnection} from '../../hooks/useTerminalConnection';

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

const connStatusLabel: Record<ServerConnectionStatus, string> = {
  [ServerConnectionStatus.CONNECTED]: '已连接',
  [ServerConnectionStatus.CONNECTING]: '连接中',
  [ServerConnectionStatus.DISCONNECTED]: '未连接',
};

const formatTime = (ts?: number | null): string => (ts ? new Date(ts).toLocaleString('zh-CN') : '—');

const formatDuration = (connectedAt: number, disconnectedAt: number): string => {
  const ms = disconnectedAt - connectedAt;
  if (ms <= 0) return '—';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
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

const Row: React.FC<{label: string; value?: string | null; mono?: boolean}> = ({label, value, mono}) => (
  <View style={s.row}>
    <Text style={s.rowLabel}>{label}</Text>
    <Text style={[s.rowValue, mono ? s.mono : null]} numberOfLines={1} ellipsizeMode="tail">
      {value ?? '—'}
    </Text>
  </View>
);

const Divider = () => <View style={s.divider} />;

export const TerminalConnectionScreen: React.FC = () => {
  const {serverConnectionStatus, connectedAt, disconnectedAt, connectionError, connectionHistory} = useTerminalConnection();

  const status = serverConnectionStatus ?? ServerConnectionStatus.DISCONNECTED;
  const isDisconnected = status === ServerConnectionStatus.DISCONNECTED;
  const statusTone: 'ok' | 'warn' | 'err' =
    status === ServerConnectionStatus.CONNECTED
      ? 'ok'
      : status === ServerConnectionStatus.CONNECTING
        ? 'warn'
        : 'err';

  const recentHistory = useMemo(() => connectionHistory.slice(-10).reverse(), [connectionHistory]);
  const totalDuration = useMemo(() => {
    const total = connectionHistory.reduce((sum, item) => sum + Math.max(item.disconnectedAt - item.connectedAt, 0), 0);
    return formatDuration(0, total);
  }, [connectionHistory]);

  return (
    <View style={s.root}>
      <ScrollView style={{flex: 1}} contentContainerStyle={s.content}>
        <View style={s.heroCard}>
          <View style={s.heroHeader}>
            <View>
              <Text style={s.heroEyebrow}>连接诊断</Text>
              <Text style={s.heroTitle}>终端连接总览</Text>
              <Text style={s.heroDesc}>查看当前连接状态、最近连接时间和历史断连记录。</Text>
            </View>
            <StatusBadge text={connStatusLabel[status]} tone={statusTone} />
          </View>

          <View style={s.metricRow}>
            <MetricCard label="当前状态" value={connStatusLabel[status]} helper="终端连接实时状态" tone={statusTone} />
            <MetricCard label="最近连接" value={formatTime(connectedAt)} helper="最后一次连接时间" tone="accent" />
            <MetricCard label="最近断开" value={formatTime(disconnectedAt)} helper="最后一次断开时间" tone={isDisconnected ? 'warn' : 'ok'} />
            <MetricCard label="累计历史" value={String(connectionHistory.length)} helper={`累计连接时长 ${totalDuration}`} tone="accent" />
          </View>
        </View>

        <Section title="当前状态" description="当前连接会话的核心时间信息。">
          <Row label="连接状态" value={connStatusLabel[status]} />
          <Divider />
          <Row label="连接时间" value={!isDisconnected ? formatTime(connectedAt) : '—'} />
          {isDisconnected ? (
            <>
              <Divider />
              <Row label="断开时间" value={formatTime(disconnectedAt)} />
            </>
          ) : null}
        </Section>

        {connectionError ? (
          <Section title="错误告警" description="最近一次连接错误信息。">
            <View style={s.errorCard}>
              <Text style={s.errorText}>{connectionError}</Text>
            </View>
          </Section>
        ) : null}

        <Section
          title="连接历史"
          description={
            connectionHistory.length > 10
              ? `共 ${connectionHistory.length} 条记录，仅展示最近 10 条。`
              : '展示最近连接与断开记录。'
          }>
          {recentHistory.length > 0 ? (
            recentHistory.map((item, index) => (
              <React.Fragment key={`${item.connectedAt}-${index}`}>
                {index > 0 ? <Divider /> : null}
                <View style={s.timelineItem}>
                  <View style={s.timelineMarkerColumn}>
                    <View style={s.timelineMarker} />
                    {index < recentHistory.length - 1 ? <View style={s.timelineLine} /> : null}
                  </View>
                  <View style={s.timelineContent}>
                    <View style={s.timelineHeader}>
                      <Text style={s.timelineTitle}>连接会话 #{recentHistory.length - index}</Text>
                      <StatusBadge text={item.connectionError ? '异常断开' : '正常结束'} tone={item.connectionError ? 'err' : 'ok'} />
                    </View>
                    <View style={s.timelineRows}>
                      <Row label="连接时间" value={formatTime(item.connectedAt)} />
                      <Divider />
                      <Row label="断开时间" value={formatTime(item.disconnectedAt)} />
                      <Divider />
                      <Row label="持续时长" value={formatDuration(item.connectedAt, item.disconnectedAt)} />
                      {item.connectionError ? (
                        <>
                          <Divider />
                          <View style={s.timelineErrorRow}>
                            <Text style={s.timelineErrorLabel}>异常原因</Text>
                            <Text style={s.timelineErrorText}>{item.connectionError}</Text>
                          </View>
                        </>
                      ) : null}
                    </View>
                  </View>
                </View>
              </React.Fragment>
            ))
          ) : (
            <View style={s.emptyState}>
              <Text style={s.emptyTitle}>暂无连接历史</Text>
              <Text style={s.emptyDesc}>终端连接产生历史记录后，会在这里显示时间线与断连原因。</Text>
            </View>
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

  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
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
  mono: {
    fontFamily: 'monospace',
    fontSize: 12,
  },
  divider: {
    height: 1,
    backgroundColor: C.divider,
    marginHorizontal: 16,
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

  errorCard: {
    margin: 14,
    padding: 16,
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

  timelineItem: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  timelineMarkerColumn: {
    alignItems: 'center',
    width: 18,
  },
  timelineMarker: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: C.accent,
    marginTop: 4,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    marginTop: 6,
    backgroundColor: C.divider,
  },
  timelineContent: {
    flex: 1,
    gap: 10,
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  timelineTitle: {
    color: C.text,
    fontSize: 14,
    fontWeight: '800',
  },
  timelineRows: {
    borderRadius: 16,
    backgroundColor: C.surfaceMuted,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  timelineErrorRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 6,
  },
  timelineErrorLabel: {
    color: C.textSecondary,
    fontSize: 13,
  },
  timelineErrorText: {
    color: C.err,
    fontSize: 13,
    lineHeight: 19,
  },

  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 30,
    gap: 8,
  },
  emptyTitle: {
    color: C.text,
    fontSize: 15,
    fontWeight: '700',
  },
  emptyDesc: {
    color: C.textMuted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
});
