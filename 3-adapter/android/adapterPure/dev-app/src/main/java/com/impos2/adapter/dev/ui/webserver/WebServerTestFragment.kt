package com.impos2.adapter.dev.ui.webserver

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import androidx.fragment.app.Fragment
import com.google.android.material.textview.MaterialTextView
import com.impos2.adapter.dev.ui.console.ConsoleSessionStore
import com.impos2.adapter.dev.ui.console.ConsoleTheme
import com.impos2.adapter.dev.ui.console.consoleCard
import com.impos2.adapter.dev.ui.console.consolePage
import com.impos2.adapter.dev.ui.console.consoleTopBar
import com.impos2.adapter.dev.ui.console.eventConsole
import com.impos2.adapter.dev.ui.console.metricRow
import com.impos2.adapter.dev.ui.console.outlineButton
import com.impos2.adapter.dev.ui.console.primaryButton
import com.impos2.adapter.dev.ui.console.sectionTitle
import com.impos2.adapter.interfaces.LocalWebServerConfig
import com.impos2.adapter.interfaces.LocalWebServerInfo
import com.impos2.adapter.interfaces.ServerStats
import com.impos2.adapter.webserver.LocalWebServerManager
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

class WebServerTestFragment : Fragment() {

  private val server by lazy { LocalWebServerManager.getInstance(requireContext()) }
  private val ioExecutor = Executors.newSingleThreadExecutor()
  private var latestStatus: LocalWebServerInfo? = null
  private var latestStats: ServerStats? = null
  private var latestHttpResult: String = "--"
  private val eventLines = mutableListOf<String>()

  override fun onCreateView(
    inflater: LayoutInflater,
    container: ViewGroup?,
    savedInstanceState: Bundle?
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
          title = "LocalWebServer 验证台",
          subtitle = "本地服务、健康检查、注册路由与统计验证",
          onBack = { requireActivity().onBackPressedDispatcher.onBackPressed() },
        )
      )

      addView(consoleCard {
        addView(MaterialTextView(context).apply {
          text = "本页用于验证 LocalWebServer 的启动、状态读取、HTTP 路由访问和运行统计。"
          textSize = 14f
          setTextColor(ConsoleTheme.textSecondary)
        })
      })

      addView(sectionTitle("运行摘要"))
      addView(
        metricRow(
          listOf(
            "状态" to (latestStatus?.status?.name ?: "未启动"),
            "端口" to (latestStatus?.config?.port?.toString() ?: "8888"),
            "请求数" to (latestStats?.requestCount?.toString() ?: "0"),
            "Uptime" to (latestStats?.uptime?.toString() ?: "0"),
          )
        )
      )

      addView(sectionTitle("操作区"))
      addView(consoleCard("服务控制") {
        addView(primaryButton("启动服务") {
          appendEvent("WebServer / start / running")
          ConsoleSessionStore.record("LocalWebServer", "start", "running")
          ioExecutor.execute {
            runActionOnUi(
              action = "start",
              recordAction = "start",
              block = {
                val addresses = server.start(LocalWebServerConfig())
                latestStatus = server.getStatus()
                "addresses=${addresses.joinToString { it.address }}"
              }
            )
          }
        })
        addView(outlineButton("查看状态") {
          appendEvent("WebServer / status / running")
          ConsoleSessionStore.record("LocalWebServer", "status", "running")
          ioExecutor.execute {
            runActionOnUi(
              action = "status",
              recordAction = "status",
              block = {
                latestStatus = server.getStatus()
                "state=${latestStatus?.status}"
              }
            )
          }
        })
        addView(outlineButton("查看统计") {
          appendEvent("WebServer / stats / running")
          ConsoleSessionStore.record("LocalWebServer", "stats", "running")
          ioExecutor.execute {
            runActionOnUi(
              action = "stats",
              recordAction = "stats",
              block = {
                latestStats = server.getStats()
                "requestCount=${latestStats?.requestCount}"
              }
            )
          }
        })
        addView(outlineButton("停止服务") {
          appendEvent("WebServer / stop / running")
          ConsoleSessionStore.record("LocalWebServer", "stop", "running")
          ioExecutor.execute {
            runActionOnUi(
              action = "stop",
              recordAction = "stop",
              block = {
                server.stop()
                latestStatus = server.getStatus()
                "done"
              }
            )
          }
        })
      })

      addView(consoleCard("HTTP 路由验证") {
        addView(primaryButton("请求 /health") {
          requestGet("http://127.0.0.1:8888/localServer/health", "GET /health")
        })
        addView(outlineButton("请求 /stats") {
          requestGet("http://127.0.0.1:8888/localServer/stats", "GET /stats")
        })
        addView(outlineButton("POST /register") {
          requestPost("http://127.0.0.1:8888/localServer/register", "", "POST /register")
        })
      })

      addView(sectionTitle("结构化结果"))
      addView(consoleCard("状态信息") {
        addView(detailLine("status", latestStatus?.status?.name ?: "--"))
        addView(detailLine("error", latestStatus?.error ?: "--"))
        addView(detailLine("port", latestStatus?.config?.port?.toString() ?: "--"))
        addView(detailLine("basePath", latestStatus?.config?.basePath ?: "--"))
        addView(detailLine("addresses", latestStatus?.addresses?.joinToString { it.address } ?: "--"))
      })

      addView(consoleCard("统计信息") {
        addView(detailLine("masterCount", latestStats?.masterCount?.toString() ?: "--"))
        addView(detailLine("slaveCount", latestStats?.slaveCount?.toString() ?: "--"))
        addView(detailLine("pendingCount", latestStats?.pendingCount?.toString() ?: "--"))
        addView(detailLine("uptime", latestStats?.uptime?.toString() ?: "--"))
        addView(detailLine("requestCount", latestStats?.requestCount?.toString() ?: "--"))
      })

      addView(consoleCard("最近 HTTP 结果") {
        addView(detailLine("latestHttpResult", latestHttpResult))
      })

      addView(sectionTitle("事件流"))
      addView(eventConsole("WebServer Activity Stream", eventLines))
    }
  }

  private fun runActionOnUi(action: String, recordAction: String, block: () -> String) {
    val result = runCatching { block() }
    activity?.runOnUiThread {
      result.onSuccess {
        appendEvent("WebServer / $action / success $it")
        ConsoleSessionStore.record("LocalWebServer", recordAction, "success")
      }.onFailure {
        appendEvent("WebServer / $action / error=${it.message}")
        ConsoleSessionStore.record("LocalWebServer", recordAction, "error")
      }
      refresh()
    }
  }

  private fun requestGet(url: String, action: String) {
    appendEvent("WebServer / $action / running")
    ConsoleSessionStore.record("LocalWebServer", action, "running")
    ioExecutor.execute {
      val result = runCatching {
        val conn = URL(url).openConnection() as HttpURLConnection
        conn.connectTimeout = 3000
        conn.readTimeout = 3000
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
        appendEvent("WebServer / $action / $result")
        ConsoleSessionStore.record("LocalWebServer", action, if (result.startsWith("error=")) "error" else "success")
        refresh()
      }
    }
  }

  private fun requestPost(url: String, body: String, action: String) {
    appendEvent("WebServer / $action / running")
    ConsoleSessionStore.record("LocalWebServer", action, "running")
    ioExecutor.execute {
      val result = runCatching {
        val conn = URL(url).openConnection() as HttpURLConnection
        conn.connectTimeout = 3000
        conn.readTimeout = 3000
        conn.requestMethod = "POST"
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
        appendEvent("WebServer / $action / $result")
        ConsoleSessionStore.record("LocalWebServer", action, if (result.startsWith("error=")) "error" else "success")
        refresh()
      }
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
