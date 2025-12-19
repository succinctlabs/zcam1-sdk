use std::{
    collections::{HashMap, hash_map::Entry},
    fmt::Display,
    sync::{Arc, RwLock},
};

use serde::Serialize;
use sp1_sdk::SP1ProofWithPublicValues;

pub trait Database {
    fn create_proof_request(&self) -> String;

    fn get_proof_request(&self, id: &str) -> Option<ProofRequest>;

    fn fulfill_proof_request(&self, id: String, proof: SP1ProofWithPublicValues);

    fn mark_proof_request_as_failed(&self, id: String, error_message: String);

    fn stats(&self) -> Stats;
}

#[derive(Debug, Clone)]
pub enum Challenge {
    Untrusted(String),
    Trusted(String),
}

impl Challenge {
    pub fn is_trusted(&self) -> bool {
        matches!(self, Challenge::Trusted(_))
    }
}

impl Display for Challenge {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Challenge::Untrusted(c) => write!(f, "{c}"),
            Challenge::Trusted(c) => write!(f, "{c}"),
        }
    }
}

#[derive(Debug, Clone)]
pub enum ProofRequest {
    Requested,
    Fulfilled(Arc<SP1ProofWithPublicValues>),
    Failed(String),
}

#[derive(Debug, Default)]
pub struct InMemoryDatabase {
    proof_requests_by_ids: RwLock<HashMap<String, ProofRequest>>,
}

impl Database for InMemoryDatabase {
    fn create_proof_request(&self) -> String {
        let mut buf = [0u8; 16];

        getrandom::fill(&mut buf).unwrap();
        let id = hex::encode(buf);

        let mut proof_requests_by_ids = self.proof_requests_by_ids.write().unwrap();

        proof_requests_by_ids.insert(id.clone(), ProofRequest::Requested);

        id
    }

    fn get_proof_request(&self, id: &str) -> Option<ProofRequest> {
        let mut proof_requests_by_ids = self.proof_requests_by_ids.write().unwrap();

        match proof_requests_by_ids.entry(id.to_string()) {
            Entry::Occupied(entry) => match entry.get() {
                ProofRequest::Requested => Some(entry.get().clone()),
                ProofRequest::Fulfilled(_) | ProofRequest::Failed(_) => Some(entry.remove()),
            },
            Entry::Vacant(_) => None,
        }
    }

    fn fulfill_proof_request(&self, id: String, proof: SP1ProofWithPublicValues) {
        let mut proof_requests_by_ids = self.proof_requests_by_ids.write().unwrap();

        proof_requests_by_ids.insert(id, ProofRequest::Fulfilled(Arc::new(proof)));
    }

    fn mark_proof_request_as_failed(&self, id: String, error_message: String) {
        let mut proof_requests_by_ids = self.proof_requests_by_ids.write().unwrap();

        proof_requests_by_ids.insert(id, ProofRequest::Failed(error_message));
    }

    fn stats(&self) -> Stats {
        let proof_requests_by_ids = self.proof_requests_by_ids.read().unwrap();
        let requested_proof_count = proof_requests_by_ids
            .iter()
            .filter(|(_, request)| matches!(request, ProofRequest::Requested))
            .count();

        Stats {
            requested_proof_count,
            fulfilled_proof_count: requested_proof_count - proof_requests_by_ids.len(),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Stats {
    pub requested_proof_count: usize,
    pub fulfilled_proof_count: usize,
}
