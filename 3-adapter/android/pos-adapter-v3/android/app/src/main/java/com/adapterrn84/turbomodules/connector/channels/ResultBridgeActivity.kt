package com.adapterrn84.turbomodules.connector.channels

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import org.json.JSONObject

class ResultBridgeActivity : Activity() {

    private var resultBroadcastAction: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val targetAction = intent.getStringExtra("targetAction")
        resultBroadcastAction = intent.getStringExtra("resultBroadcastAction")

        if (targetAction == null || resultBroadcastAction == null) {
            sendError("Missing targetAction or resultBroadcastAction")
            finish()
            return
        }

        try {
            val targetIntent = Intent(targetAction)
            
            // Copy all extras except our control parameters
            intent.extras?.let { extras ->
                for (key in extras.keySet()) {
                    if (key != "targetAction" && key != "resultBroadcastAction") {
                        val value = extras.get(key)
                        when (value) {
                            is String -> targetIntent.putExtra(key, value)
                            is Int -> targetIntent.putExtra(key, value)
                            is Boolean -> targetIntent.putExtra(key, value)
                            is Long -> targetIntent.putExtra(key, value)
                            is Double -> targetIntent.putExtra(key, value)
                        }
                    }
                }
            }

            // Handle special extras
            intent.getStringExtra("type")?.let { targetIntent.type = it }
            intent.getStringExtra("category")?.let { targetIntent.addCategory(it) }

            val systemIntent = intent.getBooleanExtra("systemIntent", false)
            if (!systemIntent) {
                targetIntent.setPackage(packageName)
                val resolveInfo = packageManager.resolveActivity(targetIntent, 0)
                resolveInfo?.let {
                    targetIntent.setClassName(it.activityInfo.packageName, it.activityInfo.name)
                }
            }

            startActivityForResult(targetIntent, REQUEST_CODE)
        } catch (e: Exception) {
            sendError(e.message ?: "Failed to start target activity")
            finish()
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)

        if (requestCode == REQUEST_CODE) {
            try {
                val result = JSONObject()
                result.put("resultCode", resultCode)

                data?.let { intent ->
                    intent.data?.let { uri ->
                        result.put("uri", uri.toString())
                    }

                    intent.extras?.let { extras ->
                        val extrasJson = JSONObject()
                        for (key in extras.keySet()) {
                            val value = extras.get(key)
                            when (value) {
                                is String, is Int, is Boolean, is Long, is Double -> {
                                    extrasJson.put(key, value)
                                }
                            }
                        }
                        result.put("extras", extrasJson)
                    }
                }

                sendResult(result.toString())
            } catch (e: Exception) {
                sendError(e.message ?: "Failed to process result")
            }
        }

        finish()
    }

    private fun sendResult(data: String) {
        resultBroadcastAction?.let { action ->
            val intent = Intent(action)
            intent.putExtra("resultData", data)
            sendBroadcast(intent)
        }
    }

    private fun sendError(error: String) {
        resultBroadcastAction?.let { action ->
            val intent = Intent(action)
            intent.putExtra("error", error)
            sendBroadcast(intent)
        }
    }

    companion object {
        private const val REQUEST_CODE = 1001
    }
}
