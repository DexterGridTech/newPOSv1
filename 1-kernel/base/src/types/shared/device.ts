
export interface DisplayInfo {
    id: string;
    displayType: string;
    refreshRate : number;
    width: number;
    height: number;
    physicalWidth: number;
    physicalHeight: number;
    orientation:string;
    isMobile:boolean;
}

export interface DeviceInfo {
    id: string;
    manufacturer: string;
    os: string;
    osVersion: string;
    cpu: string;
    memory: string;
    disk: string;
    network: string;
    displays: DisplayInfo[];
}
