import React from 'react';
import {View, TextInput, StyleSheet, Dimensions} from 'react-native';
import {ActiveInputInfo} from '../../../contexts/FancyKeyboardContext';

interface InputMaskProps {
    activeInput: ActiveInputInfo;
}

/**
 * 输入框镜像组件
 * 显示在屏幕上方 1/3 处
 */
export const InputMask: React.FC<InputMaskProps> = ({activeInput}) => {
    const screenHeight = Dimensions.get('window').height;
    const targetY = screenHeight / 3;

    return (
        <View
            style={[
                styles.container,
                {
                    top: targetY,
                    left: activeInput.position.x,
                    width: activeInput.position.width,
                    height: activeInput.position.height,
                },
            ]}
        >
            <TextInput
                value={activeInput.value}
                editable={false}
                style={styles.input}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderColor: '#3B82F6',
        borderRadius: 4,
    },
    input: {
        flex: 1,
        padding: 10,
        fontSize: 16,
        color: '#FFFFFF',
    },
});
