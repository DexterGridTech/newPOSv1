package com.impos2.posadapter.turbomodules.connector.channels

import android.app.Activity
import android.content.ComponentName
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import org.json.JSONObject

/**
 * 透明桥接 Activity，用于 IntentChannel waitResult 模式。
 *
 * 流程：
 *   1. IntentChannel 启动本 Activity，携带目标 action 和 resultBroadcastAction
 *   2. 本 Activity 用 startActivityForResult 启动真正的目标 Activity
 *   3. onActivityResult 中将结果通过 LocalBroadcast 回传给 IntentChannel 的 receiver
 */
class ResultBridgeActivity : Activity() {

    companion object {
        const val EXTRA_TARGET_ACTION = "targetAction"
        const val EXTRA_RESULT_BROADCAST = "resultBroadcastAction"
        const val EXTRA_SYSTEM_INTENT = "systemIntent"
        private const val REQUEST_CODE = 1001
    }

    private var resultBroadcastAction: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val targetAction = intent.getStringExtra(EXTRA_TARGET_ACTION)
        resultBroadcastAction = intent.getStringExtra(EXTRA_RESULT_BROADCAST)

        if (targetAction == null || resultBroadcastAction == null) {
            finish()
            return
        }

        try {
            val isSystemIntent = intent.getStringExtra(EXTRA_SYSTEM_INTENT) == "true"
            val targetIntent = Intent(targetAction).apply {
                if (!isSystemIntent) {
                    setPackage(packageName)
                }
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
            // 仅对非系统 Intent 解析为显式 Intent
            if (!isSystemIntent) {
                packageManager.resolveActivity(targetIntent, PackageManager.MATCH_DEFAULT_ONLY)?.activityInfo?.let {
                    targetIntent.component = ComponentName(it.packageName, it.name)
                }
            }
            startActivityForResult(targetIntent, REQUEST_CODE)
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
                    // 优先获取 URI（文件选择器等系统 Intent 返回）
                    data.data?.let { uri ->
                        obj.put("uri", uri.toString())
                    }
                    // 再获取 extras
                    data.extras?.keySet()?.forEach { k ->
                        obj.put(k, data.extras?.get(k)?.toString() ?: "")
                    }
                    obj.toString()
                }.getOrNull()
            } else null
            sendResult(resultCode, jsonData)
            finish()
        }
    }

    private fun sendResult(resultCode: Int, data: String?) {
        val broadcast = resultBroadcastAction ?: return
        val intent = Intent(broadcast).apply {
            setPackage(packageName)   // Android 13+ RECEIVER_NOT_EXPORTED 要求同包广播必须指定 package
            putExtra("resultCode", resultCode)
            if (data != null) putExtra("data", data)
        }
        sendBroadcast(intent)
    }
}
