package com.impos2.mixcretailrn84

import android.app.Application
import com.adapterrn84.turbomodules.AdapterPackage
import com.adapterrn84.turbomodules.appcontrol.AppControlModule
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.impos2.mixcretailrn84.appcontrol.AppControlHandlerImpl
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost

class MainApplication : Application(), ReactApplication {

    override val reactNativeHost: ReactNativeHost =
        object : DefaultReactNativeHost(this) {
            override fun getPackages(): List<ReactPackage> =
                PackageList(this).packages.apply {
                    add(AdapterPackage())
                }

            override fun getJSMainModuleName(): String = "index"

            override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

            override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
            override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
        }

    override val reactHost: ReactHost
        get() = getDefaultReactHost(applicationContext, reactNativeHost)

    override fun onCreate() {
        super.onCreate()
        ReactNativeApplicationEntryPoint.loadReactNative(this)
        AppControlModule.registerHandler(AppControlHandlerImpl(this))
    }
}
