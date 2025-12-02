use eyre::{Result, eyre};
use sp1_prover::components::CpuProverComponents;
use sp1_sdk::{
    HashableKey, ProverClient, SP1ProofMode, SP1ProofWithPublicValues, SP1ProvingKey, SP1Stdin,
    SP1VerifyingKey,
};

#[cfg(feature = "mock")]
use sp1_sdk::Prover;

pub struct ProvingClient {
    client: Box<dyn sp1_sdk::Prover<CpuProverComponents>>,
    elf: Vec<u8>,
    pk: SP1ProvingKey,
    vk: SP1VerifyingKey,
}

impl ProvingClient {
    pub fn new(elf: &[u8]) -> Self {
        #[cfg(feature = "mock")]
        let client = ProverClient::builder().mock().build();
        #[cfg(not(feature = "mock"))]
        let client = ProverClient::from_env();

        let (pk, vk) = client.setup(elf);

        Self {
            client: Box::new(client),
            elf: elf.to_vec(),
            pk,
            vk,
        }
    }

    pub fn prove<I: Into<SP1Stdin>>(&self, inputs: I) -> Result<SP1ProofWithPublicValues> {
        let stdin = inputs.into();

        let (public_values, report) = self.client.execute(&self.elf, &stdin).unwrap();

        println!("Cycles: {}", report.total_instruction_count());
        println!("Public values: {}", hex::encode(public_values.to_vec()));

        let proof = self
            .client
            .prove(&self.pk, &stdin, SP1ProofMode::Groth16)
            .map_err(|err| eyre!("{err}"))?;

        Ok(proof)
    }

    pub fn vk_hash(&self) -> String {
        self.vk.bytes32()
    }
}
