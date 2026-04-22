package com.impos2.posdesktop.screen

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.impos2.posdesktop.MainActivity

class ScreenControlTurboModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "ScreenControlModule"
    }

    override fun getName() = NAME

    private fun withActivity(promise: Promise, block: (MainActivity) -> Unit) {
        val activity = currentActivity as? MainActivity
            ?: return promise.reject("ERROR", "Activity is null")
        activity.runOnUiThread {
            try { block(activity) } catch (e: Exception) { promise.reject("ERROR", e.message ?: "Unknown error") }
        }
    }

    @ReactMethod fun enableFullscreen(promise: Promise) =
        withActivity(promise) { it.screenControlManager.enableFullscreen(); promise.resolve(true) }

    @ReactMethod fun disableFullscreen(promise: Promise) =
        withActivity(promise) { it.screenControlManager.disableFullscreen(); promise.resolve(true) }

    @ReactMethod fun startLockTask(promise: Promise) =
        withActivity(promise) { it.screenControlManager.startLockTask(); promise.resolve(true) }

    @ReactMethod fun stopLockTask(promise: Promise) =
        withActivity(promise) { it.screenControlManager.stopLockTask(); promise.resolve(true) }

    // 纯读操作，无需切主线程
    @ReactMethod fun isFullscreen(promise: Promise) {
        val activity = currentActivity as? MainActivity
        promise.resolve(activity?.screenControlManager?.isFullscreen() ?: false)
    }

    @ReactMethod fun isInLockTaskMode(promise: Promise) {
        val activity = currentActivity as? MainActivity
        promise.resolve(activity?.screenControlManager?.isInLockTaskMode() ?: false)
    }
}
