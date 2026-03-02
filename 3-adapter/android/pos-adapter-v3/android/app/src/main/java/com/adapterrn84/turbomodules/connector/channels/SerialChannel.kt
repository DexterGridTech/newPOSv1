package com.adapterrn84.turbomodules.connector.channels

import com.adapterrn84.turbomodules.connector.*
import java.io.FileInputStream
import java.io.FileOutputStream

class SerialChannel(
    private val descriptor: ChannelDescriptor
) : RequestResponseChannel {

    override fun execute(action: String, params: Map<String, String>, timeout: Long): ConnectorResult<String> {
        val startTime = System.currentTimeMillis()
        
        return try {
            val devicePath = descriptor.target
            val baudRate = descriptor.options["baudRate"]?.toIntOrNull() ?: 9600
            
            // Configure serial port using stty
            configureBaudRate(devicePath, baudRate)
            
            // Open serial port
            val outputStream = FileOutputStream(devicePath)
            val inputStream = FileInputStream(devicePath)
            
            try {
                // Send data
                val dataHex = params["data"] ?: ""
                val dataBytes = HexUtils.hexToBytes(dataHex)
                outputStream.write(dataBytes)
                outputStream.flush()
                
                // Read response with timeout
                val buffer = ByteArray(1024)
                val startRead = System.currentTimeMillis()
                var totalRead = 0
                
                while (System.currentTimeMillis() - startRead < timeout) {
                    if (inputStream.available() > 0) {
                        val bytesRead = inputStream.read(buffer, totalRead, buffer.size - totalRead)
                        if (bytesRead > 0) {
                            totalRead += bytesRead
                            // Check if we have enough data (simple heuristic: wait for no more data)
                            Thread.sleep(50)
                            if (inputStream.available() == 0) {
                                break
                            }
                        }
                    } else {
                        Thread.sleep(10)
                    }
                }
                
                val duration = System.currentTimeMillis() - startTime
                
                if (totalRead > 0) {
                    val responseHex = HexUtils.bytesToHex(buffer, totalRead)
                    ConnectorResult.Success(responseHex, duration)
                } else {
                    ConnectorResult.Failure(
                        ConnectorErrorCode.TIMEOUT,
                        "No response from serial device",
                        null,
                        duration
                    )
                }
                
            } finally {
                inputStream.close()
                outputStream.close()
            }
            
        } catch (e: Exception) {
            val duration = System.currentTimeMillis() - startTime
            ConnectorResult.Failure(
                ConnectorErrorCode.UNKNOWN,
                e.message ?: "Serial communication failed",
                e,
                duration
            )
        }
    }
    
    private fun configureBaudRate(devicePath: String, baudRate: Int) {
        try {
            val process = Runtime.getRuntime().exec(
                arrayOf("stty", "-F", devicePath, baudRate.toString(), "raw")
            )
            process.waitFor()
        } catch (e: Exception) {
            // Ignore stty errors, may not have permission
        }
    }
}
