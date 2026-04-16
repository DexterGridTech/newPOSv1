package com.impos2.mixcretailassemblyrn84.turbomodules

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule
import com.impos2.adapterv2.storage.StateStorageManager

@ReactModule(name = StateStorageTurboModule.NAME)
class StateStorageTurboModule(reactContext: ReactApplicationContext) :
  NativeStateStorageTurboModuleSpec(reactContext) {

  companion object {
    const val NAME = "StateStorageTurboModule"
  }

  private val storage by lazy { StateStorageManager.getInstance(reactApplicationContext.applicationContext) }

  override fun getName(): String = NAME

  override fun getString(key: String, promise: Promise) {
    runCatching { storage.getString(key) }
      .onSuccess { promise.resolve(it) }
      .onFailure { promise.reject("STATE_STORAGE_ERROR", it.message, it) }
  }

  override fun setString(key: String, value: String, promise: Promise) {
    runCatching { storage.setString(key, value) }
      .onSuccess { promise.resolve(null) }
      .onFailure { promise.reject("STATE_STORAGE_ERROR", it.message, it) }
  }

  override fun remove(key: String, promise: Promise) {
    runCatching { storage.remove(key) }
      .onSuccess { promise.resolve(null) }
      .onFailure { promise.reject("STATE_STORAGE_ERROR", it.message, it) }
  }

  override fun clearAll(promise: Promise) {
    runCatching { storage.clearAll() }
      .onSuccess { promise.resolve(null) }
      .onFailure { promise.reject("STATE_STORAGE_ERROR", it.message, it) }
  }

  override fun getAllKeys(promise: Promise) {
    runCatching {
      Arguments.createArray().apply {
        storage.getAllKeys().forEach { pushString(it) }
      }
    }.onSuccess {
      promise.resolve(it)
    }.onFailure {
      promise.reject("STATE_STORAGE_ERROR", it.message, it)
    }
  }
}
