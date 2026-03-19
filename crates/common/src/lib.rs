mod constants;
pub use constants::{APPLE_ROOT_CERT, GOOGLE_HARDWARE_ROOT_EC, GOOGLE_HARDWARE_ROOT_RSA};

mod io;
pub use io::AuthInputs;

mod verifier;
pub use verifier::{Verifier, VerifierError};

uniffi::setup_scaffolding!();
