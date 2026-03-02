package com.adapterrn84.turbomodules.connector

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import com.facebook.react.bridge.ReactApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.launch
import java.util.concurrent.ConcurrentHashMap

/**
 * 被动通道管理器
 * 管理所有被动事件监听（如 Intent 广播）
 */
class PassiveChannelManager(
    private val context: ReactApplicationContext,
    private val scope: CoroutineScope,
    private val eventDispatcher: EventDispatcher
) {
    private val activeChannels = ConcurrentHashMap<String, PassiveChannel>()

    // 所有被动事件的共享流
    private val passiveEvents = MutableSharedFlow<ConnectorEvent>(
        replay = 0,
        extraBufferCapacity = 64,
        onBufferOverflow = kotlinx.coroutines.channels.BufferOverflow.DROP_OLDEST
    )

    init {
        // 自动启动 Intent 被动监听
        startIntentPassiveChannel()
    }

    private fun startIntentPassiveChannel() {
        val channel = IntentPassiveChannel(context, scope)
        scope.launch {
            channel.start()
            channel.events.collect { event ->
                passiveEvents.emit(event)
                eventDispatcher.sendPassiveEvent(event)
            }
        }
        activeChannels["intent_passive"] = channel
    }

    fun getEventFlow(): SharedFlow<ConnectorEvent> = passiveEvents.asSharedFlow()

    fun cleanup() {
        activeChannels.values.forEach { channel ->
            scope.launch { channel.stop() }
        }
        activeChannels.clear()
    }
}

/**
 * Intent 被动通道
 * 监听特定的 Intent 广播
 */
class IntentPassiveChannel(
    private val context: ReactApplicationContext,
    private val scope: CoroutineScope
) : PassiveChannel {

    override val events = MutableSharedFlow<ConnectorEvent>(
        replay = 0,
        extraBufferCapacity = 64
    )

    private var receiver: BroadcastReceiver? = null

    override suspend fun start() {
        if (receiver != null) return

        receiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                intent ?: return
                scope.launch {
                    val event = ConnectorEvent(
                        channelId = "passive_intent",
                        type = "INTENT",
                        target = intent.action ?: "",
                        data = extractIntentData(intent),
                        timestamp = System.currentTimeMillis(),
                        raw = intent.extras?.toString()
                    )
                    events.emit(event)
                }
            }
        }

        val filter = IntentFilter().apply {
            addAction("com.impos2.connector.PASSIVE")
            // 可以添加更多 action
        }

        try {
            context.registerReceiver(receiver, filter)
        } catch (e: Exception) {
            // 可能在某些情况下注册失败
        }
    }

    override suspend fun stop() {
        receiver?.let {
            try {
                context.unregisterReceiver(it)
            } catch (_: Exception) {
                // 可能已经注销
            }
            receiver = null
        }
    }

    private fun extractIntentData(intent: Intent): String {
        val data = mutableMapOf<String, Any?>()
        intent.extras?.keySet()?.forEach { key ->
            data[key] = intent.extras?.get(key)
        }
        return org.json.JSONObject(data).toString()
    }
}
