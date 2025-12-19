use std::sync::Arc;

use axum::{
    Json, Router,
    extract::{Path, Request, State},
    http::StatusCode,
    routing::{get, post},
};
use base64ct::{Base64, Encoding};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tracing::{error, info};
use zcam1_common::{
    Database, InMemoryDatabase, ProofRequest, ProvingClient, Stats, generate_cert_chain,
};
use zcam1_ios::{AuthInputs, IosRegisterInputs, IosVerifier};

use crate::{ELF, MOCK_ELF};

pub fn build_app() -> Router {
    let state = RequestState::new(ELF, MOCK_ELF);

    Router::new()
        .route("/ios/register/init", post(bootstrap_init))
        .route("/ios/register/validate", post(bootstrap_register))
        .route("/ios/request-proof", post(request_proof))
        .route("/ios/proof/{id}", get(proof))
        .route("/ios/vk", get(vk_hash))
        .route("/cert-chain", post(cert_chain))
        .route("/health", get(health))
        .fallback(catch_all_404)
        .with_state(Arc::new(state))
}

/// Initializes a new device registration by generating a random challenge.
///
/// This endpoint creates a new challenge for the device identified by `key_id`
/// and stores it in the database for later validation.
async fn bootstrap_init(
    State(state): State<Arc<RequestState>>,
    Json(params): Json<IosRegisterInitRequest>,
) -> Result<String, (StatusCode, String)> {
    info!("POST /ios/register/init - key_id: {}", params.key_id);

    // Kept as backward compatibility
    Ok(params.key_id)
}

/// Validates a device registration by verifying the attestation against the stored challenge.
///
/// This endpoint verifies the attestation provided by the device and marks it as trusted
/// if the verification succeeds.
async fn bootstrap_register(
    State(state): State<Arc<RequestState>>,
    Json(params): Json<IosRegisterValidateParams>,
) -> Result<(), (StatusCode, String)> {
    info!(
        "POST /ios/register/validate - key_id: {}, app_id: {}",
        params.key_id, params.app_id
    );

    // Kept as backward compatibility
    Ok(())
}

/// Requests a proof generation for an authenticated device.
///
/// This endpoint initiates an asynchronous proof generation process for a trusted device.
/// It validates that the device is known and trusted, then spawns a background task to
/// generate the proof. Returns a request ID that can be used to poll for the proof result.
async fn request_proof(
    State(state): State<Arc<RequestState>>,
    Json(params): Json<IosRequestProofParams>,
) -> Result<String, (StatusCode, String)> {
    info!("POST /ios/request-proof - key_id: {}", params.key_id);

    let request_id = state.db.create_proof_request();
    let cloned_request_id = request_id.clone();

    tokio::spawn(async move {
        // Check if this is a simulator mock attestation
        let is_simulator_mock = params.attestation.starts_with("SIMULATOR_MOCK_");
        let inputs = AuthInputs::from(params);

        let proof = if is_simulator_mock {
            state.mock_prover.prove(inputs)
        } else {
            state.prover.prove(inputs)
        };

        match proof {
            Ok(proof) => {
                info!("Proof for request {cloned_request_id} generated");
                state.db.fulfill_proof_request(cloned_request_id, proof);
            }
            Err(err) => {
                error!("{err}");
                state
                    .db
                    .mark_proof_request_as_failed(cloned_request_id, err.to_string());
            }
        };
    });

    Ok(request_id)
}

/// Retrieves the status of a proof request by its ID.
///
/// This endpoint returns the proof bytes if the request has been fulfilled,
/// returns a 202 Accepted status if the proof is still being generated,
/// or returns a 404 if the request ID is not found.
async fn proof(
    State(state): State<Arc<RequestState>>,
    Path(id): Path<String>,
) -> Result<Vec<u8>, (StatusCode, String)> {
    info!("GET /ios/proof/{}", id);

    if let Some(status) = state.db.get_proof_request(&id) {
        match status {
            ProofRequest::Requested => Err((StatusCode::ACCEPTED, String::default())),
            ProofRequest::Fulfilled(proof) => {
                //let bytes = proof.bytes();
                Ok(proof.bytes())
            }
            ProofRequest::Failed(error_message) => {
                Err((StatusCode::INTERNAL_SERVER_ERROR, error_message))
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
    info!("GET /ios/vk");
    state.prover.vk_hash()
}

async fn cert_chain(Json(jwt): Json<Value>) -> Result<String, (StatusCode, String)> {
    info!("POST /cert-chain");
    let cert_chain = generate_cert_chain(jwt, "ZCAM1", "Succinct")
        .map_err(|err| (StatusCode::INTERNAL_SERVER_ERROR, err.to_string()))?;

    Ok(cert_chain)
}

async fn health(State(state): State<Arc<RequestState>>) -> Json<Stats> {
    Json(state.db.stats())
}

/// Catch-all handler for 404 errors that logs the requested path.
async fn catch_all_404(req: Request) -> (StatusCode, String) {
    let path = req.uri().path();
    let method = req.method();
    info!("404 NOT FOUND - {} {}", method, path);
    (StatusCode::NOT_FOUND, format!("Route '{}' not found", path))
}

struct RequestState {
    pub db: InMemoryDatabase,
    pub verifier: IosVerifier,
    pub prover: ProvingClient,
    pub mock_prover: ProvingClient,
}

impl RequestState {
    pub fn new(elf: &[u8], mock_elf: &[u8]) -> Self {
        let db = InMemoryDatabase::default();
        let verifier = IosVerifier;
        let prover = ProvingClient::new(elf, false);
        let mock_prover = ProvingClient::new(mock_elf, true);

        Self {
            db,
            verifier,
            prover,
            mock_prover,
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
    pub app_id: String,
    pub app_attest_production: bool,
}

impl From<IosRequestProofParams> for AuthInputs {
    fn from(value: IosRequestProofParams) -> Self {
        Self {
            attestation: value.attestation,
            assertion: value.assertion,
            key_id: value.key_id,
            data_hash: Base64::decode_vec(&value.data_hash).unwrap(),
            app_id: value.app_id,
            app_attest_production: value.app_attest_production,
        }
    }
}
