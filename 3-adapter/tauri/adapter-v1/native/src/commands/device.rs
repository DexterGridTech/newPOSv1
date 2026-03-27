use serde::{Deserialize, Serialize};
use sysinfo::System;

#[derive(Debug, Serialize, Deserialize)]
pub struct DeviceInfo {
    platform: String,
    arch: String,
    version: String,
    hostname: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SystemStatus {
    memory_total: u64,
    memory_used: u64,
    memory_available: u64,
    cpu_count: usize,
    uptime: u64,
}

#[tauri::command]
pub fn device_get_info() -> DeviceInfo {
    let mut sys = System::new_all();
    sys.refresh_all();

    DeviceInfo {
        platform: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        version: System::os_version().unwrap_or_else(|| "unknown".to_string()),
        hostname: System::host_name().unwrap_or_else(|| "unknown".to_string()),
    }
}

#[tauri::command]
pub fn device_get_system_status() -> SystemStatus {
    let mut sys = System::new_all();
    sys.refresh_all();

    SystemStatus {
        memory_total: sys.total_memory(),
        memory_used: sys.used_memory(),
        memory_available: sys.available_memory(),
        cpu_count: sys.cpus().len(),
        uptime: System::uptime(),
    }
}
