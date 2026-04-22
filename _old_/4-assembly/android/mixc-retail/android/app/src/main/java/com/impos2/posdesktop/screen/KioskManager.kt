package com.impos2.posdesktop.screen

import android.app.Activity
import android.app.ActivityManager
import android.content.Context
import android.os.Build

class KioskManager(private val activity: Activity) {

    private var isLockTaskEnabled = false

    fun startLockTask() {
        if (isLockTaskEnabled) return
        try {
            activity.startLockTask()
            isLockTaskEnabled = true
        } catch (_: Exception) {}
    }

    fun stopLockTask() {
        if (!isLockTaskEnabled) return
        try {
            activity.stopLockTask()
            isLockTaskEnabled = false
        } catch (_: Exception) {}
    }

    fun isInLockTaskMode(): Boolean {
        val am = activity.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            am.lockTaskModeState != ActivityManager.LOCK_TASK_MODE_NONE
        } else {
            @Suppress("DEPRECATION")
            am.isInLockTaskMode
        }
    }

    fun destroy() {
        if (isLockTaskEnabled) stopLockTask()
    }
}
