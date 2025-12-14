use eyre::Result;
use sp1_prover::components::CpuProverComponents;
use sp1_sdk::{
    HashableKey, ProverClient, SP1ProofMode, SP1ProofWithPublicValues, SP1ProvingKey, SP1Stdin,
    SP1VerifyingKey,
};

use thiserror::Error;

pub struct ProvingClient {
    prover: Box<dyn sp1_sdk::Prover<CpuProverComponents>>,
    elf: Vec<u8>,
    pk: SP1ProvingKey,
    vk: SP1VerifyingKey,
    is_mock: bool,
}

impl ProvingClient {
    pub fn new(elf: &[u8], is_mock: bool) -> Self {
        let prover = if is_mock {
            Box::new(ProverClient::builder().mock().build())
                as Box<dyn sp1_sdk::Prover<CpuProverComponents>>
        } else {
            Box::new(ProverClient::from_env())
        };

        let (pk, vk) = prover.setup(elf);

        Self {
            prover,
            elf: elf.to_vec(),
            pk,
            vk,
            is_mock,
        }
    }

    pub fn prove<I: Into<SP1Stdin>>(
        &self,
        inputs: I,
    ) -> Result<SP1ProofWithPublicValues, ProvingError> {
        let stdin = inputs.into();

        if !self.is_mock {
            let (_, report) = self
                .prover
                .execute(&self.elf, &stdin)
                .map_err(|err| ProvingError::Execution(err.to_string()))?;

            println!("Cycles: {}", report.total_instruction_count());
        }

        let proof = self
            .prover
            .prove(&self.pk, &stdin, SP1ProofMode::Groth16)
            .map_err(|err| ProvingError::ProofGeneration(err.to_string()))?;

        Ok(proof)
    }

    pub fn vk_hash(&self) -> String {
        self.vk.bytes32()
    }
}

#[derive(Debug, Error)]
pub enum ProvingError {
    #[error("Failed to execute: {0}")]
    Execution(String),

    #[error("Failed to generate proof: {0}")]
    ProofGeneration(String),
}
