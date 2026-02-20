// 使用类型断言避免 TypeScript 类型检查错误
async function detectEnvironment(): Promise<'react-native-android' | 'react-native-ios' | 'react-native-web' | 'node' | 'browser'> {
    // 检查是否在 Node.js 环境
    if (typeof process !== 'undefined' && (process as any).versions && (process as any).versions.node) {
        // 进一步检查是否是 React Native
        if (typeof navigator !== 'undefined' && (navigator as any).product === 'ReactNative') {
            // 检查平台
            try {
                // @ts-ignore - 动态导入，编译时可能不存在
                const { Platform } = await import('react-native');
                if (Platform.OS === 'android') {
                    return 'react-native-android';
                } else if (Platform.OS === 'ios') {
                    return 'react-native-ios';
                }
            } catch {
                // 如果导入失败，返回 node
            }
        }
        return 'node';
    }

    // 检查是否是浏览器环境
    if (typeof (globalThis as any).window !== 'undefined' && typeof (globalThis as any).document !== 'undefined') {
        if (typeof navigator !== 'undefined' && (navigator as any).product === 'ReactNative') {
            return 'react-native-web';
        }
        return 'browser';
    }

    return 'node';
}

// 简洁版本
export const Platform = {
    isReactNative: typeof navigator !== 'undefined' && (navigator as any).product === 'ReactNative',
    isWeb: typeof (globalThis as any).window !== 'undefined' && typeof (globalThis as any).document !== 'undefined',
    isNode: typeof process !== 'undefined' && !!(process as any).versions?.node,
};

export const isReactNativeWeb = Platform.isReactNative && Platform.isWeb;
export const isReactNativeNative = Platform.isReactNative && !Platform.isWeb;

export const isReactNativeAndroid = (async () => {
    if (!isReactNativeNative) return false;
    try {
        // @ts-ignore - 动态导入，编译时可能不存在
        const { Platform: RNPlatform } = await import('react-native');
        return RNPlatform.OS === 'android';
    } catch {
        return false;
    }
})();

export const isPureNode = Platform.isNode && !Platform.isReactNative;