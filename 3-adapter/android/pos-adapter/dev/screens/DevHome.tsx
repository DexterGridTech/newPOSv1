import React, {useState} from 'react'
import {SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View} from 'react-native'
import LoggerScreen from './LoggerScreen'
import DeviceScreen from './DeviceScreen'
import StateStorageScreen from './StateStorageScreen'
import ScriptExecutionScreen from './ScriptExecutionScreen'
import LocalWebServerScreen from './LocalWebServerScreen'
import TaskSystemScreen from './TaskSystemScreen'
import ExternalConnectorScreen from './ExternalConnectorScreen'
import {C} from '../theme'

type MenuKey = 'logger' | 'device' | 'storage' | 'script' | 'lws' | 'task' | 'connector'

interface MenuItem { key: MenuKey; label: string; tag: string }

const MENU: MenuItem[] = [
    {key: 'logger',    label: 'Logger',    tag: 'LOG'},
    {key: 'device',    label: 'Device',    tag: 'DEV'},
    {key: 'storage',   label: 'Storage',   tag: 'KV'},
    {key: 'connector', label: 'Connector', tag: 'CON'},
    {key: 'script',    label: 'Script',    tag: 'JS'},
    {key: 'lws',       label: 'WebSrv',    tag: 'WS'},
    {key: 'task',      label: 'Task',      tag: 'TSK'},
]

const SCREENS: Record<MenuKey, React.ComponentType> = {
    logger:    LoggerScreen,
    device:    DeviceScreen,
    storage:   StateStorageScreen,
    connector: ExternalConnectorScreen,
    script:    ScriptExecutionScreen,
    lws:       LocalWebServerScreen,
    task:      TaskSystemScreen,
}

export default function DevHome() {
    const [active, setActive] = useState<MenuKey>('logger')
    const Screen = SCREENS[active]

    return (
        <SafeAreaView style={s.root}>
            <View style={s.layout}>
                <View style={s.sidebar}>
                    <View style={s.sidebarHeader}>
                        <Text style={s.sidebarTitle}>POS</Text>
                        <Text style={s.sidebarSub}>Adapter Dev</Text>
                    </View>
                    <ScrollView style={s.menu}>
                        {MENU.map(item => (
                            <TouchableOpacity
                                key={item.key}
                                style={[s.menuItem, active === item.key && s.menuItemActive]}
                                onPress={() => setActive(item.key)}>
                                <View style={[s.menuTag, active === item.key && s.menuTagActive]}>
                                    <Text style={[s.menuTagText, active === item.key && s.menuTagTextActive]}>
                                        {item.tag}
                                    </Text>
                                </View>
                                <Text style={[s.menuLabel, active === item.key && s.menuLabelActive]}>
                                    {item.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
                <View style={s.content}>
                    <Screen />
                </View>
            </View>
        </SafeAreaView>
    )
}

const s = StyleSheet.create({
    root:              {flex: 1, backgroundColor: C.bgPage},
    layout:            {flex: 1, flexDirection: 'row'},
    sidebar:           {width: 100, backgroundColor: C.bgCard, borderRightWidth: 1, borderRightColor: C.border},
    sidebarHeader:     {paddingHorizontal: 12, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: C.border},
    sidebarTitle:      {fontSize: 14, fontWeight: '700', color: C.textPrimary, letterSpacing: 1},
    sidebarSub:        {fontSize: 9, color: C.textMuted, marginTop: 2, letterSpacing: 0.5},
    menu:              {flex: 1, paddingTop: 8},
    menuItem:          {paddingHorizontal: 10, paddingVertical: 10, marginHorizontal: 6, marginBottom: 2, borderRadius: 8, alignItems: 'center'},
    menuItemActive:    {backgroundColor: C.bgSub},
    menuTag:           {width: 36, height: 22, borderRadius: 4, backgroundColor: C.bgSub, alignItems: 'center', justifyContent: 'center', marginBottom: 4},
    menuTagActive:     {backgroundColor: C.accentBg},
    menuTagText:       {fontSize: 9, fontWeight: '700', color: C.textMuted, letterSpacing: 0.5},
    menuTagTextActive: {color: C.accent},
    menuLabel:         {fontSize: 11, color: C.textMuted, textAlign: 'center'},
    menuLabelActive:   {color: C.textPrimary, fontWeight: '500'},
    content:           {flex: 1},
})
