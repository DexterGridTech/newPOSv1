package com.next.adapterv2.dev.ui.scripts

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import androidx.fragment.app.Fragment
import com.google.android.material.textview.MaterialTextView
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
import com.next.adapterv2.interfaces.ScriptExecutionOptions
import com.next.adapterv2.scripts.ScriptEngineManager

class ScriptEngineTestFragment : Fragment() {

  private val scriptEngine by lazy { ScriptEngineManager.getInstance(requireContext()) }
  private var latestScript: String = "--"
  private var latestResult: String = "--"
  private var latestError: String = "--"
  private var latestStats: String = "--"
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
          title = "ScriptEngine 验证台",
          subtitle = "脚本执行、异常处理与统计验证",
          onBack = { requireActivity().onBackPressedDispatcher.onBackPressed() },
        )
      )

      addView(sectionTitle("运行摘要"))
      addView(
        metricRow(
          listOf(
            "最近脚本" to latestScript,
            "最近结果" to latestResult,
            "最近错误" to latestError,
            "统计摘要" to latestStats,
          )
        )
      )

      addView(sectionTitle("操作区"))
      addView(consoleCard("脚本执行") {
        addView(primaryButton("执行简单脚本") {
          val result = scriptEngine.executeScript(ScriptExecutionOptions(script = "return 1 + 2 + 3;"))
          updateResult("simple", result.success.toString(), result.error ?: "--", result.resultJson)
        })
        addView(outlineButton("执行参数脚本") {
          val result = scriptEngine.executeScript(
            ScriptExecutionOptions(
              script = "return params.a + params.b;",
              paramsJson = "{\"a\":10,\"b\":20}"
            )
          )
          updateResult("params", result.success.toString(), result.error ?: "--", result.resultJson)
        })
        addView(outlineButton("执行异常脚本") {
          val result = scriptEngine.executeScript(ScriptExecutionOptions(script = "throw new Error('boom')"))
          updateResult("error", result.success.toString(), result.error ?: "--", result.resultJson)
        })
      })

      addView(consoleCard("统计控制") {
        addView(primaryButton("查看统计") {
          val s = scriptEngine.getStats()
          latestStats = "total=${s.total}, success=${s.success}, failure=${s.failure}, avg=${"%.2f".format(s.avgTimeMs)}ms"
          appendEvent("ScriptEngine / getStats / success $latestStats")
          ConsoleSessionStore.record("ScriptEngine", "getStats", "success")
          refresh()
        })
        addView(outlineButton("清空统计") {
          scriptEngine.clearStats()
          latestStats = "cleared"
          appendEvent("ScriptEngine / clearStats / success")
          ConsoleSessionStore.record("ScriptEngine", "clearStats", "success")
          refresh()
        })
      })

      addView(sectionTitle("结构化结果"))
      addView(consoleCard("最近执行结果") {
        addView(detailLine("script", latestScript))
        addView(detailLine("result", latestResult))
        addView(detailLine("error", latestError))
      })

      addView(consoleCard("结果预览") {
        addView(MaterialTextView(context).apply {
          text = latestResult
          textSize = 12f
          setTextColor(ConsoleTheme.textPrimary)
          typeface = android.graphics.Typeface.MONOSPACE
        })
      })

      addView(sectionTitle("事件流"))
      addView(eventConsole("ScriptEngine Activity Stream", eventLines))
    }
  }

  private fun updateResult(scriptType: String, success: String, error: String, result: String) {
    latestScript = scriptType
    latestResult = result.ifEmpty { "<empty>" }
    latestError = error
    appendEvent("ScriptEngine / $scriptType / success=$success error=$error result=$result")
    ConsoleSessionStore.record("ScriptEngine", scriptType, if (success == "true") "success" else "error")
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
