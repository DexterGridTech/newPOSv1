package com.impos2.mixcretailrn84v2.startup

import android.os.Process
import android.util.Log
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * 启动与重启审计日志。
 *
 * 这个对象的价值不在于“打印一堆日志”，而在于把关键时序点标准化，方便后续排查：
 * - 主屏什么时候创建；
 * - 副屏什么时候创建；
 * - JS 什么时候回调 onAppLoadComplete；
 * - 重启何时发起；
 * - 副屏何时收到退出请求；
 * - ACK 是否收到；
 * - ReactHost 何时重载。
 *
 * 统一使用 `StartupAudit` tag，可以通过：
 * `adb logcat -s StartupAudit`
 * 快速过滤整条链路。
 */
object StartupAuditLogger {

  private const val TAG = "StartupAudit"
  private val formatter = SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS", Locale.US)

  /**
   * 记录某个 Activity 已创建。
   */
  fun logActivityCreated(activityName: String, displayIndex: Int) {
    Log.i(
      TAG,
      "activity_created activity=$activityName displayIndex=$displayIndex pid=${Process.myPid()} time=${formatter.format(Date())}",
    )
  }

  /**
   * 记录 JS 侧调用 onAppLoadComplete。
   */
  fun logLoadComplete(displayIndex: Int) {
    Log.i(
      TAG,
      "app_load_complete displayIndex=$displayIndex pid=${Process.myPid()} time=${formatter.format(Date())}",
    )
  }

  /**
   * 记录用户发起的重启请求，并额外附带当前是否存在副屏。
   */
  fun logRestartRequested(hasSecondary: Boolean) {
    Log.i(
      TAG,
      "restart_requested hasSecondary=$hasSecondary pid=${Process.myPid()} time=${formatter.format(Date())}",
    )
  }

  /**
   * 记录 local web server 开始停止。
   */
  fun logLocalWebServerStopping() {
    Log.i(
      TAG,
      "local_web_server_stopping pid=${Process.myPid()} time=${formatter.format(Date())}",
    )
  }

  /**
   * 记录 local web server 已停止。
   */
  fun logLocalWebServerStopped() {
    Log.i(
      TAG,
      "local_web_server_stopped pid=${Process.myPid()} time=${formatter.format(Date())}",
    )
  }

  /**
   * 记录副屏收到关停请求。
   */
  fun logSecondaryShutdownRequested() {
    Log.i(
      TAG,
      "secondary_shutdown_requested pid=${Process.myPid()} time=${formatter.format(Date())}",
    )
  }

  /**
   * 记录主进程已经收到副进程 ACK。
   */
  fun logSecondaryAckReceived() {
    Log.i(
      TAG,
      "secondary_ack_received pid=${Process.myPid()} time=${formatter.format(Date())}",
    )
  }

  /**
   * 记录等待副进程 ACK 超时。
   */
  fun logSecondaryShutdownTimeout() {
    Log.w(
      TAG,
      "secondary_shutdown_timeout pid=${Process.myPid()} time=${formatter.format(Date())}",
    )
  }

  /**
   * 记录副进程即将退出。
   */
  fun logSecondaryProcessExit() {
    Log.i(
      TAG,
      "secondary_process_exit pid=${Process.myPid()} time=${formatter.format(Date())}",
    )
  }

  /**
   * 记录主进程 ReactHost 即将 reload。
   */
  fun logMainReload() {
    Log.i(
      TAG,
      "main_reacthost_reload pid=${Process.myPid()} time=${formatter.format(Date())}",
    )
  }
}
