import React from 'react'
import {View} from 'react-native'
import {
    selectTcpIdentitySnapshot,
} from '@next/kernel-base-tcp-control-runtime-v2'
import {
    createTdpSyncRuntimeModuleV2,
    tdpSyncV2CommandDefinitions,
} from '@next/kernel-base-tdp-sync-runtime-v2'
import {createCommand} from '@next/kernel-base-runtime-shell-v2'
import type {RootState} from '@next/kernel-base-state-runtime'
import {useSelector} from 'react-redux'
import {
    createExpoRuntimeReactHarness,
    createExpoWebTcpControlRuntimeModule,
    createExpoWebTopologyAssembly,
    createExpoWebTopologyHostPort,
    createExpoWebPlatformPorts,
    ExpoRuntimeTestShell,
    ExpoTestWatermark,
    readExpoWebTestShellEnvironment,
    resolveExpoWebActivationHelperBaseUrl,
    resolveExpoWebDualTopologyHostAddress,
    resolveExpoWebTransportServers,
    tryFetchExpoWebActivationCode,
} from '@next/ui-base-test-support'
import {createAdminPasswordVerifier} from '../../../2.1-base/admin-console/src'
import {createModule as createAdminConsoleModule} from '../../../2.1-base/admin-console/src'
import {createModule as createInputRuntimeModule} from '../../../2.1-base/input-runtime/src'
import {createModule as createTerminalConsoleModule} from '../../../2.1-base/terminal-console/src'
import {createOrganizationIamMasterDataModule} from '@next/kernel-business-organization-iam-master-data'
import {createCateringProductMasterDataModule} from '@next/kernel-business-catering-product-master-data'
import {createCateringStoreOperatingMasterDataModule} from '@next/kernel-business-catering-store-operating-master-data'
import {createModule as createCateringMasterDataWorkbenchModule} from '../../../2.2-business/catering-master-data-workbench/src'
import {RootScreen} from '../src/ui/screens/RootScreen'
import {createModule as createCateringShellModule} from '../src'
import {releaseInfo} from '../../../../4-assembly/android/mixc-catering-assembly-rn84/src/generated/releaseInfo'

const shellConfig = {
    deviceId: 'CATERING-SHELL-EXPO-DEVICE-001',
    deviceModel: 'Catering Shell Expo Mock POS',
    loggerModuleName: 'ui.integration.catering-shell.test-expo',
    runtimeId: 'catering-shell-expo',
    storageNamespace: 'ui.integration.catering-shell.test-expo',
    title: 'Catering Shell Test Expo',
    topologyProfileName: 'ui.integration.catering-shell.test-expo.topology-host',
}

const shellEnv = readExpoWebTestShellEnvironment()
const dualTopologyHostAddress = resolveExpoWebDualTopologyHostAddress(shellEnv)
const transportServers = resolveExpoWebTransportServers(shellEnv)
const activationHelperBaseUrl = resolveExpoWebActivationHelperBaseUrl(shellEnv)

const createExpoHarness = async () => {
    const topologyHostPort = createExpoWebTopologyHostPort(dualTopologyHostAddress)
    return createExpoRuntimeReactHarness({
        runtimeName: shellConfig.runtimeId,
        topology: createExpoWebTopologyAssembly({
            address: dualTopologyHostAddress,
            deviceId: shellConfig.deviceId,
            loggerModuleName: shellConfig.loggerModuleName,
            profileName: shellConfig.topologyProfileName,
        }),
        modules: [
            createExpoWebTcpControlRuntimeModule({
                loggerModuleName: shellConfig.loggerModuleName,
                servers: transportServers,
            }),
            createTdpSyncRuntimeModuleV2(),
            createInputRuntimeModule(),
            createAdminConsoleModule({
                hostTools: topologyHostPort
                    ? {
                        topology: {
                            getTopologyHostStatus: () => topologyHostPort.getStatus?.() ?? Promise.resolve(null),
                            getTopologyHostDiagnostics: () => topologyHostPort.getDiagnosticsSnapshot?.() ?? Promise.resolve(null),
                        },
                    }
                    : undefined,
            }),
            createTerminalConsoleModule(),
            createOrganizationIamMasterDataModule(),
            createCateringProductMasterDataModule(),
            createCateringStoreOperatingMasterDataModule(),
            createCateringMasterDataWorkbenchModule(),
            createCateringShellModule(),
        ],
        platformPorts: createExpoWebPlatformPorts({
            deviceId: shellConfig.deviceId,
            deviceModel: shellConfig.deviceModel,
            environmentMode: 'DEV',
            storageNamespace: shellConfig.storageNamespace,
            storageMode: shellEnv.storageMode,
            loggerScope: {
                moduleName: shellConfig.loggerModuleName,
                layer: 'ui',
                subsystem: 'runtime',
                component: 'CateringShellExpoShell',
            },
            topologyHost: topologyHostPort,
        }),
        displayContext: {
            displayIndex: 0,
            displayCount: 1,
        },
    })
}

export const CateringShellExpoShell: React.FC = () => {
    return (
        <ExpoRuntimeTestShell
            runtimeId={shellConfig.runtimeId}
            createHarness={createExpoHarness}
            loadingTestID="ui-integration-catering-shell-expo:loading"
            loadingText="Catering Shell Expo Loading"
            errorTestID="ui-integration-catering-shell-expo:error"
            tcpControl={{
                deviceInfo: {
                    id: shellConfig.deviceId,
                    model: shellConfig.deviceModel,
                },
            }}
            afterInitialize={async harness => {
                await harness.runtime.dispatchCommand(createCommand(
                    tdpSyncV2CommandDefinitions.syncHotUpdateCurrentFromNativeBoot,
                    {
                        embeddedRelease: {
                            appId: releaseInfo.appId,
                            assemblyVersion: releaseInfo.assemblyVersion,
                            buildNumber: releaseInfo.buildNumber,
                            runtimeVersion: releaseInfo.runtimeVersion,
                            bundleVersion: releaseInfo.bundleVersion,
                        },
                        initializeEmbeddedCurrent: true,
                    },
                ))
            }}
            loadContext={async () => ({
                sandboxId: shellEnv.mockPlatformSandboxId,
                activationCode: await tryFetchExpoWebActivationCode({
                    baseUrl: activationHelperBaseUrl,
                    sandboxId: shellEnv.mockPlatformSandboxId,
                    logger: console,
                    logPrefix: '[catering-shell-expo]',
                }),
            })}
            renderContent={() => (
                <View style={{flex: 1, backgroundColor: '#eef4fa'}}>
                    <RootScreen
                        deviceId={shellConfig.deviceId}
                        virtualKeyboardBottomInset={40}
                    />
                </View>
            )}
            renderOverlay={({context}) => (
                <CateringShellExpoWatermark
                    sandboxId={context.sandboxId}
                    activationCode={context.activationCode}
                />
            )}
        />
    )
}

const CateringShellExpoWatermark: React.FC<{
    sandboxId: string
    activationCode: string
}> = ({activationCode, sandboxId}) => {
    const identity = useSelector<RootState, ReturnType<typeof selectTcpIdentitySnapshot>>(
        state => selectTcpIdentitySnapshot(state),
    )
    const verifier = createAdminPasswordVerifier({
        deviceIdProvider: () => shellConfig.deviceId,
    })
    const adminPassword = verifier.deriveFor(new Date())

    return (
        <ExpoTestWatermark
            testID="ui-integration-catering-shell-expo:ready"
            title={shellConfig.title}
            items={[
                {
                    label: '激活码',
                    value: activationCode,
                    testID: 'ui-integration-catering-shell-expo:activation-code',
                },
                {
                    label: '沙箱',
                    value: sandboxId,
                    testID: 'ui-integration-catering-shell-expo:sandbox-id',
                },
                {
                    label: '状态',
                    value: identity.activationStatus,
                    testID: 'ui-integration-catering-shell-expo:activation-status',
                },
                {
                    label: '终端ID',
                    value: identity.terminalId ?? '未绑定',
                    testID: 'ui-integration-catering-shell-expo:terminal-id',
                },
                {
                    label: '管理员密码',
                    value: adminPassword,
                    testID: 'ui-integration-catering-shell-expo:admin-password',
                },
            ]}
        />
    )
}
