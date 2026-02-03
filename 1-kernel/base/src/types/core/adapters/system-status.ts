export interface ISystemStatusAdapter {
    /**
     * 获取系统运行状态
     * @returns Promise<PosSystemStatus> 系统运行状态
     */
    getSystemStatus(): Promise<PosSystemStatus>;

    /**
     * 添加电源状态变化监听器
     * @param listener 监听器回调函数
     * @returns 取消监听的函数
     */
    addPowerStatusChangeListener(listener: (event: PowerStatusChangeEvent) => void): () => void;

    /**
     * 移除电源状态变化监听器
     * @param listener 监听器回调函数
     */
    removePowerStatusChangeListener(listener: (event: PowerStatusChangeEvent) => void): void;

}

/**
 * 系统运行状态类型定义
 */

/**
 * CPU 使用情况
 */
export interface CpuUsage {
    /** 整体 CPU 使用率 (0-100) */
    overall: number;
    /** 本程序 CPU 使用率 (0-100) */
    app: number;
    /** CPU 核心数 */
    cores: number;
}

/**
 * 内存使用情况
 */
export interface MemoryUsage {
    /** 总内存 (MB) */
    total: number;
    /** 已使用内存 (MB) */
    used: number;
    /** 可用内存 (MB) */
    available: number;
    /** 整体使用率 (0-100) */
    overall: number;
    /** 本程序使用内存 (MB) */
    app: number;
    /** 本程序使用率 (0-100) */
    appPercentage: number;
}

/**
 * 磁盘使用情况
 */
export interface DiskUsage {
    /** 总容量 (GB) */
    total: number;
    /** 已使用容量 (GB) */
    used: number;
    /** 可用容量 (GB) */
    available: number;
    /** 整体使用率 (0-100) */
    overall: number;
    /** 本程序使用容量 (MB) */
    app: number;
}

/**
 * GPS 定位信息
 */
export interface GpsLocation {
    /** 是否可用 */
    available: boolean;
    /** 纬度 */
    latitude: number;
    /** 经度 */
    longitude: number;
    /** 海拔高度 (米) */
    altitude: number;
    /** 精度 (米) */
    accuracy: number;
    /** 速度 (米/秒) */
    speed: number;
    /** 方向 (度, 0-360) */
    bearing: number;
    /** 定位提供者 */
    provider: string;
    /** 定位时间戳 */
    timestamp: number;
}

/**
 * 电源状态
 */
export interface PowerStatus {
    /** 电源是否连接（物理连接状态） */
    powerConnected: boolean;
    /** 是否正在充电 */
    isCharging: boolean;
    /** 电池电量 (0-100) */
    batteryLevel: number;
    /** 电池状态 */
    batteryStatus: 'charging' | 'discharging' | 'full' | 'not_charging' | 'unknown';
    /** 电池健康状态 */
    batteryHealth: 'good' | 'overheat' | 'dead' | 'over_voltage' | 'cold' | 'unknown';
}

/**
 * 电源状态变化事件
 */
export interface PowerStatusChangeEvent {
    /** 电源是否连接（物理连接状态） */
    powerConnected: boolean;
    /** 是否正在充电 */
    isCharging: boolean;
    /** 电池电量 (0-100) */
    batteryLevel: number;
    /** 电池状态 */
    batteryStatus: 'charging' | 'discharging' | 'full' | 'not_charging' | 'unknown';
    /** 变化时间戳 */
    timestamp: number;
}

/**
 * USB 设备信息
 */
export interface UsbDevice {
    /** 设备名称 */
    name: string;
    /** 设备 ID */
    deviceId: string;
    /** 厂商 ID */
    vendorId: string;
    /** 产品 ID */
    productId: string;
    /** 设备类型 */
    deviceClass: string;
}

/**
 * 蓝牙设备信息
 */
export interface BluetoothDevice {
    /** 设备名称 */
    name: string;
    /** 设备地址 (MAC) */
    address: string;
    /** 设备类型 */
    type: 'classic' | 'ble' | 'dual' | 'unknown';
    /** 连接状态 */
    connected: boolean;
    /** 信号强度 (RSSI) */
    rssi?: number;
}

/**
 * 串口设备信息
 */
export interface SerialDevice {
    /** 设备名称 */
    name: string;
    /** 设备路径 */
    path: string;
    /** 波特率 */
    baudRate?: number;
    /** 是否打开 */
    isOpen: boolean;
}

/**
 * 网络连接信息
 */
export interface NetworkConnection {
    /** 网络类型 */
    type: 'wifi' | 'ethernet' | 'mobile' | 'vpn' | 'unknown';
    /** 网络名称 */
    name: string;
    /** IP 地址 */
    ipAddress: string;
    /** 网关地址 */
    gateway: string;
    /** 子网掩码 */
    netmask: string;
    /** DNS 服务器 */
    dns: string[];
    /** 是否已连接 */
    connected: boolean;
    /** 信号强度 (仅移动网络, 0-100) */
    signalStrength?: number;
    /** 网络运营商 (仅移动网络) */
    carrier?: string;
}

/**
 * 应用安装信息
 */
export interface InstalledApp {
    /** 应用包名 */
    packageName: string;
    /** 应用名称 */
    appName: string;
    /** 版本号 */
    versionName: string;
    /** 版本代码 */
    versionCode: number;
    /** 安装时间 (时间戳) */
    installTime: number;
    /** 更新时间 (时间戳) */
    updateTime: number;
    /** 是否系统应用 */
    isSystemApp: boolean;
}

/**
 * POS 设备系统运行状态
 */
export interface PosSystemStatus {
    /** CPU 使用情况 */
    cpu: CpuUsage;
    /** 内存使用情况 */
    memory: MemoryUsage;
    /** 磁盘使用情况 */
    disk: DiskUsage;
    /** 电源状态 */
    power: PowerStatus;
    /** GPS 定位信息 */
    gps: GpsLocation;
    /** USB 设备列表 */
    usbDevices: UsbDevice[];
    /** 蓝牙设备列表 */
    bluetoothDevices: BluetoothDevice[];
    /** 串口设备列表 */
    serialDevices: SerialDevice[];
    /** 网络连接列表 */
    networks: NetworkConnection[];
    /** 已安装应用列表 */
    installedApps: InstalledApp[];
    /** 采集时间戳 */
    timestamp: number;
}






