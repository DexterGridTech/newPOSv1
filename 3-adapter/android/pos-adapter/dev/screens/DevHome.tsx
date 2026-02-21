import React, {useState} from 'react'
import {SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View} from 'react-native'
import LoggerScreen from './LoggerScreen'

// ─── Menu config ─────────────────────────────────────────────────────────────

type MenuKey = 'logger'

interface MenuItem {
    key: MenuKey
    label: string
    tag: string
}

const MENU: MenuItem[] = [
    {key: 'logger', label: 'Logger', tag: 'LOG'},
]

const SCREENS: Record<MenuKey, React.ComponentType> = {
    logger: LoggerScreen,
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function DevHome() {
    const [active, setActive] = useState<MenuKey>('logger')
    const Screen = SCREENS[active]

    return (
        <SafeAreaView style={s.root}>
            <View style={s.layout}>
                {/* Sidebar */}
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

                {/* Content */}
                <View style={s.content}>
                    <Screen />
                </View>
            </View>
        </SafeAreaView>
    )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
    root:              {flex: 1, backgroundColor: '#0F172A'},
    layout:            {flex: 1, flexDirection: 'row'},
    sidebar:           {width: 100, backgroundColor: '#0B1120', borderRightWidth: 1, borderRightColor: '#1E293B'},
    sidebarHeader:     {paddingHorizontal: 12, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#1E293B'},
    sidebarTitle:      {fontSize: 14, fontWeight: '700', color: '#F8FAFC', letterSpacing: 1},
    sidebarSub:        {fontSize: 9, color: '#475569', marginTop: 2, letterSpacing: 0.5},
    menu:              {flex: 1, paddingTop: 8},
    menuItem:          {paddingHorizontal: 10, paddingVertical: 10, marginHorizontal: 6, marginBottom: 2, borderRadius: 8, alignItems: 'center'},
    menuItemActive:    {backgroundColor: '#1E293B'},
    menuTag:           {width: 36, height: 22, borderRadius: 4, backgroundColor: '#1E293B', alignItems: 'center', justifyContent: 'center', marginBottom: 4},
    menuTagActive:     {backgroundColor: '#22C55E22'},
    menuTagText:       {fontSize: 9, fontWeight: '700', color: '#475569', letterSpacing: 0.5},
    menuTagTextActive: {color: '#22C55E'},
    menuLabel:         {fontSize: 11, color: '#475569', textAlign: 'center'},
    menuLabelActive:   {color: '#F8FAFC', fontWeight: '500'},
    content:           {flex: 1},
})
