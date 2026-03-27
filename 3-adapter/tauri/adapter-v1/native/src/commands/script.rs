use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::AppHandle;
use tokio::sync::oneshot;

type NativeCallMap = Arc<Mutex<HashMap<String, oneshot::Sender<Result<String, String>>>>>;

lazy_static::lazy_static! {
    static ref NATIVE_CALLS: NativeCallMap = Arc::new(Mutex::new(HashMap::new()));
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct NativeCallEvent {
    call_id: String,
    func_name: String,
    args_json: String,
}

#[tauri::command]
pub async fn script_execute(
    _app: AppHandle,
    _script: String,
    _params_json: String,
    _globals_json: String,
    _native_func_names: Vec<String>,
    _timeout: u64,
) -> Result<String, String> {
    // TODO: Implement script execution with rquickjs
    // Current issue: rquickjs AsyncRuntime/AsyncContext are not Send
    // Need to use spawn_blocking or find alternative approach
    Err("Script execution not yet implemented".to_string())
}

#[tauri::command]
pub fn script_resolve_native_call(call_id: String, result_json: String) {
    if let Some(tx) = NATIVE_CALLS.lock().unwrap().remove(&call_id) {
        let _ = tx.send(Ok(result_json));
    }
}

#[tauri::command]
pub fn script_reject_native_call(call_id: String, error_message: String) {
    if let Some(tx) = NATIVE_CALLS.lock().unwrap().remove(&call_id) {
        let _ = tx.send(Err(error_message));
    }
}
