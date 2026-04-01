package com.impos2.adapter.storage

import android.content.Context
import android.content.SharedPreferences
import com.impos2.adapter.interfaces.IStateStorage

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
