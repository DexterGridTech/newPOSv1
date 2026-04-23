package com.impos2.adapterv2.storage

import android.content.Context
import com.impos2.adapterv2.interfaces.IStateStorage
import com.tencent.mmkv.MMKV

/**
 * 原生状态存储实现。
 *
 * adapter-android-v2 作为正式 Android 适配层，直接承担生产可用的原生持久化能力。
 * 这里不再沿用 SharedPreferences，而是直接使用 Android 原生 MMKV。
 *
 * 这样做的原因是：
 * - 正式持久化能力属于 Android 原生能力，放在 adapter 层边界更清晰；
 * - assembly 层只保留 RN TurboModule 桥接，不再直接依赖 JS 侧 react-native-mmkv；
 * - 避免 JS 启动早期被 NitroModules 注册链路阻塞。
 *
 * 注意：
 * - manager 本身不带业务语义，只提供按 storageId 拿实例的能力；
 * - 具体 namespace 由 assembly 层决定；
 * - initialize() 保留为幂等入口，兼容 dev-app 和上层桥接的初始化时机。
 */
class StateStorageManager private constructor(
  context: Context,
  private val storageId: String,
) : IStateStorage {

  companion object {
    private const val DEFAULT_STORAGE_ID = "adapter-android-v2-state-storage"

    @Volatile
    private var initialized = false

    private val instances = mutableMapOf<String, StateStorageManager>()

    fun getInstance(
      context: Context,
      storageId: String = DEFAULT_STORAGE_ID,
    ): StateStorageManager {
      val normalizedStorageId = storageId.trim().ifEmpty { DEFAULT_STORAGE_ID }
      return synchronized(this) {
        ensureInitialized(context.applicationContext)
        instances[normalizedStorageId]
          ?: StateStorageManager(
            context = context.applicationContext,
            storageId = normalizedStorageId,
          ).also { instances[normalizedStorageId] = it }
      }
    }

    private fun ensureInitialized(context: Context) {
      if (initialized) {
        return
      }
      synchronized(this) {
        if (!initialized) {
          MMKV.initialize(context)
          initialized = true
        }
      }
    }
  }

  private val appContext = context.applicationContext

  private val storage: MMKV by lazy {
    ensureInitialized()
    MMKV.mmkvWithID(storageId)
      ?: throw IllegalStateException("Unable to open MMKV storage for id=$storageId")
  }

  override fun initialize(rootDir: String) {
    ensureInitialized()
  }

  private fun ensureInitialized() {
    Companion.ensureInitialized(appContext)
  }

  override fun getString(key: String): String? = storage.decodeString(key, null)

  override fun getInt(key: String, defaultValue: Int): Int {
    return storage.decodeInt(key, defaultValue)
  }

  override fun getLong(key: String, defaultValue: Long): Long {
    return storage.decodeLong(key, defaultValue)
  }

  override fun getFloat(key: String, defaultValue: Float): Float {
    return storage.decodeFloat(key, defaultValue)
  }

  override fun getBoolean(key: String, defaultValue: Boolean): Boolean {
    return storage.decodeBool(key, defaultValue)
  }

  override fun setString(key: String, value: String) {
    storage.encode(key, value)
  }

  override fun setInt(key: String, value: Int) {
    storage.encode(key, value)
  }

  override fun setLong(key: String, value: Long) {
    storage.encode(key, value)
  }

  override fun setFloat(key: String, value: Float) {
    storage.encode(key, value)
  }

  override fun setBoolean(key: String, value: Boolean) {
    storage.encode(key, value)
  }

  override fun remove(key: String) {
    storage.removeValueForKey(key)
  }

  override fun clearAll() {
    storage.clearAll()
  }

  override fun getAllKeys(): Set<String> = storage.allKeys()?.toSet() ?: emptySet()

  override fun contains(key: String): Boolean = storage.containsKey(key)
}
