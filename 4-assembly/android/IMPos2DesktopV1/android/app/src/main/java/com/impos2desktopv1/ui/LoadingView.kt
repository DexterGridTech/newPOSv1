package com.impos2desktopv1.ui

import android.content.Context
import android.graphics.Color
import android.view.Gravity
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView

/**
 * 加载视图组件
 *
 * 职责：
 * 1. 创建简洁的加载界面
 * 2. 提供动画效果
 *
 * 设计原则：
 * - 单一职责：只负责 UI 创建
 * - 简洁设计：去除复杂的动画和样式
 */
class LoadingView(context: Context) : FrameLayout(context) {

    private val containerLayout: LinearLayout
    private val progressBar: ProgressBar
    private val textView: TextView

    init {
        // 设置背景色
        setBackgroundColor(Color.parseColor("#F5F7FA"))

        // 创建中心容器
        containerLayout = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            layoutParams = LayoutParams(
                LayoutParams.WRAP_CONTENT,
                LayoutParams.WRAP_CONTENT
            ).apply {
                gravity = Gravity.CENTER
            }
        }

        // 创建进度条
        progressBar = ProgressBar(context).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                bottomMargin = dpToPx(24)
            }
        }
        containerLayout.addView(progressBar)

        // 创建文本
        textView = TextView(context).apply {
            textSize = 16f
            setTextColor(Color.parseColor("#2C3E50"))
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        }
        containerLayout.addView(textView)

        addView(containerLayout)
    }

    /**
     * 设置加载文本
     */
    fun setMessage(message: String) {
        textView.text = message
    }

    /**
     * 显示动画
     */
    fun show() {
        alpha = 0f
        animate()
            .alpha(1f)
            .setDuration(300)
            .start()
    }

    /**
     * 隐藏动画
     */
    fun hide(onComplete: () -> Unit) {
        animate()
            .alpha(0f)
            .setDuration(300)
            .withEndAction(onComplete)
            .start()
    }

    private fun dpToPx(dp: Int): Int {
        return (dp * context.resources.displayMetrics.density).toInt()
    }
}
