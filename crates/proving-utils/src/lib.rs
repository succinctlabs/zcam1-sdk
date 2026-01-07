mod error;

mod prover;
pub use prover::{IOS_AUTHENCITY_ELF, IosProvingClient};

uniffi::setup_scaffolding!();
