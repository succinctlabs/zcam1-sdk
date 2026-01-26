use std::{
    marker::PhantomData,
    num::NonZeroUsize,
    str::FromStr,
    sync::{Arc, Mutex, OnceLock},
    thread,
    time::{Duration, Instant},
};

use alloy_primitives::B256;
use lru::LruCache;
use serde::{Deserialize, Serialize};
use sp1_build::include_elf;
use sp1_core_machine::io::SP1Stdin;
use sp1_prover::{HashableKey, SP1VerifyingKey};
use tokio::{runtime::Runtime, sync::oneshot};
use zcam1_ios::AuthInputs;

use crate::{
    error::Error,
    network::{
        NetworkMode, NetworkProver, NetworkSigner, SP1ProofMode, get_default_rpc_url_for_mode,
    },
};

pub const IOS_AUTHENCITY_ELF: &[u8] = include_elf!("authenticity-ios");
pub const IOS_AUTHENCITY_VK: &[u8] = include_bytes!("../artifacts/vk.bin");
pub const MOCK_ELF: &[u8] = include_elf!("mock");

#[uniffi::export(callback_interface)]
pub trait Initialized: Send + Sync {
    fn initialized(&self);
}

#[derive(uniffi::Object)]
pub struct IosProvingClient(ProvingClient<AuthInputs>);

#[uniffi::export]
impl IosProvingClient {
    #[uniffi::constructor(default(callback = None))]
    pub fn new(private_key: String, callback: Option<Box<dyn Initialized>>) -> Self {
        Self(ProvingClient::ios(private_key, callback))
    }

    #[uniffi::constructor(default(callback = None))]
    pub fn mock(callback: Option<Box<dyn Initialized>>) -> Self {
        Self(ProvingClient::mock(callback))
    }

    pub async fn request_proof(
        &self,
        file_path: &str,
        format: &str,
        inputs: IosProofRequestInputs,
    ) -> Result<String, Error> {
        let inputs = AuthInputs {
            photo_bytes: std::fs::read(file_path)?,
            format: format.to_string(),
            app_attest_production: inputs.app_attest_production,
        };
        self.0.request_proof(inputs).await
    }

    pub fn vk_hash(&self) -> Result<String, Error> {
        self.0.vk_hash()
    }

    pub async fn get_proof_status(&self, request_id: &str) -> Result<ProofRequestStatus, Error> {
        self.0.get_proof_status(request_id).await
    }
}

pub struct ProvingClient<I> {
    prover_client: Arc<OnceLock<EitherProver>>,
    vk_hash: Arc<OnceLock<String>>,
    phantom: PhantomData<I>,
}

impl<I> ProvingClient<I>
where
    I: Into<SP1Stdin>,
{
    pub fn mock(callback: Option<Box<dyn Initialized>>) -> Self {
        let prover_client = Arc::new(OnceLock::new());
        let vk_hash = Arc::new(OnceLock::new());
        let cloned_prover = prover_client.clone();

        thread::spawn(move || {
            let _ = cloned_prover.set(EitherProver::Mock {
                proof_requests: Mutex::new(LruCache::new(NonZeroUsize::new(1024).unwrap())),
            });

            if let Some(callback) = callback {
                callback.initialized();
            }
        });

        Self {
            prover_client,
            vk_hash,
            phantom: PhantomData,
        }
    }

    pub async fn request_proof(&self, inputs: I) -> Result<String, Error> {
        let prover = self
            .prover_client
            .get()
            .ok_or(Error::ProverNotInitialized)?;

        prover.request_proof(inputs.into()).await
    }

    pub async fn get_proof_status(&self, request_id: &str) -> Result<ProofRequestStatus, Error> {
        let prover = self
            .prover_client
            .get()
            .ok_or(Error::ProverNotInitialized)?;
        prover.get_proof_status(request_id).await
    }

    pub fn vk_hash(&self) -> Result<String, Error> {
        self.vk_hash
            .get()
            .ok_or(Error::ProverNotInitialized)
            .cloned()
    }
}

impl ProvingClient<AuthInputs> {
    pub fn ios(private_key: String, callback: Option<Box<dyn Initialized>>) -> Self {
        let rpc_url = get_default_rpc_url_for_mode(NetworkMode::Reserved);
        let signer = NetworkSigner::local(&private_key).unwrap();

        let prover_client = Arc::new(OnceLock::new());
        let vk_hash = Arc::new(OnceLock::new());
        let cloned_prover = prover_client.clone();
        let cloned_vk_hash = vk_hash.clone();

        thread::spawn(move || {
            let prover_client = NetworkProver::new(signer, &rpc_url, NetworkMode::Reserved);
            let vk = bincode::deserialize::<SP1VerifyingKey>(IOS_AUTHENCITY_VK).unwrap();
            let _ = cloned_vk_hash.set(vk.bytes32());
            let _ = cloned_prover.set(EitherProver::Network {
                prover_client: Arc::new(prover_client),
                vk: Box::new(vk),
            });

            if let Some(callback) = callback {
                callback.initialized();
            }
        });

        Self {
            prover_client,
            vk_hash,
            phantom: PhantomData,
        }
    }
}

enum EitherProver {
    Network {
        prover_client: Arc<NetworkProver>,
        vk: Box<SP1VerifyingKey>,
    },
    Mock {
        proof_requests: Mutex<LruCache<String, (Instant, Vec<u8>)>>,
    },
}

impl EitherProver {
    pub async fn request_proof(&self, stdin: SP1Stdin) -> Result<String, Error> {
        match self {
            EitherProver::Network { prover_client, vk } => {
                let prover_client = prover_client.clone();
                let vk = vk.clone();

                run_on_tokio(async move {
                    prover_client
                        .request_proof(&vk, IOS_AUTHENCITY_ELF, &stdin, SP1ProofMode::Groth16)
                        .await
                        .map(|id| id.to_string())
                        .map_err(|err| Error::Sp1(format!("{err:#?}")))
                })
                .await
            }
            EitherProver::Mock { proof_requests } => {
                let id = B256::random().to_string();
                let mut proof_requests = proof_requests.lock().unwrap();

                let fulfilled_instant = Instant::now().checked_add(Duration::from_secs(5)).unwrap();

                proof_requests.put(id.clone(), (fulfilled_instant, vec![]));

                Ok(id)
            }
        }
    }

    pub async fn get_proof_status(&self, request_id: &str) -> Result<ProofRequestStatus, Error> {
        match self {
            EitherProver::Network {
                prover_client,
                vk: _,
            } => {
                let prover_client = prover_client.clone();
                let request_id = B256::from_str(request_id)?;

                run_on_tokio(async move {
                    prover_client
                        .get_proof_status(request_id)
                        .await
                        .map_err(|err| Error::Sp1(err.to_string()))
                        .map(|(status, maybe_proof)| ProofRequestStatus {
                            fulfillment_status: status.fulfillment_status().into(),
                            proof: maybe_proof.map(|p| p.as_bytes()),
                        })
                })
                .await
            }
            EitherProver::Mock { proof_requests } => {
                let proof_requests = proof_requests.lock().unwrap();

                let status = match proof_requests.peek(request_id) {
                    Some((fulfilled_instant, proof)) => {
                        let now = Instant::now();
                        let fulfillment_status = if *fulfilled_instant < now {
                            FulfillmentStatus::Fulfilled
                        } else {
                            FulfillmentStatus::Assigned
                        };

                        ProofRequestStatus {
                            fulfillment_status,
                            proof: Some(proof.clone()),
                        }
                    }
                    None => ProofRequestStatus {
                        fulfillment_status: FulfillmentStatus::UnspecifiedFulfillmentStatus,
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
pub struct IosProofRequestInputs {
    pub app_attest_production: bool,
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

impl From<i32> for FulfillmentStatus {
    fn from(fulfillment_status: i32) -> Self {
        match fulfillment_status {
            1 => FulfillmentStatus::Requested,
            2 => FulfillmentStatus::Assigned,
            3 => FulfillmentStatus::Fulfilled,
            4 => FulfillmentStatus::Unfulfillable,
            _ => FulfillmentStatus::UnspecifiedFulfillmentStatus,
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
/// that can be awaited from *any* executor (including UniFFI's).
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
