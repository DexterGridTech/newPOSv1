package com.adapterrn84

import android.content.Intent
import android.view.KeyEvent
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.adapterrn84.turbomodules.ConnectorTurboModule

class MainActivity : ReactActivity() {

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
   * 将结果转发给 PermissionCoordinator
   */
  override fun onRequestPermissionsResult(
      requestCode: Int,
      permissions: Array<String>,
      grantResults: IntArray
  ) {
      super.onRequestPermissionsResult(requestCode, permissions, grantResults)
      try {
          val reactContext = reactInstanceManager.currentReactContext
          val connectorModule = reactContext?.getNativeModule(ConnectorTurboModule::class.java)
          connectorModule?.getConnectorManager()?.getPermissionCoordinator()
              ?.onPermissionResult(requestCode, permissions, grantResults)
      } catch (_: Exception) {
          // ReactContext may not be ready
      }
  }

  /**
   * 处理 Activity Result
   * 将结果转发给 EventDispatcher（用于相机扫码等）
   */
  override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
      super.onActivityResult(requestCode, resultCode, data)
      try {
          val reactContext = reactInstanceManager.currentReactContext
          val connectorModule = reactContext?.getNativeModule(ConnectorTurboModule::class.java)
          connectorModule?.getConnectorManager()?.getEventDispatcher()
              ?.dispatchActivityResult(requestCode, resultCode, data)
      } catch (_: Exception) {
          // ReactContext may not be ready
      }
  }

  /**
   * 处理按键事件
   * 将按键事件转发给 EventDispatcher（用于 HID 通道）
   */
  override fun dispatchKeyEvent(event: KeyEvent): Boolean {
      try {
          val reactContext = reactInstanceManager.currentReactContext
          val connectorModule = reactContext?.getNativeModule(ConnectorTurboModule::class.java)
          connectorModule?.getConnectorManager()?.getEventDispatcher()
              ?.dispatchKeyEvent(event.keyCode, event)
      } catch (_: Exception) {
          // ReactContext may not be ready
      }
      return super.dispatchKeyEvent(event)
  }
}
