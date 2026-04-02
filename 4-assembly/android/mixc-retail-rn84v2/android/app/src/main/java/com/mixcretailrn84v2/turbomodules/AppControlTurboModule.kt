package com.impos2.mixcretailrn84v2.turbomodules

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule
import com.impos2.adapter.appcontrol.AppControlManager
import com.impos2.mixcretailrn84v2.MainActivity
import com.impos2.mixcretailrn84v2.startup.StartupCoordinator

/**
 * AppControl TurboModule。
 *
 * 这个模块把“应用壳层控制能力”暴露给 JS，包括：
 * - 加载态控制
 * - 全屏控制
 * - 锁定模式控制
 * - 应用重启
 * - 应用退出
 *
 * 其中最关键的整合层特性有两个：
 * 1. `hideLoading(displayIndex=0)` 会触发主屏 `onAppLoadComplete`，驱动原生启动编排继续往下走；
 * 2. `restartApp()` 会走主进程统一的重启链路，而不是让 JS 自己随意 reload。
 */
@ReactModule(name = AppControlTurboModule.NAME)
class AppControlTurboModule(reactContext: ReactApplicationContext) :
  NativeAppControlTurboModuleSpec(reactContext) {

  companion object {
    const val NAME = "AppControlTurboModule"
  }

  /**
   * AppControlManager 是 adapterPure 提供的系统控制实现。
   */
  private val appControlManager by lazy {
    AppControlManager.getInstance(reactApplicationContext.applicationContext as android.app.Application)
  }

  override fun getName(): String = NAME

  /**
   * 展示原生 loading。
   */
  override fun showLoading(message: String, promise: Promise) {
    runAction(promise) { appControlManager.showLoading(message) }
  }

  /**
   * 隐藏 loading。
   *
   * 当 displayIndex=0 时，额外把这次调用视为“主屏应用完成加载”的原生信号。
   */
  override fun hideLoading(displayIndex: Double, promise: Promise) {
    runAction(promise) {
      if (displayIndex.toInt() == 0) {
        val activity = MainActivity.instance ?: error("MainActivity not ready")
        StartupCoordinator.onAppLoadComplete(activity, 0)
      }
      appControlManager.hideLoading(displayIndex.toInt())
    }
  }

  /**
   * 执行应用级重启。
   *
   * 这里只允许通过主屏 Activity 发起，避免副屏直接控制整个宿主生命周期。
   */
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

  /**
   * 退出应用。
   *
   * 这是 adapterPure 暴露的底层能力，保留给某些测试场景或设备级流程使用。正式业务若要重建 RN，
   * 应优先走 [restartApp]。
   */
  override fun exitApp(promise: Promise) {
    runAction(promise) { appControlManager.exitApp() }
  }

  /**
   * 设置全屏状态。
   */
  override fun setFullscreen(enabled: Boolean, promise: Promise) {
    runAction(promise) { appControlManager.setFullscreen(enabled) }
  }

  /**
   * 设置 kiosk / lock task 状态。
   */
  override fun setKioskMode(enabled: Boolean, promise: Promise) {
    runAction(promise) { appControlManager.setKioskMode(enabled) }
  }

  /**
   * 查询当前是否全屏。
   */
  override fun isFullscreen(promise: Promise) {
    runCatching {
      appControlManager.isFullscreen()
    }.onSuccess {
      promise.resolve(it)
    }.onFailure {
      promise.reject("APP_CONTROL_ERROR", it.message, it)
    }
  }

  /**
   * 查询当前是否锁定模式。
   */
  override fun isKioskMode(promise: Promise) {
    runCatching {
      appControlManager.isKioskMode()
    }.onSuccess {
      promise.resolve(it)
    }.onFailure {
      promise.reject("APP_CONTROL_ERROR", it.message, it)
    }
  }

  /**
   * 封装通用的“无返回值原生动作”执行与 Promise 错误处理。
   */
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
