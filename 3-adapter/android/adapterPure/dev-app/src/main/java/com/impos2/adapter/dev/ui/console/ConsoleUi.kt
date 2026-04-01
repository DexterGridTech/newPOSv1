package com.impos2.adapter.dev.ui.console

import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.HorizontalScrollView
import android.widget.LinearLayout
import android.widget.ScrollView
import androidx.core.view.setPadding
import androidx.fragment.app.Fragment
import com.google.android.material.button.MaterialButton
import com.google.android.material.card.MaterialCardView
import com.google.android.material.textview.MaterialTextView
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private val timeFormat = SimpleDateFormat("HH:mm:ss", Locale.getDefault())

fun Fragment.consolePage(content: LinearLayout.() -> Unit): ScrollView {
  val root = LinearLayout(requireContext()).apply {
    orientation = LinearLayout.VERTICAL
    setBackgroundColor(ConsoleTheme.pageBg)
    setPadding(24)
    content()
  }
  return ScrollView(requireContext()).apply {
    setBackgroundColor(ConsoleTheme.pageBg)
    addView(root)
  }
}

fun Fragment.consoleCard(
  title: String? = null,
  tone: ConsoleTone = ConsoleTone.NEUTRAL,
  content: LinearLayout.() -> Unit,
): MaterialCardView {
  val stroke = when (tone) {
    ConsoleTone.PRIMARY -> ConsoleTheme.primary
    ConsoleTone.SUCCESS -> ConsoleTheme.success
    ConsoleTone.WARNING -> ConsoleTheme.warning
    ConsoleTone.ERROR -> ConsoleTheme.error
    ConsoleTone.NEUTRAL -> ConsoleTheme.cardBorder
  }
  return MaterialCardView(requireContext()).apply {
    radius = 20f
    cardElevation = 0f
    strokeColor = stroke
    strokeWidth = if (tone == ConsoleTone.NEUTRAL) 2 else 3
    setCardBackgroundColor(ConsoleTheme.cardBg)
    layoutParams = ViewGroup.MarginLayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT,
      ViewGroup.LayoutParams.WRAP_CONTENT,
    ).apply { bottomMargin = 18 }
    addView(LinearLayout(context).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(24)
      if (title != null) {
        addView(MaterialTextView(context).apply {
          text = title
          textSize = 16f
          setTextColor(ConsoleTheme.textPrimary)
          setTypeface(typeface, Typeface.BOLD)
          setPadding(0, 0, 0, 8)
        })
      }
      content()
    })
  }
}

fun Fragment.consoleTopBar(title: String, subtitle: String? = null, onBack: (() -> Unit)? = null): View {
  return MaterialCardView(requireContext()).apply {
    radius = 24f
    cardElevation = 0f
    strokeColor = ConsoleTheme.primary
    strokeWidth = 2
    setCardBackgroundColor(ConsoleTheme.cardBg)
    layoutParams = ViewGroup.MarginLayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT,
      ViewGroup.LayoutParams.WRAP_CONTENT,
    ).apply { bottomMargin = 18 }
    addView(LinearLayout(context).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
      setPadding(24)
      if (onBack != null) {
        addView(MaterialButton(context, null, com.google.android.material.R.attr.materialButtonOutlinedStyle).apply {
          text = "返回"
          setTextColor(ConsoleTheme.primary)
          strokeColor = android.content.res.ColorStateList.valueOf(ConsoleTheme.primary)
          setOnClickListener { onBack() }
          layoutParams = ViewGroup.MarginLayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT,
            ViewGroup.LayoutParams.WRAP_CONTENT,
          ).apply { rightMargin = 16 }
        })
      }
      addView(LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
        addView(MaterialTextView(context).apply {
          text = title
          textSize = 22f
          setTextColor(ConsoleTheme.textPrimary)
          setTypeface(typeface, Typeface.BOLD)
        })
        if (subtitle != null) {
          addView(MaterialTextView(context).apply {
            text = subtitle
            textSize = 13f
            setTextColor(ConsoleTheme.textSecondary)
            setPadding(0, 8, 0, 0)
          })
        }
      })
      addView(statusChip(context = context, text = timeFormat.format(Date()), tone = ConsoleTone.PRIMARY))
    })
  }
}

enum class ConsoleTone { NEUTRAL, PRIMARY, SUCCESS, WARNING, ERROR }

fun statusChip(context: android.content.Context, text: String, tone: ConsoleTone): MaterialTextView {
  val (bg, fg) = when (tone) {
    ConsoleTone.PRIMARY -> ConsoleTheme.primarySoft to ConsoleTheme.primary
    ConsoleTone.SUCCESS -> ConsoleTheme.successSoft to ConsoleTheme.success
    ConsoleTone.WARNING -> ConsoleTheme.warningSoft to ConsoleTheme.warning
    ConsoleTone.ERROR -> ConsoleTheme.errorSoft to ConsoleTheme.error
    ConsoleTone.NEUTRAL -> ConsoleTheme.neutralSoft to ConsoleTheme.textSecondary
  }
  return MaterialTextView(context).apply {
    this.text = text
    textSize = 12f
    setTextColor(fg)
    setTypeface(typeface, Typeface.BOLD)
    setPadding(18, 10, 18, 10)
    background = GradientDrawable().apply {
      cornerRadius = 999f
      setColor(bg)
    }
  }
}

fun Fragment.metricRow(items: List<Pair<String, String>>): View {
  return HorizontalScrollView(requireContext()).apply {
    isHorizontalScrollBarEnabled = false
    addView(LinearLayout(context).apply {
      orientation = LinearLayout.HORIZONTAL
      items.forEachIndexed { index, (label, value) ->
        addView(metricCard(label, value).apply {
          if (index < items.lastIndex) {
            (layoutParams as? ViewGroup.MarginLayoutParams)?.rightMargin = 16
          }
        })
      }
    })
  }
}

fun Fragment.metricCard(label: String, value: String): MaterialCardView {
  return MaterialCardView(requireContext()).apply {
    radius = 18f
    cardElevation = 0f
    strokeColor = ConsoleTheme.cardBorder
    strokeWidth = 2
    setCardBackgroundColor(ConsoleTheme.cardBg)
    layoutParams = ViewGroup.MarginLayoutParams(320, ViewGroup.LayoutParams.WRAP_CONTENT)
    addView(LinearLayout(context).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(20)
      addView(MaterialTextView(context).apply {
        text = label
        textSize = 12f
        setTextColor(ConsoleTheme.textSecondary)
      })
      addView(MaterialTextView(context).apply {
        text = value
        textSize = 20f
        setTextColor(ConsoleTheme.textPrimary)
        setTypeface(typeface, Typeface.BOLD)
        setPadding(0, 8, 0, 0)
      })
    })
  }
}

fun Fragment.sectionTitle(text: String): MaterialTextView {
  return MaterialTextView(requireContext()).apply {
    this.text = text
    textSize = 15f
    setTextColor(ConsoleTheme.textSecondary)
    setTypeface(typeface, Typeface.BOLD)
    setPadding(0, 2, 0, 12)
  }
}

fun Fragment.primaryButton(text: String, onClick: () -> Unit): MaterialButton {
  return MaterialButton(requireContext()).apply {
    this.text = text
    setBackgroundColor(ConsoleTheme.primary)
    setTextColor(android.graphics.Color.WHITE)
    insetTop = 0
    insetBottom = 0
    layoutParams = ViewGroup.MarginLayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT,
      ViewGroup.LayoutParams.WRAP_CONTENT,
    ).apply { bottomMargin = 14 }
    setOnClickListener { onClick() }
  }
}

fun Fragment.outlineButton(text: String, onClick: () -> Unit): MaterialButton {
  return MaterialButton(requireContext(), null, com.google.android.material.R.attr.materialButtonOutlinedStyle).apply {
    this.text = text
    setTextColor(ConsoleTheme.primary)
    strokeColor = android.content.res.ColorStateList.valueOf(ConsoleTheme.primary)
    insetTop = 0
    insetBottom = 0
    layoutParams = ViewGroup.MarginLayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT,
      ViewGroup.LayoutParams.WRAP_CONTENT,
    ).apply { bottomMargin = 14 }
    setOnClickListener { onClick() }
  }
}

fun Fragment.moduleTagRow(tags: List<String>): View {
  return HorizontalScrollView(requireContext()).apply {
    isHorizontalScrollBarEnabled = false
    addView(LinearLayout(context).apply {
      orientation = LinearLayout.HORIZONTAL
      tags.forEachIndexed { index, tag ->
        addView(statusChip(context, tag, ConsoleTone.NEUTRAL).apply {
          if (index < tags.lastIndex) {
            layoutParams = ViewGroup.MarginLayoutParams(
              ViewGroup.LayoutParams.WRAP_CONTENT,
              ViewGroup.LayoutParams.WRAP_CONTENT,
            ).apply { rightMargin = 10 }
          }
        })
      }
    })
  }
}

fun Fragment.eventConsole(title: String, lines: List<String>): MaterialCardView {
  return MaterialCardView(requireContext()).apply {
    radius = 20f
    cardElevation = 0f
    layoutParams = ViewGroup.MarginLayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT,
      ViewGroup.LayoutParams.WRAP_CONTENT,
    )
    setCardBackgroundColor(ConsoleTheme.consoleBg)
    addView(LinearLayout(context).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(24)
      addView(MaterialTextView(context).apply {
        text = title
        textSize = 15f
        setTextColor(ConsoleTheme.consoleText)
        setTypeface(typeface, Typeface.BOLD)
      })
      addView(MaterialTextView(context).apply {
        text = if (lines.isEmpty()) "暂无活动" else lines.joinToString("\n")
        textSize = 12f
        setTextColor(ConsoleTheme.consoleText)
        setPadding(0, 14, 0, 0)
        typeface = Typeface.MONOSPACE
      })
    })
  }
}

fun formatTime(timestamp: Long): String = timeFormat.format(Date(timestamp))
