package com.impos2desktopv1.multidisplay

import android.content.Context
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader

/**
 * 多屏显示配置
 */
data class MultiDisplayConfig(
    val enabled: Boolean = true,
    val initDelayMs: Long = 500,
    val maxRetryCount: Int = 6,
    val retryIntervalMs: Long = 500,
    val keepScreenOn: Boolean = true,
    val preloadBundle: Boolean = true,
    val secondaryScreenComponent: String = "IMPos2DesktopV1",
    val errorHandling: ErrorHandlingConfig = ErrorHandlingConfig()
) {
    data class ErrorHandlingConfig(
        val catchSecondaryScreenErrors: Boolean = true,
        val fallbackToSingleScreen: Boolean = true
    )

    companion object {
        private const val CONFIG_FILE = "multi_display_config.json"

        /**
         * 从 assets 加载配置
         */
        fun loadFromAssets(context: Context): MultiDisplayConfig {
            return try {
                val json = context.assets.open(CONFIG_FILE).use { inputStream ->
                    BufferedReader(InputStreamReader(inputStream)).use { reader ->
                        reader.readText()
                    }
                }
                parseFromJson(json)
            } catch (e: Exception) {
                // 配置文件不存在或解析失败，返回默认配置
                MultiDisplayConfig()
            }
        }

        private fun parseFromJson(json: String): MultiDisplayConfig {
            val root = JSONObject(json)
            val multiDisplay = root.getJSONObject("multiDisplay")
            val errorHandling = multiDisplay.getJSONObject("errorHandling")

            return MultiDisplayConfig(
                enabled = multiDisplay.getBoolean("enabled"),
                initDelayMs = multiDisplay.getLong("initDelayMs"),
                maxRetryCount = multiDisplay.getInt("maxRetryCount"),
                retryIntervalMs = multiDisplay.getLong("retryIntervalMs"),
                keepScreenOn = multiDisplay.getBoolean("keepScreenOn"),
                preloadBundle = multiDisplay.getBoolean("preloadBundle"),
                secondaryScreenComponent = multiDisplay.getString("secondaryScreenComponent"),
                errorHandling = ErrorHandlingConfig(
                    catchSecondaryScreenErrors = errorHandling.getBoolean("catchSecondaryScreenErrors"),
                    fallbackToSingleScreen = errorHandling.getBoolean("fallbackToSingleScreen")
                )
            )
        }
    }
}
