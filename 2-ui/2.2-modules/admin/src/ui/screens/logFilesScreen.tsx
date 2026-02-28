import React, {useCallback, useEffect, useState} from "react";
import {ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View} from "react-native";
import {LogFile, logger, ScreenMode, ScreenPartRegistration} from "@impos2/kernel-core-base";
import {uiAdminVariables} from "../variables";
import {InstanceMode, Workspace} from "@impos2/kernel-core-interconnection";

const C = {
    bg: '#F0F2F5', surface: '#FFFFFF', border: '#E2E8F0',
    text: '#0F172A', textSub: '#64748B', textMuted: '#94A3B8',
    accent: '#0369A1', accentBg: '#EFF6FF',
    ok: '#16A34A', okBg: '#F0FDF4',
    err: '#DC2626', errBg: '#FEF2F2',
    divider: '#F1F5F9',
} as const;

const Btn: React.FC<{label: string; onPress: () => void; danger?: boolean}> = ({label, onPress, danger}) => (
    <TouchableOpacity style={[s.btn, danger && s.btnDanger]} onPress={onPress} activeOpacity={0.7}>
        <Text style={[s.btnText, danger && s.btnTextDanger]}>{label}</Text>
    </TouchableOpacity>
);

export const LogFilesScreen: React.FC = () => {
    const [files, setFiles] = useState<LogFile[]>([]);
    const [loading, setLoading] = useState(false);
    const [content, setContent] = useState<{name: string; text: string} | null>(null);
    const [dirPath, setDirPath] = useState<string | null>(null);
    const [status, setStatus] = useState<{msg: string; ok: boolean} | null>(null);

    const wrap = useCallback(async (fn: () => Promise<void>) => {
        setLoading(true); setStatus(null);
        try { await fn(); } catch (e: any) { setStatus({msg: e?.message ?? String(e), ok: false}); }
        finally { setLoading(false); }
    }, []);

    const loadFiles = useCallback(() => wrap(async () => {
        setContent(null);
        setFiles((await logger.getLogFiles()) ?? []);
    }), [wrap]);

    useEffect(() => { loadFiles(); }, []);

    const viewFile = useCallback((f: LogFile) => wrap(async () => {
        setContent({name: f.fileName, text: (await logger.getLogContent(f.fileName)) ?? ''});
    }), [wrap]);

    const deleteFile = useCallback((f: LogFile) => wrap(async () => {
        await logger.deleteLogFile(f.fileName);
        setFiles(prev => prev.filter(x => x.fileName !== f.fileName));
        setStatus({msg: `已删除: ${f.fileName}`, ok: true});
    }), [wrap]);

    const clearAll = useCallback(() => wrap(async () => {
        await logger.clearAllLogs();
        setFiles([]); setContent(null);
        setStatus({msg: '已清空所有日志', ok: true});
    }), [wrap]);

    const getDir = useCallback(() => wrap(async () => {
        setDirPath(await logger.getLogDirPath());
    }), [wrap]);

    return (
        <ScrollView style={s.root} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
            <View style={s.header}><Text style={s.headerTitle}>日志文件</Text></View>
            <View style={s.actions}>
                <Btn label="刷新列表" onPress={loadFiles}/>
                <Btn label="日志目录" onPress={getDir}/>
                <Btn label="清空全部" onPress={clearAll} danger/>
            </View>
            {loading && <ActivityIndicator color={C.accent} style={{marginVertical: 12}}/>}
            {dirPath && <View style={s.dirBox}><Text style={s.dirText}>{dirPath}</Text></View>}
            {status && (
                <View style={[s.statusBox, {backgroundColor: status.ok ? C.okBg : C.errBg}]}>
                    <Text style={[s.statusText, {color: status.ok ? C.ok : C.err}]}>{status.msg}</Text>
                </View>
            )}
            {files.length > 0 && (
                <View style={s.section}>
                    <Text style={s.sectionTitle}>文件列表（{files.length}）</Text>
                    <View style={s.card}>
                        {files.map((f, i) => (
                            <React.Fragment key={f.fileName}>
                                {i > 0 && <View style={s.divider}/>}
                                <View style={s.fileRow}>
                                    <View style={s.fileInfo}>
                                        <Text style={s.fileName}>{f.fileName}</Text>
                                        <Text style={s.fileMeta}>
                                            {(f.fileSize / 1024).toFixed(1)} KB · {new Date(f.lastModified).toLocaleString('zh-CN')}
                                        </Text>
                                    </View>
                                    <View style={s.fileActions}>
                                        <TouchableOpacity style={s.fileBtn} onPress={() => viewFile(f)} activeOpacity={0.7}>
                                            <Text style={s.fileBtnText}>查看</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={[s.fileBtn, s.fileBtnDanger]} onPress={() => deleteFile(f)} activeOpacity={0.7}>
                                            <Text style={[s.fileBtnText, {color: C.err}]}>删除</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </React.Fragment>
                        ))}
                    </View>
                </View>
            )}
            {content && (
                <View style={s.section}>
                    <View style={s.contentHeader}>
                        <Text style={s.sectionTitle}>{content.name}</Text>
                        <TouchableOpacity onPress={() => setContent(null)}>
                            <Text style={s.closeBtn}>关闭</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={s.card}>
                        <ScrollView nestedScrollEnabled style={s.contentScroll}>
                            <Text style={s.contentText}>{content.text}</Text>
                        </ScrollView>
                    </View>
                </View>
            )}
        </ScrollView>
    );
};

const s = StyleSheet.create({
    root: {flex: 1, backgroundColor: C.bg},
    content: {padding: 20, paddingBottom: 40},
    header: {marginBottom: 16},
    headerTitle: {fontSize: 22, fontWeight: '700', color: C.text, letterSpacing: -0.3},
    actions: {flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap'},
    btn: {paddingHorizontal: 14, paddingVertical: 8, backgroundColor: C.surface, borderRadius: 8, borderWidth: 1, borderColor: C.border},
    btnDanger: {borderColor: '#FECACA', backgroundColor: C.errBg},
    btnText: {fontSize: 13, color: C.textSub, fontWeight: '500'},
    btnTextDanger: {color: C.err},
    dirBox: {backgroundColor: C.accentBg, borderRadius: 8, padding: 10, marginBottom: 10},
    dirText: {fontSize: 11, color: C.accent, fontFamily: 'monospace'},
    statusBox: {borderRadius: 8, padding: 10, marginBottom: 10},
    statusText: {fontSize: 12, fontWeight: '500'},
    section: {marginBottom: 16},
    sectionTitle: {fontSize: 11, fontWeight: '600', color: C.textMuted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8, marginLeft: 2},
    card: {backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, overflow: 'hidden'},
    divider: {height: 1, backgroundColor: C.divider, marginHorizontal: 16},
    fileRow: {flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12},
    fileInfo: {flex: 1},
    fileName: {fontSize: 13, color: C.text, fontWeight: '500', fontFamily: 'monospace'},
    fileMeta: {fontSize: 11, color: C.textMuted, marginTop: 2},
    fileActions: {flexDirection: 'row', gap: 8},
    fileBtn: {paddingHorizontal: 10, paddingVertical: 5, backgroundColor: C.divider, borderRadius: 6},
    fileBtnDanger: {backgroundColor: C.errBg},
    fileBtnText: {fontSize: 12, color: C.textSub},
    contentHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, marginLeft: 2},
    closeBtn: {fontSize: 12, color: C.textMuted, paddingHorizontal: 4},
    contentScroll: {maxHeight: 400},
    contentText: {fontSize: 11, color: C.textSub, padding: 16, fontFamily: 'monospace', lineHeight: 18},
});

export const logFilesScreenPart: ScreenPartRegistration = {
    name: 'logFilesScreenPart',
    title: '日志文件',
    description: '当前系统日志文件',
    partKey: 'system.admin.log.files',
    containerKey: uiAdminVariables.systemAdminPanel.key,
    screenMode: [ScreenMode.DESKTOP, ScreenMode.MOBILE],
    instanceMode: [InstanceMode.MASTER, InstanceMode.SLAVE],
    workspace: [Workspace.MAIN,Workspace.BRANCH],
    componentType: LogFilesScreen,
    indexInContainer: 0,
};
