package com.next.adapterv2.connector

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.os.ResultReceiver
import org.json.JSONObject

class SystemFilePickerActivity : Activity() {

  companion object {
    const val ACTION_OPEN_DOCUMENT = "android.intent.action.OPEN_DOCUMENT"
    const val EXTRA_TARGET_ACTION = "targetAction"
    const val EXTRA_RESULT_RECEIVER = "resultReceiver"
    private const val REQUEST_CODE = 3001
    private const val KEY_HAS_LAUNCHED = "hasLaunched"
  }

  private var hasLaunched = false
  private var resultReceiver: ResultReceiver? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    hasLaunched = savedInstanceState?.getBoolean(KEY_HAS_LAUNCHED, false) ?: false
    resultReceiver = intent.getParcelableExtra(EXTRA_RESULT_RECEIVER)

    if (hasLaunched) {
      return
    }

    val action = intent.getStringExtra(EXTRA_TARGET_ACTION) ?: ACTION_OPEN_DOCUMENT
    runCatching {
      val targetIntent = Intent(action).apply {
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        addFlags(Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
        addFlags(Intent.FLAG_GRANT_PREFIX_URI_PERMISSION)
        intent.getStringExtra("type")?.let { setType(it) }
        intent.getStringExtra("category")?.let { addCategory(it) }
      }
      hasLaunched = true
      startActivityForResult(targetIntent, REQUEST_CODE)
      overridePendingTransition(0, 0)
    }.onFailure {
      sendFailure(it.message ?: "SYSTEM_FILE_PICKER_OPEN_FAILED")
      finish()
    }
  }

  override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
    super.onActivityResult(requestCode, resultCode, data)
    if (requestCode != REQUEST_CODE) {
      return
    }

    if (resultCode == RESULT_OK && data != null) {
      val payload = JSONObject().apply {
        put("uri", data.data?.toString())
        put("clipDataCount", data.clipData?.itemCount ?: 0)
      }
      resultReceiver?.send(
        ConnectorResultCodes.SUCCESS,
        Bundle().apply {
          putString("data", payload.toString())
        },
      )
    } else {
      sendFailure("CANCELED")
    }
    finish()
    overridePendingTransition(0, 0)
  }

  override fun onSaveInstanceState(outState: Bundle) {
    super.onSaveInstanceState(outState)
    outState.putBoolean(KEY_HAS_LAUNCHED, hasLaunched)
  }

  private fun sendFailure(message: String) {
    resultReceiver?.send(
      ConnectorResultCodes.FAILURE,
      Bundle().apply {
        putString("error", message)
      },
    )
  }
}

object ConnectorResultCodes {
  const val SUCCESS = 1
  const val FAILURE = 2
}
