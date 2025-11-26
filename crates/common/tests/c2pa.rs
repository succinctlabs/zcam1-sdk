use c2pa::{
    crypto::cose::{CertificateTrustPolicy, check_end_entity_certificate_profile},
    status_tracker::StatusTracker,
};
use x509_parser::{
    pem::Pem,
    prelude::{BasicExtension, FromDer, ParsedExtension, X509Certificate},
};

const DEVICE_KEY_ID: &str = "3EUaLHJnzUZkLWaRgzv2JHGpsduSqmG1Colm/VQsJPc=";

const APP_ID: &str = "NLS5R4YCGX.com.anonymous.zcam1poc";

const ATTESTATION: &str = "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";

const ASSERTION: &str = "omlzaWduYXR1cmVYRjBEAiBeAesswnNnRVkufK9+gXqi2yrnKq/DeuLjEr+SAsKWrAIgaOWOxGv1+Ljmese+oVYgZhN2sV2IpHaK8zmqHZJei1JxYXV0aGVudGljYXRvckRhdGFYJQuHzQOLi5nuiKIkVTA0ikS1OWf+kj5Q5yGhnfEA7rhtQAAAAAE=";

const APP_ATTEST_PEM: &str = r"-----BEGIN CERTIFICATE-----
MIIDvzCCA0SgAwIBAgIGAZpYe/TbMAoGCCqGSM49BAMCME8xIzAhBgNVBAMMGkFw
cGxlIEFwcCBBdHRlc3RhdGlvbiBDQSAxMRMwEQYDVQQKDApBcHBsZSBJbmMuMRMw
EQYDVQQIDApDYWxpZm9ybmlhMB4XDTI1MTEwNTA5MjUwOVoXDTI1MTEwODA5MjUw
OVowgZExSTBHBgNVBAMMQGUwYzNhNWRjM2I1ZmNmODFhMjdlMzgxY2UzYjNjNjRl
MTk0OTNhMTYzYWNmNmE1NTU1OTFkZWIyMDk2MDYzODIxGjAYBgNVBAsMEUFBQSBD
ZXJ0aWZpY2F0aW9uMRMwEQYDVQQKDApBcHBsZSBJbmMuMRMwEQYDVQQIDApDYWxp
Zm9ybmlhMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEacLr8NW9qWbC0jUC/tlA
OFOCR7IYkUSU+KmflUX0Y1ZOXDwb5p2J/+IUlsuiYh4KOc+U9vCQ+hMf7DDMzCL0
nKOCAccwggHDMAwGA1UdEwEB/wQCMAAwDgYDVR0PAQH/BAQDAgTwMIGTBgkqhkiG
92NkCAUEgYUwgYKkAwIBCr+JMAMCAQG/iTEDAgEAv4kyAwIBAb+JMwMCAQG/iTQj
BCFOTFM1UjRZQ0dYLmNvbS5hbm9ueW1vdXMuemNhbTFwb2OlBgQEc2tzIL+JNgMC
AQW/iTcDAgEAv4k5AwIBAL+JOgMCAQC/iTsDAgEAqgMCAQC/iTwGAgRza3MgMIHX
BgkqhkiG92NkCAcEgckwgca/ingIBAYyNi4wLjG/iFADAgECv4p5CQQHMS4wLjE5
OL+KewgEBjIzQTM1Nb+KfAgEBjI2LjAuMb+KfQgEBjI2LjAuMb+KfgMCAQC/in8D
AgEAv4sAAwIBAL+LAQMCAQC/iwIDAgEAv4sDAwIBAL+LBAMCAQG/iwUDAgEAv4sK
EAQOMjMuMS4zNTUuMC4wLDC/iwsQBA4yMy4xLjM1NS4wLjAsML+LDBAEDjIzLjEu
MzU1LjAuMCwwv4gCCgQIaXBob25lb3MwMwYJKoZIhvdjZAgCBCYwJKEiBCAXm1T/
7JxqHH9QaWY1urpIpHnydwytKMChhiyi9gXR3zAKBggqhkjOPQQDAgNpADBmAjEA
n4wQJXmVS7XnDX/GCpcTwTPk5p+Hu4/jAKlJcz0guG8px4o5CsDw/d8J/Hytk6eV
AjEAhUHheF9L75DaAYvpo1ZYTomI+VblLx6OHAAGDT1+4RUDOMBeYokiNWuTEu92
of1v
-----END CERTIFICATE-----
-----BEGIN CERTIFICATE-----
MIICQzCCAcigAwIBAgIQCbrF4bxAGtnUU5W8OBoIVDAKBggqhkjOPQQDAzBSMSYw
JAYDVQQDDB1BcHBsZSBBcHAgQXR0ZXN0YXRpb24gUm9vdCBDQTETMBEGA1UECgwK
QXBwbGUgSW5jLjETMBEGA1UECAwKQ2FsaWZvcm5pYTAeFw0yMDAzMTgxODM5NTVa
Fw0zMDAzMTMwMDAwMDBaME8xIzAhBgNVBAMMGkFwcGxlIEFwcCBBdHRlc3RhdGlv
biBDQSAxMRMwEQYDVQQKDApBcHBsZSBJbmMuMRMwEQYDVQQIDApDYWxpZm9ybmlh
MHYwEAYHKoZIzj0CAQYFK4EEACIDYgAErls3oHdNebI1j0Dn0fImJvHCX+8XgC3q
s4JqWYdP+NKtFSV4mqJmBBkSSLY8uWcGnpjTY71eNw+/oI4ynoBzqYXndG6jWaL2
bynbMq9FXiEWWNVnr54mfrJhTcIaZs6Zo2YwZDASBgNVHRMBAf8ECDAGAQH/AgEA
MB8GA1UdIwQYMBaAFKyREFMzvb5oQf+nDKnl+url5YqhMB0GA1UdDgQWBBQ+410c
BBmpybQx+IR01uHhV3LjmzAOBgNVHQ8BAf8EBAMCAQYwCgYIKoZIzj0EAwMDaQAw
ZgIxALu+iI1zjQUCz7z9Zm0JV1A1vNaHLD+EMEkmKe3R+RToeZkcmui1rvjTqFQz
97YNBgIxAKs47dDMge0ApFLDukT5k2NlU/7MKX8utN+fXr5aSsq2mVxLgg35BDhv
eAe7WJQ5tw==
-----END CERTIFICATE-----";

const PEM: &str = r"-----BEGIN CERTIFICATE-----
MIIBkzCCATqgAwIBAgIQMsFhdbBFi0McUICfhTd1OTAKBggqhkjOPQQDAjAPMQ0w
CwYDVQQDDARURVNUMB4XDTI1MTEwNzA5MzgyMVoXDTI2MTEwNzA5MzgyMVowDzEN
MAsGA1UEAwwEVEVTVDBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IABKbUjUrkcwsq
1AyzXntVlUkctw4I0JyRl0Clm5OJRsuWuGKIpNjv1dmRH/VdcGwNMBZJahaDCvba
XgcjlEHoH4ujeDB2MA8GA1UdEwEB/wQFMAMBAQAwDgYDVR0PAQH/BAQDAgbAMBMG
A1UdJQQMMAoGCCsGAQUFBwMIMB0GA1UdDgQWBBTyl3rFvR9VkDi7wAiwIiheyhbK
yjAfBgNVHSMEGDAWgBTyl3rFvR9VkDi7wAiwIiheyhbKyjAKBggqhkjOPQQDAgNH
ADBEAiA5/+/C6HxLKfer6xgss6TmAW26uUBTCnzRi3LNtbV0ugIgX1UJYTBhE6w4
bjWnrClipsjUIzIBaMfClbdFolU1t+o=
-----END CERTIFICATE-----";

#[test]
fn test_check() {
    let mut validation_log = StatusTracker::default();
    let der = x509_der_from_pem(PEM.as_bytes());
    let ctp = CertificateTrustPolicy::default();

    let _ = check_end_entity_certificate_profile(&der, &ctp, &mut validation_log, None);

    println!("{validation_log:#?}")
}

#[test]
fn test_extensions() {
    let ctp = CertificateTrustPolicy::default();
    let der = x509_der_from_pem(PEM.as_bytes());
    let (_, sign_cert) = X509Certificate::from_der(&der).unwrap();
    let tbs_cert = &sign_cert.tbs_certificate;

    let mut aki_good = false;
    let mut ski_good = false;
    let mut key_usage_good = false;
    let mut handled_all_critical = true;
    let mut extended_key_usage_good = true;

    if let Some(BasicExtension { value: eku, .. }) = tbs_cert.extended_key_usage().unwrap() {
        if eku.any {
            println!("certificate 'any' EKU not allowed");
            extended_key_usage_good = false;
        }

        //if ctp.has_allowed_eku(eku).is_none() {
        //    println!("certificate missing required EKU");
        //    extended_key_usage_good = false;
        //}

        // one or the other || either of these two, and no others field
        if (eku.ocsp_signing && eku.time_stamping)
            || ((eku.ocsp_signing ^ eku.time_stamping)
                && (eku.client_auth
                    | eku.code_signing
                    | eku.email_protection
                    | eku.server_auth
                    | !eku.other.is_empty()))
        {
            println!("certificate invalid set of EKUs");
            extended_key_usage_good = false;
        }
    } else {
        println!("No extended key usage");
        extended_key_usage_good = false;
    }

    // Populate needed extension info.
    for e in sign_cert.extensions() {
        println!("Extension: {:#?}", e.parsed_extension());
        match e.parsed_extension() {
            ParsedExtension::AuthorityKeyIdentifier(_aki) => {
                aki_good = true;
            }
            ParsedExtension::SubjectKeyIdentifier(_spki) => {
                ski_good = true;
            }
            ParsedExtension::KeyUsage(ku) => {
                if ku.digital_signature() {
                    if ku.key_cert_sign() && !tbs_cert.is_ca() {
                        println!("certificate missing digitalSignature EKU");
                    }
                    key_usage_good = true;
                }
                if ku.key_cert_sign() || ku.non_repudiation() {
                    key_usage_good = true;
                }

                // TO DO: warn if not marked critical.
                // if !e.critical { // warn here somehow}
            }

            ParsedExtension::CertificatePolicies(_) => (),
            ParsedExtension::PolicyMappings(_) => (),
            ParsedExtension::SubjectAlternativeName(_) => (),
            ParsedExtension::BasicConstraints(_) => (),
            ParsedExtension::NameConstraints(_) => (),
            ParsedExtension::PolicyConstraints(_) => (),
            ParsedExtension::ExtendedKeyUsage(_) => (),
            ParsedExtension::CRLDistributionPoints(_) => (),
            ParsedExtension::InhibitAnyPolicy(_) => (),
            ParsedExtension::AuthorityInfoAccess(_) => (),
            ParsedExtension::NSCertType(_) => (),
            ParsedExtension::CRLNumber(_) => (),
            ParsedExtension::ReasonCode(_) => (),
            ParsedExtension::InvalidityDate(_) => (),
            ParsedExtension::Unparsed => {
                if e.critical {
                    // Unhandled critical extension.
                    handled_all_critical = false;
                }
            }
            _ => {
                if e.critical {
                    //println!("Oid: {}", e.oid.to_id_string());
                    // Unhandled critical extension.
                    handled_all_critical = false;
                }
            }
        }
    }

    ski_good = if tbs_cert.is_ca() { ski_good } else { true };

    println!("aki_good: {aki_good}");
    println!("ski_good: {ski_good}");
    println!("key_usage_good: {key_usage_good}");
    println!("handled_all_critical: {handled_all_critical}");
    println!("extended_key_usage_good: {extended_key_usage_good}");
}

fn x509_der_from_pem(cert_pem: &[u8]) -> Vec<u8> {
    let mut pems = Pem::iter_from_buffer(cert_pem);
    let pem = pems.next().unwrap().unwrap();
    pem.contents
}
