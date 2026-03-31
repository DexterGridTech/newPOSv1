package com.impos2.mixcretailrn84.loading

import android.app.Activity
import android.content.Intent
import android.os.Handler
import android.os.Looper
import java.lang.ref.WeakReference
import java.util.concurrent.atomic.AtomicBoolean

object LoadingManager {

    private enum class CoverType { NONE, SPLASH_SCREEN, LOADING_ACTIVITY }

    private val mainHandler = Handler(Looper.getMainLooper())
    private var currentCover = CoverType.SPLASH_SCREEN
    private var loadingActivityRef: WeakReference<LoadingActivity>? = null

    // androidx SplashScreen 通过 setKeepOnScreenCondition 轮询此值
    private val hideRequested = AtomicBoolean(false)

    fun isHideRequested(): Boolean = hideRequested.get()

    /** 重启时用 LoadingActivity 遮盖 */
    fun showLoadingActivity(activity: Activity) {
        mainHandler.post {
            hideRequested.set(false)
            currentCover = CoverType.LOADING_ACTIVITY
            activity.startActivity(Intent(activity, LoadingActivity::class.java))
        }
    }

    fun registerLoadingActivity(activity: LoadingActivity) {
        loadingActivityRef = WeakReference(activity)
    }

    fun unregisterLoadingActivity(activity: LoadingActivity) {
        if (loadingActivityRef?.get() === activity) {
            loadingActivityRef = null
        }
    }

    /** onAppLoadComplete 时调用，根据当前遮盖类型决定如何关闭 */
    fun hideLoading() {
        when (currentCover) {
            CoverType.SPLASH_SCREEN -> {
                // 通知 setKeepOnScreenCondition 可以消失了（在任意线程调用均安全）
                hideRequested.set(true)
            }
            CoverType.LOADING_ACTIVITY -> {
                mainHandler.post {
                    loadingActivityRef?.get()?.finish()
                    loadingActivityRef = null
                }
            }
            CoverType.NONE -> { /* 已关闭，忽略 */ }
        }
        currentCover = CoverType.NONE
    }
}
