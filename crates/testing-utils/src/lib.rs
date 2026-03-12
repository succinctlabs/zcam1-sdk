use sp1_build::{Elf, include_elf};

pub const IOS_AUTHENCITY_ELF: Elf = include_elf!("authenticity-ios");
pub const ANDROID_AUTHENCITY_ELF: Elf = include_elf!("authenticity-android");
