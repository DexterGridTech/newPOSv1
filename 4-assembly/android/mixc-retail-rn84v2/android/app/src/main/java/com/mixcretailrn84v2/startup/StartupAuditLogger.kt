package com.impos2.mixcretailrn84v2.startup

import android.os.Process
import android.util.Log
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

object StartupAuditLogger {

    private const val TAG = "StartupAudit"
    private val formatter = SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS", Locale.US)

    fun logActivityCreated(activityName: String, displayIndex: Int) {
        Log.i(
            TAG,
            "activity_created activity=$activityName displayIndex=$displayIndex pid=${Process.myPid()} time=${formatter.format(Date())}",
        )
    }

    fun logLoadComplete(displayIndex: Int) {
        Log.i(
            TAG,
            "app_load_complete displayIndex=$displayIndex pid=${Process.myPid()} time=${formatter.format(Date())}",
        )
    }

    fun logRestartRequested(hasSecondaryInstance: Boolean) {
        Log.i(
            TAG,
            "restart_requested pid=${Process.myPid()} hasSecondaryInstance=$hasSecondaryInstance time=${formatter.format(Date())}",
        )
    }

    fun logLocalWebServerStopping() {
        Log.i(
            TAG,
            "local_web_server_stopping pid=${Process.myPid()} time=${formatter.format(Date())}",
        )
    }

    fun logLocalWebServerStopped() {
        Log.i(
            TAG,
            "local_web_server_stopped pid=${Process.myPid()} time=${formatter.format(Date())}",
        )
    }

    fun logSecondaryShutdownRequested() {
        Log.i(
            TAG,
            "secondary_shutdown_requested pid=${Process.myPid()} time=${formatter.format(Date())}",
        )
    }

    fun logSecondaryAckReceived() {
        Log.i(
            TAG,
            "secondary_ack_received pid=${Process.myPid()} time=${formatter.format(Date())}",
        )
    }

    fun logSecondaryShutdownTimeout() {
        Log.w(
            TAG,
            "secondary_shutdown_timeout pid=${Process.myPid()} time=${formatter.format(Date())}",
        )
    }

    fun logSecondaryProcessExit() {
        Log.i(
            TAG,
            "secondary_process_exit pid=${Process.myPid()} time=${formatter.format(Date())}",
        )
    }

    fun logMainReload() {
        Log.i(
            TAG,
            "main_reacthost_reload pid=${Process.myPid()} time=${formatter.format(Date())}",
        )
    }
}
