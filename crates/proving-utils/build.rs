use std::fs::{self, File};

use cfg_aliases::cfg_aliases;
use sha2::{Digest, Sha256};
use sp1_build::{build_program, generate_elf_paths};
use sp1_prover::worker::SP1LightNode;
use tokio::runtime::Runtime;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let rt = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()?;
    let target_os = std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();

    fs::create_dir_all("./artifacts")?;

    match target_os.as_str() {
        "android" => build("authenticity-android", &rt)?,
        "macos" | "ios" => build("authenticity-ios", &rt)?,
        _ => {}
    }

    cfg_aliases! {
        android: { target_os = "android" },
        apple: { any(target_os = "macos", target_os = "ios") },
    }

    Ok(())
}

fn elf_hash(elf: &[u8]) -> String {
    format!("{:x}", Sha256::digest(elf))
}

fn build(program: &str, rt: &Runtime) -> Result<(), Box<dyn std::error::Error>> {
    let program_dir = format!("../../programs/{program}");
    let program_path = std::path::Path::new(&program_dir);
    let metadata_file = program_path.join("Cargo.toml");
    let mut metadata_cmd = cargo_metadata::MetadataCommand::new();
    let metadata = metadata_cmd.manifest_path(metadata_file).exec()?;
    let elf_paths = generate_elf_paths(&metadata, None)?;

    build_program(&program_dir);

    rt.block_on(async {
        let mut prover: Option<SP1LightNode> = None;

        for (_, elf_path) in elf_paths {
            let elf = fs::read(&elf_path)?;
            let hash = elf_hash(&elf);

            let vk_path = format!("./artifacts/{program}.bin");
            let hash_path = format!("./artifacts/{program}.elf_hash");

            // Skip setup if the ELF hasn't changed since the last build.
            if std::path::Path::new(&vk_path).exists()
                && fs::read_to_string(&hash_path).is_ok_and(|s| s.trim() == hash)
            {
                println!("cargo:warning=Skipping VK generation for {program}: ELF unchanged");
                continue;
            }

            if prover.is_none() {
                prover = Some(SP1LightNode::new().await);
            }

            let vk = prover.as_ref().unwrap().setup(&elf).await?;

            let vk_file = File::create(&vk_path)?;
            bincode::serialize_into(vk_file, &vk)?;
            fs::write(&hash_path, &hash)?;
        }

        Ok(())
    })
}
