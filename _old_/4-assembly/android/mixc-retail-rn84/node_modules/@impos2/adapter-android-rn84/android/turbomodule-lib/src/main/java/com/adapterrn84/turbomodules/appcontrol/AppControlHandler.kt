package com.adapterrn84.turbomodules.appcontrol

interface AppControlHandler {
    fun showLoading(message: String)
    fun hideLoading(displayIndex: Int)
    fun restartApp()
    fun exitApp()
    fun setFullscreen(enabled: Boolean)
    fun setKioskMode(enabled: Boolean)
}
