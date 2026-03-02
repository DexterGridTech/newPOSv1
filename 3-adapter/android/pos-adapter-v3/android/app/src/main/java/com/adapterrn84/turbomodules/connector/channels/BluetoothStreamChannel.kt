package com.adapterrn84.turbomodules.connector.channels

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothSocket
import com.adapterrn84.turbomodules.connector.*
import com.facebook.react.bridge.ReactApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import java.util.UUID
import java.util.concurrent.atomic.AtomicBoolean

class BluetoothStreamChannel(
    private val context: ReactApplicationContext,
    private val descriptor: ChannelDescriptor,
    private val scope: CoroutineScope
) : StreamChannel {

    companion object {
        private val SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")
    }

    private var socket: BluetoothSocket? = null
    private val isRunning = AtomicBoolean(false)
    private var readThread: Thread? = null

    override fun open(onData: (ConnectorEvent) -> Unit, onError: (String) -> Unit) {
        scope.launch {
            try {
                val bluetoothAdapter = BluetoothAdapter.getDefaultAdapter()
                if (bluetoothAdapter == null) {
                    onError("Bluetooth not supported")
                    return@launch
                }
                
                if (!bluetoothAdapter.isEnabled) {
                    onError("Bluetooth is disabled")
                    return@launch
                }
                
                // Parse UUID
                val uuidString = descriptor.options["uuid"] ?: SPP_UUID.toString()
                val uuid = UUID.fromString(uuidString)
                
                // Get remote device
                val device = bluetoothAdapter.getRemoteDevice(descriptor.target)
                
                // Create and connect socket
                socket = device.createRfcommSocketToServiceRecord(uuid)
                socket?.connect()
                
                // Start reading thread
                isRunning.set(true)
                readThread = Thread {
                    val buffer = ByteArray(1024)
                    
                    while (isRunning.get()) {
                        try {
                            val bytesRead = socket?.inputStream?.read(buffer) ?: -1
                            
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
                                onError(e.message ?: "Bluetooth read error")
                            }
                            break
                        }
                    }
                }.apply {
                    isDaemon = true
                    start()
                }
                
            } catch (e: Exception) {
                onError(e.message ?: "Bluetooth stream initialization failed")
            }
        }
    }

    override fun close() {
        isRunning.set(false)
        readThread?.interrupt()
        socket?.close()
        socket = null
    }
}
