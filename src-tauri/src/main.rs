// Prevents additional console window on Windows - ALWAYS hide console
#![cfg_attr(all(), windows_subsystem = "windows")]

fn main() {
    marvel_rivals_mod_manager_lib::run()
}
