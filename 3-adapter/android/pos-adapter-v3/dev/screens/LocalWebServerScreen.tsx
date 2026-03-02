import React, {useState, useCallback} from 'react'
import {View, Text, ScrollView, TouchableOpacity, StyleSheet} from 'react-native'
import {localWebServerAdapter} from '../../src/foundations/localWebServer'
import {LocalWebServerStatus} from '@impos2/kernel-core-interconnection'
import {C} from '../theme'

type StatusInfo = {status: LocalWebServerStatus; addresses: {name: string; address: string}[]; error?: string}
type StatsInfo = {masterCount: number; slaveCount: number; pendingCount: number; uptime: number}

export default function LocalWebServerScreen() {
    const [statusInfo, setStatusInfo] = useState<StatusInfo | null>(null)
    const [stats, setStats]           = useState<StatsInfo | null>(null)
    const [loading, setLoading]       = useState<string | null>(null)
    const [lastErr, setLastErr]       = useState<string | null>(null)

    const run = useCallback(async (key: string, fn: () => Promise<void>) => {
        setLoading(key); setLastErr(null)
        try { await fn() } catch (e: any) { setLastErr(e?.message ?? String(e)) }
        finally { setLoading(null) }
    }, [])

    const handleStart = () => run('start', async () => {
        const addresses = await localWebServerAdapter.startLocalWebServer({port: 8888})
        setStatusInfo({status: LocalWebServerStatus.RUNNING, addresses: addresses as any, error: undefined})
    })

    const handleStop = () => run('stop', async () => {
        await localWebServerAdapter.stopLocalWebServer()
        setStatusInfo(s => s ? {...s, status: LocalWebServerStatus.STOPPED} : null)
    })

    const handleStatus = () => run('status', async () => {
        const info = await localWebServerAdapter.getLocalWebServerStatus()
        setStatusInfo({status: info.status, addresses: info.addresses as any, error: info.error})
    })

    const handleStats = () => run('stats', async () => {
        const s = await localWebServerAdapter.getLocalWebServerStats()
        setStats(s)
    })

    const statusColor = (s?: LocalWebServerStatus) => {
        if (s === LocalWebServerStatus.RUNNING)  return C.accent
        if (s === LocalWebServerStatus.ERROR)    return C.danger
        if (s === LocalWebServerStatus.STARTING) return C.warn
        return C.textMuted
    }

    return (
        <View style={s.root}>
            <View style={s.header}>
                <Text style={s.headerTitle}>LocalWebServer</Text>
            </View>
            <ScrollView style={s.panel} contentContainerStyle={{paddingBottom: 32}}>

                {/* Actions */}
                <View style={s.btnRow}>
                    {[
                        {key: 'start',  label: 'START',  color: C.accent,  fn: handleStart},
                        {key: 'stop',   label: 'STOP',   color: C.danger,  fn: handleStop},
                        {key: 'status', label: 'STATUS', color: C.info,    fn: handleStatus},
                        {key: 'stats',  label: 'STATS',  color: C.warn,    fn: handleStats},
                    ].map(b => (
                        <TouchableOpacity key={b.key} style={[s.btn, {backgroundColor: b.color}]}
                            onPress={b.fn} disabled={loading !== null} activeOpacity={0.7}>
                            <Text style={s.btnText}>{loading === b.key ? '...' : b.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Error */}
                {lastErr && (
                    <View style={s.errBox}>
                        <Text style={s.errText}>{lastErr}</Text>
                    </View>
                )}

                {/* Status */}
                {statusInfo && (
                    <View style={s.card}>
                        <View style={s.cardRow}>
                            <Text style={s.cardLabel}>状态</Text>
                            <Text style={[s.cardValue, {color: statusColor(statusInfo.status), fontWeight: '700'}]}>
                                {statusInfo.status}
                            </Text>
                        </View>
                        {statusInfo.error && (
                            <View style={s.cardRow}>
                                <Text style={s.cardLabel}>错误</Text>
                                <Text style={[s.cardValue, {color: C.danger}]}>{statusInfo.error}</Text>
                            </View>
                        )}
                        {statusInfo.addresses.length > 0 && (
                            <>
                                <Text style={s.sectionTitle}>地址列表</Text>
                                {statusInfo.addresses.map((a, i) => (
                                    <View key={i} style={s.addrRow}>
                                        <Text style={s.addrName}>{a.name}</Text>
                                        <Text style={s.addrVal}>{a.address}</Text>
                                    </View>
                                ))}
                            </>
                        )}
                    </View>
                )}

                {/* Stats */}
                {stats && (
                    <View style={s.card}>
                        <Text style={s.sectionTitle}>连接统计</Text>
                        <View style={s.statsRow}>
                            {[
                                {label: 'Master', value: stats.masterCount, color: C.accent},
                                {label: 'Slave',  value: stats.slaveCount,  color: C.info},
                                {label: 'Pending',value: stats.pendingCount, color: C.warn},
                                {label: 'Uptime', value: `${Math.floor(stats.uptime / 1000)}s`, color: C.textPrimary},
                            ].map(item => (
                                <View key={item.label} style={s.statItem}>
                                    <Text style={[s.statValue, {color: item.color}]}>{item.value}</Text>
                                    <Text style={s.statLabel}>{item.label}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                )}
            </ScrollView>
        </View>
    )
}

const s = StyleSheet.create({
    root:        {flex: 1, backgroundColor: C.bgPage},
    header:      {paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border},
    headerTitle: {fontSize: 16, fontWeight: '600', color: C.textPrimary, letterSpacing: 0.5},
    panel:       {flex: 1, padding: 16},
    btnRow:      {flexDirection: 'row', gap: 8, marginTop: 4},
    btn:         {flex: 1, borderRadius: 6, paddingVertical: 10, alignItems: 'center'},
    btnText:     {color: C.textInverse, fontWeight: '700', fontSize: 11},
    errBox:      {backgroundColor: C.dangerBg, borderRadius: 6, padding: 10, marginTop: 10},
    errText:     {color: C.danger, fontSize: 12},
    card:        {backgroundColor: C.bgCard, borderRadius: 6, padding: 12, marginTop: 12, borderWidth: 1, borderColor: C.border},
    cardRow:     {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4},
    cardLabel:   {fontSize: 11, color: C.textMuted, fontWeight: '600'},
    cardValue:   {fontSize: 13, color: C.textPrimary},
    sectionTitle:{fontSize: 10, color: C.textSecondary, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 8, marginBottom: 6},
    addrRow:     {flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderTopWidth: 1, borderTopColor: C.border},
    addrName:    {fontSize: 11, color: C.textSecondary},
    addrVal:     {fontSize: 11, color: C.textPrimary, fontFamily: 'monospace'},
    statsRow:    {flexDirection: 'row', justifyContent: 'space-between'},
    statItem:    {alignItems: 'center'},
    statValue:   {fontSize: 18, fontWeight: '700'},
    statLabel:   {fontSize: 10, color: C.textMuted, marginTop: 2},
})
