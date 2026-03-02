package com.adapterrn84.turbomodules.connector.channels

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbManager
import com.adapterrn84.turbomodules.connector.*
import com.facebook.react.bridge.ReactApplicationContext
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

class UsbChannel(
    private val context: ReactApplicationContext,
    private val descriptor: ChannelDescriptor
) : RequestResponseChannel {

    companion object {
        private const val ACTION_USB_PERMISSION = "com.impos2.USB_PERMISSION"
    }

    override suspend fun execute(action: String, params: Map<String, String>, timeout: Long): ConnectorResult<String> {
        val startTime = System.currentTimeMillis()

        return try {
            val usbManager = context.getSystemService(Context.USB_SERVICE) as UsbManager

            // Get device by name (target is device name like "/dev/bus/usb/001/002")
            val device = usbManager.deviceList[descriptor.target]
                ?: return ConnectorResult.Failure(
                    ConnectorErrorCode.UNKNOWN,
                    "USB device not found: ${descriptor.target}",
                    null,
                    System.currentTimeMillis() - startTime
                )
            
            // Request permission if needed
            if (!usbManager.hasPermission(device)) {
                val permissionGranted = requestUsbPermission(usbManager, device, timeout)
                if (!permissionGranted) {
                    return ConnectorResult.Failure(
                        ConnectorErrorCode.PERMISSION_DENIED,
                        "USB permission denied",
                        null,
                        System.currentTimeMillis() - startTime
                    )
                }
            }
            
            // Open device and communicate
            val connection = usbManager.openDevice(device)
                ?: return ConnectorResult.Failure(
                    ConnectorErrorCode.UNKNOWN,
                    "Failed to open USB device",
                    null,
                    System.currentTimeMillis() - startTime
                )
            
            try {
                val intf = device.getInterface(0)
                connection.claimInterface(intf, true)
                
                // Find bulk endpoints
                val outEndpoint = (0 until intf.endpointCount)
                    .map { intf.getEndpoint(it) }
                    .find { it.direction == android.hardware.usb.UsbConstants.USB_DIR_OUT }
                
                val inEndpoint = (0 until intf.endpointCount)
                    .map { intf.getEndpoint(it) }
                    .find { it.direction == android.hardware.usb.UsbConstants.USB_DIR_IN }
                
                if (outEndpoint == null || inEndpoint == null) {
                    return ConnectorResult.Failure(
                        ConnectorErrorCode.UNKNOWN,
                        "USB endpoints not found",
                        null,
                        System.currentTimeMillis() - startTime
                    )
                }
                
                // Send data
                val dataHex = params["data"] ?: ""
                val dataBytes = HexUtils.hexToBytes(dataHex)
                
                val sentBytes = connection.bulkTransfer(
                    outEndpoint,
                    dataBytes,
                    dataBytes.size,
                    timeout.toInt()
                )
                
                if (sentBytes < 0) {
                    return ConnectorResult.Failure(
                        ConnectorErrorCode.UNKNOWN,
                        "USB write failed",
                        null,
                        System.currentTimeMillis() - startTime
                    )
                }
                
                // Read response
                val buffer = ByteArray(1024)
                val receivedBytes = connection.bulkTransfer(
                    inEndpoint,
                    buffer,
                    buffer.size,
                    timeout.toInt()
                )
                
                val duration = System.currentTimeMillis() - startTime
                
                if (receivedBytes < 0) {
                    return ConnectorResult.Failure(
                        ConnectorErrorCode.UNKNOWN,
                        "USB read failed",
                        null,
                        duration
                    )
                }
                
                val responseHex = HexUtils.bytesToHex(buffer, receivedBytes)
                ConnectorResult.Success(responseHex, duration)
                
            } finally {
                connection.close()
            }
            
        } catch (e: Exception) {
            val duration = System.currentTimeMillis() - startTime
            ConnectorResult.Failure(
                ConnectorErrorCode.UNKNOWN,
                e.message ?: "USB communication failed",
                e,
                duration
            )
        }
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

    override fun close() {
        // UsbChannel is stateless, connection is closed in execute() finally block
    }
}
