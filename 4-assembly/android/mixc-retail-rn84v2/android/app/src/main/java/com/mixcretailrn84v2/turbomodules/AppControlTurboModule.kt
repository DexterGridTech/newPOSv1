package com.impos2.mixcretailrn84v2.turbomodules

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule
import com.impos2.adapter.appcontrol.AppControlManager
import com.impos2.mixcretailrn84v2.MainActivity
import com.impos2.mixcretailrn84v2.startup.StartupCoordinator

@ReactModule(name = AppControlTurboModule.NAME)
class AppControlTurboModule(reactContext: ReactApplicationContext) :
  NativeAppControlTurboModuleSpec(reactContext) {

  companion object {
    const val NAME = "AppControlTurboModule"
  }

  private val appControlManager by lazy {
    AppControlManager.getInstance(reactApplicationContext.applicationContext as android.app.Application)
  }

  override fun getName(): String = NAME

  override fun showLoading(message: String, promise: Promise) {
    runAction(promise) { appControlManager.showLoading(message) }
  }

  override fun hideLoading(displayIndex: Double, promise: Promise) {
    runAction(promise) {
      if (displayIndex.toInt() == 0) {
        val activity = MainActivity.instance ?: error("MainActivity not ready")
        StartupCoordinator.onAppLoadComplete(activity, 0)
      }
      appControlManager.hideLoading(displayIndex.toInt())
    }
  }

  override fun restartApp(promise: Promise) {
    runCatching {
      val activity = MainActivity.instance ?: error("MainActivity not ready")
      activity.restartApp()
    }.onSuccess {
      promise.resolve(null)
    }.onFailure {
      promise.reject("APP_CONTROL_ERROR", it.message, it)
    }
  }

  override fun exitApp(promise: Promise) {
    runAction(promise) { appControlManager.exitApp() }
  }

  override fun setFullscreen(enabled: Boolean, promise: Promise) {
    runAction(promise) { appControlManager.setFullscreen(enabled) }
  }

  override fun setKioskMode(enabled: Boolean, promise: Promise) {
    runAction(promise) { appControlManager.setKioskMode(enabled) }
  }

  override fun isFullscreen(promise: Promise) {
    runCatching {
      appControlManager.isFullscreen()
    }.onSuccess {
      promise.resolve(it)
    }.onFailure {
      promise.reject("APP_CONTROL_ERROR", it.message, it)
    }
  }

  override fun isKioskMode(promise: Promise) {
    runCatching {
      appControlManager.isKioskMode()
    }.onSuccess {
      promise.resolve(it)
    }.onFailure {
      promise.reject("APP_CONTROL_ERROR", it.message, it)
    }
  }

  private inline fun runAction(promise: Promise, action: () -> Unit) {
    runCatching {
      action()
    }.onSuccess {
      promise.resolve(null)
    }.onFailure {
      promise.reject("APP_CONTROL_ERROR", it.message, it)
    }
  }
}
