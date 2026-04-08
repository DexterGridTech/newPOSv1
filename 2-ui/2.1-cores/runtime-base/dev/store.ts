import {
    ApplicationConfig,
    ApplicationManager,
    ScreenMode
} from "@impos2/kernel-core-base";
import {uiCoreRuntimeBaseModule} from "../src";
import {devServerSpace} from "@impos2/kernel-server-config";
import {runtimeBaseDevScreenParts} from "./screens";

export interface DevBootOptions {
    displayIndex: number
    displayCount: number
    deviceId: string
}

export function getDevBootOptions(): DevBootOptions {
    const globalValue = globalThis as typeof globalThis & {
        __RUNTIME_BASE_DEV_CONFIG__?: Partial<DevBootOptions>
        location?: {
            search?: string
        }
    };
    const searchParams = typeof globalValue.location?.search === 'string'
        ? new URLSearchParams(globalValue.location.search)
        : null;
    const mode = searchParams?.get('mode');
    const displayIndexFromMode = mode === 'dual-secondary' ? 1 : 0;
    const displayCountFromMode = mode?.startsWith('dual') ? 2 : 1;
    const displayIndex = Number(searchParams?.get('displayIndex') ?? globalValue.__RUNTIME_BASE_DEV_CONFIG__?.displayIndex ?? displayIndexFromMode);
    const displayCount = Number(searchParams?.get('displayCount') ?? globalValue.__RUNTIME_BASE_DEV_CONFIG__?.displayCount ?? displayCountFromMode);
    const deviceId = searchParams?.get('deviceId') ?? globalValue.__RUNTIME_BASE_DEV_CONFIG__?.deviceId ?? 'runtime-base-dev';
    return {
        displayIndex,
        displayCount,
        deviceId,
    };
}

export async function createDevStore(options: DevBootOptions) {
    const appConfig: ApplicationConfig = {
        serverSpace: devServerSpace,
        environment: {
            deviceId: options.deviceId,
            production: false,
            screenMode: ScreenMode.DESKTOP,
            displayCount: options.displayCount,
            displayIndex: options.displayIndex
        },
        preInitiatedState: {},
        module: {
            ...uiCoreRuntimeBaseModule,
            screenParts: runtimeBaseDevScreenParts,
        },
    };

    return ApplicationManager.getInstance().generateStore(appConfig);
}

export const storePromise = createDevStore(getDevBootOptions()).then(result => {
    console.log("runtime-base dev store ready");
    return result;
});
