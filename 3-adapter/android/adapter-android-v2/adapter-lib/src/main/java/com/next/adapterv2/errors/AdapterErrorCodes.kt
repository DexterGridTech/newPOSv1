package com.next.adapterv2.errors

/**
 * adapter-android-v2 通用错误码枚举。
 *
 * 当具体模块不适合直接暴露平台异常时，可以先落到这组通用错误语义，再由上层决定如何展示或转换。
 */
enum class AdapterErrorCodes(val code: String) {
  UNKNOWN("UNKNOWN"),
  INVALID_PARAM("INVALID_PARAM"),
  NOT_INITIALIZED("NOT_INITIALIZED"),
  OPERATION_FAILED("OPERATION_FAILED")
}
