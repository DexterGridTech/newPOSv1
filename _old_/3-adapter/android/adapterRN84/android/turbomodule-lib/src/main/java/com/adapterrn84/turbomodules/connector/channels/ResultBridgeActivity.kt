package com.adapterrn84.turbomodules.connector.channels

import android.app.Activity
import android.content.ComponentName
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import org.json.JSONObject

class ResultBridgeActivity : Activity() {

    companion object {
        const val EXTRA_TARGET_ACTION = "targetAction"
        const val EXTRA_RESULT_BROADCAST = "resultBroadcastAction"
        const val EXTRA_SYSTEM_INTENT = "systemIntent"
        private const val REQUEST_CODE = 1001
        private const val KEY_HAS_LAUNCHED = "has_launched"
    }

    private var resultBroadcastAction: String? = null
    private var hasLaunched = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (savedInstanceState != null) {
            hasLaunched = savedInstanceState.getBoolean(KEY_HAS_LAUNCHED, false)
            resultBroadcastAction = savedInstanceState.getString(EXTRA_RESULT_BROADCAST)
        }

        if (hasLaunched) return

        val targetAction = intent.getStringExtra(EXTRA_TARGET_ACTION)
        if (resultBroadcastAction == null) {
            resultBroadcastAction = intent.getStringExtra(EXTRA_RESULT_BROADCAST)
        }

        if (targetAction == null || resultBroadcastAction == null) {
            finish()
            return
        }

        try {
            val isSystemIntent = intent.getStringExtra(EXTRA_SYSTEM_INTENT) == "true"
            val targetIntent = Intent(targetAction).apply {
                if (!isSystemIntent) setPackage(packageName)
                intent.extras?.keySet()?.forEach { k ->
                    if (k != EXTRA_TARGET_ACTION && k != EXTRA_RESULT_BROADCAST && k != EXTRA_SYSTEM_INTENT) {
                        val value = intent.extras?.get(k)
                        when (k) {
                            "type" -> if (value is String) setType(value)
                            "category" -> if (value is String) addCategory(value)
                            else -> putExtra(k, value.toString())
                        }
                    }
                }
            }
            if (!isSystemIntent) {
                packageManager.resolveActivity(targetIntent, PackageManager.MATCH_DEFAULT_ONLY)?.activityInfo?.let {
                    targetIntent.component = ComponentName(it.packageName, it.name)
                }
            }
            startActivityForResult(targetIntent, REQUEST_CODE)
            hasLaunched = true
        } catch (e: Exception) {
            sendResult(Activity.RESULT_CANCELED, null)
            finish()
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == REQUEST_CODE) {
            val jsonData = if (data != null) {
                runCatching {
                    val obj = JSONObject()
                    data.data?.let { uri -> obj.put("uri", uri.toString()) }
                    data.extras?.keySet()?.forEach { k ->
                        obj.put(k, data.extras?.get(k)?.toString() ?: "")
                    }
                    obj.toString()
                }.getOrNull()
            } else null
            sendResult(resultCode, jsonData)
            finish()
            overridePendingTransition(0, 0)
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putBoolean(KEY_HAS_LAUNCHED, hasLaunched)
        resultBroadcastAction?.let { outState.putString(EXTRA_RESULT_BROADCAST, it) }
    }

    override fun onRestoreInstanceState(savedInstanceState: Bundle) {
        super.onRestoreInstanceState(savedInstanceState)
        hasLaunched = savedInstanceState.getBoolean(KEY_HAS_LAUNCHED, false)
        resultBroadcastAction = savedInstanceState.getString(EXTRA_RESULT_BROADCAST)
    }

    private fun sendResult(resultCode: Int, data: String?) {
        val broadcast = resultBroadcastAction ?: return
        val intent = Intent(broadcast).apply {
            setPackage(packageName)
            putExtra("resultCode", resultCode)
            if (data != null) putExtra("data", data)
        }
        sendBroadcast(intent)
    }
}
