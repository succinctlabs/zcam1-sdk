mod error;

mod prover;
pub use prover::{FulfillmentStatus, ProofRequestStatus, ProvingClient};

uniffi::setup_scaffolding!();
