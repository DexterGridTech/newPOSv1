package com.adapterrn84.turbomodules.connector.channels

import com.adapterrn84.turbomodules.connector.*
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import java.io.FileInputStream
import java.util.concurrent.atomic.AtomicBoolean

class SerialStreamChannel(
    private val descriptor: ChannelDescriptor,
    private val scope: CoroutineScope
) : StreamChannel {

    private var inputStream: FileInputStream? = null
    private val isRunning = AtomicBoolean(false)
    private var readThread: Thread? = null

    override fun open(onData: (ConnectorEvent) -> Unit, onError: (String) -> Unit) {
        scope.launch {
            try {
                val devicePath = descriptor.target
                val baudRate = descriptor.options["baudRate"]?.toIntOrNull() ?: 9600
                
                // Configure serial port
                configureBaudRate(devicePath, baudRate)
                
                // Open serial port
                inputStream = FileInputStream(devicePath)
                
                // Start reading thread
                isRunning.set(true)
                readThread = Thread {
                    val buffer = ByteArray(1024)
                    
                    while (isRunning.get()) {
                        try {
                            val bytesRead = inputStream?.read(buffer) ?: -1
                            
                            if (bytesRead > 0) {
                                val dataHex = HexUtils.bytesToHex(buffer, bytesRead)
                                val event = ConnectorEvent(
                                    channelId = "",
                                    type = descriptor.type.name,
                                    target = descriptor.target,
                                    data = dataHex,
                                    timestamp = System.currentTimeMillis(),
                                    raw = null
                                )
                                onData(event)
                            } else if (bytesRead < 0) {
                                break
                            }
                        } catch (e: Exception) {
                            if (isRunning.get()) {
                                onError(e.message ?: "Serial read error")
                            }
                            break
                        }
                    }
                }.apply {
                    isDaemon = true
                    start()
                }
                
            } catch (e: Exception) {
                onError(e.message ?: "Serial stream initialization failed")
            }
        }
    }

    override fun close() {
        isRunning.set(false)
        readThread?.interrupt()
        inputStream?.close()
        inputStream = null
    }
    
    private fun configureBaudRate(devicePath: String, baudRate: Int) {
        try {
            val process = Runtime.getRuntime().exec(
                arrayOf("stty", "-F", devicePath, baudRate.toString(), "raw")
            )
            process.waitFor()
        } catch (e: Exception) {
            // Ignore stty errors
        }
    }
}
