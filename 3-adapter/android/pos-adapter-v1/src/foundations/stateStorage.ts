import {createMMKV} from 'react-native-mmkv'
import type {MMKV} from 'react-native-mmkv'
import type {StateStorage} from '@impos2/kernel-core-base'
import {logger} from '@impos2/kernel-core-base'

// 扩展StateStorage接口,添加MMKV特有的方法
export interface StateStorageExtended extends StateStorage {
    getAllKeys(): string[]
    clearAll(): void
    getStorageInfo(): {keyCount: number; totalSize: number; totalSizeKB: string} | null
}

// 创建专属的MMKV实例,避免与其他模块冲突
let mmkv: MMKV
let isMMKVAvailable = false

try {
    mmkv = createMMKV({
        id: 'state-storage', // 专属ID,避免冲突
    })
    // 测试MMKV是否可用
    mmkv.set('__test__', 'test')
    mmkv.remove('__test__')
    isMMKVAvailable = true
    logger.log(['StateStorage'], 'MMKV initialized successfully')
} catch (error) {
    logger.error(['StateStorage'], 'MMKV initialization failed, using memory fallback', error)
    // 降级到内存存储
    const memoryStorage = new Map<string, string>()
    mmkv = {
        id: 'state-storage-memory-fallback',
        size: 0,
        isReadOnly: false,
        set: (key: string, value: boolean | string | number | Uint8Array) => {
            memoryStorage.set(key, String(value))
        },
        getString: (key: string) => memoryStorage.get(key),
        getBoolean: (key: string) => {
            const val = memoryStorage.get(key)
            return val === 'true' ? true : val === 'false' ? false : undefined
        },
        getNumber: (key: string) => {
            const val = memoryStorage.get(key)
            return val ? Number(val) : undefined
        },
        getBuffer: (_key: string) => undefined,
        contains: (key: string) => memoryStorage.has(key),
        remove: (key: string) => {
            memoryStorage.delete(key)
        },
        getAllKeys: () => Array.from(memoryStorage.keys()),
        clearAll: () => {
            memoryStorage.clear()
        },
        recrypt: (_key: string | undefined) => {},
        addOnValueChangedListener: (_callback: (key: string) => void) => ({remove: () => {}}),
    } as MMKV
}

/**
 * StateStorage适配器实现
 * 基于MMKV提供高性能的键值存储
 * 用作redux-persist的存储引擎
 *
 * 注意事项:
 * - 仅支持JSON可序列化的数据类型(string, number, boolean, object, array, null)
 * - Date对象会被转换为ISO字符串,需要手动转换回Date
 * - Map/Set/undefined等特殊类型不支持
 * - 循环引用会导致序列化失败
 */
export const stateStorageAdapter: StateStorageExtended = {
    /**
     * 获取存储的值
     * @param key 存储键
     * @param _args 可变参数(当前未使用)
     * @returns Promise<any> 解析后的值,如果不存在返回null
     */
    getItem: async (key: string, ..._args: Array<any>): Promise<any> => {
        const startTime = Date.now()
        try {
            const val = mmkv.getString(key)
            if (val === undefined) {
                logger.debug(['StateStorage'], `getItem: key="${key}" not found`)
                return null
            }

            // 尝试解析JSON,失败则返回原始字符串
            try {
                const result = JSON.parse(val)
                logger.debug(['StateStorage'], `getItem: key="${key}" (${Date.now() - startTime}ms)`)
                return result
            } catch {
                logger.debug(['StateStorage'], `getItem: key="${key}" returned raw string`)
                return val
            }
        } catch (error) {
            logger.error(['StateStorage'], `getItem failed for key "${key}"`, error)
            return null // redux-persist期望返回null而不是抛出异常
        }
    },

    /**
     * 设置存储值
     * @param key 存储键
     * @param value 要存储的值(会被JSON序列化)
     * @param _args 可变参数(当前未使用)
     */
    setItem: async (key: string, value: any, ..._args: Array<any>): Promise<void> => {
        const startTime = Date.now()
        try {
            mmkv.set(key, JSON.stringify(value))
            logger.debug(['StateStorage'], `setItem: key="${key}" (${Date.now() - startTime}ms)`)
        } catch (error) {
            logger.error(['StateStorage'], `setItem failed for key "${key}"`, error)
            throw error // setItem失败应该抛出异常,让redux-persist知道
        }
    },

    /**
     * 删除存储的值
     * @param key 存储键
     * @param _args 可变参数(当前未使用)
     */
    removeItem: async (key: string, ..._args: Array<any>): Promise<void> => {
        try {
            mmkv.remove(key)
            logger.debug(['StateStorage'], `removeItem: key="${key}"`)
        } catch (error) {
            logger.error(['StateStorage'], `removeItem failed for key "${key}"`, error)
            // delete失败可以静默处理,因为结果是一样的(键不存在)
        }
    },

    /**
     * 获取所有存储的键
     * @returns string[] 所有键的数组
     */
    getAllKeys: (): string[] => {
        try {
            return mmkv.getAllKeys()
        } catch (error) {
            logger.error(['StateStorage'], 'getAllKeys failed', error)
            return []
        }
    },

    /**
     * 清空所有存储数据
     */
    clearAll: (): void => {
        try {
            mmkv.clearAll()
            logger.log(['StateStorage'], 'clearAll: all data cleared')
        } catch (error) {
            logger.error(['StateStorage'], 'clearAll failed', error)
        }
    },

    /**
     * 获取存储信息统计
     * @returns 存储统计信息或null(如果获取失败)
     */
    getStorageInfo: (): {keyCount: number; totalSize: number; totalSizeKB: string} | null => {
        try {
            const allKeys = mmkv.getAllKeys()
            const totalSize = mmkv.size // 直接使用MMKV的size属性
            return {
                keyCount: allKeys.length,
                totalSize,
                totalSizeKB: (totalSize / 1024).toFixed(2),
            }
        } catch (error) {
            logger.error(['StateStorage'], 'getStorageInfo failed', error)
            return null
        }
    },
}

/**
 * 导出MMKV实例供直接访问
 * 注意: 仅用于特殊场景,一般应该通过stateStorageAdapter访问
 */
export const mmkvInstance = mmkv

/**
 * 类型安全的getItem辅助函数
 * @example
 * const user = await getTypedItem<User>('user')
 */
export async function getTypedItem<T>(key: string): Promise<T | null> {
    return stateStorageAdapter.getItem(key) as Promise<T | null>
}
