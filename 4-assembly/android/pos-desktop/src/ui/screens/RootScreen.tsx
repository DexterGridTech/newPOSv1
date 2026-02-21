import React, {useEffect, useRef} from 'react';
import {Dimensions, NativeModules, StyleSheet, Text, TouchableOpacity, View,} from 'react-native';
import {moduleName} from "../../moduleName.ts";
import {formattedTime} from "@impos2/kernel-core-base";

const {AppTurboModule} = NativeModules;

export interface AppProps {
    onLoadComplete?: () => void;
}

const RootScreen: React.FC<AppProps> = ({onLoadComplete}) => {
    const isLoadedRef = useRef(false);
    useEffect(() => {
        if (!isLoadedRef.current) {
            isLoadedRef.current = true;
            console.log(`[${moduleName}] 所有组件加载完毕，可以正常显示 - ${formattedTime()}`);
            onLoadComplete?.();
        }
    }, [onLoadComplete]);
    return (
        <View style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.text}>我是Root</Text>
                <TouchableOpacity style={styles.button} onPress={() => AppTurboModule?.restartApp?.()}>
                    <Text style={styles.buttonText}>重启</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#ffffff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        alignItems: 'center',
    },
    text: {
        marginTop: 20,
        fontSize: 16,
        color: '#666666',
    },
    button: {
        marginTop: 20,
        paddingHorizontal: 24,
        paddingVertical: 10,
        backgroundColor: '#764ba2',
        borderRadius: 8,
    },
    buttonText: {
        color: '#ffffff',
        fontSize: 16,
    },
});

export default RootScreen;
