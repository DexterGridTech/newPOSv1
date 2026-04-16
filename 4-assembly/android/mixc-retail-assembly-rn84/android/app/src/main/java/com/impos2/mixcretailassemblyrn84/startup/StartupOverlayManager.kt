package com.impos2.mixcretailassemblyrn84.startup

import android.app.Activity
import android.os.Handler
import android.os.Looper
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import com.impos2.mixcretailassemblyrn84.R
import java.lang.ref.WeakReference
import java.util.concurrent.atomic.AtomicBoolean

/**
 * 原生启动遮罩管理器。
 *
 * 这个遮罩用于覆盖“系统 Splash 结束后到主屏 JS 完成加载前”的过渡阶段，避免用户看到：
 * - 白屏；
 * - 业务页面尚未 ready 的中间态；
 * - 重启过程中主屏 bundle 重载的闪烁。
 *
 * 当前实现采用把 `launch_screen` 动态挂到 Activity 根视图之上的方式，而不是单独起一个 LoadingActivity。
 * 这样有几个好处：
 * - 生命周期更直接，不需要跨 Activity 切换；
 * - 与主屏 fade-out 动画更容易衔接；
 * - 重启时可以直接再次 show，无需额外 Activity 管理。
 */
object StartupOverlayManager {

  private const val FADE_OUT_DURATION_MS = 240L

  private val mainHandler = Handler(Looper.getMainLooper())

  /**
   * 当前附着的 Activity 弱引用。
   *
   * 使用弱引用是为了避免静态单例长期持有 Activity 导致泄漏。
   */
  private var activityRef: WeakReference<Activity>? = null

  /**
   * 当前遮罩 View 的弱引用。
   */
  private var overlayRef: WeakReference<View>? = null

  /**
   * 防止 hide 被重复触发，导致动画回调和 removeView 互相打架。
   */
  private val isHiding = AtomicBoolean(false)

  /**
   * 展示启动遮罩。
   *
   * 如果当前 Activity 上已经挂过遮罩，则复用现有 View；否则重新 inflate 一个。复用的好处是：
   * 重启过程中 show/hide 高频切换时不会反复创建 View 对象。
   */
  fun show(activity: Activity) {
    mainHandler.post {
      activityRef = WeakReference(activity)
      val root = activity.findViewById<ViewGroup>(android.R.id.content) ?: return@post
      val overlay = overlayRef?.get()?.takeIf { it.parent != null } ?: LayoutInflater.from(activity)
        .inflate(R.layout.launch_screen, root, false)
        .also {
          root.addView(
            it,
            FrameLayout.LayoutParams(
              ViewGroup.LayoutParams.MATCH_PARENT,
              ViewGroup.LayoutParams.MATCH_PARENT,
            ),
          )
          overlayRef = WeakReference(it)
        }
      overlay.animate().cancel()
      overlay.alpha = 1f
      overlay.visibility = View.VISIBLE
      overlay.isClickable = true
      overlay.isFocusable = true
      overlay.bringToFront()
      isHiding.set(false)
    }
  }

  /**
   * 淡出并移除启动遮罩。
   */
  fun hide() {
    mainHandler.post {
      val overlay = overlayRef?.get()
      if (overlay == null || overlay.parent == null) {
        isHiding.set(false)
        return@post
      }
      if (!isHiding.compareAndSet(false, true)) {
        return@post
      }
      overlay.animate()
        .alpha(0f)
        .setDuration(FADE_OUT_DURATION_MS)
        .withEndAction {
          removeOverlay(overlay)
          isHiding.set(false)
        }
        .start()
    }
  }

  /**
   * Activity 销毁时解除关联并尝试把遮罩从该 Activity 上移除。
   */
  fun detach(activity: Activity) {
    mainHandler.post {
      if (activityRef?.get() === activity) {
        activityRef = null
      }
      overlayRef?.get()?.let { overlay ->
        if (overlay.context === activity) {
          removeOverlay(overlay)
        }
      }
    }
  }

  /**
   * 真正执行遮罩移除的底层方法。
   */
  private fun removeOverlay(overlay: View) {
    overlay.animate().cancel()
    (overlay.parent as? ViewGroup)?.removeView(overlay)
    if (overlayRef?.get() === overlay) {
      overlayRef = null
    }
  }
}
