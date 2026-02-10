import {StyleSheet} from 'react-native';

export const styles = StyleSheet.create({
    container: {
        paddingVertical: 4,
        paddingHorizontal: 2,
        width: '100%',
        flex: 1,
        flexDirection: 'row',
    },
    keysContainer: {
        flex: 10,
        justifyContent: 'space-around',
    },
    confirmContainer: {
        flex: 2,
        paddingLeft: 2,
        paddingRight: 2,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'stretch',
        width: '100%',
        flex: 1,
        minHeight: 0,
    },
});
