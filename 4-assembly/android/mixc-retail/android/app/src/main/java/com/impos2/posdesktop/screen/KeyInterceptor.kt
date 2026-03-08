package com.impos2.posdesktop.screen

import android.view.KeyEvent

class KeyInterceptor(private val config: ScreenControlConfig) {
    fun onKeyDown(keyCode: Int): Boolean = when (keyCode) {
        KeyEvent.KEYCODE_HOME -> config.interceptHomeKey
        KeyEvent.KEYCODE_APP_SWITCH -> config.interceptRecentKey
        KeyEvent.KEYCODE_BACK -> config.interceptBackKey
        KeyEvent.KEYCODE_VOLUME_UP, KeyEvent.KEYCODE_VOLUME_DOWN -> config.interceptVolumeKey
        else -> false
    }
}
