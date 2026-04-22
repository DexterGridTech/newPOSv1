import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';
const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);
/**
 * 判断是否为压缩消息
 */
function isCompressedMessage(data) {
    return data && data.compressed === true && typeof data.payload === 'string';
}
/**
 * 压缩消息
 * @param json 原始 JSON 字符串
 * @returns 压缩后的 JSON 字符串(如果压缩失败,返回原始字符串)
 */
export async function compressMessage(json) {
    try {
        // 使用 gzip 压缩
        const compressed = await gzipAsync(Buffer.from(json, 'utf-8'));
        // 转换为 base64
        const base64 = compressed.toString('base64');
        // 构造压缩消息格式
        const compressedMsg = {
            compressed: true,
            payload: base64
        };
        const result = JSON.stringify(compressedMsg);
        // 记录压缩效果
        const ratio = ((1 - result.length / json.length) * 100).toFixed(1);
        console.log(`[WsCompression] 压缩: ${json.length}B -> ${result.length}B (节省 ${ratio}%)`);
        return result;
    }
    catch (error) {
        // 压缩失败,返回原始数据
        console.warn('[WsCompression] 压缩失败,使用原始数据:', error);
        return json;
    }
}
/**
 * 解压消息
 * @param data 接收到的消息字符串
 * @returns 解压后的 JSON 字符串
 */
export async function decompressMessage(data) {
    try {
        const parsed = JSON.parse(data);
        // 如果不是压缩消息,直接返回原始数据
        if (!isCompressedMessage(parsed)) {
            return data;
        }
        // 解码 base64
        const compressed = Buffer.from(parsed.payload, 'base64');
        // 使用 gzip 解压
        const decompressed = await gunzipAsync(compressed);
        const result = decompressed.toString('utf-8');
        console.log(`[WsCompression] 解压: ${data.length}B -> ${result.length}B`);
        return result;
    }
    catch (error) {
        // 解压失败,可能是未压缩的消息,返回原始数据
        console.warn('[WsCompression] 解压失败,使用原始数据:', error);
        return data;
    }
}
/**
 * 检查消息是否应该压缩
 * @param type 消息类型
 * @param json 消息 JSON 字符串
 * @returns 是否应该压缩
 */
export function shouldCompress(type, json) {
    // 心跳消息不压缩
    if (type === 'HEARTBEAT' || type === 'HEARTBEAT_RESPONSE') {
        return false;
    }
    return true;
}
//# sourceMappingURL=wsCompression.js.map