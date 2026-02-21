package com.impos2.posdesktop

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class AppTurboModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = NAME

    @ReactMethod
    fun restartApp(promise: Promise) {
        val activity = currentActivity as? MainActivity
            ?: return promise.reject("NO_ACTIVITY", "MainActivity not available")
        activity.runOnUiThread {
            try {
                activity.restartApp()
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject("RESTART_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun onAppLoadComplete(promise: Promise) {
        val activity = currentActivity as? MainActivity
            ?: return promise.reject("NO_ACTIVITY", "MainActivity not available")
        activity.runOnUiThread {
            try {
                activity.onAppLoadComplete()
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject("LOAD_COMPLETE_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun getDisplayInfo(promise: Promise) {
        val activity = currentActivity as? MainActivity
            ?: return promise.reject("NO_ACTIVITY", "MainActivity not available")
        val map = com.facebook.react.bridge.Arguments.createMap().apply {
            putBoolean("isSecondaryActive", activity.multiDisplayManager.isSecondaryActive)
        }
        promise.resolve(map)
    }

    companion object {
        const val NAME = "AppTurboModule"
    }
}
