# Technical overview

## Bootstrap flow

* A content key is generated in the Secure Enclave. This key is used to build the certificate chain that is used to sign C2PA claims.
* An App Attest device key is generated. This key is used to generate the App Attest attestation and assertions.
* The App Attest attestation is generated.
* The device is registered to the backend, including the App Attest attestation verification

## Capture flow

1. The photo is captured
2. A hash is computed from the photo bytes
3. An App Attest assertion is generated
    * The App Attest assertion contains a signature of a message: for the ZCAM1 usage, the message is the photo hash in order to prevent an attacker to reuse assertions from other photos
4. A C2PA manifest is constructed, including:
    * Photo metadata
    * The App Attest attestation generated at bootstrap
    * The App Attest assertion generated a step 3
    * Device metadata
5. The C2PA manifest claim is signed with the content key generated ay bootstrap and embedded into the file

## Proof generation flow

1. The C2PA manifest generated a capture is extracted from the photo
2. The proof inputs are extracted from the C2PA manifest:
    * App Attest attestation generated at bootstrap
    * App Attest assertion generated a step 3
    * Device metadata
3. The inputs are set to the backend where the proof is generated
4. Once generated, the proof is downloaded to the device
5. A new C2PA manifest is constructed, including the proof
6. The C2PA manifest claim is signed with the content key generated ay bootstrap and embedded into the file

### SP1 program breakdown

#### Proof inputs

* App Attest attestation
* App Attest assertion
* Device key ID
* Photo hash
* Challenge used to generate the App Attest attestation
* App ID
* App Attest environment (dev or prod)

### Execution

1. Validate the App Attest attestation against the Challenge
    * Follows these steps described at the [Verify the attestation] section on the Apple App Attest documentation
    * Outputs the device key public key generated at bootstrap
2. Validate the App Attest assertion against the photo hash
    * Follows these steps described at the [Verify the assertion] section on the Apple App Attest documentation
    * Among other checks, we verify the signature embedded in the App Attest assertion using the public key from step 1, validating the App Attest assertion is bound to a genuine untampered device.


[Verify the attestation]: https://developer.apple.com/documentation/devicecheck/validating-apps-that-connect-to-your-server#Verify-the-attestation
[Verify the assertion]: https://developer.apple.com/documentation/devicecheck/validating-apps-that-connect-to-your-server#Verify-the-assertion

## Verification flow

1. The C2PA manifest containing the SP1 proof is extracted from the photo
2. The photo hash contained inside the C2PA manifest is verified against the actuall photo bytes hash
3. The SP1 proof is verified using the SP1 verifier APIs
