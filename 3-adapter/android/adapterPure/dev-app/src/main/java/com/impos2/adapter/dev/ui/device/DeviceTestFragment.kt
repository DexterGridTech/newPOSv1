package com.impos2.adapter.dev.ui.device

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import androidx.fragment.app.Fragment
import com.google.android.material.textview.MaterialTextView
import com.impos2.adapter.device.DeviceManager
import com.impos2.adapter.dev.ui.console.ConsoleSessionStore
import com.impos2.adapter.dev.ui.console.ConsoleTheme
import com.impos2.adapter.dev.ui.console.ConsoleTone
import com.impos2.adapter.dev.ui.console.consoleCard
import com.impos2.adapter.dev.ui.console.consolePage
import com.impos2.adapter.dev.ui.console.consoleTopBar
import com.impos2.adapter.dev.ui.console.eventConsole
import com.impos2.adapter.dev.ui.console.formatTime
import com.impos2.adapter.dev.ui.console.metricRow
import com.impos2.adapter.dev.ui.console.outlineButton
import com.impos2.adapter.dev.ui.console.primaryButton
import com.impos2.adapter.dev.ui.console.sectionTitle
import com.impos2.adapter.dev.ui.console.statusChip
import com.impos2.adapter.interfaces.DeviceInfo
import com.impos2.adapter.interfaces.PowerStatusChangeEvent
import com.impos2.adapter.interfaces.SystemStatus

class DeviceTestFragment : Fragment() {

  private val deviceManager by lazy { DeviceManager.getInstance(requireContext()) }
  private var latestDeviceInfo: DeviceInfo? = null
  private var latestSystemStatus: SystemStatus? = null
  private var latestPowerEvent: PowerStatusChangeEvent? = null
  private var powerListenerId: String? = null
  private val eventLines = mutableListOf<String>()

  override fun onCreateView(
    inflater: LayoutInflater,
    container: ViewGroup?,
    savedInstanceState: Bundle?
  ): View {
    return renderPage()
  }

  override fun onDestroyView() {
    powerListenerId?.let(deviceManager::removePowerStatusChangeListener)
    powerListenerId = null
    super.onDestroyView()
  }

  private fun renderPage(): View {
    return consolePage {
      addView(
        consoleTopBar(
          title = "Device 验证台",
          subtitle = "设备信息、系统状态与电源事件监听",
          onBack = { requireActivity().onBackPressedDispatcher.onBackPressed() },
        )
      )

      addView(consoleCard {
        addView(MaterialTextView(context).apply {
          text = "本页用于验证设备基础信息、系统状态采集与电源状态监听链路。"
          textSize = 14f
          setTextColor(ConsoleTheme.textSecondary)
        })
        addView(LinearLayout(context).apply {
          orientation = LinearLayout.HORIZONTAL
          setPadding(0, 16, 0, 0)
          addView(statusChip(context, if (powerListenerId == null) "监听未启动" else "监听中", if (powerListenerId == null) ConsoleTone.NEUTRAL else ConsoleTone.SUCCESS).apply {
            layoutParams = ViewGroup.MarginLayoutParams(
              ViewGroup.LayoutParams.WRAP_CONTENT,
              ViewGroup.LayoutParams.WRAP_CONTENT,
            ).apply { rightMargin = 12 }
          })
          addView(statusChip(context, latestPowerEvent?.let { "电量 ${it.batteryLevel}%" } ?: "无实时事件", ConsoleTone.PRIMARY))
        })
      })

      addView(sectionTitle("运行摘要"))
      addView(
        metricRow(
          listOf(
            "设备 ID" to (latestDeviceInfo?.id ?: "未采集"),
            "电池" to (latestSystemStatus?.power?.batteryLevel?.let { "$it%" } ?: "--"),
            "充电状态" to (latestSystemStatus?.power?.batteryStatus ?: "--"),
            "网络" to (latestSystemStatus?.networks?.firstOrNull()?.type ?: "--"),
          )
        )
      )

      addView(sectionTitle("操作区"))
      addView(consoleCard("信息读取") {
        addView(primaryButton("获取 DeviceInfo") {
          latestDeviceInfo = deviceManager.getDeviceInfo()
          ConsoleSessionStore.record("Device", "getDeviceInfo", "success")
          appendEvent("Device / getDeviceInfo / success")
          refresh()
        })
        addView(outlineButton("获取 SystemStatus") {
          latestSystemStatus = deviceManager.getSystemStatus()
          ConsoleSessionStore.record("Device", "getSystemStatus", "success")
          appendEvent("Device / getSystemStatus / success")
          refresh()
        })
      })

      addView(consoleCard("电源监听") {
        addView(primaryButton("开始监听电源变化") {
          if (powerListenerId != null) {
            appendEvent("Device / powerListener / warning already-active")
            ConsoleSessionStore.record("Device", "powerListener", "warning already-active")
          } else {
            powerListenerId = deviceManager.addPowerStatusChangeListener(::onPowerChanged)
            ConsoleSessionStore.record("Device", "powerListener", "running")
            appendEvent("Device / powerListener / running")
          }
          refresh()
        })
        addView(outlineButton("停止监听电源变化") {
          val current = powerListenerId
          if (current == null) {
            appendEvent("Device / powerListener / warning not-active")
            ConsoleSessionStore.record("Device", "powerListener", "warning not-active")
          } else {
            deviceManager.removePowerStatusChangeListener(current)
            powerListenerId = null
            ConsoleSessionStore.record("Device", "powerListener", "success stopped")
            appendEvent("Device / powerListener / success stopped")
          }
          refresh()
        })
      })

      addView(sectionTitle("结构化结果"))
      addView(consoleCard("DeviceInfo") {
        addView(detailLine("manufacturer", latestDeviceInfo?.manufacturer ?: "--"))
        addView(detailLine("os", latestDeviceInfo?.let { "${it.os} ${it.osVersion}" } ?: "--"))
        addView(detailLine("cpu", latestDeviceInfo?.cpu ?: "--"))
        addView(detailLine("memory", latestDeviceInfo?.memory ?: "--"))
        addView(detailLine("disk", latestDeviceInfo?.disk ?: "--"))
        addView(detailLine("network", latestDeviceInfo?.network ?: "--"))
        addView(detailLine("displays", latestDeviceInfo?.displays?.size?.toString() ?: "0"))
      })

      addView(consoleCard("SystemStatus") {
        addView(detailLine("cpu.app", latestSystemStatus?.cpu?.app?.let { "%.2f".format(it) } ?: "--"))
        addView(detailLine("cpu.cores", latestSystemStatus?.cpu?.cores?.toString() ?: "--"))
        addView(detailLine("memory.total", latestSystemStatus?.memory?.total?.toString() ?: "--"))
        addView(detailLine("memory.app", latestSystemStatus?.memory?.app?.toString() ?: "--"))
        addView(detailLine("disk.used", latestSystemStatus?.disk?.used?.let { "%.2f GB".format(it) } ?: "--"))
        addView(detailLine("power.level", latestSystemStatus?.power?.batteryLevel?.toString() ?: "--"))
        addView(detailLine("usbDevices", latestSystemStatus?.usbDevices?.size?.toString() ?: "0"))
        addView(detailLine("bluetoothDevices", latestSystemStatus?.bluetoothDevices?.size?.toString() ?: "0"))
        addView(detailLine("serialDevices", latestSystemStatus?.serialDevices?.size?.toString() ?: "0"))
      })

      addView(consoleCard("最新电源事件") {
        addView(detailLine("powerConnected", latestPowerEvent?.powerConnected?.toString() ?: "--"))
        addView(detailLine("isCharging", latestPowerEvent?.isCharging?.toString() ?: "--"))
        addView(detailLine("batteryLevel", latestPowerEvent?.batteryLevel?.let { "$it%" } ?: "--"))
        addView(detailLine("batteryStatus", latestPowerEvent?.batteryStatus ?: "--"))
        addView(detailLine("batteryHealth", latestPowerEvent?.batteryHealth ?: "--"))
        addView(detailLine("timestamp", latestPowerEvent?.timestamp?.let(::formatTime) ?: "--"))
      })

      addView(sectionTitle("事件流"))
      addView(eventConsole("Device Activity Stream", eventLines))
    }
  }

  private fun onPowerChanged(event: PowerStatusChangeEvent) {
    latestPowerEvent = event
    ConsoleSessionStore.record("Device", "powerChanged", "success")
    appendEvent("${formatTime(event.timestamp)}  Device / powerChanged / level=${event.batteryLevel}% charging=${event.isCharging}")
    refresh()
  }

  private fun appendEvent(line: String) {
    eventLines.add(0, line)
    while (eventLines.size > 20) {
      eventLines.removeLast()
    }
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

  private fun refresh() {
    val currentScroll = view as? android.widget.ScrollView ?: return
    val nextScroll = renderPage() as? android.widget.ScrollView ?: return
    val nextChild = nextScroll.getChildAt(0) ?: return
    nextScroll.removeView(nextChild)
    currentScroll.removeAllViews()
    currentScroll.addView(nextChild)
  }
}
