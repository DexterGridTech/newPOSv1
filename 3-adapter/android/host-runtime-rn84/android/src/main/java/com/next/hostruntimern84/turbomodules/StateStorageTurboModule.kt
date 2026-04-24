package com.next.hostruntimern84.turbomodules

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule
import com.next.adapterv2.storage.StateStorageManager

@ReactModule(name = StateStorageTurboModule.NAME)
class StateStorageTurboModule(reactContext: ReactApplicationContext) :
  NativeStateStorageTurboModuleSpec(reactContext) {

  companion object {
    const val NAME = "StateStorageTurboModule"
  }

  private fun getStorage(namespace: String): StateStorageManager {
    return StateStorageManager.getInstance(
      context = reactApplicationContext.applicationContext,
      storageId = namespace,
    )
  }

  override fun getName(): String = NAME

  override fun getString(namespace: String, key: String, promise: Promise) {
    runCatching { getStorage(namespace).getString(key) }
      .onSuccess { promise.resolve(it) }
      .onFailure { promise.reject("STATE_STORAGE_ERROR", it.message, it) }
  }

  override fun setString(namespace: String, key: String, value: String, promise: Promise) {
    runCatching { getStorage(namespace).setString(key, value) }
      .onSuccess { promise.resolve(null) }
      .onFailure { promise.reject("STATE_STORAGE_ERROR", it.message, it) }
  }

  override fun remove(namespace: String, key: String, promise: Promise) {
    runCatching { getStorage(namespace).remove(key) }
      .onSuccess { promise.resolve(null) }
      .onFailure { promise.reject("STATE_STORAGE_ERROR", it.message, it) }
  }

  override fun clearAll(namespace: String, promise: Promise) {
    runCatching { getStorage(namespace).clearAll() }
      .onSuccess { promise.resolve(null) }
      .onFailure { promise.reject("STATE_STORAGE_ERROR", it.message, it) }
  }

  override fun getAllKeys(namespace: String, promise: Promise) {
    runCatching {
      Arguments.createArray().apply {
        getStorage(namespace).getAllKeys().forEach { pushString(it) }
      }
    }.onSuccess {
      promise.resolve(it)
    }.onFailure {
      promise.reject("STATE_STORAGE_ERROR", it.message, it)
    }
  }
}
