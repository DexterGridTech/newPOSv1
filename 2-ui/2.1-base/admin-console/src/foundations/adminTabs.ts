import type {
    AdminConsoleGroup,
    AdminConsoleTab,
} from '../types'

export const adminConsoleGroups: ReadonlyArray<{
    key: AdminConsoleGroup
    title: string
    hint: string
}> = [
    {
        key: 'runtime',
        title: '运行管理',
        hint: '管理员控制 Terminal、拓扑、设备和应用运行时',
    },
    {
        key: 'adapter',
        title: '适配器调试',
        hint: '验证连接器和适配器能力是否可用',
    },
] as const

export const adminConsoleTabs: ReadonlyArray<{
    key: AdminConsoleTab
    group: AdminConsoleGroup
    title: string
    hint: string
}> = [
    {key: 'terminal', group: 'runtime', title: '终端管理', hint: '查看终端激活状态并执行注销激活'},
    {key: 'tdp', group: 'runtime', title: 'TDP 数据平面', hint: '查看数据同步、Topic 协商和本地存储状态'},
    {key: 'topology', group: 'runtime', title: '实例与拓扑', hint: '查看主副机模式、主机信息和连接状态'},
    {key: 'version', group: 'runtime', title: '版本管理', hint: '查看应用版本、热更新状态和宿主启动标记'},
    {key: 'device', group: 'runtime', title: '设备与宿主', hint: '查看本机设备和宿主运行环境信息'},
    {key: 'control', group: 'runtime', title: '应用控制', hint: '执行全屏、锁定、清缓存和重启'},
    {key: 'logs', group: 'runtime', title: '日志', hint: '查看和清理本地日志文件'},
    {key: 'connector', group: 'adapter', title: '连接器调试', hint: '查看并探测连接器通道能力'},
    {key: 'adapter', group: 'adapter', title: '适配器测试', hint: '执行一键适配器测试并查看结果'},
] as const
