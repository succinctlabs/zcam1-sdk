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

    pub fn capture_metadata_action(&self) -> Result<Option<String>, C2paError> {
        let action = self.assertion_store.actions.get("succinct.capture");

        let metadata_action = action
            .map(|a| {
                let metadata_action = serde_json::from_value::<Action<MetadataInfo>>(a.clone())?;
                serde_json_canonicalizer::to_string(&metadata_action)
            })
            .transpose()?;

        Ok(metadata_action)
    }
}

impl Manifest {
    /// Returns the action with the given label as a JSON `Value`.
    pub fn action(&self, label: &str) -> Option<&Value> {
        self.assertion_store.actions.get(label)
    }

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

#[derive(Debug, Clone, Serialize, PartialEq, Eq, Deserialize)]
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

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Actions {
    actions: Vec<Value>,
}

impl Actions {
    pub fn get(&self, label: &str) -> Option<&Value> {
        self.actions.iter().find(|a| {
            a.as_object()
                .and_then(|obj| obj.get("action"))
                .and_then(|l| l.as_str())
                .is_some_and(|l| l == label)
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Action<P> {
    action: String,
    when: String,
    parameters: P,
}

impl Action<PhotoMetadataInfo> {
    pub fn photo_metadata(when: String, parameters: PhotoMetadataInfo) -> Self {
        Self {
            action: "succinct.capture".to_string(),
            when,
            parameters,
        }
    }
}

impl Action<VideoMetadataInfo> {
    pub fn video_metadata(when: String, parameters: VideoMetadataInfo) -> Self {
        Self {
            action: "succinct.capture".to_string(),
            when,
            parameters,
        }
    }
}

/// Film style (filter) information captured at the time of photo/video creation.
#[derive(Debug, Clone, Serialize, Deserialize, uniffi::Record)]
#[serde(rename_all = "camelCase")]
pub struct FilmStyleInfo {
    /// Name of the film style (e.g. "mellow", "bw", or a custom name).
    pub name: String,
    /// Whether this is a built-in preset, an overridden preset, or a custom style.
    /// One of "builtin", "override", or "custom".
    pub source: String,
    /// The recipe that was applied, serialized as a JSON array of effects.
    pub recipe: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, uniffi::Record)]
#[serde(rename_all = "camelCase")]
pub struct AuthenticityData {
    is_jail_broken: bool,
    is_location_spoofing_available: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    is_location_available: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    location_retrieval_status: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, uniffi::Record)]
#[serde(rename_all = "camelCase")]
pub struct PhotoMetadataInfo {
    device_make: String,
    device_model: String,
    software_version: String,
    x_resolution: u32,
    y_resolution: u32,
    orientation: u32,
    iso: String,
    exposure_time: u32,
    depth_of_field: u32,
    focal_length: u32,
    authenticity_data: AuthenticityData,
    #[serde(skip_serializing_if = "Option::is_none")]
    depth_data: Option<DepthData>,
    #[serde(skip_serializing_if = "Option::is_none")]
    film_style: Option<FilmStyleInfo>,
    #[serde(skip_serializing_if = "Option::is_none")]
    trusted_timestamp: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    location: Option<LocationInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize, uniffi::Record)]
#[serde(rename_all = "camelCase")]
pub struct VideoMetadataInfo {
    device_make: String,
    device_model: String,
    software_version: String,
    format: String,
    has_audio: bool,
    duration_seconds: u32,
    file_size_bytes: u32,
    width: u32,
    height: u32,
    rotation_degrees: u32,
    frame_rate: u32,
    video_codec: Option<String>,
    audio_codec: Option<String>,
    audio_sample_rate: Option<u32>,
    audio_channels: Option<u32>,
    authenticity_data: AuthenticityData,
    #[serde(skip_serializing_if = "Option::is_none")]
    film_style: Option<FilmStyleInfo>,
    #[serde(skip_serializing_if = "Option::is_none")]
    // The trusted capture timestamp in milliseconds.
    trusted_timestamp: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    location: Option<LocationInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum MetadataInfo {
    Photo(Box<PhotoMetadataInfo>),
    Video(Box<VideoMetadataInfo>),
}

#[derive(Debug, Clone, Serialize, Deserialize, uniffi::Record)]
#[serde(rename_all = "camelCase")]
pub struct DepthData {
    width: u32,
    height: u32,
    pixel_format: String,
    statistics: DepthDataStatistics,
    accuracy: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, uniffi::Record)]
#[serde(rename_all = "camelCase")]
pub struct DepthDataStatistics {
    pub min: String,
    pub max: String,
    pub mean: String,
    pub std_dev: String,
    pub valid_pixel_count: u32,
    pub sample_stride: u32,
}
/// GPS location captured at the time of photo/video creation.
///
/// Coordinates and accuracy are stored as strings to preserve the original
/// precision from the device without floating-point rounding.
#[derive(Debug, Clone, Serialize, Deserialize, uniffi::Record)]
#[serde(rename_all = "camelCase")]
pub struct LocationInfo {
    /// Latitude in decimal degrees (e.g. "37.7749").
    pub latitude: String,
    /// Longitude in decimal degrees (e.g. "-122.4194").
    pub longitude: String,
    /// Altitude in meters above sea level, if available.
    pub altitude: Option<String>,
    /// Horizontal accuracy radius in meters.
    pub accuracy: String,
    /// Vertical accuracy in meters, if available.
    pub altitude_accuracy: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, uniffi::Record)]
pub struct DeviceBindings {
    pub app_id: String,
    pub device_key_id: String,
    pub attestation: String,
    pub assertion: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, uniffi::Record)]
pub struct Proof {
    pub data: String,
    pub vk_hash: String,
    pub platform: String,
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
