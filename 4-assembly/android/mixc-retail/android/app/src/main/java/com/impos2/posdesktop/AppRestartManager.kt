package com.impos2.posdesktop

import android.os.Handler
import android.os.Looper
import android.util.Log
import android.widget.Toast

class AppRestartManager(private val activity: MainActivity) {

    private val mainHandler = Handler(Looper.getMainLooper())

    fun restart() {
        mainHandler.post {
            LoadingManager.showLoading(activity)

            mainHandler.postDelayed({
                try {
                    activity.multiDisplayManager.destroy()
                } catch (e: Exception) {
                    Log.e("AppRestart", "Failed to destroy multi-display", e)
                }

                try {
                    activity.provideReactInstanceManager().recreateReactContextInBackground()
                } catch (e: Exception) {
                    Log.e("AppRestart", "Failed to restart React context", e)
                    mainHandler.post {
                        LoadingManager.hideLoading()
                        Toast.makeText(activity, "重启失败，请重试", Toast.LENGTH_LONG).show()
                    }
                }
            }, 100)
        }
    }
}
