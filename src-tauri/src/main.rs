#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    let _ = dotenvy::dotenv();
    env_logger::init();
    flow_dictate_lib::run();
}
