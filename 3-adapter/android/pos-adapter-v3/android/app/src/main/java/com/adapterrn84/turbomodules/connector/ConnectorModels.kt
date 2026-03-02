package com.adapterrn84.turbomodules.connector

import org.json.JSONObject

enum class ChannelType {
    INTENT, AIDL, USB, SERIAL, BLUETOOTH, NETWORK, SDK, HID;

    companion object {
        fun fromString(value: String): ChannelType = valueOf(value.uppercase())
    }
}

enum class InteractionMode {
    REQUEST_RESPONSE, STREAM, PASSIVE;

    companion object {
        fun fromString(value: String): InteractionMode {
            return when (value.lowercase().replace("_", "-")) {
                "request-response" -> REQUEST_RESPONSE
                "stream" -> STREAM
                "passive" -> PASSIVE
                else -> valueOf(value.uppercase())
            }
        }
    }
}

data class ChannelDescriptor(
    val type: ChannelType,
    val target: String,
    val mode: InteractionMode,
    val options: Map<String, String> = emptyMap()
) {
    companion object {
        fun fromJson(json: String): ChannelDescriptor {
            val obj = JSONObject(json)
            val optionsObj = obj.optJSONObject("options")
            val options = mutableMapOf<String, String>()
            optionsObj?.keys()?.forEach { key ->
                options[key] = optionsObj.getString(key)
            }

            return ChannelDescriptor(
                type = ChannelType.fromString(obj.getString("type")),
                target = obj.getString("target"),
                mode = InteractionMode.fromString(obj.getString("mode")),
                options = options
            )
        }
    }
}

data class ConnectorEvent(
    val channelId: String,
    val type: String,
    val target: String,
    val data: String?,
    val timestamp: Long,
    val raw: String? = null
) {
    fun toJson(): String = JSONObject().apply {
        put("channelId", channelId)
        put("type", type)
        put("target", target)
        put("data", data)
        put("timestamp", timestamp)
        if (raw != null) put("raw", raw)
    }.toString()
}

sealed class ConnectorResult<out T> {
    data class Success<T>(
        val data: T,
        val duration: Long,
        val timestamp: Long = System.currentTimeMillis()
    ) : ConnectorResult<T>()

    data class Failure(
        val code: Int,
        val message: String,
        val cause: Throwable? = null,
        val duration: Long,
        val timestamp: Long = System.currentTimeMillis()
    ) : ConnectorResult<Nothing>()

    fun toJson(): String {
        return when (this) {
            is Success -> JSONObject().apply {
                put("success", true)
                put("code", 0)
                put("message", "OK")
                put("data", data)
                put("duration", duration)
                put("timestamp", timestamp)
            }.toString()
            is Failure -> JSONObject().apply {
                put("success", false)
                put("code", code)
                put("message", message)
                put("duration", duration)
                put("timestamp", timestamp)
            }.toString()
        }
    }
}
