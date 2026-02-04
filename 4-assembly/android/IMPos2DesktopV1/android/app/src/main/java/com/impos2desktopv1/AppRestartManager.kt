package com.impos2desktopv1

import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.util.Log

/**
 * 应用重启管理器
 *
 * 职责：
 * 1. 管理应用重启流程
 * 2. 跳转到 LoadingActivity
 * 3. 重新创建 React Context
 */
class AppRestartManager(private val activity: MainActivity) {

    companion object {
        private const val TAG = "AppRestartManager"
        private const val RELOAD_DELAY_MS = 1000L
    }

    private val mainHandler = Handler(Looper.getMainLooper())

    /**
     * 重新加载 React 应用（通过中间页避免退回桌面）
     */
    fun reloadReactApplication() {
        try {
            Log.d(TAG, "开始重新加载React应用（通过中间页）")

            // 跳转到 LoadingActivity
            val intent = Intent(activity, LoadingActivity::class.java).apply {
                putExtra(LoadingActivity.EXTRA_MESSAGE, "正在重启应用...")
                putExtra(LoadingActivity.EXTRA_AUTO_RETURN, true)
                putExtra(LoadingActivity.EXTRA_DELAY_MS, 2500L)
            }
            activity.startActivity(intent)

            // 延迟后开始重新创建 ReactContext
            mainHandler.postDelayed({
                recreateReactContext()
            }, RELOAD_DELAY_MS)

        } catch (e: Exception) {
            Log.e(TAG, "reloadReactApplication失败", e)
        }
    }

    /**
     * 重新创建 React Context
     */
    private fun recreateReactContext() {
        try {
            Log.d(TAG, "开始重新创建ReactContext")
            val reactInstanceManager = activity.provideReactInstanceManager()

            // 使用 recreateReactContextInBackground 重新加载
            reactInstanceManager.recreateReactContextInBackground()

            Log.d(TAG, "ReactContext重新创建已触发")
        } catch (e: Exception) {
            Log.e(TAG, "重新创建ReactContext失败", e)
        }
    }
}
