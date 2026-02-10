import {StyleSheet} from 'react-native';

export const styles = StyleSheet.create({
    container: {
        padding: 8,
        width: '100%',
        flex: 1,
        flexDirection: 'row',
    },
    keysContainer: {
        flex: 3,
        justifyContent: 'space-around',
    },
    confirmContainer: {
        flex: 2 / 3,
        paddingLeft: 4,
        paddingRight: 8,
    },
    row: {
        flexDirection: 'row',
        width: '100%',
        flex: 1,
    },
});
