import React from 'react';
import {ScrollView, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {useAppControl} from '../../hooks/useAppControl';

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

const ControlRow: React.FC<{
  label: string;
  desc: string;
  active: boolean;
  onPress: () => void;
  activeLabel?: string;
  inactiveLabel?: string;
  activeBtnLabel?: string;
  inactiveBtnLabel?: string;
}> = ({
  label,
  desc,
  active,
  onPress,
  activeLabel = '已开启',
  inactiveLabel = '已关闭',
  activeBtnLabel = '关闭',
  inactiveBtnLabel = '开启',
}) => (
  <View style={s.controlRow}>
    <View style={s.controlInfo}>
      <Text style={s.controlTitle}>{label}</Text>
      <Text style={s.controlDesc}>{desc}</Text>
      <StatusBadge label={active ? activeLabel : inactiveLabel} tone={active ? 'ok' : 'warn'} />
    </View>
    <ActionButton label={active ? activeBtnLabel : inactiveBtnLabel} onPress={onPress} tone="primary" />
  </View>
);

const SimpleActionRow: React.FC<{
  label: string;
  desc: string;
  btnLabel: string;
  onPress: () => void;
  danger?: boolean;
}> = ({label, desc, btnLabel, onPress, danger}) => (
  <View style={s.controlRow}>
    <View style={s.controlInfo}>
      <Text style={s.controlTitle}>{label}</Text>
      <Text style={s.controlDesc}>{desc}</Text>
    </View>
    <ActionButton label={btnLabel} onPress={onPress} tone={danger ? 'danger' : 'default'} />
  </View>
);

export const AppControlScreen: React.FC = () => {
  const {
    isFullScreen,
    isLocked,
    selectedSpace,
    spaceNames,
    handleToggleFullScreen,
    handleToggleLock,
    handleRestartApp,
    handleSwitchSpace,
    handleClearCache,
  } = useAppControl();

  return (
    <View style={s.root}>
      <ScrollView style={{flex: 1}} contentContainerStyle={s.content}>
        <View style={s.heroCard}>
          <View style={s.heroHeader}>
            <View>
              <Text style={s.heroEyebrow}>宿主控制面板</Text>
              <Text style={s.heroTitle}>应用与界面控制</Text>
              <Text style={s.heroDesc}>管理当前应用的全屏、锁定、服务器空间和重启等控制能力。</Text>
            </View>
          </View>

          <View style={s.metricRow}>
            <MetricCard label="全屏状态" value={isFullScreen ? '已开启' : '已关闭'} helper="控制系统栏显示状态" tone={isFullScreen ? 'ok' : 'warn'} />
            <MetricCard label="锁定状态" value={isLocked ? '已锁定' : '未锁定'} helper="控制宿主是否允许切出" tone={isLocked ? 'ok' : 'warn'} />
            <MetricCard label="当前空间" value={selectedSpace || '—'} helper="当前业务使用的服务器空间" tone="accent" />
          </View>
        </View>

        <Section title="屏幕控制" description="宿主系统界面相关控制，包括全屏和任务锁定。">
          <ControlRow
            label="全屏模式"
            desc="隐藏系统栏并让工作区以全屏方式显示。"
            active={isFullScreen}
            onPress={handleToggleFullScreen}
          />
          <Divider />
          <ControlRow
            label="锁定应用"
            desc="限制用户离开当前应用，用于受控终端场景。"
            active={isLocked}
            onPress={handleToggleLock}
            activeLabel="已锁定"
            inactiveLabel="未锁定"
          />
        </Section>

        {spaceNames.length > 1 ? (
          <Section title="服务器空间" description="切换当前应用使用的目标服务器空间。">
            {spaceNames.map((name, index) => {
              const isCurrent = name === selectedSpace;
              return (
                <React.Fragment key={name}>
                  {index > 0 ? <Divider /> : null}
                  <View style={s.controlRow}>
                    <View style={s.controlInfo}>
                      <Text style={[s.controlTitle, isCurrent ? s.controlTitleCurrent : null]}>{name}</Text>
                      <Text style={s.controlDesc}>{isCurrent ? '当前正在使用的服务器空间。' : '切换后，业务将使用该空间配置。'}</Text>
                      {isCurrent ? <StatusBadge label="当前" tone="accent" /> : null}
                    </View>
                    {!isCurrent ? <ActionButton label="切换" onPress={() => handleSwitchSpace(name)} /> : null}
                  </View>
                </React.Fragment>
              );
            })}
          </Section>
        ) : null}

        <Section title="数据管理" description="这些操作会影响本地数据状态，请谨慎执行。">
          <SimpleActionRow
            label="清空数据"
            desc="清除本地所有数据。若设备已激活，后台绑定关系仍存在，但通常需要重新激活。"
            btnLabel="清空"
            onPress={handleClearCache}
            danger
          />
        </Section>

        <Section title="应用管理" description="对宿主应用本身执行重启等控制动作。">
          <SimpleActionRow
            label="重启应用"
            desc="重新加载当前应用环境，用于配置切换或恢复异常状态。"
            btnLabel="重启"
            onPress={handleRestartApp}
            danger
          />
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
  divider: {
    height: 1,
    backgroundColor: C.divider,
    marginHorizontal: 16,
  },

  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },

  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  controlInfo: {
    flex: 1,
    minWidth: 220,
    gap: 4,
  },
  controlTitle: {
    color: C.text,
    fontSize: 14,
    fontWeight: '800',
  },
  controlTitleCurrent: {
    color: C.accentDeep,
  },
  controlDesc: {
    color: C.textSecondary,
    fontSize: 13,
    lineHeight: 19,
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
});
