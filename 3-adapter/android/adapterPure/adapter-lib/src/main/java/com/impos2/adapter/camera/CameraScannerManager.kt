package com.impos2.adapter.camera

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.ResultReceiver
import androidx.activity.ComponentActivity
import com.impos2.adapter.interfaces.ConnectorCodes
import com.impos2.adapter.interfaces.ConnectorResponse

class CameraScannerManager private constructor() {

  companion object {
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

  fun startScan(
    activity: ComponentActivity,
    params: Map<String, Any?>,
    timeoutMs: Long,
    callback: (ConnectorResponse) -> Unit
  ) {
    val receiver = object : ResultReceiver(Handler(Looper.getMainLooper())) {
      override fun onReceiveResult(resultCode: Int, resultData: Bundle?) {
        callback(toResponse(resultCode, resultData))
      }
    }

    val intent = Intent(activity, CameraScanActivity::class.java).apply {
      action = CameraScanActivity.ACTION
      putExtra("SCAN_MODE", params["SCAN_MODE"]?.toString() ?: "ALL")
      putExtra("WAIT_RESULT", params["waitResult"]?.toString()?.toBooleanStrictOrNull() ?: true)
      putExtra("TIMEOUT", timeoutMs)
      putExtra(EXTRA_RESULT_RECEIVER, receiver)
    }
    activity.startActivity(intent)
  }

  private fun toResponse(resultCode: Int, resultData: Bundle?): ConnectorResponse {
    if (resultCode == RESULT_CODE_SUCCESS) {
      return ConnectorResponse(
        success = true,
        code = ConnectorCodes.SUCCESS,
        message = "OK",
        data = mapOf(
          "SCAN_RESULT" to (resultData?.getString(CameraScanActivity.EXTRA_SCAN_RESULT) ?: ""),
          "SCAN_RESULT_FORMAT" to (resultData?.getString(CameraScanActivity.EXTRA_SCAN_FORMAT) ?: "UNKNOWN")
        )
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
      data = mapOf("error" to error)
    )
  }
}
