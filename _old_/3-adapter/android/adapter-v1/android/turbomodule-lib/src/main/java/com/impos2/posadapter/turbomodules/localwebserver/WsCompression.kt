package com.impos2.posadapter.turbomodules.localwebserver

import android.util.Log
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.util.Base64
import java.util.zip.GZIPInputStream
import java.util.zip.GZIPOutputStream

private const val TAG = "WsCompression"

/**
 * WebSocket 消息压缩/解压工具
 * 使用 gzip 压缩,减少网络传输数据量
 */
object WsCompression {
    /**
     * 压缩消息
     * @param json 原始 JSON 字符串
     * @return 压缩后的 JSON 字符串(如果压缩失败,返回原始字符串)
     */
    fun compressMessage(json: String): String {

        return try {
            // 使用 gzip 压缩
            val baos = ByteArrayOutputStream()
            GZIPOutputStream(baos).use { gzipOut ->
                gzipOut.write(json.toByteArray(Charsets.UTF_8))
            }
            val compressed = baos.toByteArray()

            // 转换为 base64
            val base64 = Base64.getEncoder().encodeToString(compressed)

            // 构造压缩消息格式
            val result = """{"compressed":true,"payload":"$base64"}"""

            // 记录压缩效果
            val ratio = ((1 - result.length.toFloat() / json.length) * 100).toInt()
            Log.d(TAG, "压缩: ${json.length}B -> ${result.length}B (节省 $ratio%)")

            result
        } catch (e: Exception) {
            // 压缩失败,返回原始数据
            Log.w(TAG, "压缩失败,使用原始数据", e)
            json
        }
    }

    /**
     * 解压消息
     * @param data 接收到的消息字符串
     * @return 解压后的 JSON 字符串
     */
    fun decompressMessage(data: String): String {
        return try {
            val json = JSONObject(data)

            // 如果不是压缩消息,直接返回原始数据
            if (!json.optBoolean("compressed", false)) {
                return data
            }

            // 解码 base64
            val base64 = json.getString("payload")
            val compressed = Base64.getDecoder().decode(base64)

            // 使用 gzip 解压
            val bais = ByteArrayInputStream(compressed)
            val decompressed = GZIPInputStream(bais).use { gzipIn ->
                gzipIn.readBytes().toString(Charsets.UTF_8)
            }

            Log.d(TAG, "解压: ${data.length}B -> ${decompressed.length}B")

            decompressed
        } catch (e: Exception) {
            // 解压失败,可能是未压缩的消息,返回原始数据
            Log.w(TAG, "解压失败,使用原始数据", e)
            data
        }
    }

    /**
     * 检查消息是否应该压缩
     * @param type 消息类型
     * @param json 消息 JSON 字符串
     * @return 是否应该压缩
     */
    fun shouldCompress(type: String, json: String): Boolean {
        // 系统消息不压缩(心跳等)
        if (type.startsWith("__system_")) {
            return false
        }

        return true
    }
}
