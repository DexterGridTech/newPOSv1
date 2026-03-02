package com.adapterrn84

import android.content.Intent
import android.view.KeyEvent
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.adapterrn84.turbomodules.connector.ActivityLifecycleDelegate

/**
 * 适配层的 MainActivity
 *
 * 使用 ActivityLifecycleDelegate 处理 ExternalConnector 相关的生命周期事件
 * 整合层可以参考此实现,在自己的 MainActivity 中使用相同的委托类
 */
class MainActivity : ReactActivity() {

  // ExternalConnector 生命周期委托
  private val connectorDelegate = ActivityLifecycleDelegate()

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "PosAdapterV3"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  /**
   * 处理权限请求结果
   */
  override fun onRequestPermissionsResult(
      requestCode: Int,
      permissions: Array<String>,
      grantResults: IntArray
  ) {
      super.onRequestPermissionsResult(requestCode, permissions, grantResults)
      connectorDelegate.handlePermissionResult(requestCode, permissions, grantResults)
  }

  /**
   * 处理 Activity Result
   */
  override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
      super.onActivityResult(requestCode, resultCode, data)
      connectorDelegate.handleActivityResult(requestCode, resultCode, data)
  }

  /**
   * 处理按键事件
   */
  override fun dispatchKeyEvent(event: KeyEvent): Boolean {
      if (connectorDelegate.handleKeyEvent(event)) return true
      return super.dispatchKeyEvent(event)
  }
}
