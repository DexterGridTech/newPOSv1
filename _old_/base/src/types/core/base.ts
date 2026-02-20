import {ApiServerAddress} from "./http";

export enum InstanceMode {
    MASTER = 'master',
    SLAVE = 'slave'
}

export enum DisplayMode {
    PRIMARY = 'primary',
    SECONDARY = 'secondary'
}

export enum ScreenMode {
    MOBILE = 'mobile',
    DESKTOP = 'desktop'
}


export interface SystemStatus {
    [key: string]: { [key: string]: string };
}

export interface ServerAddress {
    name: string
    address: string
}

export enum ServerConnectionStatus {
    CONNECTING = 'CONNECTING',
    CONNECTED = 'CONNECTED',
    DISCONNECTED = 'DISCONNECTED'
}


export interface Workspace {
    selectedWorkspace: string
    workspaces: {
        workspaceName: string,
        apiServerAddresses: ApiServerAddress[]
    }[]
}