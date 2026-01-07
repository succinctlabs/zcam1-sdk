use sp1_sdk::EnvProver;
use zcam1_ios::AuthInputs;
use zcam1_proving_utils::IOS_AUTHENCITY_ELF;

#[test]
fn execute_in_sp1_test() {
    let inputs = AuthInputs {
        photo_bytes: std::fs::read("./tests/fixtures/with_bindings.jpg").unwrap(),
        format: "image/jpeg".to_string(),
        app_attest_production: false,
    };

    let prover = EnvProver::new();

    prover
        .execute(IOS_AUTHENCITY_ELF, &inputs.into())
        .run()
        .unwrap();
}
