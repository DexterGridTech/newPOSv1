package com.impos2.posdesktop.screen

import android.content.Context
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader

data class ScreenControlConfig(
    val fullscreenEnabled: Boolean = true,
    val keepScreenOn: Boolean = true,
    val autoRestore: Boolean = true,
    val lockTaskEnabled: Boolean = false,
    val interceptHomeKey: Boolean = true,
    val interceptRecentKey: Boolean = true,
    val interceptBackKey: Boolean = false,
    val interceptVolumeKey: Boolean = false
) {
    companion object {
        fun loadFromAssets(context: Context): ScreenControlConfig {
            return try {
                val json = JSONObject(
                    BufferedReader(InputStreamReader(context.assets.open("screen_control_config.json")))
                        .use { it.readText() }
                )
                ScreenControlConfig(
                    fullscreenEnabled = json.optBoolean("fullscreenEnabled", true),
                    keepScreenOn = json.optBoolean("keepScreenOn", true),
                    autoRestore = json.optBoolean("autoRestore", true),
                    lockTaskEnabled = json.optBoolean("lockTaskEnabled", false),
                    interceptHomeKey = json.optBoolean("interceptHomeKey", true),
                    interceptRecentKey = json.optBoolean("interceptRecentKey", true),
                    interceptBackKey = json.optBoolean("interceptBackKey", false),
                    interceptVolumeKey = json.optBoolean("interceptVolumeKey", false)
                )
            } catch (e: Exception) {
                ScreenControlConfig()
            }
        }
    }
}
