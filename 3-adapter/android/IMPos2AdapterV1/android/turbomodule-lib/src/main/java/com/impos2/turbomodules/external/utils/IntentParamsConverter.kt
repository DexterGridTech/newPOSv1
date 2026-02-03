package com.impos2.turbomodules.external.utils

import android.content.Intent
import android.os.Bundle
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType

/**
 * Intent 参数转换工具
 * 将 ReadableMap 参数转换为 Intent extras
 */
object IntentParamsConverter {

    /**
     * 将 ReadableMap 参数添加到 Intent
     */
    fun addParamsToIntent(intent: Intent, params: ReadableMap?) {
        if (params == null) return

        val bundle = Bundle()
        addMapToBundle(bundle, params)
        intent.putExtras(bundle)
    }

    private fun addMapToBundle(bundle: Bundle, map: ReadableMap) {
        val iterator = map.keySetIterator()
        while (iterator.hasNextKey()) {
            val key = iterator.nextKey()
            when (map.getType(key)) {
                ReadableType.Null -> bundle.putString(key, null)
                ReadableType.Boolean -> bundle.putBoolean(key, map.getBoolean(key))
                ReadableType.Number -> {
                    val value = map.getDouble(key)
                    if (value == value.toInt().toDouble()) {
                        bundle.putInt(key, value.toInt())
                    } else {
                        bundle.putDouble(key, value)
                    }
                }
                ReadableType.String -> bundle.putString(key, map.getString(key))
                ReadableType.Map -> {
                    val nestedBundle = Bundle()
                    addMapToBundle(nestedBundle, map.getMap(key)!!)
                    bundle.putBundle(key, nestedBundle)
                }
                ReadableType.Array -> {
                    // 简化处理：将数组转为字符串
                    bundle.putString(key, map.getArray(key).toString())
                }
            }
        }
    }
}
