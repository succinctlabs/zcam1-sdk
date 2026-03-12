use sp1_sdk::{Prover, env::EnvProver};
use zcam1_common::AuthInputs;
use zcam1_proving_utils::IOS_AUTHENCITY_ELF;

#[tokio::test]
async fn execute_in_sp1_test() {
    let inputs = AuthInputs {
        photo_bytes: std::fs::read("./tests/fixtures/with_bindings.jpg")
            .expect("Failed to read with_bindings.jpg"),
        format: "image/jpeg".to_string(),
        app_attest_production: false,
    };

    let prover = EnvProver::new().await;

    prover
        .execute(IOS_AUTHENCITY_ELF, inputs.into())
        .await
        .unwrap();
}
