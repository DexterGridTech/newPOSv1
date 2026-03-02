package com.adapterrn84.turbomodules.connector.channels

object HexUtils {
    
    /**
     * 将十六进制字符串转换为字节数组
     * @param hex 十六进制字符串（可以包含空格）
     * @return 字节数组
     */
    fun hexToBytes(hex: String): ByteArray {
        val cleanHex = hex.replace(" ", "").replace("\n", "").replace("\r", "")
        
        if (cleanHex.length % 2 != 0) {
            throw IllegalArgumentException("Hex string must have even length")
        }
        
        val bytes = ByteArray(cleanHex.length / 2)
        for (i in bytes.indices) {
            val index = i * 2
            val byte = cleanHex.substring(index, index + 2).toInt(16)
            bytes[i] = byte.toByte()
        }
        
        return bytes
    }
    
    /**
     * 将字节数组转换为十六进制字符串（大写）
     * @param bytes 字节数组
     * @param len 要转换的字节数（如果小于数组长度，只转换前 len 个字节）
     * @return 十六进制字符串（大写，无空格）
     */
    fun bytesToHex(bytes: ByteArray, len: Int = bytes.size): String {
        val actualLen = minOf(len, bytes.size)
        val hexChars = CharArray(actualLen * 2)
        
        for (i in 0 until actualLen) {
            val v = bytes[i].toInt() and 0xFF
            hexChars[i * 2] = HEX_ARRAY[v ushr 4]
            hexChars[i * 2 + 1] = HEX_ARRAY[v and 0x0F]
        }
        
        return String(hexChars)
    }
    
    private val HEX_ARRAY = "0123456789ABCDEF".toCharArray()
}
