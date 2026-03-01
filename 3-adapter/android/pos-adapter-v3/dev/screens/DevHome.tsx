import React, {useState} from 'react'
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native'
import DeviceScreen from './DeviceScreen'
import LoggerScreen from './LoggerScreen'
import {StateStorageScreen} from './StateStorageScreen'
// ScriptExecutionScreen temporarily disabled for testing
// import ScriptExecutionScreen from './ScriptExecutionScreen'
import {C} from '../theme'

type MenuKey = 'device' | 'logger' | 'storage' // | 'script'

interface MenuItem { key: MenuKey; label: string; tag: string }

const MENU: MenuItem[] = [
    {key: 'device', label: 'Device', tag: 'DEV'},
    {key: 'logger', label: 'Logger', tag: 'LOG'},
    {key: 'storage', label: 'Storage', tag: 'STO'},
    // {key: 'script', label: 'Script', tag: 'SCR'},  // temporarily disabled
]

const SCREENS: Record<MenuKey, React.ComponentType> = {
    device: DeviceScreen,
    logger: LoggerScreen,
    storage: StateStorageScreen,
    // script: ScriptExecutionScreen,  // temporarily disabled
}

export default function DevHome() {
    const [active, setActive] = useState<MenuKey>('logger')
    const Screen = SCREENS[active]

    return (
        <View style={s.root}>
            <View style={s.layout}>
                <View style={s.sidebar}>
                    <View style={s.sidebarHeader}>
                        <Text style={s.sidebarTitle}>POS</Text>
                        <Text style={s.sidebarSub}>Adapter Dev</Text>
                    </View>
                    <ScrollView style={s.menu}>
                        {MENU.map(item => (
                            <Pressable
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
                            </Pressable>
                        ))}
                    </ScrollView>
                </View>
                <View style={s.content}>
                    <Screen />
                </View>
            </View>
        </View>
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
