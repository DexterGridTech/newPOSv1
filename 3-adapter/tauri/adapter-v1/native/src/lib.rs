mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            commands::device::device_get_info,
            commands::device::device_get_system_status,
            commands::script::script_execute,
            commands::script::script_resolve_native_call,
            commands::script::script_reject_native_call,
            commands::local_web_server::local_web_server_start,
            commands::local_web_server::local_web_server_stop,
            commands::local_web_server::local_web_server_get_status,
            commands::local_web_server::local_web_server_get_stats,
            commands::connector::connector_call,
            commands::connector::connector_subscribe,
            commands::connector::connector_unsubscribe,
            commands::connector::connector_is_available,
            commands::connector::connector_get_available_targets,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
