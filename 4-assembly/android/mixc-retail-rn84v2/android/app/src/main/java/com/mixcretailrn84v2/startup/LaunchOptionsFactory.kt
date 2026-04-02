package com.impos2.mixcretailrn84v2.startup

import android.content.Context
import android.hardware.display.DisplayManager
import android.os.Bundle
import com.impos2.adapter.device.DeviceManager

/**
 * 统一构建 RN 启动参数。
 *
 * 主屏和副屏都使用同一个 RN 入口组件名，因此业务层需要依赖 launch options 来判断当前
 * runtime 的宿主环境。这里把这部分参数收敛成一个工厂，避免主副屏各自拼装导致字段不一致。
 */
object LaunchOptionsFactory {

  /**
   * 生成传给 JS 的启动参数。
   *
   * 当前约定字段：
   * - `deviceId`: 当前设备唯一标识，供上层业务做设备识别；
   * - `screenMode`: 预留给业务层的屏幕模式标识；
   * - `displayCount`: 当前系统检测到的屏幕数量；
   * - `displayIndex`: 当前 runtime 对应的屏幕索引，主屏为 0，副屏为 1。
   */
  fun create(context: Context, displayIndex: Int): Bundle {
    val deviceInfo = DeviceManager.getInstance(context.applicationContext).getDeviceInfo()
    val displayManager = context.getSystemService(Context.DISPLAY_SERVICE) as DisplayManager
    return Bundle().apply {
      putString("deviceId", deviceInfo.id)
      putString("screenMode", "desktop")
      putInt("displayCount", displayManager.displays.size)
      putInt("displayIndex", displayIndex)
    }
  }
}
