package com.impos2.mixcretailrn84v2.startup

import android.os.Handler
import android.os.Looper
import com.impos2.mixcretailrn84v2.MainActivity
import java.util.concurrent.atomic.AtomicBoolean

object StartupCoordinator {

    private const val OVERLAY_HIDE_DELAY_MS = 1500L
    private const val SECONDARY_START_DELAY_MS = 3000L

    private val primaryReady = AtomicBoolean(false)
    private val mainHandler = Handler(Looper.getMainLooper())
    private var pendingOverlayHide: Runnable? = null
    private var pendingSecondaryStart: Runnable? = null

    fun attachPrimary(activity: MainActivity) {
        primaryReady.set(false)
        cancelPendingActions()
        StartupOverlayManager.show(activity)
    }

    fun onAppLoadComplete(activity: MainActivity, displayIndex: Int) {
        StartupAuditLogger.logLoadComplete(displayIndex)
        if (displayIndex != 0) {
            return
        }
        if (!primaryReady.compareAndSet(false, true)) {
            return
        }
        scheduleOverlayHide()
        scheduleSecondaryStart(activity)
    }

    fun beginRestart(activity: MainActivity) {
        primaryReady.set(false)
        cancelPendingActions()
        activity.resetSecondaryLaunchState()
        StartupOverlayManager.show(activity)
    }

    private fun scheduleOverlayHide() {
        pendingOverlayHide = Runnable {
            StartupOverlayManager.hide()
            pendingOverlayHide = null
        }.also {
            mainHandler.postDelayed(it, OVERLAY_HIDE_DELAY_MS)
        }
    }

    private fun scheduleSecondaryStart(activity: MainActivity) {
        pendingSecondaryStart = Runnable {
            activity.launchSecondaryIfAvailable()
            pendingSecondaryStart = null
        }.also {
            mainHandler.postDelayed(it, SECONDARY_START_DELAY_MS)
        }
    }

    private fun cancelPendingActions() {
        pendingOverlayHide?.let { mainHandler.removeCallbacks(it) }
        pendingOverlayHide = null
        pendingSecondaryStart?.let { mainHandler.removeCallbacks(it) }
        pendingSecondaryStart = null
    }
}
