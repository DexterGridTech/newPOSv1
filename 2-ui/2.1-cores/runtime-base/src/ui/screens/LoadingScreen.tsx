import React from 'react';
import {ActivityIndicator, Dimensions, StyleSheet, Text, View} from 'react-native';

const {width, height} = Dimensions.get('window');

const LoadingScreen: React.FC = () => (
    <View style={styles.container}>
        <View style={styles.center}>
            <View style={styles.outerRing} />
            <ActivityIndicator size={100} color="#FFFFFF" style={styles.spinner} />
        </View>
        <Text style={styles.title}>IMPos2 Desktop</Text>
        <Text style={styles.subtitle}>正在加载...</Text>
        <Text style={styles.version}>Version 1.0</Text>
    </View>
);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        width,
        height,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#764ba2',
    },
    center: {
        width: 140,
        height: 140,
        justifyContent: 'center',
        alignItems: 'center',
    },
    outerRing: {
        position: 'absolute',
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 4,
        borderColor: 'rgba(255,255,255,0.6)',
    },
    spinner: {
        position: 'absolute',
    },
    title: {
        marginTop: 40,
        fontSize: 28,
        fontWeight: 'bold',
        color: '#FFFFFF',
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: {width: 2, height: 2},
        textShadowRadius: 4,
    },
    subtitle: {
        marginTop: 16,
        fontSize: 16,
        color: 'rgba(255,255,255,0.9)',
    },
    version: {
        position: 'absolute',
        bottom: 40,
        fontSize: 12,
        color: 'rgba(255,255,255,0.7)',
    },
});

export default LoadingScreen;
