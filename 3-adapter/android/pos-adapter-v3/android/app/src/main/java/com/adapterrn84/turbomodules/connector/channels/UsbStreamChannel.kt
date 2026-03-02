package com.adapterrn84.turbomodules.connector.channels

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbDeviceConnection
import android.hardware.usb.UsbManager
import com.adapterrn84.turbomodules.connector.*
import com.facebook.react.bridge.ReactApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

class UsbStreamChannel(
    private val context: ReactApplicationContext,
    private val descriptor: ChannelDescriptor,
    private val scope: CoroutineScope
) : StreamChannel {

    companion object {
        private const val ACTION_USB_PERMISSION = "com.impos2.USB_PERMISSION"
    }

    private var connection: UsbDeviceConnection? = null
    private val isRunning = AtomicBoolean(false)
    private var readThread: Thread? = null

    override fun open(onData: (ConnectorEvent) -> Unit, onError: (String) -> Unit) {
        scope.launch {
            try {
                val usbManager = context.getSystemService(Context.USB_SERVICE) as UsbManager

                // Get device by name (target is device name like "/dev/bus/usb/001/002")
                val device = usbManager.deviceList[descriptor.target]

                if (device == null) {
                    onError("USB device not found: ${descriptor.target}")
                    return@launch
                }

                // Request permission if needed
                if (!usbManager.hasPermission(device)) {
                    val permissionGranted = requestUsbPermission(usbManager, device, 5000)
                    if (!permissionGranted) {
                        onError("USB permission denied")
                        return@launch
                    }
                }
                
                // Open device
                connection = usbManager.openDevice(device)
                if (connection == null) {
                    onError("Failed to open USB device")
                    return@launch
                }
                
                val intf = device.getInterface(0)
                connection?.claimInterface(intf, true)
                
                // Find input endpoint
                val inEndpoint = (0 until intf.endpointCount)
                    .map { intf.getEndpoint(it) }
                    .find { it.direction == android.hardware.usb.UsbConstants.USB_DIR_IN }
                
                if (inEndpoint == null) {
                    onError("USB input endpoint not found")
                    return@launch
                }
                
                // Start reading thread
                isRunning.set(true)
                readThread = Thread {
                    val buffer = ByteArray(1024)
                    
                    while (isRunning.get()) {
                        try {
                            val bytesRead = connection?.bulkTransfer(
                                inEndpoint,
                                buffer,
                                buffer.size,
                                100 // 100ms timeout for each read
                            ) ?: -1
                            
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
                            }
                        } catch (e: Exception) {
                            if (isRunning.get()) {
                                onError(e.message ?: "USB read error")
                            }
                            break
                        }
                    }
                }.apply {
                    isDaemon = true
                    start()
                }
                
            } catch (e: Exception) {
                onError(e.message ?: "USB stream initialization failed")
            }
        }
    }

    override fun close() {
        isRunning.set(false)
        readThread?.interrupt()
        connection?.close()
        connection = null
    }
    
    private fun requestUsbPermission(
        usbManager: UsbManager,
        device: UsbDevice,
        timeout: Long
    ): Boolean {
        val latch = CountDownLatch(1)
        var granted = false
        
        val receiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                if (ACTION_USB_PERMISSION == intent?.action) {
                    granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)
                    latch.countDown()
                }
            }
        }
        
        context.registerReceiver(receiver, IntentFilter(ACTION_USB_PERMISSION))
        
        try {
            val permissionIntent = PendingIntent.getBroadcast(
                context,
                0,
                Intent(ACTION_USB_PERMISSION),
                PendingIntent.FLAG_IMMUTABLE
            )
            usbManager.requestPermission(device, permissionIntent)
            
            latch.await(timeout, TimeUnit.MILLISECONDS)
            return granted
        } finally {
            context.unregisterReceiver(receiver)
        }
    }
}
