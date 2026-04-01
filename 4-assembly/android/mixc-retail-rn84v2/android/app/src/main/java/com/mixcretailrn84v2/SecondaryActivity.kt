package com.impos2.mixcretailrn84v2

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.os.Process
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.impos2.mixcretailrn84v2.startup.LaunchOptionsFactory
import com.impos2.mixcretailrn84v2.startup.SecondaryProcessController
import com.impos2.mixcretailrn84v2.startup.StartupAuditLogger
import java.util.concurrent.atomic.AtomicBoolean

class SecondaryActivity : ReactActivity() {

  private val shutdownRequested = AtomicBoolean(false)

  private val restartReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
      if (shutdownRequested.compareAndSet(false, true)) {
        StartupAuditLogger.logSecondaryShutdownRequested()
        finishAndRemoveTask()
      }
    }
  }

  override fun getMainComponentName(): String = "MixcRetailRN84v2"

  override fun createReactActivityDelegate(): ReactActivityDelegate =
    object : DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled) {
      override fun getLaunchOptions(): Bundle = LaunchOptionsFactory.create(this@SecondaryActivity, 1)
    }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    StartupAuditLogger.logActivityCreated("SecondaryActivity", 1)
    MainActivity.instance?.onSecondaryActivityCreated()
    SecondaryProcessController.markSecondaryStarted()
    val filter = SecondaryProcessController.createRestartRequestFilter()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      registerReceiver(restartReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
    } else {
      @Suppress("DEPRECATION")
      registerReceiver(restartReceiver, filter)
    }
  }

  override fun onDestroy() {
    runCatching { unregisterReceiver(restartReceiver) }
    MainActivity.instance?.onSecondaryActivityDestroyed()
    SecondaryProcessController.markSecondaryStopped()
    if (shutdownRequested.get()) {
      sendBroadcast(SecondaryProcessController.createRestartAckIntent(this))
      StartupAuditLogger.logSecondaryProcessExit()
      Process.killProcess(Process.myPid())
    }
    super.onDestroy()
  }
}
