import type {CreateAdminConsoleModuleInput} from '../application/createModule'
import type {
    AdminConnectorChannelDefinition,
    AdminControlHostSource,
    AdminDeviceHostSource,
    AdminLogHostSource,
    CreateAdminHostToolsInput,
} from './adminHostToolsFactory'

export interface CreateAdminConsoleModuleInputFromHostInput {
    device?: AdminDeviceHostSource
    logs?: AdminLogHostSource
    control?: AdminControlHostSource
    connector?: CreateAdminHostToolsInput['connector']
    connectorChannels?: readonly AdminConnectorChannelDefinition[]
    topology?: CreateAdminHostToolsInput['topology']
}

const createDefaultConnectorChannels = (): readonly AdminConnectorChannelDefinition[] => ([
    {
        key: 'serial',
        title: '串口可用性',
        type: 'SERIAL',
        detail: '探测当前宿主可识别的串口目标',
    },
    {
        key: 'network',
        title: '网络通道可用性',
        type: 'NETWORK',
        detail: '探测当前宿主可识别的网络目标',
    },
    {
        key: 'hid',
        title: 'HID 可用性',
        type: 'HID',
        detail: '探测当前宿主可识别的 HID 目标',
    },
]) as const

export const createAdminConsoleModuleInputFromHost = (
    input: CreateAdminConsoleModuleInputFromHostInput,
): CreateAdminConsoleModuleInput => ({
    hostToolSources: {
        device: input.device,
        logs: input.logs,
        control: input.control,
        connector: input.connector,
        topology: input.topology,
        connectorChannels: input.connector
            ? (input.connectorChannels ?? createDefaultConnectorChannels())
            : input.connectorChannels,
    },
})

export const adminConsoleDefaultConnectorChannels = createDefaultConnectorChannels()
