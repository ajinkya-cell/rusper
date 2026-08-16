#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    let _ = dotenvy::dotenv();
    env_logger::init();
    rusper_lib::run();
}
