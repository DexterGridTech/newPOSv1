import React, {useState, useCallback, useEffect, useRef} from 'react'
import {
    View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, FlatList,
} from 'react-native'
import {deviceAdapter} from '../../src/foundations/device'
import type {DeviceInfo, SystemStatus, PowerStatusChangeEvent} from '@impos2/kernel-core-base'
import {C} from '../theme'

type Tab = 'info' | 'status' | 'power'

const TABS: {key: Tab; label: string}[] = [
    {key: 'info', label: '设备信息'},
    {key: 'status', label: '系统状态'},
    {key: 'power', label: '电源监听'},
]

export default function DeviceScreen() {
    const [tab, setTab] = useState<Tab>('info')
    return (
        <View style={s.root}>
            <View style={s.header}>
                <Text style={s.headerTitle}>Device</Text>
                <View style={s.tabs}>
                    {TABS.map(t => (
                        <TouchableOpacity key={t.key} style={[s.tab, tab === t.key && s.tabActive]} onPress={() => setTab(t.key)}>
                            <Text style={[s.tabText, tab === t.key && s.tabTextActive]}>{t.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>
            {tab === 'info' && <InfoPanel />}
            {tab === 'status' && <StatusPanel />}
            {tab === 'power' && <PowerPanel />}
        </View>
    )
}

// ─── Info Panel ───────────────────────────────────────────────────────────────

function InfoPanel() {
    const [data, setData] = useState<DeviceInfo | null>(null)
    const [loading, setLoading] = useState(false)
    const [err, setErr] = useState<string | null>(null)

    const load = useCallback(async () => {
        setLoading(true); setErr(null)
        try { setData(await deviceAdapter.getDeviceInfo()) }
        catch (e: any) { setErr(e?.message ?? String(e)) }
        finally { setLoading(false) }
    }, [])

    return (
        <ScrollView style={s.panel} contentContainerStyle={{paddingBottom: 32}}>
            <TouchableOpacity style={s.btn} onPress={load}>
                <Text style={s.btnText}>获取设备信息</Text>
            </TouchableOpacity>
            {loading && <ActivityIndicator color="#22C55E" style={{marginTop: 16}} />}
            {err && <Text style={s.errText}>{err}</Text>}
            {data && (
                <View style={s.card}>
                    {([
                        ['ID', data.id],
                        ['制造商', data.manufacturer],
                        ['系统', `${data.os} ${data.osVersion}`],
                        ['CPU', data.cpu],
                        ['内存', data.memory],
                        ['磁盘', data.disk],
                        ['网络', data.network],
                    ] as [string, string][]).map(([k, v]) => <Row key={k} label={k} value={v} />)}
                    <Text style={s.sectionTitle}>显示器 ({data.displays.length})</Text>
                    {data.displays.map((d, i) => (
                        <View key={i} style={s.subCard}>
                            {([
                                ['ID', d.id],
                                ['类型', d.displayType],
                                ['分辨率', `${d.width} × ${d.height}`],
                                ['刷新率', `${d.refreshRate} Hz`],
                                ['物理尺寸', `${d.physicalWidth} × ${d.physicalHeight} mm`],
                                ['触摸', d.touchSupport ? '支持' : '不支持'],
                            ] as [string, string][]).map(([k, v]) => <Row key={k} label={k} value={v} small />)}
                        </View>
                    ))}
                </View>
            )}
        </ScrollView>
    )
}

// ─── Status Panel ─────────────────────────────────────────────────────────────

function StatusPanel() {
    const [data, setData] = useState<SystemStatus | null>(null)
    const [loading, setLoading] = useState(false)
    const [err, setErr] = useState<string | null>(null)

    const load = useCallback(async () => {
        setLoading(true); setErr(null)
        try { setData(await deviceAdapter.getSystemStatus()) }
        catch (e: any) { setErr(e?.message ?? String(e)) }
        finally { setLoading(false) }
    }, [])

    return (
        <ScrollView style={s.panel} contentContainerStyle={{paddingBottom: 32}}>
            <TouchableOpacity style={s.btn} onPress={load}>
                <Text style={s.btnText}>获取系统状态</Text>
            </TouchableOpacity>
            {loading && <ActivityIndicator color="#22C55E" style={{marginTop: 16}} />}
            {err && <Text style={s.errText}>{err}</Text>}
            {data && <>
                <Section title="CPU">
                    <Row label="核心数" value={String(data.cpu.cores)} />
                    <Row label="App占用" value={`${data.cpu.app.toFixed(1)}%`} />
                </Section>
                <Section title="内存">
                    <Row label="总量" value={`${data.memory.total.toFixed(0)} MB`} />
                    <Row label="App占用" value={`${data.memory.app.toFixed(0)} MB (${data.memory.appPercentage.toFixed(1)}%)`} />
                </Section>
                <Section title="磁盘">
                    <Row label="总量" value={`${data.disk.total.toFixed(1)} GB`} />
                    <Row label="已用" value={`${data.disk.used.toFixed(1)} GB`} />
                    <Row label="可用" value={`${data.disk.available.toFixed(1)} GB`} />
                    <Row label="使用率" value={`${data.disk.overall.toFixed(1)}%`} />
                    <Row label="App占用" value={`${data.disk.app.toFixed(1)} MB`} />
                </Section>
                <Section title="电源">
                    <Row label="电源连接" value={data.power.powerConnected ? '已连接' : '未连接'} accent={data.power.powerConnected} />
                    <Row label="充电中" value={data.power.isCharging ? '是' : '否'} />
                    <Row label="电量" value={`${data.power.batteryLevel}%`} />
                    <Row label="状态" value={data.power.batteryStatus} />
                    <Row label="健康" value={data.power.batteryHealth} />
                </Section>
                <Section title={`USB设备 (${data.usbDevices.length})`}>
                    {data.usbDevices.length === 0
                        ? <Text style={s.emptyText}>无</Text>
                        : data.usbDevices.map((d, i) => (
                            <View key={i} style={s.subCard}>
                                <Row label="名称" value={d.name} small />
                                <Row label="设备ID" value={d.deviceId} small />
                                <Row label="VID/PID" value={`${d.vendorId} / ${d.productId}`} small />
                            </View>
                        ))}
                </Section>
                <Section title={`蓝牙设备 (${data.bluetoothDevices.length})`}>
                    {data.bluetoothDevices.length === 0
                        ? <Text style={s.emptyText}>无</Text>
                        : data.bluetoothDevices.map((d, i) => (
                            <View key={i} style={s.subCard}>
                                <Row label="名称" value={d.name} small />
                                <Row label="地址" value={d.address} small />
                                <Row label="类型" value={d.type} small />
                                <Row label="状态" value={d.connected ? '已连接' : '未连接'} small />
                                {d.rssi != null && <Row label="信号" value={`${d.rssi} dBm`} small />}
                            </View>
                        ))}
                </Section>
                <Section title={`串口设备 (${data.serialDevices.length})`}>
                    {data.serialDevices.length === 0
                        ? <Text style={s.emptyText}>无</Text>
                        : data.serialDevices.map((d, i) => (
                            <View key={i} style={s.subCard}>
                                <Row label="名称" value={d.name} small />
                                <Row label="路径" value={d.path} small />
                                {d.baudRate != null && <Row label="波特率" value={String(d.baudRate)} small />}
                                <Row label="状态" value={d.isOpen ? '已打开' : '未打开'} small />
                            </View>
                        ))}
                </Section>
                <Section title={`网络 (${data.networks.length})`}>
                    {data.networks.length === 0
                        ? <Text style={s.emptyText}>无</Text>
                        : data.networks.map((n, i) => (
                            <View key={i} style={s.subCard}>
                                <Row label="类型" value={n.type} small />
                                <Row label="名称" value={n.name} small />
                                <Row label="IP" value={n.ipAddress} small />
                                <Row label="网关" value={n.gateway || '-'} small />
                                <Row label="子网掩码" value={n.netmask || '-'} small />
                                {n.dns.length > 0 && <Row label="DNS" value={n.dns.join(', ')} small />}
                                {n.signalStrength != null && <Row label="信号" value={`${n.signalStrength}%`} small />}
                                {n.carrier != null && <Row label="运营商" value={n.carrier} small />}
                            </View>
                        ))}
                </Section>
                <Section title={`已安装应用 (${data.installedApps.length})`}>
                    {data.installedApps.length === 0
                        ? <Text style={s.emptyText}>无</Text>
                        : data.installedApps.map((app, i) => (
                            <View key={i} style={s.subCard}>
                                <Row label="名称" value={app.appName} small />
                                <Row label="包名" value={app.packageName} small />
                                <Row label="版本" value={`${app.versionName} (${app.versionCode})`} small />
                                <Row label="系统应用" value={app.isSystemApp ? '是' : '否'} small />
                                <Row label="安装时间" value={new Date(app.installTime).toLocaleDateString()} small />
                            </View>
                        ))}
                </Section>
            </>}
        </ScrollView>
    )
}

// ─── Power Panel ──────────────────────────────────────────────────────────────

function PowerPanel() {
    const [listening, setListening] = useState(false)
    const [events, setEvents] = useState<(PowerStatusChangeEvent & {id: string})[]>([])
    const removeRef = useRef<(() => void) | null>(null)

    const toggle = useCallback(() => {
        if (listening) {
            removeRef.current?.()
            removeRef.current = null
            setListening(false)
        } else {
            const remove = deviceAdapter.addPowerStatusChangeListener(e => {
                setEvents(prev => [{...e, id: String(Date.now())}, ...prev].slice(0, 30))
            })
            removeRef.current = remove
            setListening(true)
        }
    }, [listening])

    useEffect(() => () => { removeRef.current?.() }, [])

    return (
        <View style={s.panel}>
            <TouchableOpacity style={[s.btn, listening && s.btnDanger]} onPress={toggle}>
                <Text style={s.btnText}>{listening ? '停止监听' : '开始监听'}</Text>
            </TouchableOpacity>
            {listening && (
                <View style={s.listeningBadge}>
                    <View style={s.dot} />
                    <Text style={s.listeningText}>监听中...</Text>
                </View>
            )}
            <FlatList
                data={events}
                keyExtractor={i => i.id}
                style={{marginTop: 12}}
                renderItem={({item}) => (
                    <View style={s.eventRow}>
                        <View style={[s.powerDot, {backgroundColor: item.powerConnected ? C.accent : C.danger}]} />
                        <View style={{flex: 1}}>
                            <Text style={s.eventMain}>
                                {item.powerConnected ? '电源已连接' : '电源已断开'} · {item.batteryLevel}% · {item.batteryStatus}
                            </Text>
                            <Text style={s.eventSub}>
                                充电: {item.isCharging ? '是' : '否'} · {new Date(item.timestamp).toLocaleTimeString()}
                            </Text>
                        </View>
                    </View>
                )}
                ListEmptyComponent={<Text style={s.emptyText}>暂无事件</Text>}
            />
        </View>
    )
}

// ─── Shared ───────────────────────────────────────────────────────────────────

function Section({title, children}: {title: string; children: React.ReactNode}) {
    return (
        <View style={s.card}>
            <Text style={s.sectionTitle}>{title}</Text>
            {children}
        </View>
    )
}

function Row({label, value, small, accent}: {label: string; value: string; small?: boolean; accent?: boolean}) {
    return (
        <View style={s.row}>
            <Text style={[s.rowLabel, small && s.rowLabelSm]}>{label}</Text>
            <Text style={[s.rowValue, small && s.rowValueSm, accent && s.rowValueAccent]} numberOfLines={2}>{value}</Text>
        </View>
    )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
    root:            {flex: 1, backgroundColor: C.bgPage},
    header:          {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border},
    headerTitle:     {fontSize: 16, fontWeight: '600', color: C.textPrimary, letterSpacing: 0.5},
    tabs:            {flexDirection: 'row', backgroundColor: C.bgSub, borderRadius: 8, padding: 2},
    tab:             {paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6},
    tabActive:       {backgroundColor: C.bgCard},
    tabText:         {fontSize: 12, color: C.textMuted},
    tabTextActive:   {color: C.textPrimary, fontWeight: '500'},
    panel:           {flex: 1, padding: 16},
    btn:             {backgroundColor: C.accent, borderRadius: 8, paddingVertical: 12, alignItems: 'center'},
    btnDanger:       {backgroundColor: C.danger},
    btnText:         {color: C.textInverse, fontWeight: '700', fontSize: 14},
    errText:         {color: C.danger, fontSize: 12, marginTop: 8},
    card:            {backgroundColor: C.bgCard, borderRadius: 8, padding: 12, marginTop: 12, borderWidth: 1, borderColor: C.border},
    sectionTitle:    {fontSize: 12, color: C.textMuted, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8},
    subCard:         {backgroundColor: C.bgPage, borderRadius: 6, padding: 8, marginTop: 6},
    row:             {flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4},
    rowLabel:        {fontSize: 13, color: C.textSecondary, flex: 1},
    rowLabelSm:      {fontSize: 11},
    rowValue:        {fontSize: 13, color: C.textPrimary, flex: 2, textAlign: 'right'},
    rowValueSm:      {fontSize: 11},
    rowValueAccent:  {color: C.accent},
    emptyText:       {fontSize: 12, color: C.textMuted, textAlign: 'center', paddingVertical: 8},
    listeningBadge:  {flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 6},
    dot:             {width: 8, height: 8, borderRadius: 4, backgroundColor: C.accent},
    listeningText:   {fontSize: 12, color: C.accent},
    eventRow:        {flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgCard, borderRadius: 8, padding: 10, marginBottom: 6, gap: 10, borderWidth: 1, borderColor: C.border},
    powerDot:        {width: 10, height: 10, borderRadius: 5},
    eventMain:       {fontSize: 13, color: C.textPrimary},
    eventSub:        {fontSize: 11, color: C.textSecondary, marginTop: 2},
})
