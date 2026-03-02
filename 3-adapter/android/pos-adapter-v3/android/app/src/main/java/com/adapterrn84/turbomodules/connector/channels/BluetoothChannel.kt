package com.adapterrn84.turbomodules.connector.channels

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothSocket
import com.adapterrn84.turbomodules.connector.*
import com.facebook.react.bridge.ReactApplicationContext
import java.util.UUID

class BluetoothChannel(
    private val context: ReactApplicationContext,
    private val descriptor: ChannelDescriptor
) : RequestResponseChannel {

    companion object {
        private val SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")
    }

    override suspend fun execute(action: String, params: Map<String, String>, timeout: Long): ConnectorResult<String> {
        val startTime = System.currentTimeMillis()
        
        return try {
            val bluetoothAdapter = BluetoothAdapter.getDefaultAdapter()
                ?: return ConnectorResult.Failure(
                    ConnectorErrorCode.UNKNOWN,
                    "Bluetooth not supported",
                    null,
                    System.currentTimeMillis() - startTime
                )
            
            if (!bluetoothAdapter.isEnabled) {
                return ConnectorResult.Failure(
                    ConnectorErrorCode.UNKNOWN,
                    "Bluetooth is disabled",
                    null,
                    System.currentTimeMillis() - startTime
                )
            }
            
            // Parse UUID from options or use default SPP UUID
            val uuidString = descriptor.options["uuid"] ?: SPP_UUID.toString()
            val uuid = UUID.fromString(uuidString)
            
            // Get remote device
            val device = bluetoothAdapter.getRemoteDevice(descriptor.target)
            
            // Create RFCOMM socket
            val socket: BluetoothSocket = device.createRfcommSocketToServiceRecord(uuid)
            
            try {
                // Connect
                socket.connect()
                
                // Send data
                val dataHex = params["data"] ?: ""
                val dataBytes = HexUtils.hexToBytes(dataHex)
                socket.outputStream.write(dataBytes)
                socket.outputStream.flush()
                
                // Read response with timeout
                val buffer = ByteArray(1024)
                val startRead = System.currentTimeMillis()
                var totalRead = 0
                
                while (System.currentTimeMillis() - startRead < timeout) {
                    if (socket.inputStream.available() > 0) {
                        val bytesRead = socket.inputStream.read(buffer, totalRead, buffer.size - totalRead)
                        if (bytesRead > 0) {
                            totalRead += bytesRead
                            // Wait a bit to see if more data is coming
                            Thread.sleep(50)
                            if (socket.inputStream.available() == 0) {
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
                        "No response from Bluetooth device",
                        null,
                        duration
                    )
                }
                
            } finally {
                socket.close()
            }

        } catch (e: Exception) {
            val duration = System.currentTimeMillis() - startTime
            ConnectorResult.Failure(
                ConnectorErrorCode.UNKNOWN,
                e.message ?: "Bluetooth communication failed",
                e,
                duration
            )
        }
    }

    override fun close() {
        // BluetoothChannel is stateless, socket is closed in execute() finally block
    }
}
