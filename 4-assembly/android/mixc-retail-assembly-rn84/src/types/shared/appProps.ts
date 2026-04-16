export interface AppProps {
    deviceId: string
    screenMode: string
    displayCount: number
    displayIndex: number
    isEmulator: boolean
    topology?: import('./topologyLaunch').AssemblyTopologyLaunchOptions
}
