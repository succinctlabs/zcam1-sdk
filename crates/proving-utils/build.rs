use std::fs::{self, File};

use sp1_build::{build_program, generate_elf_paths};
use sp1_prover::worker::SP1LightNode;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    build_program("../../programs/authenticity-ios");
    build_program("../../programs/mock");

    let program_dir = std::path::Path::new("../../programs/authenticity-ios");
    let metadata_file = program_dir.join("Cargo.toml");
    let mut metadata_cmd = cargo_metadata::MetadataCommand::new();
    let metadata = metadata_cmd.manifest_path(metadata_file).exec()?;
    let elf_paths = generate_elf_paths(&metadata, None)?;

    let rt = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()?;

    rt.block_on(async {
        fs::create_dir_all("./artifacts")?;

        let prover = SP1LightNode::new().await;

        for (_, elf_path) in elf_paths {
            let elf = fs::read(&elf_path)?;

            let vk = prover.setup(&elf).await?;

            let vk_file = File::create("./artifacts/vk.bin")?;

            bincode::serialize_into(vk_file, &vk)?;
        }

        Ok(())
    })
}
