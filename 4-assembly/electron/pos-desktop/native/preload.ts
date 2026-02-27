import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronBridge', {
    invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
    on: (channel: string, handler: (...args: any[]) => void) => {
        const listener = (_event: Electron.IpcRendererEvent, ...args: any[]) => handler(...args)
        ipcRenderer.on(channel, listener)
        return () => ipcRenderer.removeListener(channel, listener)
    },
})
