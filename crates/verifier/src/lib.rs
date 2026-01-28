mod bindings;
pub use bindings::verify_bindings_from_manifest;

pub mod error;
pub mod ios;

uniffi::setup_scaffolding!();
