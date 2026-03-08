import { app, BrowserWindow, ipcMain, session } from 'electron'
import path from 'node:path'
import started from 'electron-squirrel-startup'
import installExtension, { REDUX_DEVTOOLS } from 'electron-devtools-installer'

if (started) app.quit()

const createWindow = () => {
    const mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    })

    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
    } else {
        mainWindow.loadFile(
            path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
        )
    }

    mainWindow.webContents.openDevTools()
}

app.on('ready', async () => {
    if (process.env.NODE_ENV === 'development') {
        await installExtension(REDUX_DEVTOOLS).catch(console.error)
    }

    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [
                    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
                ],
            },
        })
    })

    // IPC 处理器注册（由各 handler 模块统一注册）
    registerIpcHandlers()

    createWindow()
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

function registerIpcHandlers() {
    // logger handlers
    ipcMain.handle('logger:getLogDirPath', () => app.getPath('logs'))
    ipcMain.handle('logger:getLogFiles', async () => {
        const fs = await import('node:fs/promises')
        const logDir = app.getPath('logs')
        const files = await fs.readdir(logDir).catch(() => [] as string[])
        const stats = await Promise.all(
            files.map(async f => {
                const fp = path.join(logDir, f)
                const s = await fs.stat(fp)
                return { fileName: f, filePath: fp, fileSize: s.size, lastModified: s.mtimeMs }
            }),
        )
        return stats
    })
    ipcMain.handle('logger:getLogContent', async (_e, fileName: string) => {
        const fs = await import('node:fs/promises')
        return fs.readFile(path.join(app.getPath('logs'), fileName), 'utf-8')
    })
    ipcMain.handle('logger:deleteLogFile', async (_e, fileName: string) => {
        const fs = await import('node:fs/promises')
        await fs.unlink(path.join(app.getPath('logs'), fileName))
        return true
    })
    ipcMain.handle('logger:clearAllLogs', async () => {
        const fs = await import('node:fs/promises')
        const logDir = app.getPath('logs')
        const files = await fs.readdir(logDir).catch(() => [] as string[])
        await Promise.all(files.map(f => fs.unlink(path.join(logDir, f))))
        return true
    })

    // device handlers
    ipcMain.handle('device:getDeviceInfo', () => ({
        platform: process.platform,
        arch: process.arch,
        version: process.getSystemVersion?.() ?? process.version,
    }))
    ipcMain.handle('device:getSystemStatus', () => ({
        memory: process.memoryUsage(),
        uptime: process.uptime(),
    }))
}
