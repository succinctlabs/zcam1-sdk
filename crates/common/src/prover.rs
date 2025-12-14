use eyre::Result;
use sp1_prover::components::CpuProverComponents;
use sp1_sdk::{
    CpuProver, EnvProver, HashableKey, ProverClient, SP1ProofMode, SP1ProofWithPublicValues,
    SP1ProvingKey, SP1Stdin, SP1VerifyingKey,
};

use thiserror::Error;

pub struct ProvingClient {
    env_prover: EnvProver,
    mock_prover: CpuProver,
    pk: SP1ProvingKey,
    vk: SP1VerifyingKey,
}

impl ProvingClient {
    pub fn new(elf: &[u8]) -> Self {
        let env_prover = ProverClient::from_env();
        let mock_prover = ProverClient::builder().mock().build();

        let (pk, vk) = env_prover.setup(elf);

        Self {
            env_prover,
            mock_prover,
            pk,
            vk,
        }
    }

    pub fn prove<I: Into<SP1Stdin>>(
        &self,
        inputs: I,
        is_mock: bool,
    ) -> Result<SP1ProofWithPublicValues, ProvingError> {
        let stdin = inputs.into();

        let prover = self.prover_for_request(is_mock);

        let proof = prover
            .prove(&self.pk, &stdin, SP1ProofMode::Groth16)
            .map_err(|err| ProvingError::ProofGeneration(err.to_string()))?;

        Ok(proof)
    }

    pub fn vk_hash(&self) -> String {
        self.vk.bytes32()
    }

    fn prover_for_request(&self, is_mock: bool) -> &dyn sp1_sdk::Prover<CpuProverComponents> {
        if is_mock {
            &self.mock_prover
        } else {
            &self.env_prover
        }
    }
}

#[derive(Debug, Error)]
pub enum ProvingError {
    #[error("Failed to execute: {0}")]
    Execution(String),

    #[error("Failed to generate proof: {0}")]
    ProofGeneration(String),
}
