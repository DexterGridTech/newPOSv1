package com.impos2.posdesktop.screen

import android.app.Activity

class ScreenControlManager(private val activity: Activity) {

    private val config = ScreenControlConfig.loadFromAssets(activity)
    val screenManager = ScreenManager(activity, config)
    val kioskManager = KioskManager(activity)
    val keyInterceptor = KeyInterceptor(config)

    fun initialize() {
        if (config.fullscreenEnabled) screenManager.enableFullscreen()
        if (config.lockTaskEnabled) kioskManager.startLockTask()
    }

    fun enableFullscreen() = screenManager.enableFullscreen()
    fun disableFullscreen() = screenManager.disableFullscreen()
    fun isFullscreen() = screenManager.isFullscreen()

    fun startLockTask() = kioskManager.startLockTask()
    fun stopLockTask() = kioskManager.stopLockTask()
    fun isInLockTaskMode() = kioskManager.isInLockTaskMode()

    fun onKeyDown(keyCode: Int) = keyInterceptor.onKeyDown(keyCode)

    fun destroy() {
        screenManager.destroy()
        kioskManager.destroy()
    }
}
