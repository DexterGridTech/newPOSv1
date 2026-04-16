package com.impos2.adapterv2.constants

/**
 * adapterPure 对外暴露的事件名常量。
 *
 * 这类常量通常会被测试页、桥接层或事件分发逻辑复用，统一维护可以避免字符串硬编码。
 */
object AdapterEventNames {
  const val POWER_STATUS_CHANGED = "power_status_changed"
  const val CAMERA_SCAN_RESULT = "camera_scan_result"
}
