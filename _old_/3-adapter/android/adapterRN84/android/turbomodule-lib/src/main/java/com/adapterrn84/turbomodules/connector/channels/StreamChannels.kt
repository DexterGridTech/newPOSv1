package com.adapterrn84.turbomodules.connector.channels

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothSocket
import android.content.Context
import android.hardware.usb.UsbConstants
import android.hardware.usb.UsbDeviceConnection
import android.hardware.usb.UsbManager
import android.view.KeyEvent
import com.facebook.react.bridge.ReactApplicationContext
import com.adapterrn84.turbomodules.connector.ChannelDescriptor
import com.adapterrn84.turbomodules.connector.ChannelType
import com.adapterrn84.turbomodules.connector.ConnectorEvent
import java.io.File
import java.io.FileInputStream
import java.util.UUID

class UsbStreamChannel(
    private val context: ReactApplicationContext,
    private val desc: ChannelDescriptor,
    private val onEvent: (ConnectorEvent) -> Unit
) : StreamChannel {

    @Volatile private var running = false
    private var connection: UsbDeviceConnection? = null
    private var claimedIface: android.hardware.usb.UsbInterface? = null
    private var readThread: Thread? = null

    override fun open() {
        val usbManager = context.getSystemService(Context.USB_SERVICE) as UsbManager
        val device = usbManager.deviceList[desc.target]
            ?: throw IllegalStateException("USB device not found: ${desc.target}")
        if (!usbManager.hasPermission(device))
            throw SecurityException("USB permission denied: ${desc.target}")

        val conn = usbManager.openDevice(device)
            ?: throw IllegalStateException("Cannot open USB device: ${desc.target}")
        val iface = device.getInterface(0)
        conn.claimInterface(iface, true)
        val inEp = (0 until iface.endpointCount)
            .map { iface.getEndpoint(it) }
            .firstOrNull { it.direction == UsbConstants.USB_DIR_IN }
            ?: run { conn.releaseInterface(iface); conn.close(); throw IllegalStateException("No IN endpoint on USB device: ${desc.target}") }

        connection = conn
        claimedIface = iface

        val localConn = conn
        running = true
        readThread = Thread {
            val buf = ByteArray(inEp.maxPacketSize)
            try {
                while (running) {
                    val len = localConn.bulkTransfer(inEp, buf, buf.size, 100)
                    if (len > 0) {
                        val hex = bytesToHex(buf, len)
                        onEvent(ConnectorEvent(
                            channelId = desc.target,
                            type = ChannelType.USB,
                            target = desc.target,
                            data = mapOf("hex" to hex),
                            timestamp = System.currentTimeMillis(),
                            raw = hex
                        ))
                    }
                }
            } catch (_: InterruptedException) {
            } catch (e: Exception) {
                onEvent(ConnectorEvent(
                    channelId = desc.target,
                    type = ChannelType.USB,
                    target = desc.target,
                    data = null,
                    timestamp = System.currentTimeMillis(),
                    raw = "USB stream error: ${e.message}"
                ))
            }
        }.also { it.isDaemon = true; it.start() }
    }

    override fun close() {
        running = false
        readThread?.interrupt()
        claimedIface?.let { connection?.releaseInterface(it) }
        connection?.close()
        connection = null
        claimedIface = null
    }
}

class SerialStreamChannel(
    private val context: ReactApplicationContext,
    private val desc: ChannelDescriptor,
    private val onEvent: (ConnectorEvent) -> Unit
) : StreamChannel {

    @Volatile private var running = false
    private var readThread: Thread? = null

    override fun open() {
        val port = File(desc.target)
        if (!port.exists()) throw IllegalStateException("Serial port not found: ${desc.target}")

        running = true
        readThread = Thread {
            try {
                FileInputStream(port).use { fis ->
                    val buf = ByteArray(1024)
                    while (running) {
                        if (fis.available() > 0) {
                            val len = fis.read(buf)
                            if (len > 0) {
                                val hex = bytesToHex(buf, len)
                                onEvent(ConnectorEvent(
                                    channelId = desc.target,
                                    type = ChannelType.SERIAL,
                                    target = desc.target,
                                    data = mapOf("hex" to hex),
                                    timestamp = System.currentTimeMillis(),
                                    raw = hex
                                ))
                            }
                        } else {
                            Thread.sleep(20)
                        }
                    }
                }
            } catch (_: InterruptedException) {
            } catch (e: Exception) {
                onEvent(ConnectorEvent(
                    channelId = desc.target,
                    type = ChannelType.SERIAL,
                    target = desc.target,
                    data = null,
                    timestamp = System.currentTimeMillis(),
                    raw = "Serial stream error: ${e.message}"
                ))
            }
        }.also { it.isDaemon = true; it.start() }
    }

    override fun close() {
        running = false
        readThread?.interrupt()
    }
}

class BluetoothStreamChannel(
    private val context: ReactApplicationContext,
    private val desc: ChannelDescriptor,
    private val onEvent: (ConnectorEvent) -> Unit
) : StreamChannel {

    @Volatile private var running = false
    private var socket: BluetoothSocket? = null
    private var readThread: Thread? = null

    override fun open() {
        val btAdapter = BluetoothAdapter.getDefaultAdapter()
            ?: throw IllegalStateException("Bluetooth not supported")
        if (!btAdapter.isEnabled) throw IllegalStateException("Bluetooth not enabled")

        val device = btAdapter.getRemoteDevice(desc.target)
        val uuid = UUID.fromString(desc.options["uuid"] as? String ?: "00001101-0000-1000-8000-00805F9B34FB")
        socket = device.createRfcommSocketToServiceRecord(uuid)
        btAdapter.cancelDiscovery()
        socket?.connect()

        running = true
        readThread = Thread {
            try {
                val buf = ByteArray(1024)
                while (running) {
                    val available = socket?.inputStream?.available() ?: 0
                    if (available > 0) {
                        val len = socket?.inputStream?.read(buf) ?: 0
                        if (len > 0) {
                            val hex = bytesToHex(buf, len)
                            onEvent(ConnectorEvent(
                                channelId = desc.target,
                                type = ChannelType.BLUETOOTH,
                                target = desc.target,
                                data = mapOf("hex" to hex),
                                timestamp = System.currentTimeMillis(),
                                raw = hex
                            ))
                        }
                    } else {
                        Thread.sleep(20)
                    }
                }
            } catch (_: InterruptedException) {
            } catch (e: Exception) {
                onEvent(ConnectorEvent(
                    channelId = desc.target,
                    type = ChannelType.BLUETOOTH,
                    target = desc.target,
                    data = null,
                    timestamp = System.currentTimeMillis(),
                    raw = "Bluetooth stream error: ${e.message}"
                ))
            }
        }.also { it.isDaemon = true; it.start() }
    }

    override fun close() {
        running = false
        readThread?.interrupt()
        socket?.close()
        socket = null
    }
}

class HidStreamChannel(
    private val desc: ChannelDescriptor,
    private val onEvent: (ConnectorEvent) -> Unit
) : StreamChannel {

    @Volatile private var opened = false

    override fun open() {
        opened = true
    }

    override fun close() {
        opened = false
    }

    fun onKeyEvent(event: KeyEvent): Boolean {
        if (!opened) return false
        val data = mapOf(
            "keyCode" to event.keyCode,
            "action" to event.action,
            "scanCode" to event.scanCode,
            "characters" to (event.characters ?: "")
        )
        onEvent(ConnectorEvent(
            channelId = desc.target,
            type = ChannelType.HID,
            target = desc.target,
            data = data,
            timestamp = System.currentTimeMillis()
        ))
        return true
    }
}
