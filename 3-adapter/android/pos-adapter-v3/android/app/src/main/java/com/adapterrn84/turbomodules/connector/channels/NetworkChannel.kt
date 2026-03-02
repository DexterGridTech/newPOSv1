package com.adapterrn84.turbomodules.connector.channels

import com.adapterrn84.turbomodules.connector.*
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

class NetworkChannel(
    private val descriptor: ChannelDescriptor
) : RequestResponseChannel {

    override fun execute(action: String, params: Map<String, String>, timeout: Long): ConnectorResult<String> {
        val startTime = System.currentTimeMillis()
        
        return try {
            val url = URL(descriptor.target)
            val connection = url.openConnection() as HttpURLConnection
            
            connection.requestMethod = action.uppercase()
            connection.connectTimeout = timeout.toInt()
            connection.readTimeout = timeout.toInt()
            connection.setRequestProperty("Content-Type", "application/json")
            connection.setRequestProperty("Accept", "application/json")

            // Add custom headers from options
            descriptor.options.forEach { (key, value) ->
                if (key.startsWith("header_")) {
                    val headerName = key.removePrefix("header_")
                    connection.setRequestProperty(headerName, value)
                }
            }

            if (action.uppercase() == "POST" || action.uppercase() == "PUT") {
                connection.doOutput = true
                val jsonBody = JSONObject(params).toString()
                OutputStreamWriter(connection.outputStream).use { writer ->
                    writer.write(jsonBody)
                    writer.flush()
                }
            }

            val responseCode = connection.responseCode
            val inputStream = if (responseCode in 200..299) {
                connection.inputStream
            } else {
                connection.errorStream
            }

            val response = BufferedReader(InputStreamReader(inputStream)).use { reader ->
                reader.readText()
            }

            val duration = System.currentTimeMillis() - startTime

            if (responseCode in 200..299) {
                ConnectorResult.Success(response, duration)
            } else {
                ConnectorResult.Failure(
                    ConnectorErrorCode.UNKNOWN,
                    "HTTP $responseCode: $response",
                    null,
                    duration
                )
            }
        } catch (e: Exception) {
            val duration = System.currentTimeMillis() - startTime
            ConnectorResult.Failure(
                ConnectorErrorCode.UNKNOWN,
                e.message ?: "Network request failed",
                e,
                duration
            )
        }
    }
}
