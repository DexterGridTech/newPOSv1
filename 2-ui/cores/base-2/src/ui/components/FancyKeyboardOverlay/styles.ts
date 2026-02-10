import {StyleSheet} from 'react-native';

export const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'flex-end',
        zIndex: 9999,
        elevation: 9999,
    },
    keyboardContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 10000,
        elevation: 10000,
    },
});
