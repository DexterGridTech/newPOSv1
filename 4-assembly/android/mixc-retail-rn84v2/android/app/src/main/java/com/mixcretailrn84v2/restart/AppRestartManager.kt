package com.impos2.mixcretailrn84v2.restart

import android.os.Handler
import android.os.Looper
import android.util.Log
import android.widget.Toast
import com.impos2.mixcretailrn84v2.MainActivity
import com.impos2.mixcretailrn84v2.loading.LoadingManager

class AppRestartManager(private val activity: MainActivity) {

  private val mainHandler = Handler(Looper.getMainLooper())

  companion object {
    private const val TAG = "AppRestartManager"
  }

  fun restart() {
    mainHandler.post {
      LoadingManager.showLoadingActivity(activity)
      mainHandler.postDelayed({
        try {
          activity.reloadReactHostForRestart()
        } catch (error: Throwable) {
          Log.e(TAG, "Failed to reload ReactHost", error)
          mainHandler.post {
            LoadingManager.hideLoading()
            Toast.makeText(activity, "重启失败，请重试", Toast.LENGTH_LONG).show()
          }
        }
      }, 100)
    }
  }
}
