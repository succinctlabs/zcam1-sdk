use sp1_sdk::{Prover, env::EnvProver};
use zcam1_common::AuthInputs;
use zcam1_testing_utils::ANDROID_AUTHENCITY_ELF;

#[tokio::test]
async fn execute_in_sp1_test() {
    let inputs = AuthInputs {
        photo_bytes: std::fs::read("./tests/fixtures/with_bindings_androis.jpg")
            .expect("Failed to read with_bindings.jpg"),
        format: "image/jpeg".to_string(),
        production: false,
    };

    let prover = EnvProver::new().await;

    let (_, execution_report) = prover
        .execute(ANDROID_AUTHENCITY_ELF, inputs.into())
        .await
        .unwrap();

    println!("{execution_report}")
}
