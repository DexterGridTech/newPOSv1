package com.impos2.mixcretailrn84

import android.app.Application
import com.mixcretail.turbomodules.AdapterPackage
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.shell.MainReactPackage
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost

class MainApplication : Application(), ReactApplication {

    override val reactNativeHost: ReactNativeHost =
        object : DefaultReactNativeHost(this) {
            override fun getPackages(): List<ReactPackage> {
                return listOf(
                    MainReactPackage(),
                    AdapterPackage(),
                    com.margelo.nitro.mmkv.NitroMmkvPackage(),
                    com.margelo.nitro.NitroModulesPackage(),
                    org.devio.rn.splashscreen.SplashScreenReactPackage(),
                    com.horcrux.svg.SvgPackage()
                )
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
    }
}
