package com.impos2.turbomodules.external.utils

import com.facebook.react.bridge.*
import org.json.JSONObject
import org.json.JSONArray

/**
 * 数据类型转换工具
 * 负责 Kotlin 数据类型与 React Native 数据类型之间的转换
 */
object DataConverter {

    /**
     * 将 JSONObject 转换为 ReadableMap
     */
    fun jsonObjectToReadableMap(jsonObject: JSONObject): ReadableMap {
        val map = Arguments.createMap()
        val iterator = jsonObject.keys()
        while (iterator.hasNext()) {
            val key = iterator.next()
            val value = jsonObject.get(key)
            when (value) {
                JSONObject.NULL -> map.putNull(key)
                is Boolean -> map.putBoolean(key, value)
                is Int -> map.putInt(key, value)
                is Long -> map.putDouble(key, value.toDouble())
                is Double -> map.putDouble(key, value)
                is String -> map.putString(key, value)
                is JSONObject -> map.putMap(key, jsonObjectToReadableMap(value))
                is JSONArray -> map.putArray(key, jsonArrayToReadableArray(value))
                else -> map.putString(key, value.toString())
            }
        }
        return map
    }

    /**
     * 将 JSONArray 转换为 ReadableArray
     */
    fun jsonArrayToReadableArray(jsonArray: JSONArray): ReadableArray {
        val array = Arguments.createArray()
        for (i in 0 until jsonArray.length()) {
            val value = jsonArray.get(i)
            when (value) {
                JSONObject.NULL -> array.pushNull()
                is Boolean -> array.pushBoolean(value)
                is Int -> array.pushInt(value)
                is Long -> array.pushDouble(value.toDouble())
                is Double -> array.pushDouble(value)
                is String -> array.pushString(value)
                is JSONObject -> array.pushMap(jsonObjectToReadableMap(value))
                is JSONArray -> array.pushArray(jsonArrayToReadableArray(value))
                else -> array.pushString(value.toString())
            }
        }
        return array
    }

    /**
     * 将任意类型转换为可写入的类型
     */
    fun convertToWritable(value: Any?): Any? {
        return when (value) {
            null -> null
            is ReadableMap -> convertReadableMapToWritableMap(value)
            is ReadableArray -> convertReadableArrayToWritableArray(value)
            is Map<*, *> -> convertMapToWritableMap(value)
            is List<*> -> convertListToWritableArray(value)
            is Boolean -> value
            is Int -> value
            is Long -> value.toDouble()
            is Float -> value.toDouble()
            is Double -> value
            is String -> value
            else -> value.toString()
        }
    }

    private fun convertMapToWritableMap(map: Map<*, *>): WritableMap {
        val writableMap = Arguments.createMap()
        map.forEach { (key, value) ->
            putValueInMap(writableMap, key.toString(), value)
        }
        return writableMap
    }

    private fun convertListToWritableArray(list: List<*>): WritableArray {
        val writableArray = Arguments.createArray()
        list.forEach { value ->
            pushValueInArray(writableArray, value)
        }
        return writableArray
    }

    private fun convertReadableMapToWritableMap(readableMap: ReadableMap): WritableMap {
        val writableMap = Arguments.createMap()
        val iterator = readableMap.keySetIterator()
        while (iterator.hasNextKey()) {
            val key = iterator.nextKey()
            when (readableMap.getType(key)) {
                ReadableType.Null -> writableMap.putNull(key)
                ReadableType.Boolean -> writableMap.putBoolean(key, readableMap.getBoolean(key))
                ReadableType.Number -> writableMap.putDouble(key, readableMap.getDouble(key))
                ReadableType.String -> writableMap.putString(key, readableMap.getString(key))
                ReadableType.Map -> writableMap.putMap(key, convertReadableMapToWritableMap(readableMap.getMap(key)!!))
                ReadableType.Array -> writableMap.putArray(key, convertReadableArrayToWritableArray(readableMap.getArray(key)!!))
            }
        }
        return writableMap
    }

    private fun convertReadableArrayToWritableArray(readableArray: ReadableArray): WritableArray {
        val writableArray = Arguments.createArray()
        for (i in 0 until readableArray.size()) {
            when (readableArray.getType(i)) {
                ReadableType.Null -> writableArray.pushNull()
                ReadableType.Boolean -> writableArray.pushBoolean(readableArray.getBoolean(i))
                ReadableType.Number -> writableArray.pushDouble(readableArray.getDouble(i))
                ReadableType.String -> writableArray.pushString(readableArray.getString(i))
                ReadableType.Map -> writableArray.pushMap(convertReadableMapToWritableMap(readableArray.getMap(i)))
                ReadableType.Array -> writableArray.pushArray(convertReadableArrayToWritableArray(readableArray.getArray(i)))
            }
        }
        return writableArray
    }

    private fun putValueInMap(map: WritableMap, key: String, value: Any?) {
        when (value) {
            null -> map.putNull(key)
            is Boolean -> map.putBoolean(key, value)
            is Int -> map.putInt(key, value)
            is Long -> map.putDouble(key, value.toDouble())
            is Float -> map.putDouble(key, value.toDouble())
            is Double -> map.putDouble(key, value)
            is String -> map.putString(key, value)
            is ReadableMap -> map.putMap(key, convertReadableMapToWritableMap(value))
            is ReadableArray -> map.putArray(key, convertReadableArrayToWritableArray(value))
            is Map<*, *> -> map.putMap(key, convertMapToWritableMap(value))
            is List<*> -> map.putArray(key, convertListToWritableArray(value))
            else -> map.putString(key, value.toString())
        }
    }

    private fun pushValueInArray(array: WritableArray, value: Any?) {
        when (value) {
            null -> array.pushNull()
            is Boolean -> array.pushBoolean(value)
            is Int -> array.pushInt(value)
            is Long -> array.pushDouble(value.toDouble())
            is Float -> array.pushDouble(value.toDouble())
            is Double -> array.pushDouble(value)
            is String -> array.pushString(value)
            is ReadableMap -> array.pushMap(convertReadableMapToWritableMap(value))
            is ReadableArray -> array.pushArray(convertReadableArrayToWritableArray(value))
            is Map<*, *> -> array.pushMap(convertMapToWritableMap(value))
            is List<*> -> array.pushArray(convertListToWritableArray(value))
            else -> array.pushString(value.toString())
        }
    }
}
