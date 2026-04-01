package com.impos2.mixcretailrn84v2

import android.content.Context
import android.hardware.display.DisplayManager
import android.os.Bundle
import android.view.KeyEvent
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.impos2.adapter.appcontrol.AppControlManager
import com.impos2.adapter.device.DeviceManager
import com.impos2.mixcretailrn84v2.restart.AppRestartManager
import com.impos2.mixcretailrn84v2.turbomodules.ConnectorTurboModule
import com.zoontek.rnbootsplash.RNBootSplash

class MainActivity : ReactActivity() {

  companion object {
    @Volatile
    var instance: MainActivity? = null
      private set
  }

  private lateinit var appRestartManager: AppRestartManager

  private val appControlManager by lazy {
    AppControlManager.getInstance(application)
  }

  override fun getMainComponentName(): String = "MixcRetailRN84v2"

  override fun createReactActivityDelegate(): ReactActivityDelegate =
    object : DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled) {
      override fun getLaunchOptions(): Bundle {
        val deviceInfo = DeviceManager.getInstance(applicationContext).getDeviceInfo()
        val dm = getSystemService(Context.DISPLAY_SERVICE) as DisplayManager
        return Bundle().apply {
          putString("deviceId", deviceInfo.id)
          putString("screenMode", "desktop")
          putInt("displayCount", dm.displays.size)
          putInt("displayIndex", 0)
        }
      }
    }

  override fun onCreate(savedInstanceState: Bundle?) {
    instance = this
    RNBootSplash.init(this, R.style.BootTheme)
    super.onCreate(savedInstanceState)
    appRestartManager = AppRestartManager(this)
    appControlManager.setFullscreen(true)
    appControlManager.reapplyCurrentState()
  }

  override fun onDestroy() {
    if (instance === this) {
      instance = null
    }
    super.onDestroy()
  }

  override fun onResume() {
    super.onResume()
    appControlManager.reapplyCurrentState()
  }

  override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    if (hasFocus) {
      appControlManager.reapplyCurrentState()
    }
  }


  fun restartApp() {
    appRestartManager.restart()
  }

  fun reloadReactHostForRestart() {
    reactHost.reload("user restart")
  }

  override fun dispatchKeyEvent(event: KeyEvent): Boolean {
    if (ConnectorTurboModule.onHostKeyEvent(event)) {
      return true
    }
    return super.dispatchKeyEvent(event)
  }
}
