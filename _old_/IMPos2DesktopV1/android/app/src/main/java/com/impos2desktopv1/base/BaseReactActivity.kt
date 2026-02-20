package com.impos2desktopv1.base

import android.os.Bundle
import android.view.KeyEvent
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.impos2desktopv1.utils.FullscreenHelper

/**
 * React Native Activity 基类
 *
 * 职责：
 * 1. 统一管理全屏设置
 * 2. 提供按键拦截机制
 * 3. 提供启动参数配置
 *
 * 设计原则：
 * - 模板方法模式：定义算法骨架，子类实现具体步骤
 * - 开闭原则：对扩展开放，对修改关闭
 * - 简单可控：移除所有 SplashScreen 逻辑
 */
abstract class BaseReactActivity : ReactActivity() {

    /**
     * 是否启用全屏模式
     */
    protected open fun shouldEnableFullscreen(): Boolean = true

    /**
     * 获取启动参数
     * 子类可以覆盖此方法来提供自定义的启动参数
     */
    protected open fun getLaunchParams(): Bundle? = null

    /**
     * 处理按键事件
     * 子类可以覆盖此方法来实现自定义的按键处理逻辑
     * @return true 表示已处理，false 表示未处理
     */
    protected open fun handleKeyDown(keyCode: Int, event: KeyEvent): Boolean = false

    override fun createReactActivityDelegate(): ReactActivityDelegate =
        object : DefaultReactActivityDelegate(
            this,
            mainComponentName ?: "",
            fabricEnabled
        ) {
            override fun getLaunchOptions(): Bundle? = getLaunchParams()
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        // 1. 设置早期全屏
        if (shouldEnableFullscreen()) {
            FullscreenHelper.setFullscreenEarly(this)
        }

        // 2. 调用父类 onCreate
        super.onCreate(savedInstanceState)

        // 3. 设置完整全屏模式
        if (shouldEnableFullscreen()) {
            FullscreenHelper.setFullscreen(this)
        }

        // 4. 调用子类初始化
        onInitialize(savedInstanceState)
    }

    /**
     * 子类初始化方法
     */
    protected abstract fun onInitialize(savedInstanceState: Bundle?)

    override fun onResume() {
        super.onResume()
        // 恢复全屏模式
        if (shouldEnableFullscreen()) {
            FullscreenHelper.setFullscreen(this)
        }
        onResumeAfterFullscreen()
    }

    /**
     * 在全屏设置后的 onResume 回调
     */
    protected open fun onResumeAfterFullscreen() {}

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus && shouldEnableFullscreen()) {
            FullscreenHelper.setFullscreen(this)
        }
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean {
        // 先尝试子类处理
        if (handleKeyDown(keyCode, event)) {
            return true
        }
        // 子类未处理，交给父类
        return super.onKeyDown(keyCode, event)
    }
}
