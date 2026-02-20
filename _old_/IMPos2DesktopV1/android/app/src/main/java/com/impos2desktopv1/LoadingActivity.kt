package com.impos2desktopv1

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import com.impos2desktopv1.base.BaseFullscreenActivity
import com.impos2desktopv1.ui.LoadingView

/**
 * 加载中间页
 *
 * 职责：
 * 1. 在应用重启时显示加载界面
 * 2. 避免应用退回桌面
 * 3. 自动返回主界面
 *
 * 设计原则：
 * - 单一职责：只负责显示加载界面和跳转
 * - 简洁设计：去除复杂的 UI 和动画
 * - 简单可控：移除所有 SplashScreen 逻辑
 */
class LoadingActivity : BaseFullscreenActivity() {

    companion object {
        private const val TAG = "LoadingActivity"
        const val EXTRA_MESSAGE = "message"
        const val EXTRA_AUTO_RETURN = "auto_return"
        const val EXTRA_DELAY_MS = "delay_ms"
    }

    private val mainHandler = Handler(Looper.getMainLooper())
    private var loadingView: LoadingView? = null

    override fun onInitialize(savedInstanceState: Bundle?) {
        // 获取参数
        val message = intent.getStringExtra(EXTRA_MESSAGE) ?: "正在重启应用..."
        val autoReturn = intent.getBooleanExtra(EXTRA_AUTO_RETURN, true)
        val delayMs = intent.getLongExtra(EXTRA_DELAY_MS, 2500)

        // 创建加载视图
        loadingView = LoadingView(this).apply {
            setMessage(message)
        }
        setContentView(loadingView)

        // 显示动画
        loadingView?.show()

        // 自动返回
        if (autoReturn) {
            mainHandler.postDelayed({
                returnToMainActivity()
            }, delayMs)
        }

        Log.d(TAG, "LoadingActivity 初始化完成")
    }

    /**
     * 返回到 MainActivity
     */
    private fun returnToMainActivity() {
        try {
            Log.d(TAG, "返回到 MainActivity")
            loadingView?.hide {
                val intent = Intent(this, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
                }
                startActivity(intent)
                finish()
            }
        } catch (e: Exception) {
            Log.e(TAG, "返回 MainActivity 失败", e)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        mainHandler.removeCallbacksAndMessages(null)
    }
}
