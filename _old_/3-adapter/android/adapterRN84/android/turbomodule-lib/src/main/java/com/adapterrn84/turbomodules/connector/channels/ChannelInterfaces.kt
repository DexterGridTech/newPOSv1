package com.adapterrn84.turbomodules.connector.channels

import com.facebook.react.bridge.Promise
import com.adapterrn84.turbomodules.connector.ConnectorEvent

interface RequestResponseChannel {
    fun call(action: String, params: org.json.JSONObject, timeout: Long, promise: Promise)
}

interface StreamChannel {
    fun open()
    fun close()
}

interface PassiveChannel {
    fun start(onEvent: (ConnectorEvent) -> Unit)
    fun stop()
}
