package com.impos2.adapter.interfaces

import androidx.activity.ComponentActivity

/**
 * 外部连接能力抽象。
 *
 * 这个接口定义的是 adapterPure 对“外部交互通道”的统一访问面，调用方不需要关心底层到底是：
 * - camera 扫码
 * - 系统 Intent
 * - HID 输入
 * - 其他后续新增的通道
 *
 * 对上层而言，核心语义只有三件事：
 * - 发起一次调用
 * - 判断某个 channel 是否可用
 * - 查询某类 channel 当前有哪些 target 可用
 */
interface IConnector {
  fun call(activity: ComponentActivity, request: ConnectorRequest, callback: (ConnectorResponse) -> Unit)
  fun isAvailable(channel: ChannelDescriptor): Boolean
  fun getAvailableTargets(type: ChannelType): List<String>
}
