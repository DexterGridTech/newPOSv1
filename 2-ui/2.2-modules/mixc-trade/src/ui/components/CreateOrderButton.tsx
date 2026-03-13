import React from 'react';
import {Animated, StyleSheet, Text, TouchableOpacity} from 'react-native';
import {useCreateOrderButton} from '../../hooks/useCreateOrderButton';

export const CreateOrderButton: React.FC = () => {
    const {orderCreationType, flashAnim, handlePress} = useCreateOrderButton();

    const isActive = orderCreationType === 'active';

    return (
        <Animated.View style={[s.wrapper, {opacity: flashAnim}]}>
            <TouchableOpacity
                style={[s.button, isActive ? s.buttonActive : s.buttonPassive]}
                onPress={handlePress}
                activeOpacity={0.55}
                accessibilityLabel={isActive ? '我要开单' : '码牌收单'}
                accessibilityRole="button"
            >
                <Text style={[s.label, isActive ? s.labelActive : s.labelPassive]}>
                    {isActive ? '我要开单' : '码牌收单'}
                </Text>
            </TouchableOpacity>
        </Animated.View>
    );
};

const s = StyleSheet.create({
    wrapper: {
        paddingHorizontal: 8,
        paddingTop: 12,
        paddingBottom: 8,
    },
    button: {
        borderRadius: 12,
        paddingVertical: 14,
        paddingHorizontal: 4,
        alignItems: 'center',
        justifyContent: 'center',
        shadowOffset: {width: 0, height: 4},
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    buttonActive: {
        backgroundColor: '#2563EB',
        shadowColor: '#2563EB',
    },
    buttonPassive: {
        backgroundColor: '#F97316',
        shadowColor: '#F97316',
    },
    label: {
        fontSize: 18,
        fontWeight: '700',
        letterSpacing: 0.5,
        textAlign: 'center',
    },
    labelActive: {
        color: '#FFFFFF',
    },
    labelPassive: {
        color: '#FFFFFF',
    },
});
