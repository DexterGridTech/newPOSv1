/**
 * 压缩消息
 * @param json 原始 JSON 字符串
 * @returns 压缩后的 JSON 字符串(如果压缩失败,返回原始字符串)
 */
export declare function compressMessage(json: string): string;
/**
 * 解压消息
 * @param data 接收到的消息字符串
 * @returns 解压后的 JSON 字符串
 */
export declare function decompressMessage(data: string): string;
/**
 * 检查消息是否应该压缩
 * @param type 消息类型
 * @param json 消息 JSON 字符串
 * @returns 是否应该压缩
 */
export declare function shouldCompress(type: string, json: string): boolean;
//# sourceMappingURL=compression.d.ts.map