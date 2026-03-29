package com.adapterrn84.turbomodules.connector.channels

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import com.facebook.react.bridge.ReactApplicationContext
import com.adapterrn84.turbomodules.connector.ChannelType
import com.adapterrn84.turbomodules.connector.ConnectorEvent

class IntentPassiveChannel(
    private val context: ReactApplicationContext
) : PassiveChannel {

    private var receiver: BroadcastReceiver? = null

    override fun start(onEvent: (ConnectorEvent) -> Unit) {
        if (receiver != null) stop()

        receiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
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
        val filter = IntentFilter().apply {
            addAction("com.adapterrn84.connector.PASSIVE")
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
