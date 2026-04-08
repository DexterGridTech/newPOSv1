import React from "react";
import {Text, View} from "react-native";
import {ScreenMode, ScreenPartRegistration} from "@impos2/kernel-core-base";
import {InstanceMode, Workspace} from "@impos2/kernel-core-interconnection";
import {defaultAlertPart, uiRuntimeBaseUiVariables} from "../src";

const createNamedScreen = (
    registration: Omit<ScreenPartRegistration, 'componentType'> & {
        backgroundColor: string
        accentColor: string
        body: string
    }
): ScreenPartRegistration => {
    const Component = () => (
        <View style={{flex: 1, backgroundColor: registration.backgroundColor, padding: 24, justifyContent: 'center'}}>
            <View style={{gap: 12, borderRadius: 24, backgroundColor: '#FFFFFF', padding: 24}}>
                <Text style={{fontSize: 28, fontWeight: '700', color: '#0F172A'}}>{registration.title}</Text>
                <Text style={{fontSize: 15, lineHeight: 22, color: '#475569'}}>{registration.body}</Text>
                <View style={{height: 12, width: 72, borderRadius: 999, backgroundColor: registration.accentColor}} />
            </View>
        </View>
    );

    return {
        ...registration,
        componentType: Component,
    };
};

export const runtimeBaseDevScreenParts = {
    defaultAlert: defaultAlertPart,
    primaryHome: createNamedScreen({
        partKey: 'runtime-base.dev.primary.home',
        name: 'RuntimeBasePrimaryHome',
        title: 'Primary Home',
        description: 'Primary home screen for runtime-base dev',
        body: 'This screen verifies showScreen for the primary container and acts as the default primary runtime view.',
        backgroundColor: '#E0F2FE',
        accentColor: '#0284C7',
        containerKey: uiRuntimeBaseUiVariables.primaryRootContainer.key,
        indexInContainer: 0,
        screenMode: [ScreenMode.DESKTOP],
        workspace: [Workspace.MAIN],
        instanceMode: [InstanceMode.MASTER, InstanceMode.SLAVE],
    }),
    primaryCheckout: createNamedScreen({
        partKey: 'runtime-base.dev.primary.checkout',
        name: 'RuntimeBasePrimaryCheckout',
        title: 'Primary Checkout',
        description: 'Alternative primary screen for replaceScreen verification',
        body: 'This screen verifies replaceScreen and lets the Expo dev app show a visible runtime transition.',
        backgroundColor: '#FDE68A',
        accentColor: '#D97706',
        containerKey: uiRuntimeBaseUiVariables.primaryRootContainer.key,
        indexInContainer: 1,
        screenMode: [ScreenMode.DESKTOP],
        workspace: [Workspace.MAIN],
        instanceMode: [InstanceMode.MASTER, InstanceMode.SLAVE],
    }),
    secondaryWelcome: createNamedScreen({
        partKey: 'runtime-base.dev.secondary.welcome',
        name: 'RuntimeBaseSecondaryWelcome',
        title: 'Secondary Welcome',
        description: 'Secondary display default screen',
        body: 'This screen is visible when the app is started as displayIndex=1 and helps verify dual-display linkage.',
        backgroundColor: '#DCFCE7',
        accentColor: '#16A34A',
        containerKey: uiRuntimeBaseUiVariables.secondaryRootContainer.key,
        indexInContainer: 0,
        screenMode: [ScreenMode.DESKTOP],
        workspace: [Workspace.MAIN],
        instanceMode: [InstanceMode.SLAVE],
    }),
    secondaryMirror: createNamedScreen({
        partKey: 'runtime-base.dev.secondary.mirror',
        name: 'RuntimeBaseSecondaryMirror',
        title: 'Secondary Mirror',
        description: 'Secondary mirror screen used to verify synced screen updates',
        body: 'Use this when checking that primary-originated state changes are visible on the secondary display runtime.',
        backgroundColor: '#FCE7F3',
        accentColor: '#DB2777',
        containerKey: uiRuntimeBaseUiVariables.primaryRootContainer.key,
        indexInContainer: 0,
        screenMode: [ScreenMode.DESKTOP],
        workspace: [Workspace.MAIN],
        instanceMode: [InstanceMode.SLAVE],
    }),
};
