package com.impos2.mixcretailrn84.appcontrol

import android.app.Application
import com.adapterrn84.turbomodules.appcontrol.AppControlHandler
import com.impos2.mixcretailrn84.MainActivity
import com.impos2.mixcretailrn84.loading.LoadingManager
import kotlin.system.exitProcess

class AppControlHandlerImpl(
    private val application: Application
) : AppControlHandler {

    override fun showLoading(message: String) {
        MainActivity.instance?.let { activity ->
            LoadingManager.showLoadingActivity(activity)
        }
    }

    override fun hideLoading(displayIndex: Int) {
        if (displayIndex == 0) {
            LoadingManager.hideLoading()
            MainActivity.instance?.multiDisplayManager?.startSecondaryIfAvailable()
        }
    }

    override fun restartApp() {
        MainActivity.instance?.restartApp()
    }

    override fun exitApp() {
        MainActivity.instance?.finishAndRemoveTask()
        exitProcess(0)
    }

    override fun setFullscreen(enabled: Boolean) {
        MainActivity.instance?.screenControlManager?.let { manager ->
            if (enabled) {
                manager.enableFullscreen()
            } else {
                manager.disableFullscreen()
            }
        }
    }

    override fun setKioskMode(enabled: Boolean) {
        MainActivity.instance?.screenControlManager?.let { manager ->
            if (enabled) {
                manager.startLockTask()
            } else {
                manager.stopLockTask()
            }
        }
    }
}
