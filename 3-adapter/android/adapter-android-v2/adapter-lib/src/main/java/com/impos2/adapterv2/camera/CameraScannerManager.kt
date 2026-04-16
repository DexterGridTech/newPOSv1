package com.impos2.adapterv2.camera

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.ResultReceiver
import android.util.Log
import androidx.activity.ComponentActivity
import com.impos2.adapterv2.interfaces.ConnectorCodes
import com.impos2.adapterv2.interfaces.ConnectorResponse
import java.util.UUID
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong

/**
 * 摄像头扫码流程协调器。
 *
 * 它的职责不是做图像识别本身，而是把“启动扫码页 -> 等待结果 -> 返回一次性回调”这条链路做稳。
 * 之所以单独抽一个 manager，是为了统一处理：
 * - 防止重复启动扫码流程；
 * - 确保回调只触发一次；
 * - 记录最近一次结果/错误，方便测试页与日志排查；
 * - 在启动失败或异常销毁时及时回收状态。
 */
class CameraScannerManager private constructor() {

  private enum class ScanState {
    IDLE,
    STARTING,
    SCANNING,
  }

  companion object {
    private const val TAG = "CameraScannerManager"
    private const val EXTRA_RESULT_RECEIVER = "RESULT_RECEIVER"
    private const val RESULT_CODE_SUCCESS = 1
    private const val RESULT_CODE_FAILURE = 2

    @Volatile
    private var instance: CameraScannerManager? = null

    fun getInstance(): CameraScannerManager {
      return instance ?: synchronized(this) {
        instance ?: CameraScannerManager().also { instance = it }
      }
    }
  }

  // 保护当前扫码状态与回调引用，避免多次点击或系统回调重入时产生重复结果。
  private val lock = Any()
  private val startCount = AtomicLong(0L)
  private val successCount = AtomicLong(0L)
  private val failureCount = AtomicLong(0L)
  private val duplicateRejectCount = AtomicLong(0L)

  @Volatile private var state: ScanState = ScanState.IDLE
  @Volatile private var activeRequestId: String? = null
  @Volatile private var activeStartedAt: Long = 0L
  @Volatile private var lastCompletedAt: Long = 0L
  @Volatile private var lastError: String? = null
  @Volatile private var lastResultSummary: String = "--"

  fun startScan(
    activity: ComponentActivity,
    params: Map<String, Any?>,
    timeoutMs: Long,
    callback: (ConnectorResponse) -> Unit,
  ) {
    val requestId = UUID.randomUUID().toString()
    val normalizedTimeout = timeoutMs.coerceAtLeast(1L)
    val scanMode = params["SCAN_MODE"]?.toString() ?: "ALL"
    val waitResult = params["waitResult"]?.toString()?.toBooleanStrictOrNull() ?: true

    synchronized(lock) {
      if (state != ScanState.IDLE) {
        duplicateRejectCount.incrementAndGet()
        val message = "scan already in progress"
        lastError = message
        Log.w(TAG, "startScan rejected: state=$state, activeRequestId=$activeRequestId")
        callback(
          ConnectorResponse(
            success = false,
            code = ConnectorCodes.UNKNOWN,
            message = message,
            data = mapOf(
              "error" to message,
              "activeRequestId" to (activeRequestId ?: ""),
            ),
          ),
        )
        return
      }

      state = ScanState.STARTING
      activeRequestId = requestId
      activeStartedAt = System.currentTimeMillis()
      lastError = null
      startCount.incrementAndGet()
    }

    val delivered = AtomicBoolean(false)
    val completeOnce = fun(response: ConnectorResponse) {
      if (!delivered.compareAndSet(false, true)) {
        Log.w(TAG, "duplicate scan callback ignored: requestId=$requestId")
        return
      }
      finishRequest(requestId, response)
      callback(response)
    }

    val receiver = object : ResultReceiver(Handler(Looper.getMainLooper())) {
      override fun onReceiveResult(resultCode: Int, resultData: Bundle?) {
        completeOnce(toResponse(resultCode, resultData))
      }
    }

    runCatching {
      val intent = Intent(activity, CameraScanActivity::class.java).apply {
        action = CameraScanActivity.ACTION
        putExtra("SCAN_MODE", scanMode)
        putExtra("WAIT_RESULT", waitResult)
        putExtra("TIMEOUT", normalizedTimeout)
        putExtra(EXTRA_RESULT_RECEIVER, receiver)
      }

      synchronized(lock) {
        if (activeRequestId == requestId) {
          state = ScanState.SCANNING
        }
      }

      activity.startActivity(intent)
      Log.i(TAG, "startScan success: requestId=$requestId, scanMode=$scanMode, waitResult=$waitResult")
    }.onFailure { error ->
      val response = ConnectorResponse(
        success = false,
        code = ConnectorCodes.UNKNOWN,
        message = error.message ?: "START_SCAN_FAILED",
        data = mapOf("error" to (error.message ?: "START_SCAN_FAILED")),
      )
      Log.e(TAG, "startScan failed: requestId=$requestId", error)
      completeOnce(response)
    }
  }

  fun dumpState(): String {
    return buildString {
      append("state=")
      append(state)
      append(", activeRequestId=")
      append(activeRequestId ?: "null")
      append(", activeStartedAt=")
      append(activeStartedAt)
      append(", lastCompletedAt=")
      append(lastCompletedAt)
      append(", starts=")
      append(startCount.get())
      append(", success=")
      append(successCount.get())
      append(", failure=")
      append(failureCount.get())
      append(", duplicateRejects=")
      append(duplicateRejectCount.get())
      append(", lastResult=")
      append(lastResultSummary)
      append(", lastError=")
      append(lastError ?: "null")
    }
  }

  private fun finishRequest(requestId: String, response: ConnectorResponse) {
    synchronized(lock) {
      if (activeRequestId != requestId) {
        Log.w(TAG, "finishRequest ignored: requestId=$requestId, activeRequestId=$activeRequestId")
        return
      }
      state = ScanState.IDLE
      activeRequestId = null
      lastCompletedAt = System.currentTimeMillis()
      if (response.success) {
        successCount.incrementAndGet()
        lastError = null
        lastResultSummary = buildResultSummary(response)
      } else {
        failureCount.incrementAndGet()
        lastError = response.message
        lastResultSummary = "ERROR:${response.message}"
      }
    }
  }

  private fun buildResultSummary(response: ConnectorResponse): String {
    val result = response.data?.get("SCAN_RESULT")?.toString().orEmpty()
    val format = response.data?.get("SCAN_RESULT_FORMAT")?.toString().orEmpty()
    return "result=${result.take(64)}, format=${if (format.isEmpty()) "UNKNOWN" else format}"
  }

  private fun toResponse(resultCode: Int, resultData: Bundle?): ConnectorResponse {
    if (resultCode == RESULT_CODE_SUCCESS) {
      return ConnectorResponse(
        success = true,
        code = ConnectorCodes.SUCCESS,
        message = "OK",
        data = mapOf(
          "SCAN_RESULT" to (resultData?.getString(CameraScanActivity.EXTRA_SCAN_RESULT) ?: ""),
          "SCAN_RESULT_FORMAT" to (resultData?.getString(CameraScanActivity.EXTRA_SCAN_FORMAT) ?: "UNKNOWN"),
        ),
      )
    }

    val error = resultData?.getString(CameraScanActivity.EXTRA_ERROR) ?: "CANCELED"
    val code = when (error) {
      "CANCELED" -> ConnectorCodes.CANCELED
      "CAMERA_PERMISSION_DENIED" -> ConnectorCodes.CAMERA_PERMISSION_DENIED
      "CAMERA_OPEN_FAILED" -> ConnectorCodes.CAMERA_OPEN_FAILED
      "CAMERA_SCAN_FAILED" -> ConnectorCodes.CAMERA_SCAN_FAILED
      else -> ConnectorCodes.UNKNOWN
    }

    return ConnectorResponse(
      success = false,
      code = code,
      message = error,
      data = mapOf("error" to error),
    )
  }
}
