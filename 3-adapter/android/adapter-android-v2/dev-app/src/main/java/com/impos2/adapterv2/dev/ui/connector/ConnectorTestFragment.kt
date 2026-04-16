package com.impos2.adapterv2.dev.ui.connector

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import androidx.activity.ComponentActivity
import androidx.fragment.app.Fragment
import com.google.android.material.textview.MaterialTextView
import com.impos2.adapterv2.camera.CameraScanActivity
import com.impos2.adapterv2.connector.ConnectorManager
import com.impos2.adapterv2.connector.SystemFilePickerActivity
import com.impos2.adapterv2.dev.ui.console.ConsoleSessionStore
import com.impos2.adapterv2.dev.ui.console.ConsoleTheme
import com.impos2.adapterv2.dev.ui.console.ConsoleTone
import com.impos2.adapterv2.dev.ui.console.consoleCard
import com.impos2.adapterv2.dev.ui.console.consolePage
import com.impos2.adapterv2.dev.ui.console.consoleTopBar
import com.impos2.adapterv2.dev.ui.console.eventConsole
import com.impos2.adapterv2.dev.ui.console.metricRow
import com.impos2.adapterv2.dev.ui.console.outlineButton
import com.impos2.adapterv2.dev.ui.console.primaryButton
import com.impos2.adapterv2.dev.ui.console.sectionTitle
import com.impos2.adapterv2.dev.ui.console.statusChip
import com.impos2.adapterv2.interfaces.ChannelDescriptor
import com.impos2.adapterv2.interfaces.ChannelType
import com.impos2.adapterv2.interfaces.ConnectorRequest
import com.impos2.adapterv2.interfaces.InteractionMode

class ConnectorTestFragment : Fragment() {

  private val connector by lazy { ConnectorManager.getInstance(requireContext()) }
  private var removeStreamListener: (() -> Unit)? = null
  private var removePassiveListener: (() -> Unit)? = null
  private var hidChannelId: String? = null
  private var latestCameraResult: String = "--"
  private var latestSystemResult: String = "--"
  private var latestHidEvent: String = "--"
  private var latestPassiveEvent: String = "--"
  private val eventLines = mutableListOf<String>()

  override fun onCreateView(
    inflater: LayoutInflater,
    container: ViewGroup?,
    savedInstanceState: Bundle?
  ): View {
    return renderPage()
  }

  override fun onDestroyView() {
    hidChannelId?.let { connector.unsubscribe(it) }
    hidChannelId = null
    removeStreamListener?.invoke()
    removeStreamListener = null
    removePassiveListener?.invoke()
    removePassiveListener = null
    super.onDestroyView()
  }

  private fun renderPage(): View {
    return consolePage {
      addView(
        consoleTopBar(
          title = "Connector 验证台",
          subtitle = "Camera、system picker、HID、passive 连接链路验证",
          onBack = { requireActivity().onBackPressedDispatcher.onBackPressed() },
        )
      )

      addView(consoleCard {
        addView(MaterialTextView(context).apply {
          text = "本页聚焦跨能力连接验证，强调订阅状态、最近结果与事件流。"
          textSize = 14f
          setTextColor(ConsoleTheme.textSecondary)
        })
        addView(LinearLayout(context).apply {
          orientation = LinearLayout.HORIZONTAL
          setPadding(0, 16, 0, 0)
          addView(statusChip(context, if (hidChannelId == null) "HID 未订阅" else "HID 已订阅", if (hidChannelId == null) ConsoleTone.NEUTRAL else ConsoleTone.SUCCESS).apply {
            layoutParams = ViewGroup.MarginLayoutParams(
              ViewGroup.LayoutParams.WRAP_CONTENT,
              ViewGroup.LayoutParams.WRAP_CONTENT,
            ).apply { rightMargin = 12 }
          })
          addView(statusChip(context, if (removePassiveListener == null) "Passive 未监听" else "Passive 监听中", if (removePassiveListener == null) ConsoleTone.NEUTRAL else ConsoleTone.PRIMARY))
        })
      })

      addView(sectionTitle("运行摘要"))
      addView(
        metricRow(
          listOf(
            "Camera 最近结果" to latestCameraResult,
            "System Picker" to latestSystemResult,
            "HID" to if (hidChannelId == null) "inactive" else "active",
            "Passive" to if (removePassiveListener == null) "inactive" else "active",
          )
        )
      )

      addView(sectionTitle("操作区"))
      addView(consoleCard("Camera") {
        addView(primaryButton("检查 camera 可用性") {
          val available = connector.isAvailable(cameraChannel())
          val intentTargets = connector.getAvailableTargets(ChannelType.INTENT)
          latestCameraResult = if (available) "available" else "unavailable"
          appendEvent("Connector / camera availability / success available=$available targets=$intentTargets")
          ConsoleSessionStore.record("Connector", "camera availability", "success")
          refresh()
        })
        addView(outlineButton("摄像头扫码(ALL)") { triggerScan("ALL") })
        addView(outlineButton("摄像头扫码(QR)") { triggerScan("QR_CODE_MODE") })
      })

      addView(consoleCard("System Picker") {
        addView(primaryButton("系统文件选择器") {
          val req = ConnectorRequest(
            channel = ChannelDescriptor(
              type = ChannelType.INTENT,
              target = "system",
              mode = InteractionMode.REQUEST_RESPONSE,
            ),
            action = SystemFilePickerActivity.ACTION_OPEN_DOCUMENT,
            params = mapOf(
              "type" to "*/*",
              "category" to "android.intent.category.OPENABLE",
            ),
            timeoutMs = 59000,
          )
          connector.call(requireActivity() as ComponentActivity, req) { res ->
            latestSystemResult = if (res.success) "success" else "error ${res.code}"
            appendEvent("Connector / systemPicker / success=${res.success} code=${res.code} msg=${res.message}")
            ConsoleSessionStore.record("Connector", "systemPicker", if (res.success) "success" else "error")
            refresh()
          }
        })
      })

      addView(consoleCard("HID Stream") {
        addView(primaryButton("开启 HID 键盘监听") {
          if (hidChannelId != null) {
            appendEvent("Connector / hid subscribe / warning already-active")
            ConsoleSessionStore.record("Connector", "hid subscribe", "warning already-active")
          } else {
            hidChannelId = connector.subscribe(
              ChannelDescriptor(
                type = ChannelType.HID,
                target = "keyboard",
                mode = InteractionMode.STREAM,
              ),
            )
            removeStreamListener = connector.onStream { event ->
              latestHidEvent = "${event.raw ?: event.data}"
              appendEvent("Connector / hid event / channel=${event.channelId} data=${event.data}")
              ConsoleSessionStore.record("Connector", "hid event", "success")
              refresh()
            }
            appendEvent("Connector / hid subscribe / success channelId=$hidChannelId")
            ConsoleSessionStore.record("Connector", "hid subscribe", "success")
          }
          refresh()
        })
        addView(outlineButton("关闭 HID 键盘监听") {
          hidChannelId?.let { connector.unsubscribe(it) }
          hidChannelId = null
          removeStreamListener?.invoke()
          removeStreamListener = null
          appendEvent("Connector / hid unsubscribe / success")
          ConsoleSessionStore.record("Connector", "hid unsubscribe", "success")
          refresh()
        })
      })

      addView(consoleCard("Passive Broadcast") {
        addView(primaryButton("开始监听 passive") {
          if (removePassiveListener != null) {
            appendEvent("Connector / passive listen / warning already-active")
            ConsoleSessionStore.record("Connector", "passive listen", "warning already-active")
          } else {
            removePassiveListener = connector.onPassive { event ->
              latestPassiveEvent = "${event.target} / ${event.data}"
              appendEvent("Connector / passive event / target=${event.target} data=${event.data}")
              ConsoleSessionStore.record("Connector", "passive event", "success")
              refresh()
            }
            appendEvent("Connector / passive listen / success")
            appendEvent("adb shell am broadcast -a com.impos2.connector.PASSIVE --es source adapterPure --es message hello")
            ConsoleSessionStore.record("Connector", "passive listen", "success")
          }
          refresh()
        })
        addView(outlineButton("停止监听 passive") {
          removePassiveListener?.invoke()
          removePassiveListener = null
          appendEvent("Connector / passive stop / success")
          ConsoleSessionStore.record("Connector", "passive stop", "success")
          refresh()
        })
      })

      addView(consoleCard("失败分支验证") {
        addView(outlineButton("非法 action(失败分支)") {
          val req = ConnectorRequest(
            channel = ChannelDescriptor(
              type = ChannelType.INTENT,
              target = "camera",
              mode = InteractionMode.REQUEST_RESPONSE,
            ),
            action = "invalid.action",
            params = mapOf("waitResult" to true, "SCAN_MODE" to "ALL"),
            timeoutMs = 15000,
          )
          connector.call(requireActivity() as ComponentActivity, req) { res ->
            appendEvent("Connector / invalid action / success=${res.success} code=${res.code} msg=${res.message}")
            ConsoleSessionStore.record("Connector", "invalid action", if (res.success) "warning unexpected-success" else "success failure-branch")
            refresh()
          }
        })
      })

      addView(sectionTitle("结构化结果"))
      addView(consoleCard("最近状态") {
        addView(detailLine("camera", latestCameraResult))
        addView(detailLine("systemPicker", latestSystemResult))
        addView(detailLine("hidChannelId", hidChannelId ?: "--"))
        addView(detailLine("latestHidEvent", latestHidEvent))
        addView(detailLine("latestPassiveEvent", latestPassiveEvent))
      })

      addView(sectionTitle("事件流"))
      addView(eventConsole("Connector Activity Stream", eventLines))
    }
  }

  private fun cameraChannel(): ChannelDescriptor {
    return ChannelDescriptor(
      type = ChannelType.INTENT,
      target = "camera",
      mode = InteractionMode.REQUEST_RESPONSE,
    )
  }

  private fun triggerScan(mode: String) {
    val req = ConnectorRequest(
      channel = cameraChannel(),
      action = CameraScanActivity.ACTION,
      params = mapOf("waitResult" to true, "SCAN_MODE" to mode),
      timeoutMs = 29000,
    )
    appendEvent("Connector / camera scan / running mode=$mode")
    ConsoleSessionStore.record("Connector", "camera scan", "running")
    connector.call(requireActivity() as ComponentActivity, req) { res ->
      latestCameraResult = if (res.success) "success ${res.duration}ms" else "error ${res.code}"
      appendEvent("Connector / camera scan / success=${res.success} code=${res.code} data=${res.data}")
      ConsoleSessionStore.record("Connector", "camera scan", if (res.success) "success" else "error")
      refresh()
    }
    refresh()
  }

  private fun detailLine(label: String, value: String): View {
    return LinearLayout(requireContext()).apply {
      orientation = LinearLayout.HORIZONTAL
      layoutParams = ViewGroup.MarginLayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.WRAP_CONTENT,
      ).apply { bottomMargin = 10 }
      addView(MaterialTextView(context).apply {
        text = label
        textSize = 13f
        setTextColor(ConsoleTheme.textSecondary)
        layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 0.42f)
      })
      addView(MaterialTextView(context).apply {
        text = value
        textSize = 13f
        setTextColor(ConsoleTheme.textPrimary)
        layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 0.58f)
      })
    }
  }

  private fun appendEvent(line: String) {
    eventLines.add(0, line)
    while (eventLines.size > 24) {
      eventLines.removeLast()
    }
  }

  private fun refresh() {
    val currentScroll = view as? android.widget.ScrollView ?: return
    val nextScroll = renderPage() as? android.widget.ScrollView ?: return
    val nextChild = nextScroll.getChildAt(0) ?: return
    nextScroll.removeView(nextChild)
    currentScroll.removeAllViews()
    currentScroll.addView(nextChild)
  }
}
