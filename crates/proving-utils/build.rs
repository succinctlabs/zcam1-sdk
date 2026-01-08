use std::fs::File;

use sp1_build::{build_program, verifying_key};

fn main() {
    build_program("../../programs/authenticity-ios");
    build_program("../../programs/mock");

    let vk = verifying_key("../../programs/authenticity-ios", "authenticity-ios");
    let vk_file = File::create("./artifacts/vk.bin").unwrap();

    bincode::serialize_into(vk_file, &vk).unwrap();
}
