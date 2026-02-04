package com.impos2desktopv1.screen

import android.util.Log
import android.view.KeyEvent

/**
 * 按键拦截器
 *
 * 功能：
 * 1. 拦截 Home 键
 * 2. 拦截最近任务键
 * 3. 拦截返回键
 * 4. 拦截音量键
 *
 * 优化点：
 * - 配置化管理，支持动态开关
 * - 返回拦截结果，便于调试
 */
class KeyInterceptor(private val config: ScreenControlConfig) {

    companion object {
        private const val TAG = "KeyInterceptor"
    }

    /**
     * 拦截按键事件
     * @return true 表示拦截，false 表示不拦截
     */
    fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean {
        return when (keyCode) {
            KeyEvent.KEYCODE_HOME -> {
                if (config.interceptHomeKey) {
                    Log.d(TAG, "拦截 Home 键")
                    true
                } else {
                    false
                }
            }
            KeyEvent.KEYCODE_APP_SWITCH -> {
                if (config.interceptRecentKey) {
                    Log.d(TAG, "拦截最近任务键")
                    true
                } else {
                    false
                }
            }
            KeyEvent.KEYCODE_BACK -> {
                if (config.interceptBackKey) {
                    Log.d(TAG, "拦截返回键")
                    true
                } else {
                    false
                }
            }
            KeyEvent.KEYCODE_VOLUME_UP, KeyEvent.KEYCODE_VOLUME_DOWN -> {
                if (config.interceptVolumeKey) {
                    Log.d(TAG, "拦截音量键")
                    true
                } else {
                    false
                }
            }
            else -> false
        }
    }
}
