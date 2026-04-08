import React, {useEffect, useMemo, useState} from 'react';
import {Provider, useSelector} from 'react-redux';
import {PersistGate} from "redux-persist/integration/react";
import type {Store} from '@reduxjs/toolkit';
import type {Persistor} from 'redux-persist';
import {
    RootState,
    kernelCoreBaseCommands,
    type ScreenPart
} from "@impos2/kernel-core-base";
import {
    DisplayMode,
    InstanceMode,
    ServerConnectionStatus,
    Workspace,
    kernelCoreInterconnectionParameters,
    kernelCoreInterconnectionState,
    selectDisplayMode
} from "@impos2/kernel-core-interconnection";
import {
    FancyContainerV2,
    FancyKeyboardOverlayV2,
    FancyKeyboardProviderV2,
    ModalContainer,
    ScreenContainer,
    uiRuntimeBaseUiVariables
} from "@impos2/ui-core-runtime-base";
import {
    defaultAlertPartKey,
    kernelCoreUiRuntimeCommands,
    selectCurrentOverlays,
    selectCurrentScreen,
    selectUiVariable
} from "@impos2/kernel-core-ui-runtime";
import {
    createDevStore,
    getDevBootOptions,
    storePromise
} from "./store";
import {runtimeBaseDevScreenParts} from "./screens";
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View
} from "react-native";

type StoreReadyState = { store: Store; persistor: Persistor };

const DEV_ORDER_KEY = 'runtime-base.dev.orderNo';
const DEV_NOTES_KEY = 'runtime-base.dev.notes';
const DEV_MIRROR_KEY = 'runtime-base.dev.secondary.message';
const OVERLAY_ID = 'runtime-base.dev.alert';

const PRIMARY_HOME_SCREEN: ScreenPart<any> = {
    partKey: runtimeBaseDevScreenParts.primaryHome.partKey,
    name: runtimeBaseDevScreenParts.primaryHome.name,
    title: runtimeBaseDevScreenParts.primaryHome.title,
    description: runtimeBaseDevScreenParts.primaryHome.description,
    containerKey: runtimeBaseDevScreenParts.primaryHome.containerKey,
};

const PRIMARY_CHECKOUT_SCREEN: ScreenPart<any> = {
    partKey: runtimeBaseDevScreenParts.primaryCheckout.partKey,
    name: runtimeBaseDevScreenParts.primaryCheckout.name,
    title: runtimeBaseDevScreenParts.primaryCheckout.title,
    description: runtimeBaseDevScreenParts.primaryCheckout.description,
    containerKey: runtimeBaseDevScreenParts.primaryCheckout.containerKey,
};

const SECONDARY_MIRROR_SCREEN: ScreenPart<any> = {
    partKey: runtimeBaseDevScreenParts.secondaryMirror.partKey,
    name: runtimeBaseDevScreenParts.secondaryMirror.name,
    title: runtimeBaseDevScreenParts.secondaryMirror.title,
    description: runtimeBaseDevScreenParts.secondaryMirror.description,
    containerKey: runtimeBaseDevScreenParts.secondaryMirror.containerKey,
};

const SECONDARY_WELCOME_SCREEN: ScreenPart<any> = {
    partKey: runtimeBaseDevScreenParts.secondaryWelcome.partKey,
    name: runtimeBaseDevScreenParts.secondaryWelcome.name,
    title: runtimeBaseDevScreenParts.secondaryWelcome.title,
    description: runtimeBaseDevScreenParts.secondaryWelcome.description,
    containerKey: runtimeBaseDevScreenParts.secondaryWelcome.containerKey,
};

function applyFastInterconnectionParameters() {
    kernelCoreBaseCommands.updateSystemParameters({
        [kernelCoreInterconnectionParameters.masterServerBootstrapDelayAfterStartup.key]: {
            value: 20,
            updatedAt: Date.now(),
        },
        [kernelCoreInterconnectionParameters.slaveConnectDelayAfterStartup.key]: {
            value: 20,
            updatedAt: Date.now(),
        },
        [kernelCoreInterconnectionParameters.masterServerReconnectInterval.key]: {
            value: 500,
            updatedAt: Date.now(),
        },
        [kernelCoreInterconnectionParameters.masterServerConnectionTimeout.key]: {
            value: 2000,
            updatedAt: Date.now(),
        },
        [kernelCoreInterconnectionParameters.remoteCommandResponseTimeout.key]: {
            value: 2000,
            updatedAt: Date.now(),
        },
    }).executeInternally();
}

function RuntimeDevShell() {
    const rootState = useSelector((state: RootState) => state);
    const displayMode = useSelector(selectDisplayMode);
    const instanceInfo = (rootState as any)[kernelCoreInterconnectionState.instanceInfo];
    const interconnection = (rootState as any)[kernelCoreInterconnectionState.instanceInterconnection];

    const currentPrimaryScreen = selectCurrentScreen(rootState, uiRuntimeBaseUiVariables.primaryRootContainer.key);
    const currentSecondaryScreen = selectCurrentScreen(rootState, uiRuntimeBaseUiVariables.secondaryRootContainer.key);
    const overlays = selectCurrentOverlays(rootState);
    const orderNo = selectUiVariable(rootState, DEV_ORDER_KEY, '');
    const notes = selectUiVariable(rootState, DEV_NOTES_KEY, '');
    const secondaryMessage = selectUiVariable(rootState, DEV_MIRROR_KEY, '');
    const [draftOrderNo, setDraftOrderNo] = useState(orderNo || 'A1001');
    const [draftNotes, setDraftNotes] = useState(notes || 'Need extra napkins');
    const [draftMirrorMessage, setDraftMirrorMessage] = useState(secondaryMessage || 'Primary screen synced at runtime');

    useEffect(() => {
        setDraftOrderNo(orderNo || 'A1001');
    }, [orderNo]);

    useEffect(() => {
        setDraftNotes(notes || 'Need extra napkins');
    }, [notes]);

    useEffect(() => {
        setDraftMirrorMessage(secondaryMessage || 'Primary screen synced at runtime');
    }, [secondaryMessage]);

    useEffect(() => {
        applyFastInterconnectionParameters();

        if (displayMode === DisplayMode.PRIMARY) {
            kernelCoreUiRuntimeCommands.showScreen({
                target: PRIMARY_HOME_SCREEN,
                source: 'runtime-base-dev-bootstrap'
            }).executeInternally();
            return;
        }

        kernelCoreUiRuntimeCommands.showScreen({
            target: SECONDARY_WELCOME_SCREEN,
            source: 'runtime-base-dev-secondary-bootstrap'
        }).executeInternally();
    }, [displayMode]);

    const serverConnectionStatus = interconnection?.serverConnectionStatus ?? ServerConnectionStatus.DISCONNECTED;
    const slaveConnected = Boolean(interconnection?.master?.slaveConnection?.deviceId);

    const overviewItems = useMemo(() => ([
        {label: 'Instance', value: instanceInfo?.instanceMode ?? '--'},
        {label: 'Display', value: instanceInfo?.displayMode ?? '--'},
        {label: 'Workspace', value: instanceInfo?.workspace ?? '--'},
        {label: 'Server', value: serverConnectionStatus},
        {label: 'Peer', value: slaveConnected ? 'connected' : 'idle'},
        {label: 'Overlays', value: String(overlays.length)},
    ]), [instanceInfo, overlays.length, serverConnectionStatus, slaveConnected]);

    const handleShowHome = () => {
        kernelCoreUiRuntimeCommands.showScreen({
            target: PRIMARY_HOME_SCREEN,
            source: 'runtime-base-dev-home'
        }).executeInternally();
    };

    const handleReplaceCheckout = () => {
        kernelCoreUiRuntimeCommands.replaceScreen({
            target: PRIMARY_CHECKOUT_SCREEN,
            source: 'runtime-base-dev-checkout'
        }).executeInternally();
    };

    const handleResetPrimary = () => {
        kernelCoreUiRuntimeCommands.resetScreen({
            containerKey: uiRuntimeBaseUiVariables.primaryRootContainer.key
        }).executeInternally();
    };

    const handleOpenAlert = () => {
        kernelCoreUiRuntimeCommands.openOverlay({
            overlay: {
                id: OVERLAY_ID,
                partKey: defaultAlertPartKey,
                name: 'RuntimeBaseAlert',
                title: 'RuntimeBaseAlert',
                description: 'Runtime base dev alert',
                props: {
                    title: '运行时弹窗',
                    message: '这个弹窗验证 ui-runtime 的 overlay 打开、关闭和命令执行链路。',
                    confirmText: '确认',
                    cancelText: '取消',
                }
            }
        }).executeInternally();
    };

    const handleCloseAlert = () => {
        kernelCoreUiRuntimeCommands.closeOverlay({overlayId: OVERLAY_ID}).executeInternally();
    };

    const handleSaveVariables = () => {
        kernelCoreUiRuntimeCommands.setUiVariables({
            [DEV_ORDER_KEY]: draftOrderNo,
            [DEV_NOTES_KEY]: draftNotes,
            [DEV_MIRROR_KEY]: draftMirrorMessage,
        }).executeInternally();
    };

    const handleClearVariables = () => {
        kernelCoreUiRuntimeCommands.clearUiVariables([
            DEV_ORDER_KEY,
            DEV_NOTES_KEY,
            DEV_MIRROR_KEY,
        ]).executeInternally();
    };

    const handleSyncMirrorScreen = () => {
        kernelCoreUiRuntimeCommands.showScreen({
            target: SECONDARY_MIRROR_SCREEN,
            source: 'runtime-base-dev-secondary-mirror'
        }).executeInternally();
    };

    const handleResetSecondary = () => {
        kernelCoreUiRuntimeCommands.resetScreen({
            containerKey: uiRuntimeBaseUiVariables.secondaryRootContainer.key
        }).executeInternally();
    };

    return (
        <FancyKeyboardProviderV2>
            <FancyContainerV2>
                <View style={styles.root}>
                    <View style={styles.runtimeArea}>
                        <View style={styles.runtimeHeader}>
                            <Text style={styles.runtimeTitle}>
                                {displayMode === DisplayMode.PRIMARY ? 'Runtime Base Dev / Primary' : 'Runtime Base Dev / Secondary'}
                            </Text>
                            <Text style={styles.runtimeSubtitle}>
                                Single-screen validation runs directly. Dual-screen validation uses the same shell with `displayCount=2` and `displayIndex=1`.
                            </Text>
                        </View>

                        <View style={styles.runtimeScreens}>
                            <View style={styles.screenPane}>
                                <Text style={styles.paneTitle}>Primary Container</Text>
                                <ScreenContainer containerPart={uiRuntimeBaseUiVariables.primaryRootContainer}/>
                            </View>
                            <View style={styles.screenPane}>
                                <Text style={styles.paneTitle}>Secondary Container</Text>
                                <ScreenContainer containerPart={uiRuntimeBaseUiVariables.secondaryRootContainer}/>
                            </View>
                        </View>
                    </View>

                    <ScrollView style={styles.controlPanel} contentContainerStyle={styles.controlPanelContent}>
                        <Text style={styles.panelTitle}>Runtime Controls</Text>

                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Overview</Text>
                            <View style={styles.metricGrid}>
                                {overviewItems.map(item => (
                                    <View key={item.label} style={styles.metricCard}>
                                        <Text style={styles.metricLabel}>{item.label}</Text>
                                        <Text style={styles.metricValue}>{item.value}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>

                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Screen Actions</Text>
                            <ActionButton label="Show Primary Home" onPress={handleShowHome}/>
                            <ActionButton label="Replace With Checkout" onPress={handleReplaceCheckout}/>
                            <ActionButton label="Reset Primary Screen" onPress={handleResetPrimary}/>
                            <ActionButton label="Show Secondary Mirror" onPress={handleSyncMirrorScreen}/>
                            <ActionButton label="Reset Secondary Screen" onPress={handleResetSecondary}/>
                        </View>

                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Overlay Actions</Text>
                            <ActionButton label="Open Runtime Alert" onPress={handleOpenAlert}/>
                            <ActionButton label="Close Runtime Alert" onPress={handleCloseAlert}/>
                        </View>

                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>UI Variables</Text>
                            <Field label="Order No" value={draftOrderNo} onChangeText={setDraftOrderNo}/>
                            <Field label="Notes" value={draftNotes} onChangeText={setDraftNotes} multiline/>
                            <Field label="Secondary Message" value={draftMirrorMessage} onChangeText={setDraftMirrorMessage} multiline/>
                            <ActionButton label="Save Variables" onPress={handleSaveVariables}/>
                            <ActionButton label="Clear Variables" onPress={handleClearVariables}/>
                        </View>

                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Runtime Snapshot</Text>
                            <SnapshotRow label="Primary Screen" value={currentPrimaryScreen?.partKey ?? '--'}/>
                            <SnapshotRow label="Secondary Screen" value={currentSecondaryScreen?.partKey ?? '--'}/>
                            <SnapshotRow label="Order No" value={orderNo || '--'}/>
                            <SnapshotRow label="Notes" value={notes || '--'}/>
                            <SnapshotRow label="Secondary Msg" value={secondaryMessage || '--'}/>
                        </View>
                    </ScrollView>
                </View>
                <ModalContainer/>
            </FancyContainerV2>
            <FancyKeyboardOverlayV2/>
        </FancyKeyboardProviderV2>
    );
}

function ActionButton(props: {label: string; onPress: () => void}) {
    return (
        <Pressable onPress={props.onPress} style={({pressed}) => [styles.button, pressed ? styles.buttonPressed : null]}>
            <Text style={styles.buttonText}>{props.label}</Text>
        </Pressable>
    );
}

function Field(props: {label: string; value: string; onChangeText: (value: string) => void; multiline?: boolean}) {
    return (
        <View style={styles.field}>
            <Text style={styles.fieldLabel}>{props.label}</Text>
            <TextInput
                value={props.value}
                onChangeText={props.onChangeText}
                multiline={props.multiline}
                style={[styles.input, props.multiline ? styles.inputMultiline : null]}
                placeholder={props.label}
                placeholderTextColor="#94A3B8"
            />
        </View>
    );
}

function SnapshotRow(props: {label: string; value: string}) {
    return (
        <View style={styles.snapshotRow}>
            <Text style={styles.snapshotLabel}>{props.label}</Text>
            <Text style={styles.snapshotValue}>{props.value}</Text>
        </View>
    );
}

export const DevApp: React.FC = () => {
    const [storeReady, setStoreReady] = useState<StoreReadyState | null>(null);

    useEffect(() => {
        storePromise.then(result => {
            setStoreReady(result);
        });
    }, []);

    if (!storeReady) {
        return (
            <View style={styles.loadingRoot}>
                <Text style={styles.loadingTitle}>Loading runtime-base dev shell...</Text>
                <Text style={styles.loadingHint}>
                    Current boot: displayIndex={getDevBootOptions().displayIndex}, displayCount={getDevBootOptions().displayCount}
                </Text>
            </View>
        );
    }

    return (
        <Provider store={storeReady.store}>
            <PersistGate
                persistor={storeReady.persistor}
                onBeforeLift={() => {
                    kernelCoreBaseCommands.initialize().executeInternally();
                }}
            >
                <RuntimeDevShell/>
            </PersistGate>
        </Provider>
    );
};

const styles = StyleSheet.create({
    loadingRoot: {
        flex: 1,
        backgroundColor: '#0F172A',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: 24,
    },
    loadingTitle: {
        color: '#F8FAFC',
        fontSize: 24,
        fontWeight: '700',
    },
    loadingHint: {
        color: '#CBD5E1',
        fontSize: 14,
    },
    root: {
        flex: 1,
        flexDirection: 'row',
        backgroundColor: '#E2E8F0',
    },
    runtimeArea: {
        flex: 1.5,
        padding: 20,
        gap: 16,
    },
    runtimeHeader: {
        borderRadius: 24,
        backgroundColor: '#0F172A',
        padding: 24,
        gap: 8,
    },
    runtimeTitle: {
        color: '#F8FAFC',
        fontSize: 28,
        fontWeight: '700',
    },
    runtimeSubtitle: {
        color: '#CBD5E1',
        fontSize: 14,
        lineHeight: 20,
    },
    runtimeScreens: {
        flex: 1,
        gap: 16,
    },
    screenPane: {
        flex: 1,
        borderRadius: 24,
        overflow: 'hidden',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#CBD5E1',
    },
    paneTitle: {
        paddingHorizontal: 20,
        paddingTop: 18,
        paddingBottom: 10,
        fontSize: 16,
        fontWeight: '700',
        color: '#0F172A',
        backgroundColor: '#F8FAFC',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    controlPanel: {
        width: 420,
        backgroundColor: '#F8FAFC',
        borderLeftWidth: 1,
        borderLeftColor: '#CBD5E1',
    },
    controlPanelContent: {
        padding: 20,
        gap: 16,
    },
    panelTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#0F172A',
    },
    card: {
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
        padding: 18,
        gap: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0F172A',
    },
    metricGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    metricCard: {
        width: '47%',
        borderRadius: 16,
        backgroundColor: '#F8FAFC',
        padding: 14,
        gap: 6,
    },
    metricLabel: {
        fontSize: 12,
        color: '#64748B',
        textTransform: 'uppercase',
        letterSpacing: 0.6,
    },
    metricValue: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0F172A',
    },
    button: {
        minHeight: 48,
        borderRadius: 14,
        backgroundColor: '#0F172A',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 16,
    },
    buttonPressed: {
        opacity: 0.86,
    },
    buttonText: {
        color: '#F8FAFC',
        fontSize: 14,
        fontWeight: '700',
    },
    field: {
        gap: 8,
    },
    fieldLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#334155',
    },
    input: {
        minHeight: 46,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#CBD5E1',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 14,
        paddingVertical: 12,
        color: '#0F172A',
        fontSize: 14,
    },
    inputMultiline: {
        minHeight: 80,
        textAlignVertical: 'top',
    },
    snapshotRow: {
        gap: 4,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        paddingBottom: 10,
    },
    snapshotLabel: {
        fontSize: 12,
        color: '#64748B',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    snapshotValue: {
        fontSize: 14,
        color: '#0F172A',
        fontWeight: '600',
    },
});
