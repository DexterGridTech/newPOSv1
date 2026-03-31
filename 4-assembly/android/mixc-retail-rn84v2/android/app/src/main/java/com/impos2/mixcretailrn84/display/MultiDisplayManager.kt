package com.impos2.mixcretailrn84.display

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.hardware.display.DisplayManager
import android.os.Handler
import android.os.Looper
import android.view.Display
import com.impos2.mixcretailrn84.SecondaryActivity

class MultiDisplayManager(
    private val activity: Activity
) {
    private var secondaryActivityStarted = false
    val isSecondaryActive: Boolean get() = secondaryActivityStarted

    fun startSecondaryIfAvailable() {
        val dm = activity.getSystemService(Context.DISPLAY_SERVICE) as DisplayManager
        val displays = dm.displays
        if (displays.size < 2) return
        val secondary = displays.firstOrNull { it.displayId != Display.DEFAULT_DISPLAY } ?: return
        if (secondaryActivityStarted) return

        Handler(Looper.getMainLooper()).post {
            val intent = Intent(activity, SecondaryActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_MULTIPLE_TASK)
            }

            val options = android.app.ActivityOptions.makeBasic()
            options.launchDisplayId = secondary.displayId

            activity.startActivity(intent, options.toBundle())
            secondaryActivityStarted = true
        }
    }

    fun destroy() {
        secondaryActivityStarted = false
    }
}
