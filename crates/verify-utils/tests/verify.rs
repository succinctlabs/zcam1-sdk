use zcam1_c2pa_utils::types::DeviceBindings;
use zcam1_verify_utils::bindings::{verify_bindings_from_file, verify_bindings_from_manifest};

const IMAGE_WITH_VALID_BINDINGS: &str = "./tests/fixtures/with_bindings.jpg";

#[test]
fn test_verify_bindings() {
    let is_valid = verify_bindings_from_file(IMAGE_WITH_VALID_BINDINGS, false).unwrap();

    assert!(is_valid);
}

fn mock_bindings() -> DeviceBindings {
    DeviceBindings {
        app_id: "com.test.app".to_string(),
        device_key_id: "test_key".to_string(),
        attestation: "SIMULATOR_MOCK_test_key_123".to_string(),
        assertion: "SIMULATOR_MOCK_ASSERTION_test_key_456".to_string(),
    }
}

#[test]
fn test_simulator_mock_accepted_in_dev() {
    let bindings = mock_bindings();
    let result = verify_bindings_from_manifest(&bindings, "some metadata", &[0u8; 32], false);

    assert!(result.is_ok());
    assert!(
        result.unwrap(),
        "Simulator mock should be accepted in dev mode"
    );
}

#[test]
fn test_simulator_mock_rejected_in_production() {
    let bindings = mock_bindings();
    let result = verify_bindings_from_manifest(&bindings, "some metadata", &[0u8; 32], true);

    assert!(
        result.is_err(),
        "Simulator mock should be rejected in production"
    );
    let err = result.unwrap_err();
    assert!(
        err.to_string().contains("Simulator"),
        "Error should mention simulator: {err}"
    );
}

#[test]
fn test_verify_bindings_file_without_manifest() {
    // sample.jpg has no C2PA manifest — should return an error
    let result = verify_bindings_from_file("../c2pa-utils/tests/fixtures/sample.jpg", false);

    assert!(
        result.is_err(),
        "File without manifest should fail verification"
    );
}
