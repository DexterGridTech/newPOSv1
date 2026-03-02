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
) : StreamChannel {

    companion object {
        private const val SUBMIT_DELAY_MS = 100L
    }

    private val buffer = StringBuilder()
    private val handler = Handler(Looper.getMainLooper())
    private var submitRunnable: Runnable? = null
    private var onDataCallback: ((ConnectorEvent) -> Unit)? = null

    override fun open(onData: (ConnectorEvent) -> Unit, onError: (String) -> Unit) {
        onDataCallback = onData
    }

    override fun close() {
        onDataCallback = null

        // Cancel pending submit
        submitRunnable?.let { handler.removeCallbacks(it) }
        submitRunnable = null

        // Clear buffer
        buffer.clear()
    }

    /**
     * 由 ConnectorTurboModule.onKeyEvent() 调用
     * @return true = 事件已消费；false = 不处理
     */
    fun onKeyEvent(event: KeyEvent): Boolean {
        val keyCode = event.keyCode
        android.util.Log.d("HidStreamChannel", "onKeyEvent: keyCode=$keyCode, action=${event.action}")

        // 系统按键不拦截
        if (isSystemKey(keyCode)) {
            android.util.Log.d("HidStreamChannel", "System key, not intercepting")
            return false
        }

        // 拦截所有 action 的事件，防止 ACTION_UP 等触发系统行为
        if (event.action != KeyEvent.ACTION_DOWN) {
            android.util.Log.d("HidStreamChannel", "Not ACTION_DOWN, intercepting anyway")
            return true
        }

        return when (keyCode) {
            KeyEvent.KEYCODE_ENTER, KeyEvent.KEYCODE_NUMPAD_ENTER -> {
                android.util.Log.d("HidStreamChannel", "ENTER key, submitting buffer")
                submitRunnable?.let { handler.removeCallbacks(it) }
                submitBuffer()
                true
            }
            else -> {
                val char = event.unicodeChar
                android.util.Log.d("HidStreamChannel", "char=$char")
                if (char == 0) {
                    true
                } else {
                    buffer.append(char.toChar())
                    android.util.Log.d("HidStreamChannel", "buffer=${buffer.toString()}")
                    submitRunnable?.let { handler.removeCallbacks(it) }
                    submitRunnable = Runnable {
                        submitBuffer()
                    }.also {
                        handler.postDelayed(it, SUBMIT_DELAY_MS)
                    }
                    true
                }
            }
        }
    }

    /**
     * 判断是否为系统按键(不应被拦截的按键)
     * 只保留真正的系统级按键,其他所有按键都拦截以避免触发 UI 变化
     */
    private fun isSystemKey(keyCode: Int): Boolean = keyCode in setOf(
        KeyEvent.KEYCODE_BACK,
        KeyEvent.KEYCODE_HOME,
        KeyEvent.KEYCODE_VOLUME_UP,
        KeyEvent.KEYCODE_VOLUME_DOWN,
        KeyEvent.KEYCODE_VOLUME_MUTE,
        KeyEvent.KEYCODE_POWER
    )

    private fun submitBuffer() {
        val text = buffer.toString().trim()
        buffer.clear()
        if (text.isEmpty()) return

        val event = ConnectorEvent(
            channelId = "",
            type = descriptor.type.name,
            target = descriptor.target,
            data = text,
            timestamp = System.currentTimeMillis(),
            raw = text
        )

        onDataCallback?.invoke(event)
    }
}
