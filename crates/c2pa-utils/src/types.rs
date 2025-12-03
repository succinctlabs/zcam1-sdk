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
    pub fn bindings(&self) -> Option<DeviceBindings> {
        self.assertion_store.device_bindings.clone()
    }

    pub fn proof(&self) -> Option<Proof> {
        self.assertion_store.proof.clone()
    }

    pub fn data_hash(&self) -> DataHash {
        self.assertion_store.data_hash.clone()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, uniffi::Record)]
pub struct Claim {
    pub signature: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, uniffi::Record)]
pub struct AssertionStore {
    #[serde(rename = "succinct.bindings")]
    pub device_bindings: Option<DeviceBindings>,
    #[serde(rename = "succinct.proof")]
    pub proof: Option<Proof>,
    #[serde(rename = "c2pa.hash.data")]
    pub data_hash: DataHash,
}

#[derive(Debug, Clone, Serialize, Deserialize, uniffi::Record)]
pub struct DeviceBindings {
    pub app_id: String,
    pub device_key_id: String,
    pub challenge: String,
    pub attestation: String,
    pub assertion: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, uniffi::Record)]
pub struct Proof {
    pub data: String,
    pub vk_hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, uniffi::Record)]
pub struct DataHash {
    pub name: String,
    pub alg: String,
    pub hash: String,
    #[serde(default)]
    pub exclusions: Vec<Exclusion>,
}

#[derive(Debug, Clone, Serialize, Deserialize, uniffi::Record)]
pub struct Exclusion {
    start: u32,
    length: u32,
}
