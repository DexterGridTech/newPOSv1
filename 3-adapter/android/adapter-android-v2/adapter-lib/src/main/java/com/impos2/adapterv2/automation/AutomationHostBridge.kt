package com.impos2.adapterv2.automation

/**
 * Automation socket transport 的上层桥。
 *
 * adapter 层只负责把单行 JSON 消息送到宿主桥并写回响应；协议语义由 assembly / TS runtime 决定。
 */
fun interface AutomationHostBridge {
  fun onMessage(session: AutomationSession, message: String): String?
}

