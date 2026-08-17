#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    std::env::set_var("WEBVIEW2_DEFAULT_BACKGROUND_COLOR", "0");
    let _ = dotenvy::dotenv();
    env_logger::init();
    rusper_lib::run();
}
