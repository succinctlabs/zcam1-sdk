use security_framework::{
    item::{ItemClass, ItemSearchOptions, Reference, SearchResult},
    key::Algorithm,
};
use std::error::Error;

pub fn sign_with_enclave(application_label: &[u8], data: &[u8]) -> Result<Vec<u8>, Box<dyn Error>> {
    let mut search_options = ItemSearchOptions::new();

    search_options
        .class(ItemClass::key())
        .application_label(application_label)
        .load_refs(true) // We want metadata, not the key ref
        .limit(1);

    let items = search_options.search()?;

    let key = match items.first() {
        Some(SearchResult::Ref(Reference::Key(k))) => k,
        _ => return Err("Key not found in Secure Enclave".into()),
    };

    let signature = key.create_signature(Algorithm::ECDSASignatureMessageX962SHA256, data)?;

    Ok(signature)
}
