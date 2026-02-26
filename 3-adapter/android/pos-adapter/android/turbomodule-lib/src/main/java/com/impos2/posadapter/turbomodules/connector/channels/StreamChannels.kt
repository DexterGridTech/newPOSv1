package com.impos2.posadapter.turbomodules.connector.channels

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothSocket
import android.content.Context
import android.hardware.usb.UsbConstants
import android.hardware.usb.UsbDeviceConnection
import android.hardware.usb.UsbManager
import com.facebook.react.bridge.ReactApplicationContext
import com.impos2.posadapter.turbomodules.bytesToHex
import com.impos2.posadapter.turbomodules.connector.ChannelDescriptor
import com.impos2.posadapter.turbomodules.connector.ChannelType
import com.impos2.posadapter.turbomodules.connector.ConnectorEvent
import java.io.File
import java.io.FileInputStream
import java.util.UUID

// ─── USB Stream ───────────────────────────────────────────────────────────────

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

        // 先用局部变量捕获 conn，再设 running=true
        // 避免 close() 在 running=true 之后、localConn 赋值之前执行导致 NPE
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
                // 正常关闭
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

// ─── Serial Stream ────────────────────────────────────────────────────────────

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
                // 正常关闭
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

// ─── Bluetooth Stream ─────────────────────────────────────────────────────────

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

        val uuid = UUID.fromString(
            desc.options["uuid"] as? String ?: "00001101-0000-1000-8000-00805F9B34FB"
        )
        val btSocket = btAdapter.getRemoteDevice(desc.target)
            .createRfcommSocketToServiceRecord(uuid)
        socket = btSocket

        running = true
        // connect() 是阻塞操作，必须在后台线程执行，避免 ANR
        readThread = Thread {
            try {
                btAdapter.cancelDiscovery()
                btSocket.connect()

                val buf = ByteArray(1024)
                val ins = btSocket.inputStream
                while (running) {
                    if (ins.available() > 0) {
                        val len = ins.read(buf)
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
                // 正常关闭
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
