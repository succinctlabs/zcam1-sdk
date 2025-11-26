use eyre::{Result, eyre};
use sp1_sdk::{EnvProver, ProverClient, SP1ProofWithPublicValues, SP1ProvingKey, SP1Stdin};

pub struct Prover {
    client: EnvProver,
    elf: Vec<u8>,
    pk: SP1ProvingKey,
}

impl Prover {
    pub fn new(elf: &[u8]) -> Self {
        let client = ProverClient::from_env();

        let (pk, _) = client.setup(elf);

        Self {
            client,
            elf: elf.to_vec(),
            pk,
        }
    }

    pub fn prove<I: Into<SP1Stdin>>(&self, inputs: I) -> Result<SP1ProofWithPublicValues> {
        let stdin = inputs.into();

        let (public_values, report) = self.client.execute(&self.elf, &stdin).run().unwrap();

        println!("Cycles: {}", report.total_instruction_count());
        println!("Public values: {}", hex::encode(public_values.to_vec()));

        let proof = self
            .client
            .prove(&self.pk, &stdin)
            .groth16()
            .run()
            .map_err(|err| eyre!("{err}"))?;

        Ok(proof)
    }
}
