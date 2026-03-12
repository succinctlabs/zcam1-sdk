use std::{
    num::NonZeroUsize,
    str::FromStr,
    sync::{Arc, Mutex, OnceLock},
    time::{Duration, Instant},
};

use alloy_primitives::B256;
use lru::LruCache;
use serde::{Deserialize, Serialize};
use sp1_sdk::{
    Elf, HashableKey, NetworkProver, ProveRequest, Prover, SP1_CIRCUIT_VERSION,
    SP1ProofWithPublicValues, SP1ProvingKey, SP1PublicValues, SP1Stdin, SP1VerifyingKey,
    include_elf,
    network::{
        NetworkMode, get_default_rpc_url_for_mode,
        proto::types::FulfillmentStatus as Sp1FulfillmentStatus, signer::NetworkSigner,
    },
};
use tokio::{runtime::Runtime, sync::oneshot};
use zcam1_common::AuthInputs;

use crate::error::Error;

#[cfg(apple)]
pub const AUTHENCITY_ELF: Elf = include_elf!("authenticity-ios");
#[cfg(apple)]
pub const AUTHENCITY_VK: &[u8] = include_bytes!("../artifacts/authenticity-ios.bin");
#[cfg(android)]
pub const AUTHENCITY_ELF: Elf = include_elf!("authenticity-android");
#[cfg(android)]
pub const AUTHENCITY_VK: &[u8] = include_bytes!("../artifacts/authenticity-android.bin");

/// Selects which prover network to connect to.
#[derive(Debug, Default, uniffi::Enum)]
pub enum ProverNetworkMode {
    /// Mainnet network using auction-based proving.
    #[default]
    Mainnet,
    /// Reserved capacity network for hosted/reserved proving.
    Reserved,
}

impl From<ProverNetworkMode> for NetworkMode {
    fn from(value: ProverNetworkMode) -> Self {
        match value {
            ProverNetworkMode::Mainnet => NetworkMode::Mainnet,
            ProverNetworkMode::Reserved => NetworkMode::Reserved,
        }
    }
}

#[uniffi::export(callback_interface)]
pub trait Initialized: Send + Sync {
    fn initialized(&self);
}

#[derive(uniffi::Object)]
pub struct ProvingClient {
    prover: Arc<OnceLock<EitherProver>>,
    vk_hash: Arc<OnceLock<String>>,
}

#[uniffi::export]
impl ProvingClient {
    #[uniffi::constructor(default(callback = None))]
    pub fn new(
        private_key: &str,
        callback: Option<Box<dyn Initialized>>,
        network_mode: Option<ProverNetworkMode>,
    ) -> Self {
        Self::network(private_key, AUTHENCITY_VK, callback, network_mode)
    }

    #[uniffi::constructor(default(callback = None))]
    pub fn simulator(callback: Option<Box<dyn Initialized>>) -> Self {
        Self::mock(AUTHENCITY_VK, callback)
    }

    pub async fn request_proof(
        &self,
        file_path: &str,
        format: &str,
        production: bool,
    ) -> Result<String, Error> {
        let prover = self.prover.get().ok_or(Error::ProverNotInitialized)?;

        let inputs = AuthInputs {
            photo_bytes: std::fs::read(file_path)?,
            format: format.to_string(),
            production,
        };

        prover.request_proof(inputs.into()).await
    }

    pub async fn get_proof_status(&self, request_id: &str) -> Result<ProofRequestStatus, Error> {
        let prover = self.prover.get().ok_or(Error::ProverNotInitialized)?;
        prover.get_proof_status(request_id).await
    }

    pub fn vk_hash(&self) -> Result<String, Error> {
        self.vk_hash
            .get()
            .ok_or(Error::ProverNotInitialized)
            .cloned()
    }
}

impl ProvingClient {
    pub fn network(
        private_key: &str,
        vk: &'static [u8],
        callback: Option<Box<dyn Initialized>>,
        network_mode: Option<ProverNetworkMode>,
    ) -> Self {
        let network_mode = network_mode.unwrap_or_default().into();
        let rpc_url = get_default_rpc_url_for_mode(network_mode);
        let signer = NetworkSigner::local(&private_key).unwrap();

        let prover = Arc::new(OnceLock::new());
        let vk_hash = Arc::new(OnceLock::new());
        let cloned_prover = prover.clone();
        let cloned_vk_hash = vk_hash.clone();

        tokio_rt().spawn(async move {
            let prover = NetworkProver::new(signer, &rpc_url, network_mode).await;
            let vk = bincode::deserialize::<SP1VerifyingKey>(vk).unwrap();
            let _ = cloned_vk_hash.set(vk.bytes32());
            let _ = cloned_prover.set(EitherProver::Network {
                prover: Arc::new(prover),
                vk: Box::new(vk),
            });

            if let Some(callback) = callback {
                callback.initialized();
            }
        });

        Self { prover, vk_hash }
    }

    pub fn mock(vk: &'static [u8], callback: Option<Box<dyn Initialized>>) -> Self {
        let prover = Arc::new(OnceLock::new());
        let vk_hash = Arc::new(OnceLock::new());
        let cloned_prover = prover.clone();
        let cloned_vk_hash = vk_hash.clone();

        tokio_rt().spawn(async move {
            let vk = bincode::deserialize::<SP1VerifyingKey>(vk).unwrap();
            let _ = cloned_vk_hash.set(vk.bytes32());
            let _ = cloned_prover.set(EitherProver::Mock {
                vk: Box::new(vk),
                proof_requests: Mutex::new(LruCache::new(NonZeroUsize::new(1024).unwrap())),
            });

            if let Some(callback) = callback {
                callback.initialized();
            }
        });

        Self { prover, vk_hash }
    }
}

enum EitherProver {
    Network {
        prover: Arc<NetworkProver>,
        vk: Box<SP1VerifyingKey>,
    },
    Mock {
        vk: Box<SP1VerifyingKey>,
        proof_requests: Mutex<LruCache<String, (Instant, SP1ProofWithPublicValues)>>,
    },
}

impl EitherProver {
    pub async fn request_proof(&self, stdin: SP1Stdin) -> Result<String, Error> {
        match self {
            EitherProver::Network { prover, vk } => {
                let prover = prover.clone();
                let vk = vk.clone();
                let pk = SP1ProvingKey::new(*vk, AUTHENCITY_ELF);

                run_on_tokio(async move {
                    prover
                        .prove(&pk, stdin)
                        .groth16()
                        .strategy(prover.default_fulfillment_strategy())
                        .request()
                        .await
                        .map(|id| id.to_string())
                        .map_err(|err| Error::Sp1(format!("{err:#?}")))
                })
                .await
            }
            EitherProver::Mock { vk, proof_requests } => {
                let id = B256::random().to_string();

                let proof = SP1ProofWithPublicValues::create_mock_proof(
                    &vk,
                    SP1PublicValues::default(),
                    sp1_sdk::SP1ProofMode::Groth16,
                    SP1_CIRCUIT_VERSION,
                );

                let fulfilled_instant =
                    Instant::now().checked_add(Duration::from_secs(10)).unwrap();

                proof_requests
                    .lock()
                    .unwrap()
                    .put(id.clone(), (fulfilled_instant, proof));

                Ok(id)
            }
        }
    }

    pub async fn get_proof_status(&self, request_id: &str) -> Result<ProofRequestStatus, Error> {
        match self {
            EitherProver::Network { prover, vk: _ } => {
                let prover = prover.clone();
                let request_id = B256::from_str(request_id)?;

                run_on_tokio(async move {
                    prover
                        .get_proof_status(request_id)
                        .await
                        .map_err(|err| Error::Sp1(err.to_string()))
                        .map(|(status, maybe_proof)| ProofRequestStatus {
                            fulfillment_status: Sp1FulfillmentStatus::try_from(
                                status.fulfillment_status(),
                            )
                            .unwrap()
                            .into(),
                            proof: maybe_proof.map(|p| p.bytes()),
                        })
                })
                .await
            }
            EitherProver::Mock {
                vk: _,
                proof_requests,
            } => {
                let proof_requests = proof_requests.lock().unwrap();

                let status = match proof_requests.peek(request_id) {
                    Some((fulfilled_instant, proof)) => {
                        let now = Instant::now();
                        let fulfillment_status = if *fulfilled_instant < now {
                            Sp1FulfillmentStatus::Fulfilled.into()
                        } else {
                            Sp1FulfillmentStatus::Assigned.into()
                        };

                        ProofRequestStatus {
                            fulfillment_status,
                            proof: Some(proof.bytes()),
                        }
                    }
                    None => ProofRequestStatus {
                        fulfillment_status: Sp1FulfillmentStatus::UnspecifiedFulfillmentStatus
                            .into(),
                        proof: None,
                    },
                };

                Ok(status)
            }
        }
    }
}

#[derive(Debug, Default, Clone, Serialize, Deserialize, uniffi::Record)]
#[serde(rename_all = "camelCase")]
pub struct ProofRequestInputs {
    pub production: bool,
}

#[derive(Debug, uniffi::Record)]
pub struct ProofRequestStatus {
    pub fulfillment_status: FulfillmentStatus,
    pub proof: Option<Vec<u8>>,
}

#[derive(Debug, Eq, PartialEq, uniffi::Enum)]
pub enum FulfillmentStatus {
    UnspecifiedFulfillmentStatus = 0,
    Requested = 1,
    Assigned = 2,
    Fulfilled = 3,
    Unfulfillable = 4,
}

impl From<Sp1FulfillmentStatus> for FulfillmentStatus {
    fn from(fulfillment_status: Sp1FulfillmentStatus) -> Self {
        match fulfillment_status {
            Sp1FulfillmentStatus::UnspecifiedFulfillmentStatus => {
                FulfillmentStatus::UnspecifiedFulfillmentStatus
            }
            Sp1FulfillmentStatus::Requested => FulfillmentStatus::Requested,
            Sp1FulfillmentStatus::Assigned => FulfillmentStatus::Assigned,
            Sp1FulfillmentStatus::Fulfilled => FulfillmentStatus::Fulfilled,
            Sp1FulfillmentStatus::Unfulfillable => FulfillmentStatus::Unfulfillable,
        }
    }
}

fn tokio_rt() -> &'static Runtime {
    static RT: OnceLock<Runtime> = OnceLock::new();
    RT.get_or_init(|| {
        tokio::runtime::Builder::new_multi_thread()
            .enable_all()
            .build()
            .expect("failed to build tokio runtime")
    })
}

/// Runs a Tokio-requiring future on the global runtime and returns a Future
/// that can be awaited from *any* executor (including `UniFFI`'s).
pub async fn run_on_tokio<F, T>(fut: F) -> T
where
    F: std::future::Future<Output = T> + Send + 'static,
    T: Send + 'static,
{
    let (tx, rx) = oneshot::channel();
    tokio_rt().spawn(async move {
        let out = fut.await;
        let _ = tx.send(out);
    });

    rx.await.expect("tokio task was cancelled")
}
