use std::collections::HashMap;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManifestStore {
    pub active_manifest: String,
    pub manifests: HashMap<String, Manifest>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Manifest {
    pub claim: Claim,
    pub assertion_store: AssertionStore,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claim {
    pub signature: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssertionStore {
    #[serde(rename = "succinct.proof")]
    pub proof: String,
    #[serde(rename = "c2pa.hash.data")]
    pub data_hash: DataHash,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DataHash {
    pub name: String,
    pub alg: String,
    pub hash: String,
    pub exclusions: Vec<Exclusion>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Exclusion {
    start: usize,
    length: usize,
}
