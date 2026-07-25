// Windows'ta sürümde konsol penceresi açılmasın — kullanıcı teknik değil,
// uygulamanın arkasında siyah bir terminal görmemeli.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    kurs_takip_lib::run()
}
