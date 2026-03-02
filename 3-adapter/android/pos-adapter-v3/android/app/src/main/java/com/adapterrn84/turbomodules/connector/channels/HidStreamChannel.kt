package com.adapterrn84.turbomodules.connector.channels

import android.os.Handler
import android.os.Looper
import android.view.KeyEvent
import com.adapterrn84.turbomodules.connector.*
import com.facebook.react.bridge.ReactApplicationContext
import kotlinx.coroutines.CoroutineScope

/**
 * HID 流通道（键盘/扫码枪）
 * 
 * 扫码枪模式：
 * - 按键缓冲：每次按键存入 buffer
 * - 100ms 提交延迟：使用 Handler.postDelayed 实现
 * - 每次新按键重置 100ms 计时器
 * - 100ms 内无新按键 → 提交整个 buffer 作为一次扫码结果
 * - KEYCODE_ENTER → 立即提交 buffer
 */
class HidStreamChannel(
    private val context: ReactApplicationContext,
    private val descriptor: ChannelDescriptor,
    private val scope: CoroutineScope,
    private val eventDispatcher: EventDispatcher
) : StreamChannel, EventDispatcher.HidEventHandler {

    companion object {
        private const val SUBMIT_DELAY_MS = 100L
    }

    private val buffer = StringBuilder()
    private val handler = Handler(Looper.getMainLooper())
    private var submitRunnable: Runnable? = null
    private var onDataCallback: ((ConnectorEvent) -> Unit)? = null

    override fun open(onData: (ConnectorEvent) -> Unit, onError: (String) -> Unit) {
        onDataCallback = onData
        
        // Register to EventDispatcher
        eventDispatcher.registerHidHandler(descriptor.target, this)
    }

    override fun close() {
        onDataCallback = null
        
        // Cancel pending submit
        submitRunnable?.let { handler.removeCallbacks(it) }
        submitRunnable = null
        
        // Unregister from EventDispatcher
        eventDispatcher.unregisterHidHandler(descriptor.target, this)
        
        // Clear buffer
        buffer.clear()
    }

    override suspend fun onKeyEvent(keyCode: Int, event: KeyEvent) {
        // Only process ACTION_DOWN events
        if (event.action != KeyEvent.ACTION_DOWN) {
            return
        }

        // Handle ENTER key - submit immediately
        if (keyCode == KeyEvent.KEYCODE_ENTER) {
            submitBuffer()
            return
        }

        // Convert keyCode to character
        val char = event.getUnicodeChar()
        if (char > 0) {
            // Add character to buffer
            buffer.append(char.toChar())
            
            // Reset submit timer
            submitRunnable?.let { handler.removeCallbacks(it) }
            submitRunnable = Runnable {
                submitBuffer()
            }.also {
                handler.postDelayed(it, SUBMIT_DELAY_MS)
            }
        }
    }

    private fun submitBuffer() {
        if (buffer.isEmpty()) {
            return
        }

        val data = buffer.toString()
        buffer.clear()

        // Cancel pending submit
        submitRunnable?.let { handler.removeCallbacks(it) }
        submitRunnable = null

        // Send event
        val event = ConnectorEvent(
            channelId = "",
            type = descriptor.type.name,
            target = descriptor.target,
            data = data,
            timestamp = System.currentTimeMillis(),
            raw = null
        )

        onDataCallback?.invoke(event)
    }
}
