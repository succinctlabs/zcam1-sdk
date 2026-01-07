mod error;

mod prover;
pub use prover::{FulfillmentStatus, IOS_AUTHENCITY_ELF, IosProvingClient, ProofRequestStatus};

uniffi::setup_scaffolding!();
