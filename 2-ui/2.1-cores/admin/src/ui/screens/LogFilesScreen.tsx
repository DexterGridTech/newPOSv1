import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {LogFile, logger} from '@impos2/kernel-core-base';

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

const ActionButton: React.FC<{
  label: string;
  onPress: () => void;
  tone?: 'default' | 'primary' | 'danger';
}> = ({label, onPress, tone = 'default'}) => {
  const toneStyle = {
    default: {container: s.actionButton, text: s.actionButtonText},
    primary: {container: [s.actionButton, s.actionButtonPrimary], text: [s.actionButtonText, s.actionButtonTextPrimary]},
    danger: {container: [s.actionButton, s.actionButtonDanger], text: [s.actionButtonText, s.actionButtonTextDanger]},
  }[tone];

  return (
    <TouchableOpacity style={toneStyle.container} onPress={onPress} activeOpacity={0.8}>
      <Text style={toneStyle.text}>{label}</Text>
    </TouchableOpacity>
  );
};

const EmptyState: React.FC<{title: string; desc: string}> = ({title, desc}) => (
  <View style={s.emptyState}>
    <Text style={s.emptyTitle}>{title}</Text>
    <Text style={s.emptyDesc}>{desc}</Text>
  </View>
);

export const LogFilesScreen: React.FC = () => {
  const [files, setFiles] = useState<LogFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState<{name: string; text: string} | null>(null);
  const [dirPath, setDirPath] = useState<string | null>(null);
  const [status, setStatus] = useState<{msg: string; ok: boolean} | null>(null);

  const wrap = useCallback(async (fn: () => Promise<void>) => {
    setLoading(true);
    setStatus(null);
    try {
      await fn();
    } catch (e: any) {
      setStatus({msg: e?.message ?? String(e), ok: false});
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFiles = useCallback(
    () =>
      wrap(async () => {
        setContent(null);
        setFiles((await logger.getLogFiles()) ?? []);
      }),
    [wrap],
  );

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const viewFile = useCallback(
    (file: LogFile) =>
      wrap(async () => {
        setContent({name: file.fileName, text: (await logger.getLogContent(file.fileName)) ?? ''});
      }),
    [wrap],
  );

  const deleteFile = useCallback(
    (file: LogFile) =>
      wrap(async () => {
        await logger.deleteLogFile(file.fileName);
        setFiles(prev => prev.filter(item => item.fileName !== file.fileName));
        setStatus({msg: `已删除: ${file.fileName}`, ok: true});
        if (content?.name === file.fileName) {
          setContent(null);
        }
      }),
    [content?.name, wrap],
  );

  const clearAll = useCallback(
    () =>
      wrap(async () => {
        await logger.clearAllLogs();
        setFiles([]);
        setContent(null);
        setStatus({msg: '已清空所有日志', ok: true});
      }),
    [wrap],
  );

  const getDir = useCallback(
    () =>
      wrap(async () => {
        setDirPath(await logger.getLogDirPath());
      }),
    [wrap],
  );

  const totalSizeKb = useMemo(() => files.reduce((sum, file) => sum + file.fileSize, 0) / 1024, [files]);
  const latestModified = useMemo(
    () => (files.length ? new Date(Math.max(...files.map(file => file.lastModified))).toLocaleString('zh-CN') : '—'),
    [files],
  );

  return (
    <View style={s.root}>
      <ScrollView style={{flex: 1}} contentContainerStyle={s.content}>
        <View style={s.heroCard}>
          <View style={s.heroHeader}>
            <View>
              <Text style={s.heroEyebrow}>日志浏览器</Text>
              <Text style={s.heroTitle}>日志文件总览</Text>
              <Text style={s.heroDesc}>统一查看日志文件、读取内容、清理文件并快速定位故障信息。</Text>
            </View>
            <StatusBadge text={loading ? '处理中' : '可操作'} tone={loading ? 'warn' : 'accent'} />
          </View>

          <View style={s.metricRow}>
            <View style={[s.metricCard, {backgroundColor: C.accentSoft}]}> 
              <Text style={s.metricLabel}>文件数量</Text>
              <Text style={[s.metricValue, {color: C.accentDeep}]}>{files.length}</Text>
              <Text style={s.metricHelper}>当前已识别日志文件</Text>
            </View>
            <View style={s.metricCard}>
              <Text style={s.metricLabel}>总大小</Text>
              <Text style={s.metricValue}>{totalSizeKb.toFixed(1)} KB</Text>
              <Text style={s.metricHelper}>用于评估日志体积</Text>
            </View>
            <View style={s.metricCard}>
              <Text style={s.metricLabel}>最近更新</Text>
              <Text style={s.metricValueSmall}>{latestModified}</Text>
              <Text style={s.metricHelper}>最新日志变更时间</Text>
            </View>
          </View>

          <View style={s.actionRow}>
            <ActionButton label="刷新列表" onPress={loadFiles} tone="primary" />
            <ActionButton label="日志目录" onPress={getDir} />
            <ActionButton label="清空全部" onPress={clearAll} tone="danger" />
          </View>
        </View>

        {loading ? (
          <View style={s.loadingBox}>
            <ActivityIndicator color={C.accent} />
            <Text style={s.loadingText}>正在执行日志操作...</Text>
          </View>
        ) : null}

        {dirPath ? (
          <View style={s.pathCard}>
            <Text style={s.pathLabel}>日志目录</Text>
            <Text selectable style={s.pathValue}>{dirPath}</Text>
          </View>
        ) : null}

        {status ? (
          <View style={[s.statusCard, {backgroundColor: status.ok ? C.okSoft : C.errSoft}]}> 
            <Text style={[s.statusText, {color: status.ok ? C.ok : C.err}]}>{status.msg}</Text>
          </View>
        ) : null}

        <View style={s.grid}>
          <View style={s.listPane}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>文件列表</Text>
              <Text style={s.sectionDesc}>选择一个文件即可在右侧查看内容。</Text>
            </View>
            <View style={s.sectionCard}>
              {files.length > 0 ? (
                files.map((file, index) => {
                  const isActive = content?.name === file.fileName;
                  return (
                    <React.Fragment key={file.fileName}>
                      {index > 0 ? <View style={s.divider} /> : null}
                      <TouchableOpacity style={[s.fileRow, isActive ? s.fileRowActive : null]} onPress={() => viewFile(file)} activeOpacity={0.85}>
                        <View style={s.fileMain}>
                          <Text style={s.fileName}>{file.fileName}</Text>
                          <Text style={s.fileMeta}>
                            {(file.fileSize / 1024).toFixed(1)} KB · {new Date(file.lastModified).toLocaleString('zh-CN')}
                          </Text>
                        </View>
                        <View style={s.fileActions}>
                          <ActionButton label="查看" onPress={() => viewFile(file)} />
                          <ActionButton label="删除" onPress={() => deleteFile(file)} tone="danger" />
                        </View>
                      </TouchableOpacity>
                    </React.Fragment>
                  );
                })
              ) : (
                <EmptyState title="暂无日志文件" desc="先刷新列表或等待终端产生日志后再查看。" />
              )}
            </View>
          </View>

          <View style={s.previewPane}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>内容预览</Text>
              <Text style={s.sectionDesc}>当前预览只读，不会修改原始日志文件。</Text>
            </View>
            <View style={s.sectionCard}>
              {content ? (
                <>
                  <View style={s.previewHeader}>
                    <View style={{flex: 1}}>
                      <Text style={s.previewTitle}>{content.name}</Text>
                      <Text style={s.previewHint}>日志内容较长时请上下滚动查看。</Text>
                    </View>
                    <ActionButton label="关闭预览" onPress={() => setContent(null)} />
                  </View>
                  <View style={s.divider} />
                  <ScrollView style={s.previewScroll} contentContainerStyle={s.previewScrollContent} nestedScrollEnabled>
                    <Text style={s.previewText}>{content.text || '文件为空'}</Text>
                  </ScrollView>
                </>
              ) : (
                <EmptyState title="未选择日志文件" desc="从左侧文件列表中选择一项，即可在这里查看日志内容。" />
              )}
            </View>
          </View>
        </View>
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
    minWidth: 150,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: C.surfaceMuted,
    borderWidth: 1,
    borderColor: C.border,
  },
  metricLabel: {
    color: C.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 8,
  },
  metricValue: {
    color: C.text,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  metricValueSmall: {
    color: C.text,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  metricHelper: {
    color: C.textSecondary,
    fontSize: 12,
    marginTop: 6,
  },

  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
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

  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },

  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  loadingText: {
    color: C.textSecondary,
    fontSize: 13,
  },
  pathCard: {
    borderRadius: 18,
    backgroundColor: C.accentSoft,
    borderWidth: 1,
    borderColor: C.borderStrong,
    padding: 14,
    gap: 8,
  },
  pathLabel: {
    color: C.accentDeep,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  pathValue: {
    color: C.accentDeep,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'monospace',
  },
  statusCard: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '700',
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  listPane: {
    flexGrow: 1,
    minWidth: 320,
    flexBasis: 320,
    gap: 6,
  },
  previewPane: {
    flexGrow: 1.2,
    minWidth: 320,
    flexBasis: 360,
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
  sectionDesc: {
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

  fileRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  fileRowActive: {
    backgroundColor: C.accentSoft,
  },
  fileMain: {
    gap: 4,
  },
  fileName: {
    color: C.text,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  fileMeta: {
    color: C.textMuted,
    fontSize: 11,
  },
  fileActions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 10,
  },

  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  previewTitle: {
    color: C.text,
    fontSize: 14,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  previewHint: {
    color: C.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  previewScroll: {
    maxHeight: 520,
  },
  previewScrollContent: {
    padding: 16,
  },
  previewText: {
    color: C.textSecondary,
    fontSize: 11,
    lineHeight: 18,
    fontFamily: 'monospace',
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
