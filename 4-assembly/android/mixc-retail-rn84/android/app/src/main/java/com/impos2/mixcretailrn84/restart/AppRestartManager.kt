package com.impos2.mixcretailrn84.restart

import android.os.Handler
import android.os.Looper
import android.util.Log
import android.widget.Toast
import com.impos2.mixcretailrn84.MainActivity
import com.impos2.mixcretailrn84.loading.LoadingManager

class AppRestartManager(private val activity: MainActivity) {

    private val mainHandler = Handler(Looper.getMainLooper())

    companion object {
        private const val TAG = "AppRestartManager"
    }

    fun restart() {
        mainHandler.post {
            LoadingManager.showLoading(activity)
            mainHandler.postDelayed({
                try {
                    activity.multiDisplayManager.destroy()
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to destroy multi-display", e)
                }
                try {
                    activity.getReactHost().reload("user restart")
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to reload ReactHost", e)
                    mainHandler.post {
                        LoadingManager.hideLoading()
                        Toast.makeText(activity, "重启失败，请重试", Toast.LENGTH_LONG).show()
                    }
                }
            }, 100)
        }
    }
}
