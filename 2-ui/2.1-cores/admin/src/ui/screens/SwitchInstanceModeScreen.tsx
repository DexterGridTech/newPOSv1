import React from 'react';
import {ScrollView, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import {InstanceMode, ServerConnectionStatus} from '@impos2/kernel-core-interconnection';
import {useLocalServerStatus} from '../../hooks/useLocalServerStatus';
import {useSwitchInstanceMode} from '../../hooks/useSwitchInstanceMode';

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

const StatusBadge: React.FC<{label: string; tone: 'ok' | 'warn' | 'err' | 'accent'}> = ({label, tone}) => {
  const toneStyle = {
    ok: {bg: C.okSoft, color: C.ok},
    warn: {bg: C.warnSoft, color: C.warn},
    err: {bg: C.errSoft, color: C.err},
    accent: {bg: C.accentSoft, color: C.accentDeep},
  }[tone];
  return (
    <View style={[s.badge, {backgroundColor: toneStyle.bg}]}> 
      <Text style={[s.badgeText, {color: toneStyle.color}]}>{label}</Text>
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

const Divider = () => <View style={s.divider} />;

const Row: React.FC<{label: string; value?: string | null; mono?: boolean}> = ({label, value, mono}) => (
  <View style={s.row}>
    <Text style={s.rowLabel}>{label}</Text>
    <Text style={[s.rowValue, mono ? s.mono : null]} numberOfLines={1} ellipsizeMode="tail">
      {value ?? '—'}
    </Text>
  </View>
);

const ActionButton: React.FC<{
  label: string;
  onPress: () => void;
  tone?: 'default' | 'primary' | 'danger';
  disabled?: boolean;
}> = ({label, onPress, tone = 'default', disabled}) => {
  const toneStyle = {
    default: {container: s.actionButton, text: s.actionButtonText},
    primary: {container: [s.actionButton, s.actionButtonPrimary], text: [s.actionButtonText, s.actionButtonTextPrimary]},
    danger: {container: [s.actionButton, s.actionButtonDanger], text: [s.actionButtonText, s.actionButtonTextDanger]},
  }[tone];

  return (
    <TouchableOpacity
      style={[toneStyle.container, disabled ? s.actionButtonDisabled : null]}
      onPress={onPress}
      activeOpacity={0.85}
      disabled={disabled}>
      <Text style={[toneStyle.text, disabled ? s.actionButtonTextDisabled : null]}>{label}</Text>
    </TouchableOpacity>
  );
};

export const SwitchInstanceModeScreen: React.FC = () => {
  const {
    standalone,
    enableSlave,
    masterInfo,
    isMaster,
    isSlave,
    isServerConnected,
    isServerConnecting,
    handleSetMaster,
    handleSetSlave,
    handleEnableSlave,
    handleStartConnection,
    handleAddMaster,
  } = useSwitchInstanceMode();

  const {connStatus} = useLocalServerStatus();

  const qrValue = masterInfo ? JSON.stringify(masterInfo) : null;
  const serverBtnLabel = isServerConnecting ? '连接中...' : isServerConnected ? '已启动' : '启动服务器';

  const connectionTone: 'ok' | 'warn' | 'err' =
    connStatus === ServerConnectionStatus.CONNECTED
      ? 'ok'
      : connStatus === ServerConnectionStatus.CONNECTING
        ? 'warn'
        : 'err';

  return (
    <View style={s.root}>
      <ScrollView style={{flex: 1}} contentContainerStyle={s.content}>
        <View style={s.heroCard}>
          <View style={s.heroHeader}>
            <View>
              <Text style={s.heroEyebrow}>实例控制台</Text>
              <Text style={s.heroTitle}>主从模式管理</Text>
              <Text style={s.heroDesc}>切换运行模式，配置主设备信息，并管理从设备连接流程。</Text>
            </View>
            <StatusBadge label={isMaster ? 'MASTER' : 'SLAVE'} tone={isMaster ? 'ok' : 'warn'} />
          </View>

          <View style={s.metricRow}>
            <MetricCard label="当前模式" value={isMaster ? 'MASTER' : 'SLAVE'} helper="终端当前实例模式" tone={isMaster ? 'ok' : 'warn'} />
            <MetricCard label="运行环境" value={standalone ? 'Standalone' : 'Managed'} helper="是否允许本地直接切换模式" tone="accent" />
            <MetricCard label="Slave 能力" value={enableSlave ? '已启用' : '未启用'} helper="控制从设备能力入口" tone={enableSlave ? 'ok' : 'warn'} />
            <MetricCard label="连接状态" value={connStatus === ServerConnectionStatus.CONNECTED ? '已连接' : connStatus === ServerConnectionStatus.CONNECTING ? '连接中' : '未连接'} helper="与主设备通信状态" tone={connectionTone} />
          </View>
        </View>

        <Section title="模式切换" description="在允许本地切换的环境下，可直接切换主从实例模式。">
          <View style={s.actionPanel}>
            <View style={s.actionInfo}>
              <Text style={s.actionTitle}>实例模式</Text>
              <Text style={s.actionDesc}>当前终端运行在 {isMaster ? 'MASTER' : 'SLAVE'} 模式。</Text>
            </View>
            <View style={s.actionStack}>
              <ActionButton label="切换为 MASTER" onPress={handleSetMaster} tone="primary" disabled={!standalone || isMaster} />
              <ActionButton label="切换为 SLAVE" onPress={handleSetSlave} disabled={!standalone || isSlave} />
            </View>
          </View>
          {!standalone ? (
            <>
              <Divider />
              <View style={s.noticeRow}>
                <Text style={s.noticeText}>当前环境不支持本地直接切换主从模式。</Text>
              </View>
            </>
          ) : null}
        </Section>

        <Section title="从设备能力" description="主设备可决定是否开放从设备接入入口。">
          <View style={s.actionPanel}>
            <View style={s.actionInfo}>
              <Text style={s.actionTitle}>Enable Slave</Text>
              <Text style={s.actionDesc}>启用后，可作为主设备向从设备暴露连接信息。</Text>
            </View>
            <View style={s.inlineRight}>
              <StatusBadge label={enableSlave ? '已启用' : '未启用'} tone={enableSlave ? 'ok' : 'warn'} />
              {!enableSlave ? <ActionButton label="启用" onPress={handleEnableSlave} tone="primary" /> : null}
            </View>
          </View>
        </Section>

        {isMaster ? (
          <>
            <Section title="主设备连接服务" description="主设备负责暴露连接入口，并为从设备提供二维码信息。">
              <View style={s.actionPanel}>
                <View style={s.actionInfo}>
                  <Text style={s.actionTitle}>本地连接服务</Text>
                  <Text style={s.actionDesc}>启动后从设备可通过二维码中的地址信息连接到当前主设备。</Text>
                </View>
                <View style={s.inlineRight}>
                  <StatusBadge label={serverBtnLabel} tone={isServerConnected ? 'ok' : isServerConnecting ? 'warn' : 'accent'} />
                  {!isServerConnected ? (
                    <ActionButton label={serverBtnLabel} onPress={handleStartConnection} tone="primary" disabled={isServerConnecting} />
                  ) : null}
                </View>
              </View>
            </Section>

            {masterInfo && qrValue ? (
              <Section title="主设备身份" description="从设备可扫描此二维码获取主设备连接信息。">
                <Row label="设备 ID" value={masterInfo.deviceId} mono />
                {masterInfo.serverAddress?.map((address, index) => (
                  <React.Fragment key={`${address.name}-${index}`}>
                    <Divider />
                    <Row label={address.name} value={address.address} mono />
                  </React.Fragment>
                ))}
                <Divider />
                <View style={s.qrBlock}>
                  <Text style={s.qrHint}>使用从设备扫描二维码以发起连接</Text>
                  <View style={s.qrWrapper}>
                    <QRCode value={qrValue} size={180} />
                  </View>
                </View>
              </Section>
            ) : null}
          </>
        ) : null}

        {isSlave ? (
          <Section title="Master 设备" description="查看当前已配置的主设备信息，并在必要时重新连接。">
            {masterInfo ? (
              <>
                <View style={s.actionPanel}>
                  <View style={s.actionInfo}>
                    <Text style={s.actionTitle}>当前主设备</Text>
                    <Text style={s.actionDesc}>可查看连接状态，并在断线后重新连接。</Text>
                  </View>
                  <View style={s.inlineRight}>
                    <StatusBadge
                      label={
                        connStatus === ServerConnectionStatus.CONNECTED
                          ? '已连接'
                          : connStatus === ServerConnectionStatus.CONNECTING
                            ? '连接中'
                            : '未连接'
                      }
                      tone={connectionTone}
                    />
                    {connStatus === ServerConnectionStatus.DISCONNECTED ? (
                      <ActionButton label="重新连接" onPress={handleStartConnection} tone="primary" />
                    ) : null}
                  </View>
                </View>
                <Divider />
                <Row label="设备 ID" value={masterInfo.deviceId} mono />
                {masterInfo.serverAddress?.map((address, index) => (
                  <React.Fragment key={`${address.name}-${index}`}>
                    <Divider />
                    <Row label={address.name} value={address.address} mono />
                  </React.Fragment>
                ))}
              </>
            ) : (
              <View style={s.actionPanel}>
                <View style={s.actionInfo}>
                  <Text style={s.actionTitle}>尚未配置 Master</Text>
                  <Text style={s.actionDesc}>请先扫描主设备二维码，获取连接信息后再发起连接。</Text>
                </View>
                <ActionButton label="添加 Master" onPress={handleAddMaster} tone="primary" />
              </View>
            )}
          </Section>
        ) : null}
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

  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },

  actionPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  actionInfo: {
    flex: 1,
    minWidth: 220,
    gap: 4,
  },
  actionTitle: {
    color: C.text,
    fontSize: 14,
    fontWeight: '800',
  },
  actionDesc: {
    color: C.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  actionStack: {
    gap: 10,
    minWidth: 180,
  },
  inlineRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  noticeRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  noticeText: {
    color: C.textMuted,
    fontSize: 13,
  },
  divider: {
    height: 1,
    backgroundColor: C.divider,
    marginHorizontal: 16,
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

  actionButton: {
    minHeight: 42,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: C.surfaceMuted,
    borderWidth: 1,
    borderColor: C.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonPrimary: {
    backgroundColor: C.accent,
    borderColor: C.accent,
  },
  actionButtonDanger: {
    backgroundColor: C.errSoft,
    borderColor: '#F1C8C8',
  },
  actionButtonDisabled: {
    backgroundColor: C.divider,
    borderColor: C.divider,
  },
  actionButtonText: {
    color: C.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  actionButtonTextPrimary: {
    color: C.surface,
  },
  actionButtonTextDanger: {
    color: C.err,
  },
  actionButtonTextDisabled: {
    color: C.textMuted,
  },

  qrBlock: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 18,
    gap: 14,
  },
  qrHint: {
    color: C.textSecondary,
    fontSize: 13,
  },
  qrWrapper: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: C.surfaceMuted,
    borderWidth: 1,
    borderColor: C.border,
  },
});
