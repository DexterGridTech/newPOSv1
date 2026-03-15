import React, {useCallback} from "react";
import {useLifecycle} from "@impos2/ui-core-base";
import {Text, View, Pressable, StyleSheet} from "react-native";
import {useSelector} from "react-redux";
import {selectSelectedProductOrder, kernelMixcOrderCreateTraditionalCommands} from "@impos2/kernel-mixc-order-create-traditional";
import {shortId} from "@impos2/kernel-core-base";

export const PriceKeyboard: React.FC = () => {
    const selectedProductOrder = useSelector(selectSelectedProductOrder);
    const disabled = !selectedProductOrder || selectedProductOrder.length === 0;

    useLifecycle({
        componentName: 'PriceKeyboard',
        onInitiated: useCallback(() => {}, []),
        onClearance: useCallback(() => {}, []),
    });

    const handleKeyPress = useCallback((char: string) => {
        console.log('Key pressed:', char);
        kernelMixcOrderCreateTraditionalCommands.setProductPrice({char}).execute(shortId());
    }, []);

    const handleConfirm = useCallback(() => {
        console.log('Confirm pressed, selectedProductOrder:', selectedProductOrder);
        if (selectedProductOrder && selectedProductOrder.length > 0) {
            kernelMixcOrderCreateTraditionalCommands.selectProductOrder({productId: selectedProductOrder}).execute(shortId());
        }
    }, [selectedProductOrder]);

    const handlePress1 = useCallback(() => handleKeyPress('1'), [handleKeyPress]);
    const handlePress2 = useCallback(() => handleKeyPress('2'), [handleKeyPress]);
    const handlePress3 = useCallback(() => handleKeyPress('3'), [handleKeyPress]);
    const handlePress4 = useCallback(() => handleKeyPress('4'), [handleKeyPress]);
    const handlePress5 = useCallback(() => handleKeyPress('5'), [handleKeyPress]);
    const handlePress6 = useCallback(() => handleKeyPress('6'), [handleKeyPress]);
    const handlePress7 = useCallback(() => handleKeyPress('7'), [handleKeyPress]);
    const handlePress8 = useCallback(() => handleKeyPress('8'), [handleKeyPress]);
    const handlePress9 = useCallback(() => handleKeyPress('9'), [handleKeyPress]);
    const handlePress0 = useCallback(() => handleKeyPress('0'), [handleKeyPress]);
    const handlePressDot = useCallback(() => handleKeyPress('.'), [handleKeyPress]);
    const handlePressBackspace = useCallback(() => handleKeyPress('b'), [handleKeyPress]);

    return (
        <View style={styles.container}>
            <View style={styles.mainGrid}>
                <View style={styles.leftGrid}>
                    <View style={styles.row}>
                        <KeyButton label="1" onPress={handlePress1} disabled={disabled} />
                        <KeyButton label="2" onPress={handlePress2} disabled={disabled} />
                        <KeyButton label="3" onPress={handlePress3} disabled={disabled} />
                    </View>
                    <View style={styles.row}>
                        <KeyButton label="4" onPress={handlePress4} disabled={disabled} />
                        <KeyButton label="5" onPress={handlePress5} disabled={disabled} />
                        <KeyButton label="6" onPress={handlePress6} disabled={disabled} />
                    </View>
                    <View style={styles.row}>
                        <KeyButton label="7" onPress={handlePress7} disabled={disabled} />
                        <KeyButton label="8" onPress={handlePress8} disabled={disabled} />
                        <KeyButton label="9" onPress={handlePress9} disabled={disabled} />
                    </View>
                    <View style={styles.row}>
                        <KeyButton label="0" onPress={handlePress0} disabled={disabled} />
                        <KeyButton label="." onPress={handlePressDot} disabled={disabled} wide />
                    </View>
                </View>
                <View style={styles.rightColumn}>
                    <KeyButton label="退格" onPress={handlePressBackspace} disabled={disabled} />
                    <KeyButton label="确认" onPress={handleConfirm} disabled={disabled} primary />
                </View>
            </View>
        </View>
    );
};

interface KeyButtonProps {
    label: string;
    onPress: () => void;
    disabled: boolean;
    wide?: boolean;
    primary?: boolean;
}

const KeyButton: React.FC<KeyButtonProps> = ({label, onPress, disabled, wide = false, primary = false}) => {
    return (
        <Pressable
            style={({pressed}) => [
                styles.key,
                wide && styles.keyWide,
                primary && styles.keyPrimary,
                disabled && styles.keyDisabled,
                pressed && !disabled && styles.keyPressed,
            ]}
            onPress={onPress}
            disabled={disabled}
        >
            <Text style={[styles.keyText, primary && styles.keyTextPrimary, disabled && styles.keyTextDisabled]}>{label}</Text>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
        backgroundColor: '#F8F9FA',
    },
    mainGrid: {
        flex: 1,
        flexDirection: 'row',
        gap: 12,
    },
    leftGrid: {
        flex: 3,
        gap: 12,
    },
    rightColumn: {
        flex: 1,
        gap: 12,
    },
    row: {
        flex: 1,
        flexDirection: 'row',
        gap: 12,
    },
    key: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    keyWide: {
        flex: 2,
    },
    keyPrimary: {
        backgroundColor: '#4A90E2',
    },
    keyDisabled: {
        backgroundColor: '#E9ECEF',
        shadowOpacity: 0,
        elevation: 0,
    },
    keyPressed: {
        backgroundColor: '#E3F2FD',
        transform: [{scale: 0.95}],
    },
    keyText: {
        fontSize: 24,
        fontWeight: '600',
        color: '#212529',
    },
    keyTextPrimary: {
        color: '#FFFFFF',
    },
    keyTextDisabled: {
        color: '#ADB5BD',
    },
});