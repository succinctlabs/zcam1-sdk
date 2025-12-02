use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use crate::error::Error;

#[derive(Debug, Clone, Serialize, Deserialize, uniffi::Object)]
pub struct ManifestStore {
    pub active_manifest: String,
    pub manifests: HashMap<String, Manifest>,
}

#[uniffi::export]
impl ManifestStore {
    pub fn active_manifest(&self) -> Result<Manifest, Error> {
        self.manifests
            .get(&self.active_manifest)
            .cloned()
            .ok_or_else(|| Error::NoActiveManifest)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, uniffi::Object)]
pub struct Manifest {
    pub claim: Claim,
    pub assertion_store: AssertionStore,
}

#[uniffi::export]
impl Manifest {
    pub fn proof(&self) -> Proof {
        self.assertion_store.proof.clone()
    }

    pub fn data_hash(&self) -> DataHash {
        self.assertion_store.data_hash.clone()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, uniffi::Object)]
pub struct Claim {
    pub signature: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, uniffi::Object)]
pub struct AssertionStore {
    #[serde(rename = "succinct.proof")]
    pub proof: Proof,
    #[serde(rename = "c2pa.hash.data")]
    pub data_hash: DataHash,
}

#[derive(Debug, Clone, Serialize, Deserialize, uniffi::Object)]
pub struct Proof {
    pub data: String,
    pub vk_hash: String,
}

#[uniffi::export]
impl Proof {
    pub fn data(&self) -> String {
        self.data.clone()
    }

    pub fn vk_hash(&self) -> String {
        self.vk_hash.clone()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, uniffi::Object)]
pub struct DataHash {
    pub name: String,
    pub alg: String,
    pub hash: String,
    #[serde(default)]
    pub exclusions: Vec<Exclusion>,
}

#[uniffi::export]
impl DataHash {
    pub fn hash(&self) -> String {
        self.hash.clone()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, uniffi::Object)]
pub struct Exclusion {
    start: usize,
    length: usize,
}
