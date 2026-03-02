package com.adapterrn84.turbomodules.connector

import com.adapterrn84.turbomodules.connector.channels.HidStreamChannel
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

class ChannelRegistry(
    private val scope: CoroutineScope,
    private val eventDispatcher: EventDispatcher
) {

    private data class ChannelEntry(
        val channel: StreamChannel,
        val job: Job
    )

    private val channels = ConcurrentHashMap<String, ChannelEntry>()

    // 活跃的 HID 流通道（用于按键事件路由）
    private val activeHidChannels = ConcurrentHashMap<String, HidStreamChannel>()

    fun register(channel: StreamChannel): String {
        val channelId = UUID.randomUUID().toString()

        val job = scope.launch {
            channel.open(
                onData = { event ->
                    // 添加 channelId 并发送
                    val eventWithId = event.copy(channelId = channelId)
                    eventDispatcher.sendStreamEvent(eventWithId)
                },
                onError = { errorMsg ->
                    // 发送错误事件
                    val errorEvent = ConnectorEvent(
                        channelId = channelId,
                        type = "error",
                        target = "",
                        data = null,
                        timestamp = System.currentTimeMillis(),
                        raw = errorMsg
                    )
                    eventDispatcher.sendStreamEvent(errorEvent)
                }
            )
        }

        channels[channelId] = ChannelEntry(channel, job)

        // 如果是 HID 通道，添加到 activeHidChannels
        if (channel is HidStreamChannel) {
            activeHidChannels[channelId] = channel
        }

        return channelId
    }

    fun unregister(channelId: String) {
        channels.remove(channelId)?.let { entry ->
            entry.job.cancel()
            entry.channel.close()
        }
        activeHidChannels.remove(channelId)
    }

    fun closeAll() {
        channels.values.forEach { entry ->
            entry.job.cancel()
            entry.channel.close()
        }
        channels.clear()
        activeHidChannels.clear()
    }

    /**
     * 获取活跃的 HID 通道（用于 MainActivity 按键事件路由）
     */
    fun getActiveHidChannels(): Map<String, HidStreamChannel> = activeHidChannels
}
