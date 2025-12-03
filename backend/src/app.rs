use std::sync::Arc;

use axum::{
    Json, Router,
    extract::{Path, State},
    http::StatusCode,
    routing::{get, post},
};
use base64ct::{Base64, Encoding};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sp1_sdk::include_elf;
use zcam1_common::{
    Database, InMemoryDatabase, ProofRequest, ProvingClient, Verifier, generate_cert_chain,
};
use zcam1_ios::{AuthInputs, IosRegisterInputs, IosVerifier};

const ELF: &[u8] = include_elf!("authenticity-ios");

pub fn build_app() -> Router {
    let state = RequestState::new(ELF);

    Router::new()
        .route("/ios/register/init", post(bootstrap_init))
        .route("/ios/register/validate", post(bootstrap_register))
        .route("/ios/request-proof", post(request_proof))
        .route("/ios/proof/{id}", get(proof))
        .route("/ios/vk", get(vk_hash))
        .route("/cert-chain", post(cert_chain))
        .with_state(Arc::new(state))
}

async fn bootstrap_init(
    State(state): State<Arc<RequestState>>,
    Json(params): Json<IosRegisterInitRequest>,
) -> Result<String, (StatusCode, String)> {
    println!("INIT");
    let mut buf = [0u8; 16];

    getrandom::fill(&mut buf)
        .map_err(|err| (StatusCode::INTERNAL_SERVER_ERROR, err.to_string()))?;
    let challenge = hex::encode(buf);

    state.db.init_device(params.key_id, challenge.clone());

    Ok(challenge)
}

async fn bootstrap_register(
    State(state): State<Arc<RequestState>>,
    Json(params): Json<IosRegisterValidateParams>,
) -> Result<(), (StatusCode, String)> {
    println!("REGISTER");
    let challenge = state.db.get_challenge(&params.key_id).ok_or_else(|| {
        (
            StatusCode::UNAUTHORIZED,
            "This content pub key is not known".to_string(),
        )
    })?;

    let inputs = IosRegisterInputs::from(&params);
    let is_valid = state
        .verifier
        .bootstrap_verify(&inputs, challenge.to_string())
        .map_err(|err| (StatusCode::INTERNAL_SERVER_ERROR, err.to_string()))?;

    if is_valid {
        state.db.mark_device_as_trusted(params.key_id);
    }

    println!("is_valid: {is_valid}");

    Ok(())
}

async fn request_proof(
    State(state): State<Arc<RequestState>>,
    Json(params): Json<IosRequestProofParams>,
) -> Result<String, (StatusCode, String)> {
    let request_id = state.db.create_proof_request();
    let cloned_request_id = request_id.clone();

    tokio::spawn(async move {
        let inputs = AuthInputs::from(&params);
        let proof = state.prover.prove(inputs).unwrap();

        state.db.fulfill_proof_request(cloned_request_id, proof);
    });

    Ok(request_id)
}

async fn proof(
    State(state): State<Arc<RequestState>>,
    Path(id): Path<String>,
) -> Result<Vec<u8>, (StatusCode, String)> {
    if let Some(status) = state.db.get_proof_request(&id) {
        match status {
            ProofRequest::Requested => Err((StatusCode::ACCEPTED, String::default())),
            ProofRequest::Fulfilled(proof) => {
                //let bytes = proof.bytes();
                Ok(proof.bytes())
            }
        }
    } else {
        Err((
            StatusCode::NOT_FOUND,
            format!("Proof request ID '{id}' not found"),
        ))
    }
}

async fn vk_hash(State(state): State<Arc<RequestState>>) -> String {
    state.prover.vk_hash()
}

async fn cert_chain(Json(jwt): Json<Value>) -> Result<String, (StatusCode, String)> {
    let cert_chain = generate_cert_chain(jwt, "ZCAM1", "Succinct")
        .map_err(|err| (StatusCode::INTERNAL_SERVER_ERROR, err.to_string()))?;

    Ok(cert_chain)
}

struct RequestState {
    pub db: InMemoryDatabase,
    pub verifier: IosVerifier,
    pub prover: ProvingClient,
}

impl RequestState {
    pub fn new(elf: &[u8]) -> Self {
        let db = InMemoryDatabase::default();
        let verifier = IosVerifier;
        let prover = ProvingClient::new(elf);

        Self {
            db,
            verifier,
            prover,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct IosRegisterInitRequest {
    key_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IosRegisterValidateParams {
    pub attestation: String,
    pub key_id: String,
    pub app_id: String,
    pub production: bool,
}

impl From<&IosRegisterValidateParams> for IosRegisterInputs {
    fn from(value: &IosRegisterValidateParams) -> Self {
        Self {
            attestation: value.attestation.clone(),
            key_id: value.key_id.clone(),
            app_id: value.app_id.clone(),
            production: value.production,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IosRequestProofParams {
    pub attestation: String, // b64
    pub assertion: String,   // b64
    pub key_id: String,      // b64
    pub data_hash: String,   // b64
    pub challenge: String,
    pub app_id: String,
    pub app_attest_production: bool,
}

impl From<&IosRequestProofParams> for AuthInputs {
    fn from(value: &IosRequestProofParams) -> Self {
        Self {
            attestation: value.attestation.clone(),
            assertion: value.assertion.clone(),
            key_id: value.key_id.clone(),
            data_hash: Base64::decode_vec(&value.data_hash).unwrap(),
            challenge: value.challenge.clone(),
            app_id: value.app_id.clone(),
            app_attest_production: value.app_attest_production,
        }
    }
}
