package com.impos2.posdesktop

import android.os.Handler
import android.os.Looper

class AppRestartManager(private val activity: MainActivity) {

    private val mainHandler = Handler(Looper.getMainLooper())

    fun restart() {
        mainHandler.post {
            try { activity.multiDisplayManager.destroy() } catch (_: Exception) {}
            activity.provideReactInstanceManager().recreateReactContextInBackground()
        }
    }
}
