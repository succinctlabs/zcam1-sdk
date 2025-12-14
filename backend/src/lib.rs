use sp1_sdk::include_elf;

mod app;
pub use app::build_app;

pub const ELF: &[u8] = include_elf!("authenticity-ios");
pub const MOCK_ELF: &[u8] = include_elf!("mock");
