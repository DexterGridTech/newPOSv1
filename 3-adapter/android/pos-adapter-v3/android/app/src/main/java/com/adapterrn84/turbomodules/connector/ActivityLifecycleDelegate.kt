package com.adapterrn84.turbomodules.connector

import android.app.Activity
import android.content.Intent
import android.view.KeyEvent
import com.adapterrn84.turbomodules.ConnectorTurboModule

/**
 * Activity 生命周期委托类
 *
 * 用于处理 ExternalConnector 相关的 Activity 生命周期事件
 * 整合层可以在自己的 MainActivity 中创建此类的实例,并在相应的生命周期方法中调用
 *
 * 使用示例:
 * ```kotlin
 * class MainActivity : ReactActivity() {
 *     private val connectorDelegate = ActivityLifecycleDelegate()
 *
 *     override fun dispatchKeyEvent(event: KeyEvent): Boolean {
 *         if (connectorDelegate.handleKeyEvent(event)) return true
 *         return super.dispatchKeyEvent(event)
 *     }
 *
 *     override fun onRequestPermissionsResult(...) {
 *         super.onRequestPermissionsResult(...)
 *         connectorDelegate.handlePermissionResult(requestCode, permissions, grantResults)
 *     }
 *
 *     override fun onActivityResult(...) {
 *         super.onActivityResult(...)
 *         connectorDelegate.handleActivityResult(requestCode, resultCode, data)
 *     }
 * }
 * ```
 */
class ActivityLifecycleDelegate {

    /**
     * 处理按键事件
     *
     * @param event 按键事件
     * @return true 表示事件已被处理,不需要继续传递; false 表示事件未被处理,需要继续传递
     */
    fun handleKeyEvent(event: KeyEvent): Boolean {
        // 1. 优先让 HID channel 处理
        val module = ConnectorTurboModule.getInstance()
        if (module?.onKeyEvent(event) == true) return true

        // 2. 禁用所有可能导致界面跳转的按键
        return when (event.keyCode) {
            KeyEvent.KEYCODE_TAB,           // Tab 键
            KeyEvent.KEYCODE_DPAD_UP,       // 方向键上
            KeyEvent.KEYCODE_DPAD_DOWN,     // 方向键下
            KeyEvent.KEYCODE_DPAD_LEFT,     // 方向键左
            KeyEvent.KEYCODE_DPAD_RIGHT,    // 方向键右
            KeyEvent.KEYCODE_DPAD_CENTER,   // 方向键中心（确认）
            KeyEvent.KEYCODE_ENTER,         // 回车键
            KeyEvent.KEYCODE_SPACE          // 空格键
            -> true  // 拦截这些按键,不让它们触发导航
            else -> false
        }
    }

    /**
     * 处理权限请求结果
     *
     * @param requestCode 请求码
     * @param permissions 权限列表
     * @param grantResults 授权结果列表
     */
    fun handlePermissionResult(
        requestCode: Int,
        permissions: Array<String>,
        grantResults: IntArray
    ) {
        try {
            val connectorModule = ConnectorTurboModule.getInstance()
            connectorModule?.getConnectorManager()?.getPermissionCoordinator()
                ?.onPermissionResult(requestCode, permissions, grantResults)
        } catch (_: Exception) {
            // Module may not be ready
        }
    }

    /**
     * 处理 Activity Result
     *
     * @param requestCode 请求码
     * @param resultCode 结果码
     * @param data Intent 数据
     */
    fun handleActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        try {
            val connectorModule = ConnectorTurboModule.getInstance()
            connectorModule?.getConnectorManager()?.getEventDispatcher()
                ?.dispatchActivityResult(requestCode, resultCode, data)
        } catch (_: Exception) {
            // Module may not be ready
        }
    }
}
