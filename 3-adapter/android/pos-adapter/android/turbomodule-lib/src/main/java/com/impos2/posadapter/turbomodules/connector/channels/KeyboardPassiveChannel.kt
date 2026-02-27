package com.impos2.posadapter.turbomodules.connector.channels

import android.view.KeyEvent
import com.impos2.posadapter.turbomodules.connector.ChannelType
import com.impos2.posadapter.turbomodules.connector.ConnectorEvent
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit

/**
 * HID 键盘被动通道
 *
 * 扫码枪以 HID Keyboard 模式工作时，每次扫描会快速连续发送字符按键 + 回车。
 * 本通道将连续按键拼接为完整字符串，超过 [COMMIT_DELAY_MS] 毫秒无新按键则视为一次完整输入，
 * 通过 onEvent 推送给 JS 层。
 *
 * 拦截点在 Activity.dispatchKeyEvent，由 MainActivity 调用 [onKeyEvent]，
 * 返回 true 表示消费该事件（UI 不再收到）。
 */
class KeyboardPassiveChannel : PassiveChannel {

    companion object {
        /** 两次按键间隔超过此值（ms）视为新的一次输入 */
        private const val COMMIT_DELAY_MS = 100L
        const val SOURCE = "keyboard"
    }

    private var onEvent: ((ConnectorEvent) -> Unit)? = null
    private val buffer = StringBuilder()
    private val scheduler = Executors.newSingleThreadScheduledExecutor()
    private var commitFuture: ScheduledFuture<*>? = null

    override fun start(onEvent: (ConnectorEvent) -> Unit) {
        this.onEvent = onEvent
    }

    override fun stop() {
        onEvent = null
        commitFuture?.cancel(false)
        buffer.clear()
    }

    /**
     * 由 MainActivity.dispatchKeyEvent 调用。
     * @return true = 事件已消费，不再传递给 UI；false = 不处理，继续传递
     */
    fun onKeyEvent(event: KeyEvent): Boolean {
        if (onEvent == null) return false

        val keyCode = event.keyCode

        // 系统级按键不拦截，让系统正常处理
        if (isSystemKey(keyCode)) return false

        // ACTION_UP 一律消费（配合 ACTION_DOWN 成对消费，防止 UI 收到 UP 事件）
        if (event.action != KeyEvent.ACTION_DOWN) return true

        return when (keyCode) {
            KeyEvent.KEYCODE_ENTER, KeyEvent.KEYCODE_NUMPAD_ENTER -> {
                // 回车 = 一次扫码结束，立即提交
                commitFuture?.cancel(false)
                commitBuffer()
                true
            }
            else -> {
                val char = event.unicodeChar
                if (char == 0) {
                    // 非可打印字符（Shift、Ctrl 等修饰键），消费但不记录
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

    /**
     * 系统级按键：返回、Home、音量、电源、菜单等，不拦截
     */
    private fun isSystemKey(keyCode: Int): Boolean = keyCode in setOf(
        KeyEvent.KEYCODE_BACK,
        KeyEvent.KEYCODE_HOME,
        KeyEvent.KEYCODE_VOLUME_UP,
        KeyEvent.KEYCODE_VOLUME_DOWN,
        KeyEvent.KEYCODE_VOLUME_MUTE,
        KeyEvent.KEYCODE_POWER,
        KeyEvent.KEYCODE_MENU,
        KeyEvent.KEYCODE_APP_SWITCH,
        KeyEvent.KEYCODE_CAMERA,
    )

    private fun commitBuffer() {
        val text = buffer.toString().trim()
        buffer.clear()
        if (text.isEmpty()) return
        onEvent?.invoke(
            ConnectorEvent(
                channelId = SOURCE,
                type      = ChannelType.HID,
                target    = SOURCE,
                data      = mapOf("text" to text),
                timestamp = System.currentTimeMillis(),
                raw       = text
            )
        )
    }
}
