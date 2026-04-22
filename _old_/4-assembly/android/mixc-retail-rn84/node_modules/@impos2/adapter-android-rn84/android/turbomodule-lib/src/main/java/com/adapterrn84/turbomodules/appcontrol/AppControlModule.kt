package com.adapterrn84.turbomodules.appcontrol

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule
import com.adapterrn84.turbomodules.NativeAppControlModuleSpec

@ReactModule(name = AppControlModule.NAME)
class AppControlModule(reactContext: ReactApplicationContext) :
    NativeAppControlModuleSpec(reactContext) {

    companion object {
        const val NAME = "AppControlModule"
        private var handler: AppControlHandler? = null

        fun registerHandler(h: AppControlHandler) {
            handler = h
        }
    }

    override fun getName() = NAME

    @ReactMethod
    override fun showLoading(message: String, promise: Promise) {
        try {
            handler?.showLoading(message) ?: run {
                promise.reject("NO_HANDLER", "Handler not registered")
                return
            }
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    override fun hideLoading(displayIndex: Double, promise: Promise) {
        try {
            handler?.hideLoading(displayIndex.toInt()) ?: run {
                promise.reject("NO_HANDLER", "Handler not registered")
                return
            }
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    override fun restartApp(promise: Promise) {
        try {
            handler?.restartApp() ?: run {
                promise.reject("NO_HANDLER", "Handler not registered")
                return
            }
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    override fun exitApp(promise: Promise) {
        try {
            handler?.exitApp() ?: run {
                promise.reject("NO_HANDLER", "Handler not registered")
                return
            }
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    override fun setFullscreen(enabled: Boolean, promise: Promise) {
        try {
            handler?.setFullscreen(enabled) ?: run {
                promise.reject("NO_HANDLER", "Handler not registered")
                return
            }
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    override fun setKioskMode(enabled: Boolean, promise: Promise) {
        try {
            handler?.setKioskMode(enabled) ?: run {
                promise.reject("NO_HANDLER", "Handler not registered")
                return
            }
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }
}
