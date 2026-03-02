package com.adapterrn84.turbomodules.connector

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
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

    suspend fun register(channel: StreamChannel): String {
        val channelId = UUID.randomUUID().toString()

        val job = scope.launch {
            channel.open()
                .catch { e ->
                    // 发送错误事件
                    val errorEvent = ConnectorEvent(
                        channelId = channelId,
                        type = "error",
                        target = "",
                        data = null,
                        timestamp = System.currentTimeMillis(),
                        raw = e.message
                    )
                    eventDispatcher.sendStreamEvent(errorEvent)
                }
                .collect { event ->
                    // 添加 channelId 并发送
                    val eventWithId = event.copy(channelId = channelId)
                    eventDispatcher.sendStreamEvent(eventWithId)
                }
        }

        channels[channelId] = ChannelEntry(channel, job)
        return channelId
    }

    suspend fun unregister(channelId: String) {
        channels.remove(channelId)?.let { entry ->
            entry.job.cancel()
            entry.channel.close()
        }
    }

    fun closeAll() {
        channels.values.forEach { entry ->
            entry.job.cancel()
            runBlocking { entry.channel.close() }
        }
        channels.clear()
    }
}
