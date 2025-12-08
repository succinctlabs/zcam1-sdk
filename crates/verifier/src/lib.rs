use zcam1_c2pa_utils::types::DataHash;

use crate::error::Error;

pub mod error;
pub mod ios;

pub fn verify_hash(path: &str, data_hash: &DataHash) -> Result<bool, Error> {
    let is_valid = zcam1_c2pa_utils::verify_hash(path, data_hash)?;

    Ok(is_valid)
}
