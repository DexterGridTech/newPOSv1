package com.impos2.mixcretailrn84v2.startup

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.hardware.display.DisplayManager
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.Display
import com.impos2.mixcretailrn84v2.SecondaryActivity
import java.util.concurrent.atomic.AtomicBoolean

class SecondaryDisplayLauncher(
    private val activity: Activity,
) {
    companion object {
        private const val TAG = "SecondaryDisplayLauncher"
    }

    private val launchRequested = AtomicBoolean(false)

    val isSecondaryActive: Boolean
        get() = SecondaryProcessController.isSecondaryAlive() || launchRequested.get()

    fun startIfAvailable() {
        val displayManager = activity.getSystemService(Context.DISPLAY_SERVICE) as DisplayManager
        val displays = displayManager.displays
        if (displays.size < 2) {
            return
        }
        val secondary = displays.firstOrNull { it.displayId != Display.DEFAULT_DISPLAY } ?: return
        if (isSecondaryActive) {
            return
        }

        Handler(Looper.getMainLooper()).post {
            runCatching {
                launchRequested.set(true)
                val intent = Intent(activity, SecondaryActivity::class.java).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_MULTIPLE_TASK)
                }
                val options = android.app.ActivityOptions.makeBasic().apply {
                    launchDisplayId = secondary.displayId
                }
                activity.startActivity(intent, options.toBundle())
            }.onFailure {
                launchRequested.set(false)
                Log.e(TAG, "Failed to start SecondaryActivity", it)
            }
        }
    }

    fun markSecondaryStarted() {
        launchRequested.set(false)
        SecondaryProcessController.markSecondaryStarted()
    }

    fun markSecondaryStopped() {
        launchRequested.set(false)
        SecondaryProcessController.markSecondaryStopped()
    }

    fun reset() {
        launchRequested.set(false)
        SecondaryProcessController.markSecondaryStopped()
    }
}
