use sp1_sdk::{
    NetworkProver, ProveRequest, Prover, SP1Stdin,
    env::EnvProver,
    network::{NetworkMode, get_default_rpc_url_for_mode, signer::NetworkSigner},
};
use zcam1_ios::AuthInputs;
use zcam1_proving_utils::IOS_AUTHENCITY_ELF;

#[tokio::test]
async fn execute_in_sp1_test() {
    let inputs = AuthInputs {
        photo_bytes: std::fs::read("./tests/fixtures/with_bindings.jpg")
            .expect("Failed to read with_bindings.jpg"),
        format: "image/jpeg".to_string(),
        app_attest_production: false,
    };

    prover
        .execute(IOS_AUTHENCITY_ELF, inputs.into())
        .await
        .unwrap();
}
