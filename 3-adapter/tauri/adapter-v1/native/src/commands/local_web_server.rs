use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalWebServerConfig {
    port: u16,
    base_path: String,
    heartbeat_interval: u64,
    heartbeat_timeout: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct ServerStatus {
    status: String,
    addresses: Vec<String>,
    config: LocalWebServerConfig,
    error: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ServerStats {
    requests: u64,
    errors: u64,
}

lazy_static::lazy_static! {
    static ref SERVER_STATE: Arc<Mutex<Option<ServerStatus>>> = Arc::new(Mutex::new(None));
}

#[tauri::command]
pub async fn local_web_server_start(config: LocalWebServerConfig) -> Result<serde_json::Value, String> {
    // 简化实现：仅返回模拟地址
    let addresses = vec![format!("http://127.0.0.1:{}", config.port)];
    
    *SERVER_STATE.lock().unwrap() = Some(ServerStatus {
        status: "RUNNING".to_string(),
        addresses: addresses.clone(),
        config: config.clone(),
        error: None,
    });

    Ok(serde_json::json!({ "addresses": addresses }))
}

#[tauri::command]
pub fn local_web_server_stop() {
    *SERVER_STATE.lock().unwrap() = None;
}

#[tauri::command]
pub fn local_web_server_get_status() -> ServerStatus {
    SERVER_STATE.lock().unwrap().clone().unwrap_or(ServerStatus {
        status: "STOPPED".to_string(),
        addresses: vec![],
        config: LocalWebServerConfig {
            port: 8888,
            base_path: "/localServer".to_string(),
            heartbeat_interval: 30000,
            heartbeat_timeout: 60000,
        },
        error: None,
    })
}

#[tauri::command]
pub fn local_web_server_get_stats() -> ServerStats {
    ServerStats { requests: 0, errors: 0 }
}
