use std::time::Duration;

use tonic::transport::Channel;

use crate::error::Error;

mod client;

mod grpc;

mod proto;

mod proof;
pub use proof::{ProofFromNetwork, SP1ProofMode};

mod prover;
pub use prover::NetworkProver;

mod retry;

mod signer;
pub use signer::NetworkSigner;

mod utils;
pub use utils::get_default_rpc_url_for_mode;

pub(crate) const DEFAULT_AUCTION_TIMEOUT_DURATION: Duration = Duration::from_secs(30);
pub(crate) const MAINNET_RPC_URL: &str = "https://rpc.mainnet.succinct.xyz";
pub(crate) const RESERVED_RPC_URL: &str = "https://rpc.production.succinct.xyz";
pub(crate) const MAINNET_DEFAULT_CYCLE_LIMIT: u64 = 1_000_000_000_000;
pub(crate) const RESERVED_DEFAULT_CYCLE_LIMIT: u64 = 100_000_000;
pub(crate) const DEFAULT_TIMEOUT_SECS: u64 = 14400;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NetworkMode {
    /// Mainnet network using auction-based proving.
    Mainnet,
    /// Reserved capacity network for hosted/reserved proving.
    Reserved,
}
