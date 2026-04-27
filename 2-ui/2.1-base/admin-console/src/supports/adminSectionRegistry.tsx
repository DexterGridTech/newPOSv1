import React from 'react'
import type {
    AdminConsoleSection,
    AdminConsoleSectionRegistry,
} from '../types'
import {AdapterDiagnosticsScreen} from '../ui/screens/AdapterDiagnosticsScreen'
import {AdminConnectorSection} from '../ui/screens/AdminConnectorSection'
import {AdminControlSection} from '../ui/screens/AdminControlSection'
import {AdminDeviceSection} from '../ui/screens/AdminDeviceSection'
import {AdminLogsSection} from '../ui/screens/AdminLogsSection'
import {AdminTerminalSection} from '../ui/screens/AdminTerminalSection'
import {AdminTopologySection} from '../ui/screens/AdminTopologySection'
import {AdminVersionSection} from '../ui/screens/AdminVersionSection'
import {getAdminAdapterDiagnosticsRegistry} from './adapterDiagnosticsRuntime'

const createDefaultAdminConsoleSections = (): readonly AdminConsoleSection[] => ([
    {
        tab: 'device',
        group: 'runtime',
        title: '设备与宿主',
        render: ({hostTools}) => <AdminDeviceSection host={hostTools.device} />,
    },
    {
        tab: 'connector',
        group: 'adapter',
        title: '连接器调试',
        render: ({hostTools}) => <AdminConnectorSection host={hostTools.connector} />,
    },
    {
        tab: 'terminal',
        group: 'runtime',
        title: '终端管理',
        render: ({runtime, store}) => (
            <AdminTerminalSection runtime={runtime} store={store} />
        ),
    },
    {
        tab: 'topology',
        group: 'runtime',
        title: '实例与拓扑',
        render: ({runtime, store, hostTools}) => (
            <AdminTopologySection runtime={runtime} store={store} host={hostTools.topology} />
        ),
    },
    {
        tab: 'version',
        group: 'runtime',
        title: '版本管理',
        render: ({store, hostTools}) => (
            <AdminVersionSection store={store} host={hostTools.version} />
        ),
    },
    {
        tab: 'control',
        group: 'runtime',
        title: '应用控制',
        render: ({runtime, hostTools}) => <AdminControlSection runtime={runtime} host={hostTools.control} />,
    },
    {
        tab: 'logs',
        group: 'runtime',
        title: '日志',
        render: ({hostTools}) => <AdminLogsSection host={hostTools.logs} />,
    },
    {
        tab: 'adapter',
        group: 'adapter',
        title: '适配器测试',
        render: ({runtime, store}) => (
            <AdapterDiagnosticsScreen
                runtime={runtime}
                store={store}
                registry={getAdminAdapterDiagnosticsRegistry()}
            />
        ),
    },
]) as const

const sharedAdminConsoleSectionRegistry = (() => {
    let sections = [...createDefaultAdminConsoleSections()]

    return {
        list() {
            return sections
        },
        replace(nextSections) {
            sections = [...nextSections]
        },
    } satisfies AdminConsoleSectionRegistry
})()

export const getAdminConsoleSectionRegistry = (): AdminConsoleSectionRegistry =>
    sharedAdminConsoleSectionRegistry

export const installAdminConsoleSections = (
    sections: readonly AdminConsoleSection[],
) => {
    sharedAdminConsoleSectionRegistry.replace(sections)
}

export const resetAdminConsoleSections = () => {
    sharedAdminConsoleSectionRegistry.replace(createDefaultAdminConsoleSections())
}
