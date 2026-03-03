
export interface DisplayInfo {
    id: string;
    //类型
    displayType: string;
    //刷新率，取整数
    refreshRate : number;
    //像素宽，取整数
    width: number;
    //像素长，取整数
    height: number;
    //物理宽，取整数
    physicalWidth: number;
    //物理长，取整数
    physicalHeight: number;
    //是否支持触摸
    touchSupport: true
}

export interface DeviceInfo {
    id: string;
    //制造商
    manufacturer: string;
    //操作系统类型
    os: string;
    //操作系统版本
    osVersion: string;
    //cpu类型、主频、核心数
    cpu: string;
    //内容类型、容量
    memory: string;
    //硬盘类型、容量
    disk: string;
    //网卡类型
    network: string;
    //显示器
    displays: DisplayInfo[];
}
