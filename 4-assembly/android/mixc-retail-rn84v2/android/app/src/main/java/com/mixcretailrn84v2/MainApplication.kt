package com.impos2.mixcretailrn84v2

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.react.devsupport.interfaces.DevLoadingViewManager
import com.impos2.mixcretailrn84v2.turbomodules.AdapterPackage

class MainApplication : Application(), ReactApplication {

  override val reactNativeHost: DefaultReactNativeHost =
    object : DefaultReactNativeHost(this) {
      override fun getPackages() =
        PackageList(this@MainApplication).packages.apply {
          add(AdapterPackage())
        }

      override fun getJSMainModuleName(): String = "index"

      override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

      override fun getDevLoadingViewManager(): DevLoadingViewManager =
        object : DevLoadingViewManager {
          override fun showMessage(message: String) = Unit

          override fun showMessage(
            message: String,
            color: Double?,
            backgroundColor: Double?,
            dismissButton: Boolean?,
          ) = Unit

          override fun updateProgress(status: String?, done: Int?, total: Int?) = Unit

          override fun hide() = Unit
        }
    }

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(applicationContext, reactNativeHost)
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }
}
