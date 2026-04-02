package com.impos2.adapter.storage

import android.content.Context
import android.content.SharedPreferences
import com.impos2.adapter.interfaces.IStateStorage

/**
 * 轻量原生状态存储实现。
 *
 * 在 adapterPure 中，这个模块只承担“原生侧可独立验证的基础 KV 存储”角色，当前基于
 * SharedPreferences 实现。它的定位不是最终的跨层生产持久化方案；最终整合层会由 RN 侧适配器
 * 接入 MMKV 4.x。
 *
 * 保留这个实现的意义在于：
 * - adapterPure 本身的测试页面可以完整验证存储能力；
 * - 原生代码在不依赖 RN 的情况下也能有最小可用存储；
 * - 对外接口保持稳定，后续若要替换底层实现，不影响上层调用者。
 */
class StateStorageManager private constructor(context: Context) : IStateStorage {

  companion object {
    private const val PREF_NAME = "adapter_pure_state_storage"

    @Volatile
    private var instance: StateStorageManager? = null

    fun getInstance(context: Context): StateStorageManager =
      instance ?: synchronized(this) {
        instance ?: StateStorageManager(context.applicationContext).also { instance = it }
      }
  }

  // SharedPreferences 只作为当前阶段的轻量实现，优势是稳定、零额外依赖、易于原生独立测试。
  private val prefs: SharedPreferences =
    context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)

  override fun initialize(rootDir: String) {
    // 当前 adapterPure 阶段使用 SharedPreferences，无需目录初始化。
  }

  override fun getString(key: String): String? = prefs.getString(key, null)

  override fun getInt(key: String, defaultValue: Int): Int {
    return try {
      prefs.getInt(key, defaultValue)
    } catch (_: ClassCastException) {
      defaultValue
    }
  }

  override fun getLong(key: String, defaultValue: Long): Long {
    return try {
      prefs.getLong(key, defaultValue)
    } catch (_: ClassCastException) {
      defaultValue
    }
  }

  override fun getFloat(key: String, defaultValue: Float): Float {
    return try {
      prefs.getFloat(key, defaultValue)
    } catch (_: ClassCastException) {
      defaultValue
    }
  }

  override fun getBoolean(key: String, defaultValue: Boolean): Boolean {
    return try {
      prefs.getBoolean(key, defaultValue)
    } catch (_: ClassCastException) {
      defaultValue
    }
  }

  override fun setString(key: String, value: String) {
    prefs.edit().putString(key, value).apply()
  }

  override fun setInt(key: String, value: Int) {
    prefs.edit().putInt(key, value).apply()
  }

  override fun setLong(key: String, value: Long) {
    prefs.edit().putLong(key, value).apply()
  }

  override fun setFloat(key: String, value: Float) {
    prefs.edit().putFloat(key, value).apply()
  }

  override fun setBoolean(key: String, value: Boolean) {
    prefs.edit().putBoolean(key, value).apply()
  }

  override fun remove(key: String) {
    prefs.edit().remove(key).apply()
  }

  override fun clearAll() {
    prefs.edit().clear().apply()
  }

  override fun getAllKeys(): Set<String> = prefs.all.keys

  override fun contains(key: String): Boolean = prefs.contains(key)
}
