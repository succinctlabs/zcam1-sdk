use std::{
    collections::HashMap,
    fmt::Display,
    sync::{Arc, RwLock},
};

use sp1_sdk::SP1ProofWithPublicValues;

pub trait Database {
    fn init_device(&self, key_id: String, register_challenge: String);

    fn mark_device_as_trusted(&self, key_id: String);

    fn get_challenge(&self, key_id: &str) -> Option<Challenge>;

    fn create_proof_request(&self) -> String;

    fn get_proof_request(&self, id: &str) -> Option<ProofRequest>;

    fn fulfill_proof_request(&self, id: String, proof: SP1ProofWithPublicValues);
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
}

#[derive(Debug, Default)]
pub struct InMemoryDatabase {
    challenges_by_key_ids: RwLock<HashMap<String, Challenge>>,
    proof_requests_by_ids: RwLock<HashMap<String, ProofRequest>>,
}

impl Database for InMemoryDatabase {
    fn init_device(&self, key_id: String, register_challenge: String) {
        let mut challenges_by_key_ids = self.challenges_by_key_ids.write().unwrap();

        challenges_by_key_ids.insert(key_id, Challenge::Untrusted(register_challenge));
    }

    fn mark_device_as_trusted(&self, key_id: String) {
        if let Some(challenge) = self.get_challenge(&key_id) {
            let mut challenges_by_key_ids = self.challenges_by_key_ids.write().unwrap();

            challenges_by_key_ids.insert(key_id, Challenge::Trusted(challenge.to_string()));
        }
    }

    fn get_challenge(&self, key_id: &str) -> Option<Challenge> {
        let challenges_by_key_ids = self.challenges_by_key_ids.read().unwrap();

        challenges_by_key_ids.get(key_id).cloned()
    }

    fn create_proof_request(&self) -> String {
        let mut buf = [0u8; 16];

        getrandom::fill(&mut buf).unwrap();
        let id = hex::encode(buf);

        let mut proof_requests_by_ids = self.proof_requests_by_ids.write().unwrap();

        proof_requests_by_ids.insert(id.clone(), ProofRequest::Requested);

        id
    }

    fn get_proof_request(&self, id: &str) -> Option<ProofRequest> {
        let proof_requests_by_ids = self.proof_requests_by_ids.read().unwrap();

        proof_requests_by_ids.get(id).cloned()
    }

    fn fulfill_proof_request(&self, id: String, proof: SP1ProofWithPublicValues) {
        let mut proof_requests_by_ids = self.proof_requests_by_ids.write().unwrap();

        proof_requests_by_ids.insert(id, ProofRequest::Fulfilled(Arc::new(proof)));
    }
}
