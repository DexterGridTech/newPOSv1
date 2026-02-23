import React, {useCallback, useEffect, useRef} from 'react';
import {Animated, Easing, StyleSheet, Text, View} from 'react-native';
import {uiBaseCoreUiVariables, useLifecycle} from "@impos2/ui-core-base";
import {ScreenMode, ScreenPartRegistration} from "@impos2/kernel-core-base";
import {InstanceMode, Workspace} from "@impos2/kernel-core-interconnection";

// ─── Orb ─────────────────────────────────────────────────────────────────────
const Orb: React.FC<{
    size: number; color: string;
    style: object; duration: number; delay: number;
}> = ({size, color, style, duration, delay}) => {
    const y = useRef(new Animated.Value(0)).current;
    const scale = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.delay(delay),
                Animated.parallel([
                    Animated.timing(y, {toValue: -28, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true}),
                    Animated.timing(scale, {toValue: 1.08, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true}),
                ]),
                Animated.parallel([
                    Animated.timing(y, {toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true}),
                    Animated.timing(scale, {toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true}),
                ]),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, []);

    return (
        <Animated.View style={[{
            position: 'absolute', width: size, height: size, borderRadius: size / 2,
            backgroundColor: color, opacity: 0.18,
            transform: [{translateY: y}, {scale}],
        }, style]}/>
    );
};

// ─── Shimmer line ─────────────────────────────────────────────────────────────
const ShimmerLine: React.FC<{delay: number}> = ({delay}) => {
    const opacity = useRef(new Animated.Value(0.3)).current;
    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.delay(delay),
                Animated.timing(opacity, {toValue: 1, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true}),
                Animated.timing(opacity, {toValue: 0.3, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true}),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, []);
    return <Animated.View style={[s.shimmerLine, {opacity}]}/>;
};

// ─── Component ───────────────────────────────────────────────────────────────
export const SecondaryWelComeScreen: React.FC = () => {
    const titleOpacity = useRef(new Animated.Value(0)).current;
    const titleY = useRef(new Animated.Value(20)).current;
    const subOpacity = useRef(new Animated.Value(0)).current;
    const dividerScale = useRef(new Animated.Value(0)).current;

    useLifecycle({
        componentName: 'SecondaryWelComeScreen',
        onInitiated: useCallback(() => {}, []),
        onClearance: useCallback(() => {}, []),
    });

    useEffect(() => {
        Animated.sequence([
            Animated.delay(300),
            Animated.parallel([
                Animated.timing(titleOpacity, {toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true}),
                Animated.timing(titleY, {toValue: 0, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true}),
            ]),
            Animated.parallel([
                Animated.timing(dividerScale, {toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true}),
                Animated.timing(subOpacity, {toValue: 1, duration: 700, easing: Easing.out(Easing.ease), useNativeDriver: true}),
            ]),
        ]).start();
    }, []);

    return (
        <View style={s.root}>
            {/* Background orbs */}
            <Orb size={520} color="#4F46E5" style={{top: -120, left: -160}} duration={5200} delay={0}/>
            <Orb size={400} color="#7C3AED" style={{bottom: -80, right: -100}} duration={6400} delay={800}/>
            <Orb size={280} color="#B45309" style={{top: '30%', right: '10%'}} duration={4800} delay={400}/>
            <Orb size={200} color="#0EA5E9" style={{bottom: '20%', left: '5%'}} duration={5600} delay={1200}/>

            {/* Grid overlay */}
            <View style={s.grid} pointerEvents="none"/>

            {/* Center content */}
            <View style={s.center}>
                <ShimmerLine delay={0}/>
                <ShimmerLine delay={600}/>

                <Animated.View style={{opacity: titleOpacity, transform: [{translateY: titleY}]}}>
                    <Text style={s.sub}>WELCOME TO</Text>
                    <Text style={s.title}>欢迎来到万象城</Text>
                </Animated.View>

                <Animated.View style={[s.dividerWrap, {transform: [{scaleX: dividerScale}]}]}>
                    <View style={s.dividerLeft}/>
                    <View style={s.diamond}/>
                    <View style={s.dividerRight}/>
                </Animated.View>

                <Animated.Text style={[s.tagline, {opacity: subOpacity}]}>
                    尊享购物 · 品味生活
                </Animated.Text>
            </View>

            {/* Bottom brand */}
            <Animated.Text style={[s.brand, {opacity: subOpacity}]}>MIXC WORLD</Animated.Text>
        </View>
    );
};

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
    root: {
        flex: 1, backgroundColor: '#080B14',
        justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
    },
    grid: {
        position: 'absolute', inset: 0,
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
    } as any,
    center: {alignItems: 'center', gap: 0},
    shimmerLine: {
        width: 1, height: 60, backgroundColor: '#C9A84C', marginBottom: 32,
    },
    sub: {
        fontSize: 13, letterSpacing: 8, color: '#C9A84C',
        fontWeight: '300', textAlign: 'center', marginBottom: 16,
    },
    title: {
        fontSize: 52, fontWeight: '300', color: '#F5EDD6',
        letterSpacing: 12, textAlign: 'center',
    },
    dividerWrap: {
        flexDirection: 'row', alignItems: 'center',
        marginTop: 28, marginBottom: 24, width: 280,
    },
    dividerLeft: {flex: 1, height: 1, backgroundColor: '#C9A84C', opacity: 0.6},
    dividerRight: {flex: 1, height: 1, backgroundColor: '#C9A84C', opacity: 0.6},
    diamond: {
        width: 6, height: 6, backgroundColor: '#C9A84C',
        transform: [{rotate: '45deg'}], marginHorizontal: 10,
    },
    tagline: {
        fontSize: 14, letterSpacing: 6, color: '#8B7355',
        fontWeight: '300', textAlign: 'center',
    },
    brand: {
        position: 'absolute', bottom: 36,
        fontSize: 11, letterSpacing: 10, color: '#3D3520',
        fontWeight: '400',
    },
});

// ─── Registration ─────────────────────────────────────────────────────────────
export const secondaryWelComeScreenPart: ScreenPartRegistration = {
    name: 'secondaryWelComeScreen',
    title: '副屏欢迎界面',
    description: '副屏欢迎界面（桌面版）',
    partKey: 'secondaryWelCome',
    containerKey: uiBaseCoreUiVariables.rootScreenContainer.key,
    screenMode: [ScreenMode.DESKTOP],
    workspace: [Workspace.MAIN],
    instanceMode: [InstanceMode.SLAVE],
    componentType: SecondaryWelComeScreen,
    indexInContainer: 1,
}
