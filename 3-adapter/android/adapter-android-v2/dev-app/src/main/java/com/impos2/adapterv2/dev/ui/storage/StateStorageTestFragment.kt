package com.impos2.adapterv2.dev.ui.storage

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
import com.impos2.adapterv2.storage.StateStorageManager

class StateStorageTestFragment : Fragment() {

  private lateinit var keyInput: TextInputEditText
  private lateinit var valueInput: TextInputEditText
  private val storage by lazy { StateStorageManager.getInstance(requireContext()) }
  private var latestKey: String = "--"
  private var latestValue: String = "--"
  private var latestAction: String = "--"
  private var latestKeys: Set<String> = emptySet()
  private val eventLines = mutableListOf<String>()

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    storage.initialize()
  }

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
          title = "StateStorage 验证台",
          subtitle = "原生 Key-Value 存储读写与键集合验证",
          onBack = { requireActivity().onBackPressedDispatcher.onBackPressed() },
        )
      )

      addView(sectionTitle("运行摘要"))
      addView(
        metricRow(
          listOf(
            "最近 Key" to latestKey,
            "最近值" to latestValue,
            "最近动作" to latestAction,
            "键数量" to latestKeys.size.toString(),
          )
        )
      )

      addView(sectionTitle("输入区"))
      addView(consoleCard("Key / Value") {
        addView(TextInputLayout(context).apply {
          hint = "key"
          keyInput = TextInputEditText(context)
          addView(keyInput)
        })
        addView(TextInputLayout(context).apply {
          hint = "value"
          valueInput = TextInputEditText(context)
          addView(valueInput)
        })
      })

      addView(sectionTitle("操作区"))
      addView(consoleCard("String / Int / Boolean") {
        addView(primaryButton("写入 String") {
          val key = keyInput.text?.toString().orEmpty()
          val value = valueInput.text?.toString().orEmpty()
          storage.setString(key, value)
          updateState(key, value, "setString")
        })
        addView(outlineButton("读取 String") {
          val key = keyInput.text?.toString().orEmpty()
          updateState(key, storage.getString(key) ?: "", "getString")
        })
        addView(outlineButton("写入 Int") {
          val key = keyInput.text?.toString().orEmpty()
          val value = valueInput.text?.toString()?.toIntOrNull() ?: 0
          storage.setInt(key, value)
          updateState(key, value.toString(), "setInt")
        })
        addView(outlineButton("读取 Int") {
          val key = keyInput.text?.toString().orEmpty()
          updateState(key, storage.getInt(key).toString(), "getInt")
        })
        addView(outlineButton("写入 Boolean") {
          val key = keyInput.text?.toString().orEmpty()
          val value = valueInput.text?.toString()?.toBooleanStrictOrNull() ?: false
          storage.setBoolean(key, value)
          updateState(key, value.toString(), "setBoolean")
        })
        addView(outlineButton("读取 Boolean") {
          val key = keyInput.text?.toString().orEmpty()
          updateState(key, storage.getBoolean(key).toString(), "getBoolean")
        })
      })

      addView(consoleCard("键管理") {
        addView(primaryButton("是否存在") {
          val key = keyInput.text?.toString().orEmpty()
          updateState(key, storage.contains(key).toString(), "contains")
        })
        addView(outlineButton("全部 keys") {
          latestKeys = storage.getAllKeys()
          latestAction = "getAllKeys"
          appendEvent("StateStorage / getAllKeys / success keys=${latestKeys.joinToString(",")}")
          ConsoleSessionStore.record("StateStorage", "getAllKeys", "success")
          refresh()
        })
        addView(outlineButton("删除 key") {
          val key = keyInput.text?.toString().orEmpty()
          storage.remove(key)
          updateState(key, "removed", "remove")
        })
        addView(outlineButton("清空全部") {
          storage.clearAll()
          latestKey = "--"
          latestValue = "--"
          latestAction = "clearAll"
          latestKeys = emptySet()
          appendEvent("StateStorage / clearAll / success")
          ConsoleSessionStore.record("StateStorage", "clearAll", "success")
          refresh()
        })
      })

      addView(sectionTitle("结构化结果"))
      addView(consoleCard("最近结果") {
        addView(detailLine("key", latestKey))
        addView(detailLine("value", latestValue))
        addView(detailLine("action", latestAction))
        addView(detailLine("keys", if (latestKeys.isEmpty()) "--" else latestKeys.joinToString(", ")))
      })

      addView(sectionTitle("事件流"))
      addView(eventConsole("StateStorage Activity Stream", eventLines))
    }
  }

  private fun updateState(key: String, value: String, action: String) {
    latestKey = key.ifEmpty { "--" }
    latestValue = value.ifEmpty { "<empty>" }
    latestAction = action
    latestKeys = storage.getAllKeys()
    appendEvent("StateStorage / $action / success key=$key value=$value")
    ConsoleSessionStore.record("StateStorage", action, "success")
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
