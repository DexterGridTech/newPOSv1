package com.impos2.mixcretailrn84v2.startup

import android.app.Activity
import android.os.Handler
import android.os.Looper
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import com.impos2.mixcretailrn84v2.R
import java.lang.ref.WeakReference
import java.util.concurrent.atomic.AtomicBoolean

object StartupOverlayManager {

    private const val FADE_OUT_DURATION_MS = 240L

    private val mainHandler = Handler(Looper.getMainLooper())
    private var activityRef: WeakReference<Activity>? = null
    private var overlayRef: WeakReference<View>? = null
    private val isHiding = AtomicBoolean(false)

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

    private fun removeOverlay(overlay: View) {
        overlay.animate().cancel()
        (overlay.parent as? ViewGroup)?.removeView(overlay)
        if (overlayRef?.get() === overlay) {
            overlayRef = null
        }
    }
}
