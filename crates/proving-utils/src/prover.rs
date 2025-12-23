use std::marker::PhantomData;

use serde::{Deserialize, Serialize};
use sp1_sdk::{
    CpuProver, HashableKey, NetworkProver, NetworkSigner, Prover, SP1ProofWithPublicValues,
    SP1ProvingKey, SP1Stdin, include_elf,
    network::{NetworkMode, get_default_rpc_url_for_mode},
};

use crate::error::Error;

pub const IOS_AUTHENCITY_ELF: &[u8] = include_elf!("authenticity-ios");
pub const MOCK_ELF: &[u8] = include_elf!("mock");

#[derive(uniffi::Object)]
pub struct IosProvingClient(ProvingClient<IosAuthInputs>);

#[uniffi::export]
impl IosProvingClient {
    #[uniffi::constructor()]
    pub fn new(private_key: String) -> Self {
        Self(ProvingClient::ios(private_key))
    }

    #[uniffi::constructor()]
    pub fn mock() -> Self {
        Self(ProvingClient::mock())
    }

    pub async fn request_proof(&self, inputs: IosAuthInputs) -> Result<Vec<u8>, Error> {
        self.0
            .request_proof(inputs)
            .await
            .map(|proof| proof.bytes())
    }

    pub fn vk_hash(&self) -> String {
        self.0.vk_hash()
    }
}

pub struct ProvingClient<I> {
    prover: EitherProver,
    pk: SP1ProvingKey,
    vk_hash: String,
    phantom: PhantomData<I>,
}

impl<I> ProvingClient<I>
where
    I: Into<SP1Stdin>,
{
    pub fn mock() -> Self {
        let prover = CpuProver::mock();

        let (pk, vk) = prover.setup(MOCK_ELF);

        Self {
            prover: EitherProver::Mock {
                prover: Box::new(prover),
            },
            pk,
            vk_hash: vk.bytes32(),
            phantom: PhantomData,
        }
    }

    pub async fn request_proof(&self, inputs: I) -> Result<SP1ProofWithPublicValues, Error> {
        self.prover.request_proof(&self.pk, inputs.into()).await
    }

    pub fn vk_hash(&self) -> String {
        self.vk_hash.clone()
    }
}

impl ProvingClient<IosAuthInputs> {
    pub fn ios(private_key: String) -> Self {
        let rpc_url = get_default_rpc_url_for_mode(NetworkMode::Reserved);
        let signer = NetworkSigner::local(&private_key).unwrap();
        let prover = NetworkProver::new(signer, &rpc_url, NetworkMode::Reserved);

        let (pk, vk) = prover.setup(IOS_AUTHENCITY_ELF);

        Self {
            prover: EitherProver::Network {
                prover: Box::new(prover),
            },
            pk,
            vk_hash: vk.bytes32(),
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
    pub attestation: String, // b64
    pub assertion: String,   // b64
    pub key_id: String,      // b64
    pub data_hash: Vec<u8>,
    pub app_id: String,
    pub app_attest_production: bool,
}

impl From<IosAuthInputs> for sp1_sdk::SP1Stdin {
    fn from(inputs: IosAuthInputs) -> Self {
        let mut stdin = sp1_sdk::SP1Stdin::new();

        stdin.write(&inputs);

        stdin
    }
}
