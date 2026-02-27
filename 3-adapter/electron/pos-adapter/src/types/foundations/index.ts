// ElectronBridge 类型声明，由 native/preload.ts 注入到 window
export interface ElectronBridge {
    invoke: (channel: string, ...args: any[]) => Promise<any>
    on: (channel: string, handler: (...args: any[]) => void) => () => void
}

declare global {
    interface Window {
        electronBridge: ElectronBridge
    }
}

export {}
