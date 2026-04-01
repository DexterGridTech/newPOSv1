package com.impos2.adapter.dev.ui

import android.graphics.Typeface
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import androidx.fragment.app.Fragment
import com.google.android.material.textview.MaterialTextView
import com.impos2.adapter.dev.ui.console.ConsoleSessionStore
import com.impos2.adapter.dev.ui.console.ConsoleTheme
import com.impos2.adapter.dev.ui.console.ConsoleTone
import com.impos2.adapter.dev.ui.console.consoleCard
import com.impos2.adapter.dev.ui.console.consolePage
import com.impos2.adapter.dev.ui.console.consoleTopBar
import com.impos2.adapter.dev.ui.console.eventConsole
import com.impos2.adapter.dev.ui.console.formatTime
import com.impos2.adapter.dev.ui.console.metricRow
import com.impos2.adapter.dev.ui.console.moduleTagRow
import com.impos2.adapter.dev.ui.console.outlineButton
import com.impos2.adapter.dev.ui.console.sectionTitle
import com.impos2.adapter.dev.ui.console.statusChip

class TestHomeFragment(
  private val onModuleClick: (TestModule) -> Unit
) : Fragment() {
  override fun onCreateView(
    inflater: LayoutInflater,
    container: ViewGroup?,
    savedInstanceState: Bundle?
  ): View {
    val recentActivities = ConsoleSessionStore.getRecentActivities()
    val recentErrors = recentActivities.count { it.status.contains("error", ignoreCase = true) }
    val latestModule = recentActivities.firstOrNull()?.module ?: "暂无"
    val completedModules = TestModule.entries.count { ConsoleSessionStore.getLatestStatus(it.title) != null }

    return consolePage {
      addView(
        consoleTopBar(
          title = "adapterPure 原生能力验证台",
          subtitle = "Native Capability Verification Console",
        )
      )

      addView(consoleCard(tone = ConsoleTone.PRIMARY) {
        addView(MaterialTextView(context).apply {
          text = "用于验证 adapterPure 原生能力，不依赖 RN 运行时。每个模块必须在本地可验证，并在整合层复测。"
          textSize = 14f
          setTextColor(ConsoleTheme.textSecondary)
        })
      })

      addView(sectionTitle("全局概览"))
      addView(
        metricRow(
          listOf(
            "模块总数" to TestModule.entries.size.toString(),
            "已覆盖模块" to completedModules.toString(),
            "最近活跃" to latestModule,
            "最近错误数" to recentErrors.toString(),
          )
        )
      )

      addView(sectionTitle("模块矩阵"))
      TestModule.entries.forEach { module ->
        val latestStatus = ConsoleSessionStore.getLatestStatus(module.title) ?: "未执行"
        addView(consoleCard(tone = module.statusTone(latestStatus)) {
          addView(MaterialTextView(context).apply {
            text = module.title
            textSize = 19f
            setTextColor(ConsoleTheme.textPrimary)
            setTypeface(typeface, Typeface.BOLD)
          })
          addView(MaterialTextView(context).apply {
            text = module.description
            textSize = 13f
            setTextColor(ConsoleTheme.textSecondary)
            setPadding(0, 10, 0, 14)
          })

          addView(LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(0, 0, 0, 10)
            addView(statusChip(context, latestStatus, module.statusTone(latestStatus)).apply {
              layoutParams = ViewGroup.MarginLayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
              ).apply { rightMargin = 12 }
            })
            addView(statusChip(context, module.userRoleHint, ConsoleTone.PRIMARY))
          })

          addView(moduleTagRow(module.capabilityTags))

          addView(MaterialTextView(context).apply {
            text = module.quickHint
            textSize = 12f
            setTextColor(ConsoleTheme.textSecondary)
            setPadding(0, 14, 0, 16)
          })

          addView(outlineButton("进入验证") {
            onModuleClick(module)
          })
        })
      }

      addView(sectionTitle("最近活动"))
      addView(
        eventConsole(
          title = "最近 6 条验证活动",
          lines = recentActivities.map {
            "${formatTime(it.timestamp)}  ${it.module} / ${it.action} / ${it.status}"
          }
        )
      )
    }
  }

  private fun TestModule.statusTone(status: String) = when {
    status.contains("success", ignoreCase = true) -> ConsoleTone.SUCCESS
    status.contains("error", ignoreCase = true) -> ConsoleTone.ERROR
    status.contains("running", ignoreCase = true) -> ConsoleTone.PRIMARY
    status.contains("warning", ignoreCase = true) -> ConsoleTone.WARNING
    else -> ConsoleTone.NEUTRAL
  }
}
