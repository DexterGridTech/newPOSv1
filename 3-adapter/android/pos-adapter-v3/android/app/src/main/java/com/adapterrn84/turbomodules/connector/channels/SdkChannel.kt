package com.adapterrn84.turbomodules.connector.channels

import com.adapterrn84.turbomodules.connector.*
import org.json.JSONObject

class SdkChannel(
    private val descriptor: ChannelDescriptor
) : RequestResponseChannel {

    override fun execute(action: String, params: Map<String, String>, timeout: Long): ConnectorResult<String> {
        val startTime = System.currentTimeMillis()
        
        return try {
            // target format: "className#methodName"
            val parts = descriptor.target.split("#")
            if (parts.size != 2) {
                return ConnectorResult.Failure(
                    ConnectorErrorCode.UNKNOWN,
                    "Invalid target format. Expected: className#methodName",
                    null,
                    System.currentTimeMillis() - startTime
                )
            }

            val className = parts[0]
            val methodName = parts[1]

            val clazz = Class.forName(className)
            val method = clazz.getMethod(methodName, Map::class.java)

            val result = if (java.lang.reflect.Modifier.isStatic(method.modifiers)) {
                // Static method
                method.invoke(null, params)
            } else {
                // Instance method
                val instance = clazz.getDeclaredConstructor().newInstance()
                method.invoke(instance, params)
            }

            val duration = System.currentTimeMillis() - startTime
            val resultString = when (result) {
                null -> """{"result":null}"""
                is String -> result
                is Number, is Boolean -> JSONObject().put("result", result).toString()
                else -> JSONObject().put("result", result.toString()).toString()
            }

            ConnectorResult.Success(resultString, duration)
        } catch (e: ClassNotFoundException) {
            val duration = System.currentTimeMillis() - startTime
            ConnectorResult.Failure(
                ConnectorErrorCode.UNKNOWN,
                "Class not found: ${e.message}",
                e,
                duration
            )
        } catch (e: NoSuchMethodException) {
            val duration = System.currentTimeMillis() - startTime
            ConnectorResult.Failure(
                ConnectorErrorCode.UNKNOWN,
                "Method not found: ${e.message}",
                e,
                duration
            )
        } catch (e: Exception) {
            val duration = System.currentTimeMillis() - startTime
            ConnectorResult.Failure(
                ConnectorErrorCode.UNKNOWN,
                e.message ?: "SDK method invocation failed",
                e,
                duration
            )
        }
    }

    override fun close() {
        // SdkChannel is stateless, no cleanup needed
    }
}
