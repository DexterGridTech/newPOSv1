import React, {useState, useCallback, useEffect, useRef, memo} from 'react';
import {View, TouchableOpacity, Text, StyleSheet, Animated, Platform, Dimensions} from 'react-native';

const {height: screenHeight} = Dimensions.get('window');
const iconFontSize = Math.max(24, Math.min(36, screenHeight * 0.035));

const SYMBOL_LAYOUT = {
    row1: ['1','2','3','4','5','6','7','8','9','0'],
    row2: ['!','@','#','$','%','^','&','*','(',')'],
    row3: ['-','_','=','+','[',']','{','}','|','\\'],
    row4: ['/',':', ';','"',"'",'<','>','?',',','.'],
};

interface FancyFullKeyBoardV2Props {
    onKeyPress: (key: string) => void;
    onCancel: () => void;
    onConfirm: () => void;
    shouldShake?: boolean;
    hasChanges?: boolean;
}

// 单个按键 memo：接收 value + onKeyPress，内部构造 onPress，onKeyPress 稳定时不重渲染
const KeyButton = memo<{label: string; value: string; onKeyPress: (v: string) => void; style?: any; textStyle?: any}>(
    ({label, value, onKeyPress, style, textStyle}) => {
        const handlePress = useCallback(() => onKeyPress(value), [onKeyPress, value]);
        return (
            <TouchableOpacity style={[styles.key, style]} onPress={handlePress} activeOpacity={0.6}>
                <Text style={[styles.keyText, textStyle]}>{label}</Text>
            </TouchableOpacity>
        );
    }
);

// 操作按钮区单独 memo，只在 hasChanges/shouldShake 变化时重渲染，与按键区完全隔离
const ActionButtons = memo<{
    hasChanges: boolean;
    shouldShake: boolean;
    onCancel: () => void;
    onConfirm: () => void;
}>(({hasChanges, shouldShake, onCancel, onConfirm}) => {
    const shakeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (shouldShake) {
            const useNative = Platform.OS !== 'web';
            Animated.sequence([
                Animated.timing(shakeAnim, {toValue: 10, duration: 50, useNativeDriver: useNative}),
                Animated.timing(shakeAnim, {toValue: -10, duration: 50, useNativeDriver: useNative}),
                Animated.timing(shakeAnim, {toValue: 10, duration: 50, useNativeDriver: useNative}),
                Animated.timing(shakeAnim, {toValue: -10, duration: 50, useNativeDriver: useNative}),
                Animated.timing(shakeAnim, {toValue: 0, duration: 50, useNativeDriver: useNative}),
            ]).start();
        }
    }, [shouldShake]);

    if (!hasChanges) {
        return (
            <TouchableOpacity style={styles.closeButtonFull} onPress={onCancel} activeOpacity={0.7}>
                <Text style={styles.closeButtonText}>关闭</Text>
            </TouchableOpacity>
        );
    }
    return (
        <>
            <TouchableOpacity style={styles.cancelButton} onPress={onCancel} activeOpacity={0.7}>
                <Text style={styles.cancelButtonText}>取消</Text>
            </TouchableOpacity>
            <Animated.View style={{flex: 1, transform: [{translateX: shakeAnim}]}}>
                <TouchableOpacity style={[styles.confirmButton, StyleSheet.absoluteFillObject]} onPress={onConfirm} activeOpacity={0.7}>
                    <Text style={styles.confirmButtonText}>确认</Text>
                </TouchableOpacity>
            </Animated.View>
        </>
    );
});

export const FancyFullKeyBoardV2: React.FC<FancyFullKeyBoardV2Props> = memo(
    ({onKeyPress, onCancel, onConfirm, shouldShake = false, hasChanges = false}) => {
        const [isUpperCase, setIsUpperCase] = useState(false);
        const [isSymbolMode, setIsSymbolMode] = useState(false);

        // 用 ref 持有最新 isUpperCase，handleKeyPress 不因大小写切换而重建
        const isUpperCaseRef = useRef(isUpperCase);
        isUpperCaseRef.current = isUpperCase;

        const handleKeyPress = useCallback((value: string) => {
            if (value === 'SHIFT') {
                setIsUpperCase((prev) => !prev);
            } else if (value === 'SYMBOL') {
                setIsSymbolMode((prev) => !prev);
            } else {
                onKeyPress(value);
                if (isUpperCaseRef.current && value.length === 1 && /[a-zA-Z]/.test(value)) {
                    setIsUpperCase(false);
                }
            }
        }, [onKeyPress]);

        const letterLayout = {
            row1: isUpperCase ? ['Q','W','E','R','T','Y','U','I','O','P'] : ['q','w','e','r','t','y','u','i','o','p'],
            row2: isUpperCase ? ['A','S','D','F','G','H','J','K','L','@'] : ['a','s','d','f','g','h','j','k','l','@'],
            row3: isUpperCase ? ['Z','X','C','V','B','N','M','.','-','_'] : ['z','x','c','v','b','n','m','.','-','_'],
        };

        const renderRow = (keys: string[], rowId: string) =>
            keys.map((key, index) => (
                <KeyButton key={`${rowId}-${index}`} label={key} value={key} onKeyPress={handleKeyPress}/>
            ));

        return (
            <View style={styles.container}>
                <View style={styles.keyboardMain}>
                    <View style={styles.row}>{renderRow(isSymbolMode ? SYMBOL_LAYOUT.row1 : letterLayout.row1, 'r1')}</View>
                    <View style={styles.row}>{renderRow(isSymbolMode ? SYMBOL_LAYOUT.row2 : letterLayout.row2, 'r2')}</View>
                    <View style={styles.row}>{renderRow(isSymbolMode ? SYMBOL_LAYOUT.row3 : letterLayout.row3, 'r3')}</View>
                    <View style={styles.row}>
                        {isSymbolMode ? (
                            <>
                                <KeyButton label="ABC" value="SYMBOL" onKeyPress={handleKeyPress} style={styles.functionKey} textStyle={styles.functionKeyText}/>
                                {SYMBOL_LAYOUT.row4.slice(0, 8).map((key, i) => (
                                    <KeyButton key={`r4-${i}`} label={key} value={key} onKeyPress={handleKeyPress}/>
                                ))}
                                <KeyButton label="⌫" value="DELETE" onKeyPress={handleKeyPress} style={styles.functionKey} textStyle={[styles.functionKeyText, {fontSize: iconFontSize}]}/>
                            </>
                        ) : (
                            <>
                                <KeyButton label="⇧" value="SHIFT" onKeyPress={handleKeyPress} style={[styles.functionKey, isUpperCase && styles.activeShift]} textStyle={[styles.functionKeyText, isUpperCase && styles.activeShiftText, {fontSize: iconFontSize}]}/>
                                <KeyButton label="123#" value="SYMBOL" onKeyPress={handleKeyPress} style={[styles.functionKey, isSymbolMode && styles.activeSymbol]} textStyle={[styles.functionKeyText, isSymbolMode && styles.activeSymbolText]}/>
                                <KeyButton label="空格" value=" " onKeyPress={handleKeyPress} style={styles.spaceKey}/>
                                <KeyButton label="⌫" value="DELETE" onKeyPress={handleKeyPress} style={styles.functionKey} textStyle={[styles.functionKeyText, {fontSize: iconFontSize}]}/>
                            </>
                        )}
                    </View>
                </View>
                <View style={styles.actionButtons}>
                    <ActionButtons hasChanges={hasChanges} shouldShake={shouldShake} onCancel={onCancel} onConfirm={onConfirm}/>
                </View>
            </View>
        );
    }
);

// ─── Design Tokens（与 FancyNumberKeyBoardV2 保持一致）────────────────────────
const T = {
    bg: '#E8ECF0',
    keyBg: '#FFFFFF',
    keyText: '#1A2332',
    keyRadius: 8,
    keyElevation: 2,
    fnKeyBg: '#64748B',
    fnKeyText: '#FFFFFF',
    activeKeyBg: '#2563EB',
    activeKeyText: '#FFFFFF',
    deleteBg: '#CBD5E1',
    deleteText: '#334155',
    confirmBg: '#16A34A',
    confirmText: '#FFFFFF',
    cancelBg: '#DC2626',
    cancelText: '#FFFFFF',
    closeBg: '#94A3B8',
    closeText: '#FFFFFF',
    fontKey: 18 as const,
    fontFn: 16 as const,
    fontAction: 17 as const,
    fontWeight600: '600' as const,
    fontWeight700: '700' as const,
};

const styles = StyleSheet.create({
    container: {flex: 1, flexDirection: 'row', backgroundColor: T.bg, padding: 6, gap: 6},
    keyboardMain: {flex: 1, gap: 4},
    row: {flexDirection: 'row', gap: 5, flex: 1},
    key: {flex: 1, backgroundColor: T.keyBg, borderRadius: T.keyRadius, justifyContent: 'center', alignItems: 'center', elevation: T.keyElevation},
    keyText: {fontSize: T.fontKey, fontWeight: T.fontWeight600, color: T.keyText},
    functionKey: {backgroundColor: T.fnKeyBg},
    functionKeyText: {fontSize: T.fontFn, fontWeight: T.fontWeight700, color: T.fnKeyText},
    spaceKey: {flex: 6},
    activeShift: {backgroundColor: T.activeKeyBg},
    activeShiftText: {color: T.activeKeyText},
    activeSymbol: {backgroundColor: T.activeKeyBg},
    activeSymbolText: {color: T.activeKeyText},
    actionButtons: {width: 100, gap: 6},
    cancelButton: {flex: 1, backgroundColor: T.cancelBg, borderRadius: T.keyRadius, justifyContent: 'center', alignItems: 'center', elevation: 3},
    cancelButtonText: {fontSize: T.fontAction, fontWeight: T.fontWeight700, color: T.cancelText},
    closeButtonFull: {flex: 1, backgroundColor: T.closeBg, borderRadius: T.keyRadius, justifyContent: 'center', alignItems: 'center', elevation: 2},
    closeButtonText: {fontSize: T.fontAction, fontWeight: T.fontWeight700, color: T.closeText},
    confirmButton: {flex: 1, backgroundColor: T.confirmBg, borderRadius: T.keyRadius, justifyContent: 'center', alignItems: 'center', elevation: 4},
    confirmButtonText: {fontSize: T.fontAction, fontWeight: T.fontWeight700, color: T.confirmText},
});
