package com.impos2.mixcretailrn84v2

import android.os.Bundle
import android.util.Log
import android.view.KeyEvent
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.impos2.adapter.appcontrol.AppControlManager
import com.impos2.mixcretailrn84v2.restart.AppRestartManager
import com.impos2.mixcretailrn84v2.startup.LaunchOptionsFactory
import com.impos2.mixcretailrn84v2.startup.SecondaryDisplayLauncher
import com.impos2.mixcretailrn84v2.startup.StartupAuditLogger
import com.impos2.mixcretailrn84v2.startup.StartupCoordinator
import com.impos2.mixcretailrn84v2.startup.StartupOverlayManager
import com.impos2.mixcretailrn84v2.turbomodules.ConnectorTurboModule

class MainActivity : ReactActivity() {

  companion object {
    private const val TAG = "MainActivity"

    @Volatile
    var instance: MainActivity? = null
      private set
  }

  private lateinit var appRestartManager: AppRestartManager
  private lateinit var secondaryDisplayLauncher: SecondaryDisplayLauncher

  private val appControlManager by lazy {
    AppControlManager.getInstance(application)
  }

  override fun getMainComponentName(): String = "MixcRetailRN84v2"

  override fun createReactActivityDelegate(): ReactActivityDelegate =
    object : DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled) {
      override fun getLaunchOptions(): Bundle = LaunchOptionsFactory.create(this@MainActivity, 0)
    }

  override fun onCreate(savedInstanceState: Bundle?) {
    installSplashScreen()
    instance = this
    StartupAuditLogger.logActivityCreated("MainActivity", 0)
    super.onCreate(savedInstanceState)
    secondaryDisplayLauncher = SecondaryDisplayLauncher(this)
    appRestartManager = AppRestartManager(this)
    runCatching { appControlManager.setFullscreen(true) }
      .onFailure { Log.e(TAG, "Failed to enable fullscreen on create", it) }
    runCatching { appControlManager.reapplyCurrentState() }
      .onFailure { Log.e(TAG, "Failed to reapply app control state on create", it) }
    runCatching { StartupCoordinator.attachPrimary(this) }
      .onFailure { Log.e(TAG, "Failed to attach startup coordinator", it) }
  }

  override fun onDestroy() {
    StartupOverlayManager.detach(this)
    if (instance === this) {
      instance = null
    }
    super.onDestroy()
  }

  override fun onResume() {
    super.onResume()
    runCatching { appControlManager.reapplyCurrentState() }
      .onFailure { Log.e(TAG, "Failed to reapply app control state on resume", it) }
  }

  override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    if (hasFocus) {
      runCatching { appControlManager.reapplyCurrentState() }
        .onFailure { Log.e(TAG, "Failed to reapply app control state on window focus", it) }
    }
  }

  fun restartApp() {
    appRestartManager.restart()
  }

  fun reloadReactHostForRestart() {
    StartupAuditLogger.logMainReload()
    reactHost.reload("user restart")
  }

  fun launchSecondaryIfAvailable() {
    secondaryDisplayLauncher.startIfAvailable()
  }

  fun onSecondaryActivityCreated() {
    secondaryDisplayLauncher.markSecondaryStarted()
  }

  fun onSecondaryActivityDestroyed() {
    secondaryDisplayLauncher.markSecondaryStopped()
  }

  fun resetSecondaryLaunchState() {
    secondaryDisplayLauncher.reset()
  }

  val isSecondaryDisplayActive: Boolean
    get() = secondaryDisplayLauncher.isSecondaryActive

  override fun dispatchKeyEvent(event: KeyEvent): Boolean {
    if (ConnectorTurboModule.onHostKeyEvent(event)) {
      return true
    }
    return super.dispatchKeyEvent(event)
  }
}
