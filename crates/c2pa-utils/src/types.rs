use std::{
    collections::HashMap,
    io::{Read, Seek},
    sync::Arc,
};

use c2pa::{assertions::DataHash, HashRange};
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

    /// Returns the action with the given label as a JSON string.
    pub fn action(&self, label: String) -> Option<String> {
        self.assertion_store
            .actions
            .get(&label)
            .map(|v| v.to_string())
    }
}

impl Manifest {
    pub fn compute_hash_from_stream<R>(&self, stream: &mut R) -> Result<Vec<u8>, C2paError>
    where
        R: Read + Seek + ?Sized,
    {
        let hash = match &self.assertion_store.hash {
            Some(data_hash) => data_hash.hash_from_stream(stream)?,
            None => {
                // Remove the entire C2PA manifest store from asset
                todo!()
            }
        };

        Ok(hash)
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
    #[serde(alias = "c2pa.hash.data")]
    pub hash: Option<Arc<DataHash>>,
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
pub struct PhotoMetadataInfo {
    device_make: String,
    device_model: String,
    software_version: String,
    x_resolution: u32,
    y_resolution: u32,
    orientation: String,
    iso: Vec<String>,
    exposure_time: u32,
    depth_of_field: u32,
    focal_length: u32,
    depth_data: Option<DepthData>,
}

#[derive(Debug, Clone, Serialize, Deserialize, uniffi::Record)]
pub struct DepthData {
    width: u32,
    height: u32,
    pixel_format: String,
    statistics: DepthDataStatistics,
    accuracy: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, uniffi::Record)]
pub struct DepthDataStatistics {
    min: u32,
    max: u32,
    mean: u32,
    std_dev: u32,
    valid_pixel_count: u32,
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
    Bmff(String),
}

impl AssetHash {
    /// Returns the asset hash as a base64 string.
    pub fn value(&self) -> String {
        match self {
            AssetHash::Data(data_hash) => String::from_utf8(data_hash.hash.clone()).unwrap(),
            AssetHash::Bmff(bmff_hash) => bmff_hash.clone(),
        }
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
    fn test_deser_data_hash() {
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

        assert!(store.hash.is_some())
    }
}
