import React from 'react'
import type {
    AdminConsoleSection,
    AdminConsoleSectionRegistry,
} from '../types'
import {
    AdapterDiagnosticsScreen,
    AdminConnectorSection,
    AdminControlSection,
    AdminDeviceSection,
    AdminLogsSection,
    AdminTerminalSection,
    AdminTopologySection,
} from '../ui/screens'
import {getAdminAdapterDiagnosticsRegistry} from './adapterDiagnosticsRuntime'

const createDefaultAdminConsoleSections = (): readonly AdminConsoleSection[] => ([
    {
        tab: 'device',
        group: 'runtime',
        title: '设备与宿主',
        render: () => <AdminDeviceSection />,
    },
    {
        tab: 'connector',
        group: 'adapter',
        title: '连接器调试',
        render: () => <AdminConnectorSection />,
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
        render: ({runtime, store}) => (
            <AdminTopologySection runtime={runtime} store={store} />
        ),
    },
    {
        tab: 'control',
        group: 'runtime',
        title: '应用控制',
        render: () => <AdminControlSection />,
    },
    {
        tab: 'logs',
        group: 'runtime',
        title: '日志',
        render: () => <AdminLogsSection />,
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
