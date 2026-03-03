package com.impos2.posadapter.turbomodules.connector.channels

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import com.facebook.react.bridge.ReactApplicationContext
import com.impos2.posadapter.turbomodules.connector.ChannelType
import com.impos2.posadapter.turbomodules.connector.ConnectorEvent

/**
 * 被动接收通道：监听外部 APP 通过 Intent 主动调用本 APP
 * 在 ConnectorTurboModule 初始化时自动启动
 */
class IntentPassiveChannel(
    private val context: ReactApplicationContext
) : PassiveChannel {

    private var receiver: BroadcastReceiver? = null

    override fun start(onEvent: (ConnectorEvent) -> Unit) {
        // 防止重复注册：先 stop 清理旧 receiver
        if (receiver != null) stop()

        receiver = object : BroadcastReceiver() {
            override fun onReceive(ctx: Context, intent: Intent) {
                val action = intent.action ?: return
                val data = mutableMapOf<String, Any?>()
                intent.extras?.keySet()?.forEach { k ->
                    data[k] = intent.extras?.get(k)?.toString()
                }
                onEvent(ConnectorEvent(
                    channelId = "passive.intent",
                    type = ChannelType.INTENT,
                    target = action,
                    data = data,
                    timestamp = System.currentTimeMillis()
                ))
            }
        }
        // 监听所有带自定义前缀的 Intent（整合层可通过 AndroidManifest 声明具体 action）
        val filter = IntentFilter().apply {
            addAction("com.impos2.connector.PASSIVE")
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            context.registerReceiver(receiver, filter)
        }
    }

    override fun stop() {
        receiver?.let {
            try { context.unregisterReceiver(it) } catch (_: Exception) {}
            receiver = null
        }
    }
}
