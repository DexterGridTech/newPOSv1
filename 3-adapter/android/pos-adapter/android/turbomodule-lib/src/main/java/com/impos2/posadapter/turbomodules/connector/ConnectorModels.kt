package com.impos2.posadapter.turbomodules.connector

/**
 * 通道类型
 */
enum class ChannelType {
    INTENT, AIDL, USB, SERIAL, BLUETOOTH, NETWORK, SDK, HID
}

object ConnectorCode {
    const val UNKNOWN        = 9999
    const val NOT_REGISTERED = 9998
}

/**
 * 交互模式
 */
enum class InteractionMode {
    REQUEST_RESPONSE, STREAM, PASSIVE
}

/**
 * 通道描述符
 */
data class ChannelDescriptor(
    val type: ChannelType,
    val target: String,
    val mode: InteractionMode,
    val options: Map<String, Any?> = emptyMap()
) {
    companion object {
        fun fromJson(json: org.json.JSONObject): ChannelDescriptor {
            val typeStr = json.getString("type")
            val type = try {
                ChannelType.valueOf(typeStr)
            } catch (_: IllegalArgumentException) {
                throw IllegalArgumentException("Unknown ChannelType: '$typeStr'. Valid values: ${ChannelType.values().joinToString()}")
            }
            val mode = when (json.getString("mode")) {
                "request-response" -> InteractionMode.REQUEST_RESPONSE
                "stream"           -> InteractionMode.STREAM
                "passive"          -> InteractionMode.PASSIVE
                else               -> InteractionMode.REQUEST_RESPONSE
            }
            val options = mutableMapOf<String, Any?>()
            json.optJSONObject("options")?.keys()?.forEach { k ->
                options[k] = json.optJSONObject("options")?.get(k)
            }
            return ChannelDescriptor(type, json.getString("target"), mode, options)
        }
    }
}

/**
 * 标准事件载荷（Stream / Passive 模式推送）
 */
data class ConnectorEvent(
    val channelId: String,
    val type: ChannelType,
    val target: String,
    val data: Map<String, Any?>?,   // null 表示错误事件
    val timestamp: Long,
    val raw: String? = null
) {
    fun toWritableMap(): com.facebook.react.bridge.WritableMap {
        val map = com.facebook.react.bridge.Arguments.createMap()
        map.putString("channelId", channelId)
        map.putString("type", type.name)
        map.putString("target", target)
        map.putDouble("timestamp", timestamp.toDouble())
        raw?.let { map.putString("raw", it) }
        if (data != null) {
            val dataMap = com.facebook.react.bridge.Arguments.createMap()
            data.forEach { (k, v) ->
                when (v) {
                    is String  -> dataMap.putString(k, v)
                    is Int     -> dataMap.putInt(k, v)
                    is Double  -> dataMap.putDouble(k, v)
                    is Boolean -> dataMap.putBoolean(k, v)
                    else       -> dataMap.putString(k, v?.toString() ?: "")
                }
            }
            map.putMap("data", dataMap)
        } else {
            map.putNull("data")
        }
        return map
    }
}
