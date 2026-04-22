package com.adapterrn84.turbomodules.connector

enum class ChannelType {
    INTENT, AIDL, USB, SERIAL, BLUETOOTH, NETWORK, SDK, HID
}

object ConnectorCode {
    const val UNKNOWN = 9999
    const val NOT_REGISTERED = 9998
}

enum class InteractionMode {
    REQUEST_RESPONSE, STREAM, PASSIVE
}

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
                "stream" -> InteractionMode.STREAM
                "passive" -> InteractionMode.PASSIVE
                else -> InteractionMode.REQUEST_RESPONSE
            }
            val options = mutableMapOf<String, Any?>()
            json.optJSONObject("options")?.keys()?.forEach { k ->
                options[k] = json.optJSONObject("options")?.get(k)
            }
            return ChannelDescriptor(type, json.getString("target"), mode, options)
        }
    }
}

data class ConnectorEvent(
    val channelId: String,
    val type: ChannelType,
    val target: String,
    val data: Map<String, Any?>?,
    val timestamp: Long,
    val raw: String? = null
) {
    fun toMap(): Map<String, Any?> = mapOf(
        "channelId" to channelId,
        "type" to type.name,
        "target" to target,
        "data" to data,
        "timestamp" to timestamp.toDouble(),
        "raw" to raw
    )
}
