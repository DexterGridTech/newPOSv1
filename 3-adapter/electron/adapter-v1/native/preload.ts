import { contextBridge, ipcRenderer } from 'electron'

// 通过 contextBridge 安全暴露 IPC 接口到渲染进程
// 对应 Android TurboModule 的通信桥梁角色
contextBridge.exposeInMainWorld('electronBridge', {
    invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
    on: (channel: string, handler: (...args: any[]) => void) => {
        const listener = (_event: Electron.IpcRendererEvent, ...args: any[]) => handler(...args)
        ipcRenderer.on(channel, listener)
        return () => ipcRenderer.removeListener(channel, listener)
    },
})
