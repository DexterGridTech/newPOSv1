package com.adapterrn84.turbomodules.connector.channels

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import androidx.core.content.ContextCompat
import com.adapterrn84.turbomodules.connector.*
import com.facebook.react.bridge.ReactApplicationContext
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import org.json.JSONObject

class IntentChannel(
    private val context: ReactApplicationContext,
    private val descriptor: ChannelDescriptor,
    private val eventDispatcher: EventDispatcher
) : RequestResponseChannel {

    override suspend fun execute(action: String, params: Map<String, String>, timeout: Long): ConnectorResult<String> {
        val startTime = System.currentTimeMillis()
        
        return try {
            val waitResult = params["waitResult"]?.toBoolean() ?: false
            
            if (waitResult) {
                executeWithResult(action, params, timeout, startTime)
            } else {
                executeFireAndForget(action, params, startTime)
            }
        } catch (e: Exception) {
            val duration = System.currentTimeMillis() - startTime
            ConnectorResult.Failure(
                ConnectorErrorCode.UNKNOWN,
                e.message ?: "Intent execution failed",
                e,
                duration
            )
        }
    }

    private fun executeFireAndForget(
        action: String,
        params: Map<String, String>,
        startTime: Long
    ): ConnectorResult<String> {
        val intent = buildIntent(action, params)
        context.startActivity(intent)
        
        val duration = System.currentTimeMillis() - startTime
        return ConnectorResult.Success(
            """{"sent":true}""",
            duration
        )
    }

    private fun executeWithResult(
        action: String,
        params: Map<String, String>,
        timeout: Long,
        startTime: Long
    ): ConnectorResult<String> {
        val resultBroadcastAction = "com.impos2.connector.RESULT_${System.currentTimeMillis()}"
        val latch = CountDownLatch(1)
        var resultData: String? = null
        var resultError: String? = null

        val receiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                intent?.let {
                    resultData = it.getStringExtra("resultData")
                    resultError = it.getStringExtra("error")
                    latch.countDown()
                }
            }
        }

        ContextCompat.registerReceiver(context, receiver, IntentFilter(resultBroadcastAction), ContextCompat.RECEIVER_NOT_EXPORTED)

        try {
            val bridgeIntent = Intent(context, ResultBridgeActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                putExtra("targetAction", action)
                putExtra("resultBroadcastAction", resultBroadcastAction)
                params.forEach { (key, value) ->
                    if (key != "waitResult") {
                        putExtra(key, value)
                    }
                }
            }

            context.startActivity(bridgeIntent)

            val success = latch.await(timeout, TimeUnit.MILLISECONDS)
            val duration = System.currentTimeMillis() - startTime

            return if (success) {
                if (resultError != null) {
                    ConnectorResult.Failure(
                        ConnectorErrorCode.UNKNOWN,
                        resultError!!,
                        null,
                        duration
                    )
                } else {
                    ConnectorResult.Success(resultData ?: """{"received":true}""", duration)
                }
            } else {
                ConnectorResult.Failure(
                    ConnectorErrorCode.TIMEOUT,
                    "Intent result timeout",
                    null,
                    duration
                )
            }
        } finally {
            context.unregisterReceiver(receiver)
        }
    }

    private fun buildIntent(action: String, params: Map<String, String>): Intent {
        val intent = Intent(action)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)

        val systemIntent = params["systemIntent"]?.toBoolean() ?: false
        if (!systemIntent) {
            intent.setPackage(context.packageName)
        }

        params.forEach { (key, value) ->
            when (key) {
                "type" -> intent.type = value
                "category" -> intent.addCategory(value)
                "waitResult", "systemIntent" -> {} // Skip these
                else -> intent.putExtra(key, value)
            }
        }

        // Convert to explicit intent if not system intent
        if (!systemIntent) {
            val resolveInfo = context.packageManager.resolveActivity(intent, 0)
            resolveInfo?.let {
                intent.setClassName(it.activityInfo.packageName, it.activityInfo.name)
            }
        }

        return intent
    }

    override fun close() {
        // IntentChannel is stateless, no cleanup needed
    }
}
