package com.impos2.posadapter.turbomodules

internal fun hexToBytes(hex: String): ByteArray {
    val s = hex.replace(" ", "")
    if (s.isEmpty()) return ByteArray(0)
    return ByteArray(s.length / 2) { i -> s.substring(i * 2, i * 2 + 2).toInt(16).toByte() }
}

internal fun bytesToHex(bytes: ByteArray, len: Int): String =
    bytes.take(len).joinToString(" ") { "%02X".format(it) }
