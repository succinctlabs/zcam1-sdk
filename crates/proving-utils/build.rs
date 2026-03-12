use std::fs::{self, File};

use cfg_aliases::cfg_aliases;
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

fn build(program: &str, rt: &Runtime) -> Result<(), Box<dyn std::error::Error>> {
    let program_dir = format!("../../programs/{program}");
    let program_path = std::path::Path::new(&program_dir);
    let metadata_file = program_path.join("Cargo.toml");
    let mut metadata_cmd = cargo_metadata::MetadataCommand::new();
    let metadata = metadata_cmd.manifest_path(metadata_file).exec()?;
    let elf_paths = generate_elf_paths(&metadata, None)?;

    build_program(&program_dir);

    rt.block_on(async {
        let prover = SP1LightNode::new().await;

        for (_, elf_path) in elf_paths {
            let elf = fs::read(&elf_path)?;

            let vk = prover.setup(&elf).await?;

            let vk_file = File::create(format!("./artifacts/{program}.bin"))?;

            bincode::serialize_into(vk_file, &vk)?;
        }

        Ok(())
    })
}
