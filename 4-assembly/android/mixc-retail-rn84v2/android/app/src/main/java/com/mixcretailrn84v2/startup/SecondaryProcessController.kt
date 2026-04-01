package com.impos2.mixcretailrn84v2.startup

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.Handler
import android.os.Looper
import java.util.concurrent.atomic.AtomicBoolean

object SecondaryProcessController {

    private const val ACTION_REQUEST_SECONDARY_RESTART = "com.impos2.mixcretailrn84v2.action.REQUEST_SECONDARY_RESTART"
    private const val ACTION_SECONDARY_RESTART_ACK = "com.impos2.mixcretailrn84v2.action.SECONDARY_RESTART_ACK"
    private const val ACK_TIMEOUT_MS = 1800L
    private const val PROCESS_EXIT_GRACE_MS = 500L

    private val mainHandler = Handler(Looper.getMainLooper())
    private val waitingForAck = AtomicBoolean(false)
    private val secondaryAlive = AtomicBoolean(false)

    fun markSecondaryStarted() {
        secondaryAlive.set(true)
    }

    fun markSecondaryStopped() {
        secondaryAlive.set(false)
    }

    fun isSecondaryAlive(): Boolean = secondaryAlive.get()

    fun requestShutdownIfNeeded(
        context: Context,
        hasSecondaryInstance: Boolean,
        onComplete: () -> Unit,
    ) {
        val shouldShutdown = hasSecondaryInstance || isSecondaryAlive()
        if (!shouldShutdown) {
            onComplete()
            return
        }
        if (!waitingForAck.compareAndSet(false, true)) {
            return
        }

        val appContext = context.applicationContext
        var completed = false
        lateinit var receiver: BroadcastReceiver

        fun complete(timeout: Boolean) {
            if (completed) {
                return
            }
            completed = true
            waitingForAck.set(false)
            runCatching { appContext.unregisterReceiver(receiver) }
            if (timeout) {
                StartupAuditLogger.logSecondaryShutdownTimeout()
            }
            onComplete()
        }

        receiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                if (intent?.action == ACTION_SECONDARY_RESTART_ACK) {
                    StartupAuditLogger.logSecondaryAckReceived()
                    mainHandler.postDelayed({ complete(false) }, PROCESS_EXIT_GRACE_MS)
                }
            }
        }

        val filter = IntentFilter(ACTION_SECONDARY_RESTART_ACK)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            appContext.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            @Suppress("DEPRECATION")
            appContext.registerReceiver(receiver, filter)
        }

        mainHandler.postDelayed({ complete(true) }, ACK_TIMEOUT_MS)

        appContext.sendBroadcast(
            Intent(ACTION_REQUEST_SECONDARY_RESTART).apply {
                `package` = appContext.packageName
            },
        )
    }

    fun createRestartRequestFilter(): IntentFilter = IntentFilter(ACTION_REQUEST_SECONDARY_RESTART)

    fun createRestartAckIntent(context: Context): Intent =
        Intent(ACTION_SECONDARY_RESTART_ACK).apply {
            `package` = context.packageName
        }
}
