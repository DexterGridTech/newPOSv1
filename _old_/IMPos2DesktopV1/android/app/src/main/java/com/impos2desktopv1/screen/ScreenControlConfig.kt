package com.impos2desktopv1.screen

import android.content.Context
import android.util.Log
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader

/**
 * 屏幕控制配置
 *
 * 支持从 assets/screen_control_config.json 加载配置
 */
data class ScreenControlConfig(
    // 全屏模式配置
    val fullscreenEnabled: Boolean = true,
    val keepScreenOn: Boolean = true,
    val autoRestore: Boolean = true,

    // 锁定任务模式配置
    val lockTaskEnabled: Boolean = false,

    // 按键拦截配置
    val interceptHomeKey: Boolean = true,
    val interceptRecentKey: Boolean = true,
    val interceptBackKey: Boolean = false,
    val interceptVolumeKey: Boolean = false,

    // Home Launcher 配置
    val setAsHomeLauncher: Boolean = false
) {
    companion object {
        private const val TAG = "ScreenControlConfig"
        private const val CONFIG_FILE = "screen_control_config.json"

        /**
         * 从 assets 加载配置
         */
        fun loadFromAssets(context: Context): ScreenControlConfig {
            return try {
                val json = readJsonFromAssets(context, CONFIG_FILE)
                parseConfig(json)
            } catch (e: Exception) {
                Log.w(TAG, "加载配置失败，使用默认配置: ${e.message}")
                ScreenControlConfig()
            }
        }

        private fun readJsonFromAssets(context: Context, fileName: String): String {
            val inputStream = context.assets.open(fileName)
            val reader = BufferedReader(InputStreamReader(inputStream))
            return reader.use { it.readText() }
        }

        private fun parseConfig(jsonString: String): ScreenControlConfig {
            val json = JSONObject(jsonString)
            return ScreenControlConfig(
                fullscreenEnabled = json.optBoolean("fullscreenEnabled", true),
                keepScreenOn = json.optBoolean("keepScreenOn", true),
                autoRestore = json.optBoolean("autoRestore", true),
                lockTaskEnabled = json.optBoolean("lockTaskEnabled", false),
                interceptHomeKey = json.optBoolean("interceptHomeKey", true),
                interceptRecentKey = json.optBoolean("interceptRecentKey", true),
                interceptBackKey = json.optBoolean("interceptBackKey", false),
                interceptVolumeKey = json.optBoolean("interceptVolumeKey", false),
                setAsHomeLauncher = json.optBoolean("setAsHomeLauncher", false)
            )
        }
    }
}
