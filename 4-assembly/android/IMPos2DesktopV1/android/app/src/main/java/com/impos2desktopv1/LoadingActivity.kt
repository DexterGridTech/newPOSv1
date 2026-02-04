package com.impos2desktopv1

import android.animation.AnimatorSet
import android.animation.ObjectAnimator
import android.animation.ValueAnimator
import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.animation.AccelerateDecelerateInterpolator
import android.view.animation.LinearInterpolator
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView

/**
 * 加载中间页 - 高级设计版
 * 用于 ReactInstanceManager 重启时显示，避免应用退回桌面
 *
 * 特性：
 * - 渐变背景
 * - 淡入淡出动画
 * - Material Design 风格
 * - 流畅的视觉体验
 */
class LoadingActivity : Activity() {

    companion object {
        private const val TAG = "LoadingActivity"
        const val EXTRA_MESSAGE = "message"
        const val EXTRA_AUTO_RETURN = "auto_return"
        const val EXTRA_DELAY_MS = "delay_ms"

        // 品牌色
        private const val COLOR_PRIMARY = "#4A90E2"
        private const val COLOR_PRIMARY_DARK = "#357ABD"
        private const val COLOR_ACCENT = "#50C878"
        private const val COLOR_BACKGROUND_START = "#F5F7FA"
        private const val COLOR_BACKGROUND_END = "#E8EDF2"
    }

    private val mainHandler = Handler(Looper.getMainLooper())
    private var textView: TextView? = null
    private var progressBar: ProgressBar? = null
    private var containerLayout: LinearLayout? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Log.d(TAG, "LoadingActivity onCreate")

        // 获取参数
        val message = intent.getStringExtra(EXTRA_MESSAGE) ?: "正在重启应用..."
        val autoReturn = intent.getBooleanExtra(EXTRA_AUTO_RETURN, true)
        val delayMs = intent.getLongExtra(EXTRA_DELAY_MS, 2500)

        // 创建高级加载界面
        createModernLoadingView(message)

        // 启动入场动画
        startEnterAnimation()

        // 自动返回
        if (autoReturn) {
            mainHandler.postDelayed({
                startExitAnimation {
                    returnToMainActivity()
                }
            }, delayMs)
        }
    }

    /**
     * 创建现代化的加载界面
     */
    private fun createModernLoadingView(message: String) {
        // 根布局 - 带渐变背景
        val rootLayout = FrameLayout(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
            background = createGradientBackground()
        }

        // 中心容器
        containerLayout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                gravity = Gravity.CENTER
            }
            alpha = 0f // 初始透明，用于淡入动画
        }

        // 添加图标容器（带阴影效果）
        val iconContainer = createIconContainer()
        containerLayout?.addView(iconContainer)

        // 添加进度条
        progressBar = createModernProgressBar()
        containerLayout?.addView(progressBar)

        // 添加文字
        textView = createStyledTextView(message)
        containerLayout?.addView(textView)

        // 添加副标题
        val subtitle = createSubtitleTextView()
        containerLayout?.addView(subtitle)

        rootLayout.addView(containerLayout)
        setContentView(rootLayout)
    }

    /**
     * 创建渐变背景
     */
    private fun createGradientBackground(): GradientDrawable {
        return GradientDrawable(
            GradientDrawable.Orientation.TOP_BOTTOM,
            intArrayOf(
                Color.parseColor(COLOR_BACKGROUND_START),
                Color.parseColor(COLOR_BACKGROUND_END)
            )
        )
    }

    /**
     * 创建图标容器（带圆形背景和阴影）
     */
    private fun createIconContainer(): FrameLayout {
        val container = FrameLayout(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                dpToPx(120),
                dpToPx(120)
            ).apply {
                bottomMargin = dpToPx(32)
            }
        }

        // 圆形背景
        val background = View(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
            val drawable = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                colors = intArrayOf(
                    Color.parseColor(COLOR_PRIMARY),
                    Color.parseColor(COLOR_PRIMARY_DARK)
                )
                gradientType = GradientDrawable.LINEAR_GRADIENT
                setStroke(dpToPx(3), Color.WHITE)
            }
            this.background = drawable
            elevation = dpToPx(8).toFloat()
        }
        container.addView(background)

        // 图标（使用 Android 默认图标）
        val icon = ImageView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                dpToPx(60),
                dpToPx(60)
            ).apply {
                gravity = Gravity.CENTER
            }
            setImageResource(android.R.drawable.ic_popup_sync)
            setColorFilter(Color.WHITE)
        }
        container.addView(icon)

        return container
    }

    /**
     * 创建现代化进度条
     */
    private fun createModernProgressBar(): ProgressBar {
        return ProgressBar(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                dpToPx(48),
                dpToPx(48)
            ).apply {
                bottomMargin = dpToPx(24)
            }
            indeterminateDrawable?.setTint(Color.parseColor(COLOR_PRIMARY))
        }
    }

    /**
     * 创建样式化的主文本
     */
    private fun createStyledTextView(message: String): TextView {
        return TextView(this).apply {
            text = message
            textSize = 18f
            setTextColor(Color.parseColor("#2C3E50"))
            typeface = android.graphics.Typeface.create("sans-serif-medium", android.graphics.Typeface.NORMAL)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                bottomMargin = dpToPx(8)
            }
        }
    }

    /**
     * 创建副标题文本
     */
    private fun createSubtitleTextView(): TextView {
        return TextView(this).apply {
            text = "请稍候..."
            textSize = 14f
            setTextColor(Color.parseColor("#7F8C8D"))
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        }
    }

    /**
     * 返回到 MainActivity
     */
    private fun returnToMainActivity() {
        try {
            Log.d(TAG, "返回到 MainActivity")
            val intent = Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            }
            startActivity(intent)
            finish()
        } catch (e: Exception) {
            Log.e(TAG, "返回 MainActivity 失败", e)
        }
    }

    /**
     * 启动退场动画
     */
    private fun startExitAnimation(onComplete: () -> Unit) {
        containerLayout?.let { container ->
            // 淡出动画
            val fadeOut = ObjectAnimator.ofFloat(container, "alpha", 1f, 0f).apply {
                duration = 300
                interpolator = AccelerateDecelerateInterpolator()
            }

            // 缩放动画
            val scaleX = ObjectAnimator.ofFloat(container, "scaleX", 1f, 0.9f).apply {
                duration = 300
                interpolator = AccelerateDecelerateInterpolator()
            }

            val scaleY = ObjectAnimator.ofFloat(container, "scaleY", 1f, 0.9f).apply {
                duration = 300
                interpolator = AccelerateDecelerateInterpolator()
            }

            // 组合动画
            AnimatorSet().apply {
                playTogether(fadeOut, scaleX, scaleY)
                addListener(object : android.animation.Animator.AnimatorListener {
                    override fun onAnimationEnd(animation: android.animation.Animator) {
                        onComplete()
                    }
                    override fun onAnimationStart(animation: android.animation.Animator) {}
                    override fun onAnimationCancel(animation: android.animation.Animator) {}
                    override fun onAnimationRepeat(animation: android.animation.Animator) {}
                })
                start()
            }
        } ?: onComplete()
    }

    /**
     * 启动入场动画
     */
    private fun startEnterAnimation() {
        containerLayout?.let { container ->
            // 淡入动画
            val fadeIn = ObjectAnimator.ofFloat(container, "alpha", 0f, 1f).apply {
                duration = 400
                interpolator = AccelerateDecelerateInterpolator()
            }

            // 缩放动画
            val scaleX = ObjectAnimator.ofFloat(container, "scaleX", 0.8f, 1f).apply {
                duration = 400
                interpolator = AccelerateDecelerateInterpolator()
            }

            val scaleY = ObjectAnimator.ofFloat(container, "scaleY", 0.8f, 1f).apply {
                duration = 400
                interpolator = AccelerateDecelerateInterpolator()
            }

            // 组合动画
            AnimatorSet().apply {
                playTogether(fadeIn, scaleX, scaleY)
                start()
            }
        }

        // 进度条旋转动画
        progressBar?.let { pb ->
            val rotation = ObjectAnimator.ofFloat(pb, "rotation", 0f, 360f).apply {
                duration = 1500
                repeatCount = ValueAnimator.INFINITE
                interpolator = LinearInterpolator()
            }
            rotation.start()
        }
    }

    /**
     * dp 转 px
     */
    private fun dpToPx(dp: Int): Int {
        return TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            dp.toFloat(),
            resources.displayMetrics
        ).toInt()
    }

    override fun onDestroy() {
        super.onDestroy()
        mainHandler.removeCallbacksAndMessages(null)
        Log.d(TAG, "LoadingActivity onDestroy")
    }
}
