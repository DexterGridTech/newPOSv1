import {ScreenMode, ScreenPartRegistration} from "@impos2/kernel-core-base";
import {InstanceMode, Workspace} from "@impos2/kernel-core-interconnection";
import {AdapterDebugScreen} from "./screens/AdapterDebugScreen";

export const assemblyAndroidMixcRetailScreenParts: Record<string, ScreenPartRegistration> = {
  adapterDebugScreen: {
    name: 'adapterDebugScreen',
    title: 'Adapter Debug Screen',
    description: 'RN84v2 adapter / TurboModule 验证页',
    partKey: 'assembly-android-mixc-retail-rn84v2-adapter-debug',
    screenMode: [ScreenMode.DESKTOP, ScreenMode.MOBILE],
    instanceMode: [InstanceMode.MASTER, InstanceMode.SLAVE],
    workspace: [Workspace.MAIN, Workspace.BRANCH],
    componentType: AdapterDebugScreen,
  },
};
