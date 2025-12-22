use std::collections::HashMap;

use c2pa::HashRange;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::error::Error;

// `Reader::json()` and `Reader::detailed_json()` returns 2 differents things:
//
// The manifests from the `manifests` map returned by `Reader::json()` can be
// deserialized to `ManifestDefinition` and thus can be used in
// `Builder::from_json`.
// The drawback of `Reader::json()` is the the data hash is not included.
//
// The data hash is included when using `Reader::detailed_json()`, but
// the manifests can't be deserialized to `ManifestDefinition`.
pub type RawManifestStore = ManifestStore<Value>;

#[derive(Debug, Clone, Serialize, Deserialize, uniffi::Object)]
pub struct ManifestStore<T = Manifest> {
    pub active_manifest: String,
    pub manifests: HashMap<String, T>,
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

impl RawManifestStore {
    pub fn raw_active_manifest(&self) -> Result<Value, Error> {
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

impl Manifest {
    pub fn action(&self, label: &str) -> Option<&Value> {
        self.assertion_store.actions.get(label)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, uniffi::Record)]
pub struct Claim {
    pub signature: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssertionStore {
    #[serde(rename = "succinct.bindings")]
    pub device_bindings: Option<DeviceBindings>,
    #[serde(rename = "succinct.proof")]
    pub proof: Option<Proof>,
    #[serde(rename = "c2pa.actions.v2")]
    pub actions: Actions,
    #[serde(rename = "c2pa.hash.data")]
    pub data_hash: DataHash,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Actions {
    actions: Vec<Value>,
}

impl Actions {
    pub fn get(&self, label: &str) -> Option<&Value> {
        self.actions.iter().find(|a| {
            a.as_object()
                .and_then(|obj| obj.get("action"))
                .and_then(|l| l.as_str())
                .map(|l| l == label)
                .unwrap_or_default()
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, uniffi::Record)]
pub struct DeviceBindings {
    pub app_id: String,
    pub device_key_id: String,
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

impl DataHash {
    pub fn as_hash_ranges(&self) -> Vec<HashRange> {
        self.exclusions.iter().map(Into::into).collect()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, uniffi::Record)]
pub struct Exclusion {
    pub start: u64,
    pub length: u64,
}

impl From<&Exclusion> for HashRange {
    fn from(value: &Exclusion) -> Self {
        Self::new(value.start, value.length)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, uniffi::Enum)]
pub enum AuthenticityStatus {
    Unknown,
    NoManifest,
    InvalidManifest,
    Bindings,
    Proof,
}
