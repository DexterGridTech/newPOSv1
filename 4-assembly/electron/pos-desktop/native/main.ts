import { app, BrowserWindow, ipcMain, session } from 'electron'
import path from 'node:path'
import started from 'electron-squirrel-startup'

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
}

app.on('ready', () => {
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
    // appControl handlers — 对应 Android 的 ScreenControlModule + AppTurboModule
    ipcMain.handle('appControl:isFullScreen', () => {
        const win = BrowserWindow.getFocusedWindow()
        return win?.isFullScreen() ?? false
    })
    ipcMain.handle('appControl:setFullScreen', (_e, isFullScreen: boolean) => {
        BrowserWindow.getFocusedWindow()?.setFullScreen(isFullScreen)
    })
    ipcMain.handle('appControl:isAppLocked', () => false)
    ipcMain.handle('appControl:setAppLocked', () => {})
    ipcMain.handle('appControl:restartApp', () => {
        app.relaunch()
        app.exit(0)
    })
    ipcMain.handle('appControl:onAppLoadComplete', () => {
        console.log('[Assembly] App load complete')
    })
}
