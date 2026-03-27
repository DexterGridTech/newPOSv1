package com.impos2.adapter

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule

abstract class NativeScriptsTurboModuleSpec(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    abstract fun executeScript(
        script: String,
        params: String,
        timeout: Double,
        promise: Promise
    )

    abstract fun resolveNativeCall(
        callId: String,
        result: String,
        promise: Promise
    )

    abstract fun getStats(promise: Promise)

    abstract fun clearStats(promise: Promise)
}
