package com.impos2.adapter.interfaces

interface IStateStorage {
  fun initialize(rootDir: String = "")
  fun getString(key: String): String?
  fun getInt(key: String, defaultValue: Int = 0): Int
  fun getLong(key: String, defaultValue: Long = 0L): Long
  fun getFloat(key: String, defaultValue: Float = 0f): Float
  fun getBoolean(key: String, defaultValue: Boolean = false): Boolean
  fun setString(key: String, value: String)
  fun setInt(key: String, value: Int)
  fun setLong(key: String, value: Long)
  fun setFloat(key: String, value: Float)
  fun setBoolean(key: String, value: Boolean)
  fun remove(key: String)
  fun clearAll()
  fun getAllKeys(): Set<String>
  fun contains(key: String): Boolean
}
