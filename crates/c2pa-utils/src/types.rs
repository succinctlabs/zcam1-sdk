use std::{
    collections::HashMap,
    io::{Read, Seek},
    sync::Arc,
};

use c2pa::{
    assertions::{BmffHash, DataHash},
    HashRange,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::error::C2paError;

#[derive(Debug, Clone, Serialize, Deserialize, uniffi::Object)]
pub struct ManifestStore {
    pub active_manifest: String,
    pub manifests: HashMap<String, Manifest>,
}

#[uniffi::export]
impl ManifestStore {
    pub fn active_manifest(&self) -> Result<Manifest, C2paError> {
        self.manifests
            .get(&self.active_manifest)
            .cloned()
            .ok_or_else(|| C2paError::NoActiveManifest)
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

    #[uniffi::method(name = "hash")]
    pub fn hash_string(&self) -> Option<String> {
        self.assertion_store.hash.value()
    }
}

impl Manifest {
    pub fn action(&self, label: &str) -> Option<&Value> {
        self.assertion_store.actions.get(label)
    }

    pub fn hash(&self) -> &AssetHash {
        &self.assertion_store.hash
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
    #[serde(alias = "c2pa.hash.bmff.v3", alias = "c2pa.hash.data")]
    pub hash: AssetHash,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum AssetHash {
    Data(Arc<DataHash>),
    Bmff(Arc<BmffHash>),
}

impl AssetHash {
    /// Returns the asset hash as a base64 string.
    pub fn value(&self) -> Option<String> {
        match self {
            AssetHash::Data(data_hash) => Some(String::from_utf8(data_hash.hash.clone()).unwrap()),
            AssetHash::Bmff(bmff_hash) => bmff_hash
                .hash()
                .map(|h| String::from_utf8(h.clone()).unwrap()),
        }
    }

    pub fn compute_hash_from_stream<R>(&self, stream: &mut R) -> Result<Vec<u8>, C2paError>
    where
        R: Read + Seek + ?Sized,
    {
        let hash = match self {
            AssetHash::Data(data_hash) => data_hash.hash_from_stream(stream)?,
            AssetHash::Bmff(bmff_hash) => bmff_hash.hash_from_stream(stream)?,
        };

        Ok(hash)
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

#[cfg(test)]
mod tests {
    use serde_json::json;

    use crate::types::AssertionStore;

    #[test]
    fn test_deser_hash() {
        let json = json!({
            "c2pa.actions.v2": {
                "actions": []
            },
            "c2pa.hash.bmff.v3": {
                "exclusions": [
                    {
                    "xpath": "/uuid",
                    "length": null,
                    "data": [
                        {
                        "offset": 8,
                        "value": "2P7D1hsOSDySl1goh37EgQ=="
                        }
                    ],
                    "subset": null,
                    "version": null,
                    "flags": null,
                    "exact": null
                    },
                    {
                    "xpath": "/ftyp",
                    "length": null,
                    "data": null,
                    "subset": null,
                    "version": null,
                    "flags": null,
                    "exact": null
                    },
                    {
                    "xpath": "/mfra",
                    "length": null,
                    "data": null,
                    "subset": null,
                    "version": null,
                    "flags": null,
                    "exact": null
                    }
                ],
                "alg": "sha256",
                "hash": "VNtDCaAx/XHJUJdTmRaPZfNScgKhXSVwlK0yILwWJkE=",
                "name": "jumbf manifest"
            }
        });

        let store = serde_json::from_value::<AssertionStore>(json).unwrap();

        assert_eq!(
            store.hash.value().unwrap(),
            String::from("VNtDCaAx/XHJUJdTmRaPZfNScgKhXSVwlK0yILwWJkE=")
        )
    }
}
