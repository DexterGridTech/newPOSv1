package com.impos2desktopv1.base

import android.app.Activity
import android.os.Bundle
import android.util.Log
import com.impos2desktopv1.utils.FullscreenHelper

/**
 * 全屏 Activity 基类
 *
 * 职责：
 * 1. 统一管理全屏设置
 * 2. 提供生命周期钩子
 *
 * 设计原则：
 * - 模板方法模式：定义算法骨架，子类实现具体步骤
 * - 单一职责：只负责全屏相关逻辑
 * - 简单可控：移除所有 SplashScreen 逻辑
 */
abstract class BaseFullscreenActivity : Activity() {

    companion object {
        private const val TAG = "BaseFullscreenActivity"
    }

    /**
     * 是否启用全屏模式
     * 子类可以覆盖此方法来控制是否启用全屏
     */
    protected open fun shouldEnableFullscreen(): Boolean = true

    override fun onCreate(savedInstanceState: Bundle?) {
        // 1. 设置早期全屏（在 super.onCreate 之前）
        if (shouldEnableFullscreen()) {
            FullscreenHelper.setFullscreenEarly(this)
        }

        // 2. 调用父类 onCreate
        super.onCreate(savedInstanceState)
        Log.d(TAG, "${javaClass.simpleName} onCreate")

        // 3. 设置完整全屏模式（在 super.onCreate 之后）
        if (shouldEnableFullscreen()) {
            FullscreenHelper.setFullscreen(this)
        }

        // 4. 调用子类初始化
        onInitialize(savedInstanceState)
    }

    /**
     * 子类初始化方法
     * 在全屏和启动屏设置完成后调用
     */
    protected abstract fun onInitialize(savedInstanceState: Bundle?)

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus && shouldEnableFullscreen()) {
            FullscreenHelper.setFullscreen(this)
            Log.d(TAG, "${javaClass.simpleName} 窗口获得焦点，重新设置全屏")
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        Log.d(TAG, "${javaClass.simpleName} onDestroy")
    }
}
