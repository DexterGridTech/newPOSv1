package com.impos2.posadapter.turbomodules.connector

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.impos2.posadapter.turbomodules.connector.channels.*
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/**
 * 通道注册表：管理所有活跃的流式通道生命周期
 */
class ChannelRegistry(private val context: ReactApplicationContext) {

    // channelId → StreamChannel
    private val activeStreams = ConcurrentHashMap<String, StreamChannel>()

    fun getRequestResponseChannel(desc: ChannelDescriptor): RequestResponseChannel =
        when (desc.type) {
            ChannelType.INTENT    -> IntentChannel(context)
            ChannelType.AIDL      -> AidlChannel(context)
            ChannelType.USB       -> UsbChannel(context)
            ChannelType.SERIAL    -> SerialChannel(context)
            ChannelType.BLUETOOTH -> BluetoothChannel(context)
            ChannelType.NETWORK   -> NetworkChannel(context)
            ChannelType.SDK       -> SdkChannel(context)
            else -> throw IllegalArgumentException("${desc.type} 不支持 request-response 模式")
        }

    fun openStreamChannel(
        desc: ChannelDescriptor,
        onEvent: (ConnectorEvent) -> Unit
    ): String {
        val channelId = UUID.randomUUID().toString()
        val channel: StreamChannel = when (desc.type) {
            ChannelType.USB       -> UsbStreamChannel(context, desc, onEvent)
            ChannelType.SERIAL    -> SerialStreamChannel(context, desc, onEvent)
            ChannelType.BLUETOOTH -> BluetoothStreamChannel(context, desc, onEvent)
            else -> throw IllegalArgumentException("${desc.type} 不支持 stream 模式")
        }
        channel.open()
        activeStreams[channelId] = channel
        return channelId
    }

    fun closeStreamChannel(channelId: String) {
        activeStreams.remove(channelId)?.close()
    }

    fun closeAll() {
        activeStreams.values.forEach { it.close() }
        activeStreams.clear()
    }
}
