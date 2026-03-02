package com.adapterrn84.turbomodules.connector

import kotlinx.coroutines.flow.SharedFlow

interface RequestResponseChannel {
    suspend fun execute(
        action: String,
        params: Map<String, String>,
        timeout: Long
    ): ConnectorResult<String>

    fun close()
}

interface StreamChannel {
    fun open(onData: (ConnectorEvent) -> Unit, onError: (String) -> Unit)
    fun close()
}

interface PassiveChannel {
    val events: SharedFlow<ConnectorEvent>
    suspend fun start()
    suspend fun stop()
}
