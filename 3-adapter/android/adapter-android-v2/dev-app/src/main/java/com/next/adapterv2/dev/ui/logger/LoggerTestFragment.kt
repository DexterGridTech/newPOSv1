package com.next.adapterv2.dev.ui.logger

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import androidx.fragment.app.Fragment
import com.google.android.material.textfield.TextInputEditText
import com.google.android.material.textfield.TextInputLayout
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
import com.next.adapterv2.interfaces.LogFile
import com.next.adapterv2.logger.LogManager

class LoggerTestFragment : Fragment() {

  private lateinit var fileNameInput: TextInputEditText
  private val logManager by lazy { LogManager.getInstance(requireContext()) }
  private var latestFiles: List<LogFile> = emptyList()
  private var latestContentPreview: String = "--"
  private var latestDir: String = "--"
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
          title = "Logger 验证台",
          subtitle = "日志写入、文件列表、内容读取与清理验证",
          onBack = { requireActivity().onBackPressedDispatcher.onBackPressed() },
        )
      )

      addView(sectionTitle("运行摘要"))
      addView(
        metricRow(
          listOf(
            "日志文件数" to latestFiles.size.toString(),
            "最近文件" to (latestFiles.firstOrNull()?.fileName ?: "--"),
            "日志目录" to latestDir,
            "预览长度" to latestContentPreview.length.toString(),
          )
        )
      )

      addView(sectionTitle("操作区"))
      addView(consoleCard("日志写入与目录") {
        addView(primaryButton("写入四级日志") {
          logManager.debug("LoggerTest", "debug message")
          logManager.log("LoggerTest", "info message")
          logManager.warn("LoggerTest", "warn message")
          logManager.error("LoggerTest", "error message")
          appendEvent("Logger / write levels / success")
          ConsoleSessionStore.record("Logger", "write levels", "success")
          refresh()
        })
        addView(outlineButton("获取日志列表") {
          latestFiles = logManager.getLogFiles()
          appendEvent("Logger / list files / success count=${latestFiles.size}")
          ConsoleSessionStore.record("Logger", "list files", "success")
          refresh()
        })
        addView(outlineButton("输出日志目录") {
          latestDir = logManager.getLogDirPath()
          appendEvent("Logger / get dir / success path=$latestDir")
          ConsoleSessionStore.record("Logger", "get dir", "success")
          refresh()
        })
      })

      addView(consoleCard("文件操作") {
        addView(TextInputLayout(context).apply {
          hint = "输入日志文件名（例如 2026-03-31.log）"
          fileNameInput = TextInputEditText(context)
          addView(fileNameInput)
        })
        addView(primaryButton("读取文件内容") {
          val fileName = fileNameInput.text?.toString()?.trim().orEmpty()
          if (fileName.isEmpty()) {
            latestContentPreview = "请输入 fileName"
            appendEvent("Logger / read content / warning empty-file-name")
            ConsoleSessionStore.record("Logger", "read content", "warning")
          } else {
            latestContentPreview = logManager.getLogContent(fileName).ifEmpty { "<empty>" }.take(800)
            appendEvent("Logger / read content / success file=$fileName")
            ConsoleSessionStore.record("Logger", "read content", "success")
          }
          refresh()
        })
        addView(outlineButton("删除文件") {
          val fileName = fileNameInput.text?.toString()?.trim().orEmpty()
          if (fileName.isEmpty()) {
            appendEvent("Logger / delete file / warning empty-file-name")
            ConsoleSessionStore.record("Logger", "delete file", "warning")
          } else {
            val deleted = logManager.deleteLogFile(fileName)
            appendEvent("Logger / delete file / success=$deleted file=$fileName")
            ConsoleSessionStore.record("Logger", "delete file", if (deleted) "success" else "error")
          }
          refresh()
        })
        addView(outlineButton("清空全部日志") {
          val cleared = logManager.clearAllLogs()
          appendEvent("Logger / clear all / success=$cleared")
          ConsoleSessionStore.record("Logger", "clear all", if (cleared) "success" else "error")
          latestFiles = emptyList()
          latestContentPreview = "--"
          refresh()
        })
      })

      addView(sectionTitle("结构化结果"))
      addView(consoleCard("日志文件列表") {
        if (latestFiles.isEmpty()) {
          addView(detailLine("files", "暂无数据"))
        } else {
          latestFiles.take(5).forEachIndexed { index, file ->
            addView(detailLine("#$index ${file.fileName}", "size=${file.fileSize}, modified=${file.lastModified}"))
          }
        }
      })

      addView(consoleCard("内容预览") {
        addView(MaterialTextView(context).apply {
          text = latestContentPreview
          textSize = 12f
          setTextColor(ConsoleTheme.textPrimary)
          typeface = android.graphics.Typeface.MONOSPACE
        })
      })

      addView(sectionTitle("事件流"))
      addView(eventConsole("Logger Activity Stream", eventLines))
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
