package com.impos2.hostruntimern84.startup

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
 * - ReactHost 何时切 bundle / 触发 reload。
 *
 * 统一使用 `StartupAudit` tag，可以通过：
 * `adb logcat -s StartupAudit`
 * 快速过滤整条链路。
 */
object StartupAuditLogger {

  private const val TAG = "StartupAudit"
  private val formatter = SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS", Locale.US)

  private fun formatNow(): String = formatter.format(Date())

  /**
   * 记录某个 Activity 已创建。
   */
  fun logActivityCreated(activityName: String, displayIndex: Int) {
    Log.i(
      TAG,
      "activity_created activity=$activityName displayIndex=$displayIndex pid=${Process.myPid()} time=${formatNow()}",
    )
  }

  /**
   * 记录 JS 侧调用 onAppLoadComplete。
   */
  fun logLoadComplete(displayIndex: Int) {
    Log.i(
      TAG,
      "app_load_complete displayIndex=$displayIndex pid=${Process.myPid()} time=${formatNow()}",
    )
  }

  /**
   * 记录主屏 ready 后实际触发副屏启动的时间点。
   */
  fun logSecondaryLaunchScheduled() {
    Log.i(
      TAG,
      "secondary_launch_scheduled pid=${Process.myPid()} time=${formatNow()}",
    )
  }

  /**
   * 记录副屏启动器真正开始尝试 startActivity 的时间点。
   */
  fun logSecondaryLaunchAttempt(displayCount: Int, displayId: Int) {
    Log.i(
      TAG,
      "secondary_launch_attempt displayCount=$displayCount displayId=$displayId pid=${Process.myPid()} time=${formatNow()}",
    )
  }

  /**
   * 记录用户发起的重启请求，并额外附带当前是否存在副屏。
   */
  fun logRestartRequested(hasSecondary: Boolean) {
    Log.i(
      TAG,
      "restart_requested hasSecondary=$hasSecondary pid=${Process.myPid()} time=${formatNow()}",
    )
  }

  /**
   * 记录 topology host 开始停止。
   */
  fun logTopologyHostStopping() {
    Log.i(
      TAG,
      "topology_host_stopping pid=${Process.myPid()} time=${formatNow()}",
    )
  }

  /**
   * 记录 topology host 已停止。
   */
  fun logTopologyHostStopped() {
    Log.i(
      TAG,
      "topology_host_stopped pid=${Process.myPid()} time=${formatNow()}",
    )
  }

  /**
   * 记录副屏收到关停请求。
   */
  fun logSecondaryShutdownRequested() {
    Log.i(
      TAG,
      "secondary_shutdown_requested pid=${Process.myPid()} time=${formatNow()}",
    )
  }

  /**
   * 记录主进程已经收到副进程 ACK。
   */
  fun logSecondaryAckReceived() {
    Log.i(
      TAG,
      "secondary_ack_received pid=${Process.myPid()} time=${formatNow()}",
    )
  }

  /**
   * 记录等待副进程 ACK 超时。
   */
  fun logSecondaryShutdownTimeout() {
    Log.w(
      TAG,
      "secondary_shutdown_timeout pid=${Process.myPid()} time=${formatNow()}",
    )
  }

  /**
   * 记录副进程即将退出。
   */
  fun logSecondaryProcessExit() {
    Log.i(
      TAG,
      "secondary_process_exit pid=${Process.myPid()} time=${formatNow()}",
    )
  }

  /**
   * 记录主进程准备直接 reload 当前 ReactHost。
   */
  fun logReactHostReloadRequested(reason: String) {
    Log.i(
      TAG,
      "react_host_reload_requested reason=$reason pid=${Process.myPid()} time=${formatNow()}",
    )
  }

  /**
   * 记录主进程准备切换到新的 bundle 并 reload ReactHost。
   */
  fun logReactHostBundleReloadRequested(bundleFile: String) {
    Log.i(
      TAG,
      "react_host_bundle_reload_requested bundleFile=$bundleFile pid=${Process.myPid()} time=${formatNow()}",
    )
  }

  /**
   * 记录主进程准备通过进程级重启应用热更新 bundle。
   */
  fun logHotUpdateProcessRelaunchRequested(bundleFile: String) {
    Log.i(
      TAG,
      "hot_update_process_relaunch_requested bundleFile=$bundleFile pid=${Process.myPid()} time=${formatNow()}",
    )
  }

  fun logHotUpdateHealthCheckScheduled(timeoutMs: Long, bundleVersion: String, packageId: String) {
    Log.i(
      TAG,
      "hot_update_health_check_scheduled timeoutMs=$timeoutMs bundleVersion=$bundleVersion packageId=$packageId pid=${Process.myPid()} time=${formatNow()}",
    )
  }

  fun logHotUpdateHealthCheckCancelled(reason: String) {
    Log.i(
      TAG,
      "hot_update_health_check_cancelled reason=$reason pid=${Process.myPid()} time=${formatNow()}",
    )
  }

  fun logHotUpdateHealthCheckTimedOut(timeoutMs: Long, bundleVersion: String, packageId: String) {
    Log.w(
      TAG,
      "hot_update_health_check_timeout timeoutMs=$timeoutMs bundleVersion=$bundleVersion packageId=$packageId pid=${Process.myPid()} time=${formatNow()}",
    )
  }
}
