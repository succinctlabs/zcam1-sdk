use std::{
    marker::PhantomData,
    sync::{Arc, OnceLock},
    thread,
};

use serde::{Deserialize, Serialize};
use sp1_sdk::{
    CpuProver, HashableKey, NetworkProver, NetworkSigner, Prover, SP1ProofWithPublicValues,
    SP1ProvingKey, SP1Stdin, include_elf,
    network::{NetworkMode, get_default_rpc_url_for_mode},
};
use zcam1_ios::AuthInputs;

use crate::error::Error;

pub const IOS_AUTHENCITY_ELF: &[u8] = include_elf!("authenticity-ios");
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
        inputs: IosAuthInputs,
    ) -> Result<Vec<u8>, Error> {
        let auth_inputs = AuthInputs {
            photo_bytes: std::fs::read(&inputs.photo_path)?,
            format: inputs.photo_format.clone(),
            // Attestation fields from the client
            attestation: inputs.attestation,
            assertion: inputs.assertion,
            key_id: inputs.key_id,
            data_hash: inputs.data_hash,
            app_id: inputs.app_id,
            app_attest_production: inputs.app_attest_production,
        };
        self.0
            .request_proof(auth_inputs)
            .await
            .map(|proof| proof.bytes())
    }

    pub fn vk_hash(&self) -> Result<String, Error> {
        self.0.vk_hash()
    }
}

pub struct ProvingClient<I> {
    prover: Arc<OnceLock<EitherProver>>,
    pk: Arc<OnceLock<SP1ProvingKey>>,
    vk_hash: Arc<OnceLock<String>>,
    phantom: PhantomData<I>,
}

impl<I> ProvingClient<I>
where
    I: Into<SP1Stdin>,
{
    pub fn mock(callback: Option<Box<dyn Initialized>>) -> Self {
        let prover = Arc::new(OnceLock::new());
        let pk = Arc::new(OnceLock::new());
        let vk_hash = Arc::new(OnceLock::new());
        let cloned_prover = prover.clone();
        let cloned_pk = pk.clone();
        let cloned_vk_hash = vk_hash.clone();

        thread::spawn(move || {
            let prover = CpuProver::mock();
            let (pk, vk) = prover.setup(MOCK_ELF);
            let _ = cloned_prover.set(EitherProver::Mock {
                prover: Box::new(prover),
            });
            let _ = cloned_pk.set(pk);
            let _ = cloned_vk_hash.set(vk.bytes32());

            if let Some(callback) = callback {
                callback.initialized();
            }
        });

        Self {
            prover,
            pk,
            vk_hash,
            phantom: PhantomData,
        }
    }

    pub async fn request_proof(&self, inputs: I) -> Result<SP1ProofWithPublicValues, Error> {
        let pk = self.pk.get().ok_or(Error::ProverNotInitialized)?;
        let prover = self.prover.get().ok_or(Error::ProverNotInitialized)?;
        prover.request_proof(pk, inputs.into()).await
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

        let prover = Arc::new(OnceLock::new());
        let pk = Arc::new(OnceLock::new());
        let vk_hash = Arc::new(OnceLock::new());
        let cloned_prover = prover.clone();
        let cloned_pk = pk.clone();
        let cloned_vk_hash = vk_hash.clone();

        thread::spawn(move || {
            let prover = NetworkProver::new(signer, &rpc_url, NetworkMode::Reserved);
            let (pk, vk) = prover.setup(IOS_AUTHENCITY_ELF);
            let _ = cloned_prover.set(EitherProver::Network {
                prover: Box::new(prover),
            });
            let _ = cloned_pk.set(pk);
            let _ = cloned_vk_hash.set(vk.bytes32());

            if let Some(callback) = callback {
                callback.initialized();
            }
        });

        Self {
            prover,
            pk,
            vk_hash,
            phantom: PhantomData,
        }
    }
}

enum EitherProver {
    Network { prover: Box<NetworkProver> },
    Mock { prover: Box<CpuProver> },
}

impl EitherProver {
    pub async fn request_proof(
        &self,
        pk: &SP1ProvingKey,
        stdin: SP1Stdin,
    ) -> Result<SP1ProofWithPublicValues, Error> {
        match self {
            EitherProver::Network { prover } => prover
                .prove(pk, &stdin)
                .run_async()
                .await
                .map_err(|err| Error::Sp1(err.to_string())),
            EitherProver::Mock { prover } => prover
                .prove(pk, &stdin)
                .groth16()
                .run()
                .map_err(|err| Error::Sp1(err.to_string())),
        }
    }
}

#[derive(Debug, Default, Clone, Serialize, Deserialize, uniffi::Record)]
#[serde(rename_all = "camelCase")]
pub struct IosAuthInputs {
    pub attestation: String,
    pub assertion: String,
    pub key_id: String,
    pub data_hash: Vec<u8>,
    pub app_id: String,
    pub app_attest_production: bool,
    pub photo_path: String,
    pub photo_format: String,
}

#[derive(Debug, Default, Clone, Serialize, Deserialize, uniffi::Record)]
#[serde(rename_all = "camelCase")]
pub struct IosProofRequestInputs {
    pub app_attest_production: bool,
}
