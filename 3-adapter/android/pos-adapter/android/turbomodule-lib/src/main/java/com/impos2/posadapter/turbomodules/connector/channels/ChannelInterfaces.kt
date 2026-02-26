package com.impos2.posadapter.turbomodules.connector.channels

import com.facebook.react.bridge.Promise
import com.impos2.posadapter.turbomodules.connector.ConnectorEvent
import com.impos2.posadapter.turbomodules.connector.ChannelDescriptor

/**
 * 请求响应通道接口（一次调用，一次响应）
 */
interface RequestResponseChannel {
    fun call(action: String, params: org.json.JSONObject, timeout: Long, promise: Promise)
}

/**
 * 流式通道接口（持续推送）
 */
interface StreamChannel {
    fun open()
    fun close()
}

/**
 * 被动接收通道接口（外部主动调用本 APP）
 */
interface PassiveChannel {
    fun start(onEvent: (ConnectorEvent) -> Unit)
    fun stop()
}
