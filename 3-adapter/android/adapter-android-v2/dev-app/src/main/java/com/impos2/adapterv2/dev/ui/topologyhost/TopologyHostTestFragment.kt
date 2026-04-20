package com.impos2.adapterv2.dev.ui.topologyhost

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import androidx.fragment.app.Fragment
import com.google.android.material.textfield.TextInputEditText
import com.google.android.material.textfield.TextInputLayout
import com.google.android.material.textview.MaterialTextView
import com.impos2.adapterv2.dev.ui.console.ConsoleSessionStore
import com.impos2.adapterv2.dev.ui.console.ConsoleTheme
import com.impos2.adapterv2.dev.ui.console.consoleCard
import com.impos2.adapterv2.dev.ui.console.consolePage
import com.impos2.adapterv2.dev.ui.console.consoleTopBar
import com.impos2.adapterv2.dev.ui.console.eventConsole
import com.impos2.adapterv2.dev.ui.console.metricRow
import com.impos2.adapterv2.dev.ui.console.outlineButton
import com.impos2.adapterv2.dev.ui.console.primaryButton
import com.impos2.adapterv2.dev.ui.console.sectionTitle
import com.impos2.adapterv2.topologyhostv3.TopologyHostV3Config
import com.impos2.adapterv2.topologyhostv3.TopologyHostV3DiagnosticsSnapshot
import com.impos2.adapterv2.topologyhostv3.TopologyHostV3Manager
import com.impos2.adapterv2.topologyhostv3.TopologyHostV3StatusInfo
import com.impos2.adapterv2.topologyhostv3.TopologyHostV3Stats
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

class TopologyHostTestFragment : Fragment() {
  private val hostManager by lazy { TopologyHostV3Manager.getInstance(requireContext()) }
  private val ioExecutor = Executors.newSingleThreadExecutor()

  private lateinit var faultRuleKindInput: TextInputEditText
  private lateinit var faultRuleChannelInput: TextInputEditText
  private lateinit var faultRuleDelayInput: TextInputEditText

  private var latestStatus: TopologyHostV3StatusInfo? = null
  private var latestStats: TopologyHostV3Stats? = null
  private var latestDiagnostics: TopologyHostV3DiagnosticsSnapshot? = null
  private var latestHttpResult: String = "--"
  private val eventLines = mutableListOf<String>()

  override fun onCreateView(
    inflater: LayoutInflater,
    container: ViewGroup?,
    savedInstanceState: Bundle?,
  ): View {
    return renderPage()
  }

  override fun onDestroy() {
    ioExecutor.shutdownNow()
    super.onDestroy()
  }

  private fun renderPage(): View {
    return consolePage {
      addView(
        consoleTopBar(
          title = "TopologyHost V3 验证台",
          subtitle = "双屏 V3 host、pair relay、fault rule 与 liveness 诊断",
          onBack = { requireActivity().onBackPressedDispatcher.onBackPressed() },
        )
      )

      addView(consoleCard {
        addView(MaterialTextView(context).apply {
          text = "本页只验证 topologyHostV3。旧 ticket-based topologyhost 已冻结为 legacy，不再作为 adapter dev-app 的活跃验证面。"
          textSize = 14f
          setTextColor(ConsoleTheme.textSecondary)
        })
      })

      addView(sectionTitle("运行摘要"))
      addView(metricRow(
        listOf(
          "状态" to (latestStatus?.state?.name ?: "未启动"),
          "端口" to (latestStatus?.config?.port?.toString() ?: "8888"),
          "sessionCount" to (latestStats?.sessionCount?.toString() ?: "0"),
          "peerCount" to (latestStats?.peerCount?.toString() ?: "0"),
        ),
      ))

      addView(sectionTitle("服务控制"))
      addView(consoleCard("启动与状态") {
        addView(primaryButton("启动 topologyHost") {
          appendEvent("TopologyHost / start / running")
          ConsoleSessionStore.record("TopologyHost", "start", "running")
          ioExecutor.execute {
            runActionOnUi("start", "start") {
              hostManager.start(TopologyHostV3Config())
              latestStatus = hostManager.getStatus()
              latestStats = hostManager.getStats()
              "ws=${latestStatus?.addressInfo?.wsUrl}"
            }
          }
        })
        addView(outlineButton("读取状态") {
          appendEvent("TopologyHost / status / running")
          ConsoleSessionStore.record("TopologyHost", "status", "running")
          ioExecutor.execute {
            runActionOnUi("status", "status") {
              latestStatus = hostManager.getStatus()
              "state=${latestStatus?.state}"
            }
          }
        })
        addView(outlineButton("读取统计") {
          appendEvent("TopologyHost / stats / running")
          ConsoleSessionStore.record("TopologyHost", "stats", "running")
          ioExecutor.execute {
            runActionOnUi("stats", "stats") {
              latestStats = hostManager.getStats()
              latestDiagnostics = hostManager.getDiagnosticsSnapshot()
              "sessions=${latestStats?.sessionCount}, peers=${latestStats?.peerCount}"
            }
          }
        })
        addView(outlineButton("停止 topologyHost") {
          appendEvent("TopologyHost / stop / running")
          ConsoleSessionStore.record("TopologyHost", "stop", "running")
          ioExecutor.execute {
            runActionOnUi("stop", "stop") {
              hostManager.stop()
              latestStatus = hostManager.getStatus()
              "done"
            }
          }
        })
      })

      addView(sectionTitle("HTTP 验证"))
      addView(consoleCard("V3 状态与 fault rules") {
        addView(TextInputLayout(context).apply {
          hint = "fault kind，例如 relay-delay / relay-drop"
          faultRuleKindInput = TextInputEditText(context).apply {
            setText("relay-delay")
          }
          addView(faultRuleKindInput)
        })
        addView(TextInputLayout(context).apply {
          hint = "channel，可空，例如 dispatch"
          faultRuleChannelInput = TextInputEditText(context).apply {
            setText("dispatch")
          }
          addView(faultRuleChannelInput)
        })
        addView(TextInputLayout(context).apply {
          hint = "delayMs，可空"
          faultRuleDelayInput = TextInputEditText(context).apply {
            setText("800")
          }
          addView(faultRuleDelayInput)
        })
        addView(outlineButton("POST /fault-rules") {
          val kind = faultRuleKindInput.text?.toString()?.trim().orEmpty()
          val channel = faultRuleChannelInput.text?.toString()?.trim().orEmpty()
          val delayMs = faultRuleDelayInput.text?.toString()?.trim().orEmpty()
          val rule = buildFaultRuleJson(kind, channel, delayMs)
          requestPost(
            url = "http://127.0.0.1:8888/mockMasterServer/fault-rules",
            body = """{"rules":[$rule]}""",
            action = "POST /fault-rules",
          )
        })
        addView(outlineButton("DELETE /fault-rules") {
          requestPost(
            url = "http://127.0.0.1:8888/mockMasterServer/fault-rules",
            method = "DELETE",
            body = "{}",
            action = "DELETE /fault-rules",
          )
        })
        addView(outlineButton("GET /status") {
          requestGet("http://127.0.0.1:8888/mockMasterServer/status", "GET /status")
        })
        addView(outlineButton("GET /stats") {
          requestGet("http://127.0.0.1:8888/mockMasterServer/stats", "GET /stats")
        })
        addView(outlineButton("GET /diagnostics") {
          requestGet("http://127.0.0.1:8888/mockMasterServer/diagnostics", "GET /diagnostics")
        })
      })

      addView(sectionTitle("结构化结果"))
      addView(consoleCard("状态") {
        addView(detailLine("state", latestStatus?.state?.name ?: "--"))
        addView(detailLine("wsUrl", latestStatus?.addressInfo?.wsUrl ?: "--"))
        addView(detailLine("httpBaseUrl", latestStatus?.addressInfo?.httpBaseUrl ?: "--"))
        addView(detailLine("error", latestStatus?.error ?: "--"))
      })

      addView(consoleCard("统计") {
        addView(detailLine("sessionCount", latestStats?.sessionCount?.toString() ?: "--"))
        addView(detailLine("peerCount", latestStats?.peerCount?.toString() ?: "--"))
        addView(detailLine("stalePeerCount", latestStats?.stalePeerCount?.toString() ?: "--"))
        addView(detailLine("faultRuleCount", latestStats?.activeFaultRuleCount?.toString() ?: "--"))
      })

      addView(consoleCard("诊断快照") {
        addView(detailLine("hostNodeId", latestDiagnostics?.hostRuntime?.nodeId ?: "--"))
        addView(detailLine("sessionId", latestDiagnostics?.sessionId ?: "--"))
        addView(detailLine("peers", latestDiagnostics?.peers?.size?.toString() ?: "--"))
        addView(detailLine("faultRules", latestDiagnostics?.faultRules?.size?.toString() ?: "--"))
      })

      addView(consoleCard("最近 HTTP 结果") {
        addView(MaterialTextView(context).apply {
          text = latestHttpResult
          textSize = 12f
          typeface = android.graphics.Typeface.MONOSPACE
          setTextColor(ConsoleTheme.textPrimary)
        })
      })

      addView(sectionTitle("事件流"))
      addView(eventConsole("TopologyHost Activity Stream", eventLines))
    }
  }

  private fun buildFaultRuleJson(kind: String, channel: String, delayMs: String): String {
    val createdAt = System.currentTimeMillis()
    val base = StringBuilder()
      .append("{")
      .append("\"kind\":\"").append(kind.ifBlank { "relay-delay" }).append("\",")
      .append("\"ruleId\":\"dev-rule-").append(createdAt).append("\",")
      .append("\"createdAt\":").append(createdAt)
    if (channel.isNotBlank()) {
      base.append(",\"channel\":\"").append(channel).append("\"")
    }
    if (delayMs.isNotBlank()) {
      base.append(",\"delayMs\":").append(delayMs.toLongOrNull() ?: 500L)
    }
    base.append("}")
    return base.toString()
  }

  private fun requestGet(url: String, action: String) {
    appendEvent("TopologyHost / $action / running")
    ConsoleSessionStore.record("TopologyHost", action, "running")
    ioExecutor.execute {
      val result = runCatching {
        val conn = URL(url).openConnection() as HttpURLConnection
        conn.connectTimeout = 3_000
        conn.readTimeout = 3_000
        conn.requestMethod = "GET"
        val code = conn.responseCode
        val body = (if (code in 200..299) conn.inputStream else conn.errorStream)
          ?.bufferedReader()
          ?.use { it.readText() }
          .orEmpty()
        conn.disconnect()
        "code=$code, body=$body"
      }.getOrElse { "error=${it.message}" }
      activity?.runOnUiThread {
        latestHttpResult = result
        appendEvent("TopologyHost / $action / $result")
        ConsoleSessionStore.record("TopologyHost", action, if (result.startsWith("error=")) "error" else "success")
        refresh()
      }
    }
  }

  private fun requestPost(url: String, body: String, action: String, method: String = "POST") {
    appendEvent("TopologyHost / $action / running")
    ConsoleSessionStore.record("TopologyHost", action, "running")
    ioExecutor.execute {
      val result = runCatching {
        val conn = URL(url).openConnection() as HttpURLConnection
        conn.connectTimeout = 3_000
        conn.readTimeout = 3_000
        conn.requestMethod = method
        conn.doOutput = true
        conn.setRequestProperty("Content-Type", "application/json")
        OutputStreamWriter(conn.outputStream).use { it.write(body) }
        val code = conn.responseCode
        val responseBody = (if (code in 200..299) conn.inputStream else conn.errorStream)
          ?.bufferedReader()
          ?.use { it.readText() }
          .orEmpty()
        conn.disconnect()
        "code=$code, body=$responseBody"
      }.getOrElse { "error=${it.message}" }
      activity?.runOnUiThread {
        latestHttpResult = result
        appendEvent("TopologyHost / $action / $result")
        ConsoleSessionStore.record("TopologyHost", action, if (result.startsWith("error=")) "error" else "success")
        refresh()
      }
    }
  }

  private fun runActionOnUi(action: String, recordAction: String, block: () -> String) {
    val result = runCatching { block() }
    activity?.runOnUiThread {
      result.onSuccess {
        appendEvent("TopologyHost / $action / success $it")
        ConsoleSessionStore.record("TopologyHost", recordAction, "success")
      }.onFailure {
        appendEvent("TopologyHost / $action / error=${it.message}")
        ConsoleSessionStore.record("TopologyHost", recordAction, "error")
      }
      refresh()
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
