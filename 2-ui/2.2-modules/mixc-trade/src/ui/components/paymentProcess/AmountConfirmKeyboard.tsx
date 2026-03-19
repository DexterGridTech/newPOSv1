import React, {useCallback, useState} from "react";
import {Pressable, StyleSheet, Text, View} from "react-native";
import {centsToMoneyString, moneyStringToCents, updateMoneyString} from "@impos2/kernel-order-base";

interface AmountConfirmKeyboardProps {
    maxAmount: number;  // 单位：分（整数）
    onConfirm: (amount: number) => void;  // amount 单位：分（整数）
}

// 内部 hook 管理用户输入的元字符串（moneyString），不涉及 redux state
const useAmountKeyboard = (maxAmount: number, onConfirm: (amount: number) => void) => {
    // 初始值：maxAmount（分）→ 元字符串，centsToMoneyString 保证精度
    const [moneyString, setMoneyString] = useState(() => centsToMoneyString(maxAmount));

    const handleKeyPress = useCallback((char: string) => {
        setMoneyString(prev => {
            const next = updateMoneyString(prev, char);
            // 退格始终允许
            if (char === 'b') return next;
            // 校验：将输入的元字符串转为分（整数）后与 maxAmount（分）比较，避免浮点误差
            return moneyStringToCents(next) <= maxAmount ? next : prev;
        });
    }, [maxAmount]);

    const handleConfirm = useCallback(() => {
        onConfirm(moneyStringToCents(moneyString));
    }, [moneyString, onConfirm]);

    // 金额为 0 时禁用确认按钮
    const isZero = moneyStringToCents(moneyString) === 0;

    return {moneyString, isZero, handleKeyPress, handleConfirm};
};

export const AmountConfirmKeyboard: React.FC<AmountConfirmKeyboardProps> = React.memo(({maxAmount, onConfirm}) => {
    const {moneyString, isZero, handleKeyPress, handleConfirm} = useAmountKeyboard(maxAmount, onConfirm);

    return (
        <View style={styles.container}>
            <View style={styles.amountDisplay}>
                <Text style={styles.amountLabel}>收单金额</Text>
                <Text style={styles.amountValue}>{moneyString}</Text>
                {/* maxAmount（分）→ 元字符串展示 */}
                <Text style={styles.maxHint}>最大 {centsToMoneyString(maxAmount)}</Text>
            </View>
            <View style={styles.keyboard}>
                <View style={styles.mainGrid}>
                    <View style={styles.leftGrid}>
                        <View style={styles.row}>
                            <KeyButton label="1" onPress={() => handleKeyPress('1')}/>
                            <KeyButton label="2" onPress={() => handleKeyPress('2')}/>
                            <KeyButton label="3" onPress={() => handleKeyPress('3')}/>
                        </View>
                        <View style={styles.row}>
                            <KeyButton label="4" onPress={() => handleKeyPress('4')}/>
                            <KeyButton label="5" onPress={() => handleKeyPress('5')}/>
                            <KeyButton label="6" onPress={() => handleKeyPress('6')}/>
                        </View>
                        <View style={styles.row}>
                            <KeyButton label="7" onPress={() => handleKeyPress('7')}/>
                            <KeyButton label="8" onPress={() => handleKeyPress('8')}/>
                            <KeyButton label="9" onPress={() => handleKeyPress('9')}/>
                        </View>
                        <View style={styles.row}>
                            <KeyButton label="0" onPress={() => handleKeyPress('0')}/>
                            <KeyButton label="." onPress={() => handleKeyPress('.')} wide/>
                        </View>
                    </View>
                    <View style={styles.rightColumn}>
                        <KeyButton label="退格" onPress={() => handleKeyPress('b')}/>
                        <KeyButton label="确认" onPress={handleConfirm} primary disabled={isZero}/>
                    </View>
                </View>
            </View>
        </View>
    );
});

interface KeyButtonProps {
    label: string;
    onPress: () => void;
    wide?: boolean;
    primary?: boolean;
    disabled?: boolean;
}

const KeyButton: React.FC<KeyButtonProps> = ({label, onPress, wide = false, primary = false, disabled = false}) => (
    <Pressable
        style={({pressed}) => [
            styles.key,
            wide && styles.keyWide,
            primary && styles.keyPrimary,
            disabled && styles.keyDisabled,
            pressed && !disabled && styles.keyPressed,
        ]}
        onPress={disabled ? undefined : onPress}
    >
        <Text
            style={[styles.keyText, primary && styles.keyTextPrimary, disabled && styles.keyTextDisabled]}>{label}</Text>
    </Pressable>
);

const styles = StyleSheet.create({
    container: {
        gap: 12,
    },
    amountDisplay: {
        alignItems: 'flex-end',
        paddingVertical: 8,
        paddingHorizontal: 4,
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    amountLabel: {
        fontSize: 12,
        color: '#94A3B8',
    },
    amountValue: {
        fontSize: 32,
        fontWeight: '700',
        color: '#1E293B',
        marginTop: 4,
    },
    maxHint: {
        fontSize: 11,
        color: '#94A3B8',
        marginTop: 2,
    },
    keyboard: {
        height: 260,
    },
    mainGrid: {
        flex: 1,
        flexDirection: 'row',
        gap: 8,
    },
    leftGrid: {
        flex: 3,
        gap: 8,
    },
    rightColumn: {
        flex: 1,
        gap: 8,
    },
    row: {
        flex: 1,
        flexDirection: 'row',
        gap: 8,
    },
    key: {
        flex: 1,
        backgroundColor: '#F8FAFC',
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    keyWide: {
        flex: 2,
    },
    keyPrimary: {
        backgroundColor: '#2563EB',
        borderColor: '#2563EB',
    },
    keyDisabled: {
        backgroundColor: '#CBD5E1',
        borderColor: '#CBD5E1',
    },
    keyPressed: {
        backgroundColor: '#E2E8F0',
        transform: [{scale: 0.96}],
    },
    keyText: {
        fontSize: 20,
        fontWeight: '500',
        color: '#1E293B',
    },
    keyTextPrimary: {
        color: '#FFFFFF',
    },
    keyTextDisabled: {
        color: '#94A3B8',
    },
});
