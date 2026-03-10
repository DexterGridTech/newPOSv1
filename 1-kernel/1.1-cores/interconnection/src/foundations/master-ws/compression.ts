/**
 * WebSocket 消息压缩/解压工具
 * 使用 gzip 压缩,减少网络传输数据量
 */

import {gzipSync, gunzipSync, strToU8, strFromU8} from 'fflate';
import {logger, LOG_TAGS} from '@impos2/kernel-core-base';
import {moduleName} from '../../moduleName';

/** 压缩阈值: 只压缩大于 1KB 的消息 */
const COMPRESSION_THRESHOLD = 1024;

/** 压缩消息格式 */
interface CompressedMessage {
    compressed: true;
    payload: string; // base64 编码的 gzip 数据
}

/**
 * 判断是否为压缩消息
 */
function isCompressedMessage(data: any): data is CompressedMessage {
    return data && data.compressed === true && typeof data.payload === 'string';
}

/**
 * 压缩消息
 * @param json 原始 JSON 字符串
 * @returns 压缩后的 JSON 字符串(如果压缩失败或消息太小,返回原始字符串)
 */
export function compressMessage(json: string): string {
    // 小消息不压缩
    if (json.length < COMPRESSION_THRESHOLD) {
        return json;
    }

    try {
        // 使用 gzip 压缩
        const compressed = gzipSync(strToU8(json));

        // 转换为 base64
        const base64 = btoa(String.fromCharCode(...compressed));

        // 构造压缩消息格式
        const compressedMsg: CompressedMessage = {
            compressed: true,
            payload: base64
        };

        const result = JSON.stringify(compressedMsg);

        // 记录压缩效果
        const ratio = ((1 - result.length / json.length) * 100).toFixed(1);
        logger.debug(
            [moduleName, LOG_TAGS.WebSocket, 'Compression'],
            `压缩: ${json.length}B -> ${result.length}B (节省 ${ratio}%)`
        );

        return result;
    } catch (error) {
        // 压缩失败,返回原始数据
        logger.warn(
            [moduleName, LOG_TAGS.WebSocket, 'Compression'],
            '压缩失败,使用原始数据:',
            error
        );
        return json;
    }
}

/**
 * 解压消息
 * @param data 接收到的消息字符串
 * @returns 解压后的 JSON 字符串
 */
export function decompressMessage(data: string): string {
    try {
        const parsed = JSON.parse(data);

        // 如果不是压缩消息,直接返回原始数据
        if (!isCompressedMessage(parsed)) {
            return data;
        }

        // 解码 base64
        const binary = atob(parsed.payload);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }

        // 使用 gzip 解压
        const decompressed = strFromU8(gunzipSync(bytes));

        logger.debug(
            [moduleName, LOG_TAGS.WebSocket, 'Compression'],
            `解压: ${data.length}B -> ${decompressed.length}B`
        );

        return decompressed;
    } catch (error) {
        // 解压失败,可能是未压缩的消息,返回原始数据
        logger.warn(
            [moduleName, LOG_TAGS.WebSocket, 'Compression'],
            '解压失败,使用原始数据:',
            error
        );
        return data;
    }
}

/**
 * 检查消息是否应该压缩
 * @param type 消息类型
 * @param json 消息 JSON 字符串
 * @returns 是否应该压缩
 */
export function shouldCompress(type: string, json: string): boolean {
    // 系统消息不压缩(心跳等)
    if (type.startsWith('__system_')) {
        return false;
    }

    // 小消息不压缩
    if (json.length < COMPRESSION_THRESHOLD) {
        return false;
    }

    return true;
}
