package com.impos2.posadapter.turbomodules.connector.channels

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothSocket
import android.content.Context
import android.hardware.usb.UsbConstants
import android.hardware.usb.UsbDeviceConnection
import android.hardware.usb.UsbManager
import android.view.KeyEvent
import com.facebook.react.bridge.ReactApplicationContext
import com.impos2.posadapter.turbomodules.bytesToHex
import com.impos2.posadapter.turbomodules.connector.ChannelDescriptor
import com.impos2.posadapter.turbomodules.connector.ChannelType
import com.impos2.posadapter.turbomodules.connector.ConnectorEvent
import java.io.File
import java.io.FileInputStream
import java.util.UUID
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit

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

// ─── HID Stream ───────────────────────────────────────────────────────────────

/**
 * HID 键盘扫码枪 Stream 通道
 *
 * 通过 externalConnector.subscribe({ type: 'HID', target: 'keyboard', mode: 'stream' }) 接入。
 * open() 后由 ConnectorTurboModule.onKeyEvent() 转发按键事件；
 * close() 后从路由表注销，停止接收。
 *
 * 拼接逻辑与原 KeyboardPassiveChannel 一致：
 *   连续按键拼接为字符串，超过 COMMIT_DELAY_MS 无新按键则推送一次 ConnectorEvent。
 */
class HidStreamChannel(
    private val desc: ChannelDescriptor,
    private val onEvent: (ConnectorEvent) -> Unit
) : StreamChannel {

    companion object {
        private const val COMMIT_DELAY_MS = 100L
    }

    private val buffer = StringBuilder()
    private val scheduler = Executors.newSingleThreadScheduledExecutor()
    private var commitFuture: ScheduledFuture<*>? = null

    override fun open() {
        // 注册由 ConnectorTurboModule 完成（调用方持有 channelId → this 的映射）
    }

    override fun close() {
        commitFuture?.cancel(false)
        buffer.clear()
        scheduler.shutdownNow()
    }

    /**
     * 由 ConnectorTurboModule.onKeyEvent() 调用。
     * @return true = 事件已消费；false = 不处理
     */
    fun onKeyEvent(event: KeyEvent): Boolean {
        val keyCode = event.keyCode
        if (isSystemKey(keyCode)) return false
        if (event.action != KeyEvent.ACTION_DOWN) return true

        return when (keyCode) {
            KeyEvent.KEYCODE_ENTER, KeyEvent.KEYCODE_NUMPAD_ENTER -> {
                commitFuture?.cancel(false)
                commitBuffer()
                true
            }
            else -> {
                val char = event.unicodeChar
                if (char == 0) {
                    true
                } else {
                    buffer.append(char.toChar())
                    commitFuture?.cancel(false)
                    commitFuture = scheduler.schedule(::commitBuffer, COMMIT_DELAY_MS, TimeUnit.MILLISECONDS)
                    true
                }
            }
        }
    }

    private fun isSystemKey(keyCode: Int): Boolean = keyCode in setOf(
        KeyEvent.KEYCODE_BACK, KeyEvent.KEYCODE_HOME,
        KeyEvent.KEYCODE_VOLUME_UP, KeyEvent.KEYCODE_VOLUME_DOWN,
        KeyEvent.KEYCODE_VOLUME_MUTE, KeyEvent.KEYCODE_POWER,
        KeyEvent.KEYCODE_MENU, KeyEvent.KEYCODE_APP_SWITCH, KeyEvent.KEYCODE_CAMERA,
    )

    private fun commitBuffer() {
        val text = buffer.toString().trim()
        buffer.clear()
        if (text.isEmpty()) return
        onEvent(ConnectorEvent(
            channelId = desc.target,
            type      = ChannelType.HID,
            target    = desc.target,
            data      = mapOf("text" to text),
            timestamp = System.currentTimeMillis(),
            raw       = text
        ))
    }
}
