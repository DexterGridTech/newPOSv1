package com.impos2.mixcretailrn84.appcontrol

import android.os.Handler
import android.os.Looper
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule
import com.impos2.mixcretailrn84.loading.LoadingManager
import com.adapterrn84.turbomodules.NativeAppControlModuleSpec
import org.devio.rn.splashscreen.SplashScreen

@ReactModule(name = AppControlModule.NAME)
class AppControlModule(reactContext: ReactApplicationContext) :
    NativeAppControlModuleSpec(reactContext) {

    companion object {
        const val NAME = "AppControlModule"
    }

    private val mainHandler = Handler(Looper.getMainLooper())

    private val activity get() = currentActivity as? com.impos2.mixcretailrn84.MainActivity

    override fun isFullScreen(promise: Promise) {
        mainHandler.post {
            try {
                promise.resolve(activity?.screenControlManager?.isFullscreen() ?: false)
            } catch (e: Exception) {
                promise.reject("ERR_FULLSCREEN", e)
            }
        }
    }

    override fun isAppLocked(promise: Promise) {
        mainHandler.post {
            try {
                promise.resolve(activity?.screenControlManager?.isInLockTaskMode() ?: false)
            } catch (e: Exception) {
                promise.reject("ERR_LOCK", e)
            }
        }
    }

    override fun setFullScreen(isFullScreen: Boolean, promise: Promise) {
        mainHandler.post {
            try {
                val mgr = activity?.screenControlManager
                if (mgr != null) {
                    if (isFullScreen) mgr.enableFullscreen() else mgr.disableFullscreen()
                }
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject("ERR_FULLSCREEN", e)
            }
        }
    }

    override fun setAppLocked(isAppLocked: Boolean, promise: Promise) {
        mainHandler.post {
            try {
                val mgr = activity?.screenControlManager
                if (mgr != null) {
                    if (isAppLocked) mgr.startLockTask() else mgr.stopLockTask()
                }
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject("ERR_LOCK", e)
            }
        }
    }

    override fun restartApp(promise: Promise) {
        mainHandler.post {
            try {
                activity?.appRestartManager?.restart()
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject("ERR_RESTART", e)
            }
        }
    }

    override fun onAppLoadComplete(displayIndex: Double, promise: Promise) {
        mainHandler.post {
            try {
                LoadingManager.hideLoading()
                activity?.let { SplashScreen.hide(it) }
                if (displayIndex.toInt() == 0) {
                    activity?.multiDisplayManager?.startSecondaryIfAvailable()
                }
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject("ERR_LOAD_COMPLETE", e)
            }
        }
    }
}
