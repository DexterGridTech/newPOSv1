package com.next.adapterv2.dev.ui.appcontrol

import android.app.Application
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import androidx.fragment.app.Fragment
import com.google.android.material.textview.MaterialTextView
import com.next.adapterv2.appcontrol.AppControlManager
import com.next.adapterv2.dev.ui.console.ConsoleSessionStore
import com.next.adapterv2.dev.ui.console.ConsoleTheme
import com.next.adapterv2.dev.ui.console.consoleCard
import com.next.adapterv2.dev.ui.console.consolePage
import com.next.adapterv2.dev.ui.console.consoleTopBar
import com.next.adapterv2.dev.ui.console.eventConsole
import com.next.adapterv2.dev.ui.console.metricRow
import com.next.adapterv2.dev.ui.console.outlineButton
import com.next.adapterv2.dev.ui.console.primaryButton
import com.next.adapterv2.dev.ui.console.sectionTitle

class AppControlTestFragment : Fragment() {

  private val appControl by lazy {
    AppControlManager.getInstance(requireActivity().application as Application)
  }
  private var latestAction: String = "--"
  private var latestStatusSummary: String = "fullscreen=false, kiosk=false"
  private var latestHint: String = "锁定模式依赖系统 lock task 能力；模拟器里通常不会有明显效果。"
  private val eventLines = mutableListOf<String>()

  override fun onCreateView(
    inflater: LayoutInflater,
    container: ViewGroup?,
    savedInstanceState: Bundle?
  ): View {
    return renderPage()
  }

  private fun renderPage(): View {
    return consolePage {
      addView(
        consoleTopBar(
          title = "AppControl 验证台",
          subtitle = "全屏、锁定、Loading 与应用控制验证",
          onBack = { requireActivity().onBackPressedDispatcher.onBackPressed() },
        )
      )

      addView(sectionTitle("运行摘要"))
      addView(
        metricRow(
          listOf(
            "Fullscreen" to appControl.isFullscreen().toString(),
            "Kiosk" to appControl.isKioskMode().toString(),
            "最近动作" to latestAction,
            "当前状态" to latestStatusSummary,
            "控制层" to "AppControlManager",
          )
        )
      )

      addView(sectionTitle("操作区"))
      addView(consoleCard("状态查询") {
        addView(primaryButton("查看状态") {
          captureStatus("status")
        })
      })

      addView(consoleCard("Loading 控制") {
        addView(primaryButton("显示 Loading") {
          appControl.showLoading("adapter-android-v2 loading...")
          recordAction("showLoading")
        })
        addView(outlineButton("隐藏 Loading") {
          appControl.hideLoading(0)
          recordAction("hideLoading")
        })
      })

      addView(consoleCard("显示与锁定控制") {
        addView(primaryButton("开启全屏") {
          appControl.setFullscreen(true)
          recordAction("setFullscreen true")
        })
        addView(outlineButton("关闭全屏") {
          appControl.setFullscreen(false)
          recordAction("setFullscreen false")
        })
        addView(primaryButton("开启锁屏模式") {
          appControl.setKioskMode(true)
          recordAction("setKioskMode true")
        })
        addView(outlineButton("关闭锁屏模式") {
          appControl.setKioskMode(false)
          recordAction("setKioskMode false")
        })
      })


      addView(sectionTitle("结构化结果"))
      addView(consoleCard("当前状态") {
        addView(detailLine("fullscreen", appControl.isFullscreen().toString()))
        addView(detailLine("kiosk", appControl.isKioskMode().toString()))
        addView(detailLine("latestAction", latestAction))
        addView(detailLine("statusSummary", latestStatusSummary))
        addView(detailLine("hint", latestHint))
      })

      addView(sectionTitle("事件流"))
      addView(eventConsole("AppControl Activity Stream", eventLines))
    }
  }

  private fun recordAction(action: String) {
    latestAction = action
    captureStatus(action)
    ConsoleSessionStore.record("AppControl", action, "success")
    refresh()
  }

  private fun captureStatus(action: String) {
    val fullscreen = appControl.isFullscreen()
    val kiosk = appControl.isKioskMode()
    latestAction = action
    latestStatusSummary = "fullscreen=$fullscreen, kiosk=$kiosk"
    latestHint = if (kiosk) {
      "lock task 已进入激活状态。"
    } else {
      "如果锁定模式按钮已点击但 kiosk=false，通常是系统未授予 lock task 条件；模拟器里经常如此。"
    }
    appendEvent("AppControl / $action / status => $latestStatusSummary")
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
    while (eventLines.size > 20) {
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
