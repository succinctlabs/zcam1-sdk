import CommonCrypto
import CryptoKit
import Foundation
import Security

public enum CerificateServiceError: Error, LocalizedError {
    case keyNotFound(String)
    case keyNotSupported
    case signatureFailed(String)
    case invalidSubject
    case internalFailure(String)

    public var errorDescription: String? {
        switch self {
        case .keyNotFound(let tag):
            return "Secure Enclave private key with tag '\(tag)' was not found."
        case .keyNotSupported:
            return "The Secure Enclave key does not support ECDSA with SHA-256."
        case .signatureFailed(let reason):
            return "Failed to sign TBSCertificate: \(reason)"
        case .invalidSubject:
            return "At least a Common Name (CN) must be provided for the subject."
        case .internalFailure(let reason):
            return "Internal failure building certificate: \(reason)"
        }
    }
}

/// A minimal service to build a self-signed X.509 certificate for a P-256 Secure Enclave private key.
/// The generated certificate is version v1 (no extensions), using ecdsa-with-SHA256, and encodes a basic subject/issuer name.
/// The result is returned as a PEM-encoded "CERTIFICATE".
@objc public final class CerificateService: NSObject {

    // MARK: - Public API

    /// Creates a self-signed X.509 certificate in PEM using a Secure Enclave private key referenced by `keyTag`.
    ///
    /// Notes:
    /// - The certificate is X.509 v1 (no extensions).
    /// - Signature algorithm is ecdsa-with-SHA256.
    /// - Subject and Issuer are identical (self-signed).
    /// - SubjectPublicKeyInfo uses id-ecPublicKey with prime256v1 parameters.
    ///
    /// - Parameters:
    ///   - keyTag: The keychain application tag for the Secure Enclave private key (P-256).
    ///   - commonName: Subject Common Name (CN) - required.
    ///   - organization: Optional Organization (O).
    ///   - organizationalUnit: Optional Organizational Unit (OU).
    ///   - country: Optional Country (C). Typically a 2-letter code if present.
    ///   - locality: Optional Locality (L).
    ///   - stateOrProvince: Optional State or Province (ST).
    ///   - validFrom: NotBefore date. Defaults to now minus 5 minutes to accommodate clock skew.
    ///   - validDays: The number of days after `validFrom` for NotAfter. Defaults to 365.
    /// - Returns: PEM-encoded certificate string.
    public static func createSelfSignedCertificatePEM(
        keyTag: String,
        commonName: String,
        organization: String? = nil,
        organizationalUnit: String? = nil,
        country: String? = nil,
        locality: String? = nil,
        stateOrProvince: String? = nil,
        validFrom: Date = Date().addingTimeInterval(-300),  // -5 minutes
        validDays: Int = 365
    ) throws -> String {
        guard !commonName.isEmpty else { throw CerificateServiceError.invalidSubject }

        // 1) Locate Secure Enclave private key
        let privateKey = try loadSecureEnclavePrivateKey(tag: keyTag)

        // 2) Extract public key (ANSI X9.63 uncompressed format expected from SecKeyCopyExternalRepresentation)
        guard let publicKey = SecKeyCopyPublicKey(privateKey) else {
            throw CerificateServiceError.internalFailure(
                "Failed to copy public key from private key.")
        }
        var error: Unmanaged<CFError>?
        guard let pubData = SecKeyCopyExternalRepresentation(publicKey, &error) as Data? else {
            if let err = error?.takeRetainedValue() {
                throw CerificateServiceError.internalFailure("Public key export failed: \(err)")
            }
            throw CerificateServiceError.internalFailure("Public key export failed.")
        }

        // 3) Build TBSCertificate (DER)
        let issuerAndSubject = NameBuilder()
            .add(.commonName, commonName)
            .addIfPresent(.organization, organization)
            .addIfPresent(.organizationalUnit, organizationalUnit)
            .addIfPresent(.country, country)
            .addIfPresent(.locality, locality)
            .addIfPresent(.stateOrProvince, stateOrProvince)
            .build()

        let serial = randomSerialNumber(length: 16)
        let notBefore = validFrom
        let notAfter =
            Calendar.current.date(byAdding: .day, value: validDays, to: validFrom) ?? validFrom

        let tbs = try TBSCertificateBuilder.build(
            serialNumber: serial,
            issuer: issuerAndSubject,
            subject: issuerAndSubject,
            notBefore: notBefore,
            notAfter: notAfter,
            publicKeyBytesX963: pubData,
            isCA: false,
            pathLenConstraint: nil,
            includeTimeStampingEKU: true,
            authorityKeyIdentifier: nil
        )

        // 4) Sign TBSCertificate with Secure Enclave private key using ECDSA-SHA256
        let signAlg = SecKeyAlgorithm.ecdsaSignatureMessageX962SHA256
        guard SecKeyIsAlgorithmSupported(privateKey, .sign, signAlg) else {
            throw CerificateServiceError.keyNotSupported
        }

        var sigError: Unmanaged<CFError>?
        guard
            let sig = SecKeyCreateSignature(privateKey, signAlg, tbs as CFData, &sigError) as Data?
        else {
            if let err = sigError?.takeRetainedValue() {
                throw CerificateServiceError.signatureFailed("\(err)")
            }
            throw CerificateServiceError.signatureFailed("Unknown error.")
        }

        // 5) Assemble final Certificate = SEQUENCE { tbsCertificate, signatureAlgorithm, signatureValue }
        let sigAlgId = AlgorithmIdentifier.ecdsaWithSHA256.der
        let certificateDER = ASN1.sequence([
            tbs,
            sigAlgId,
            ASN1.bitString(sig),  // DER-encoded ECDSA-Sig-Value inside BIT STRING
        ])

        // 6) Convert to PEM
        return pemWrap(type: "CERTIFICATE", der: certificateDER)
    }

    /// Creates a certificate chain (end-entity + intermediate + root) in PEM for a Secure Enclave P-256 key.
    /// The end-entity certificate uses the Secure Enclave public key and is issued by an in-memory Intermediate CA,
    /// which in turn is issued by an in-memory Root CA.
    public static func createCertificateChainPEM(
        keyTag: String,
        commonName: String,
        organization: String,
        organizationalUnit: String? = nil,
        country: String? = nil,
        locality: String? = nil,
        stateOrProvince: String? = nil,
        validDays: Int = 365
    ) throws -> String {
        // Load Secure Enclave private key and extract its public key (ANSI X9.63)
        let sePrivateKey = try loadSecureEnclavePrivateKey(tag: keyTag)
        guard let sePublicKey = SecKeyCopyPublicKey(sePrivateKey) else {
            throw CerificateServiceError.internalFailure(
                "Failed to copy public key from private key.")
        }
        var err: Unmanaged<CFError>?
        guard let eePubData = SecKeyCopyExternalRepresentation(sePublicKey, &err) as Data? else {
            if let e = err?.takeRetainedValue() {
                throw CerificateServiceError.internalFailure("Public key export failed: \(e)")
            }
            throw CerificateServiceError.internalFailure("Public key export failed.")
        }

        // Generate in-memory Root and Intermediate P-256 keys using CryptoKit (non-enclave, ephemeral)
        let rootPrivateKey = P256.Signing.PrivateKey()
        let intermediatePrivateKey = P256.Signing.PrivateKey()

        // Subjects
        let rootCN = "\(organization) Root CA"
        let intermediateCN = "\(organization) Intermediate CA"

        let rootSubject = NameBuilder()
            .add(.commonName, rootCN)
            .add(.organization, organization)
            .addIfPresent(.organizationalUnit, organizationalUnit)
            .addIfPresent(.country, country)
            .addIfPresent(.locality, locality)
            .addIfPresent(.stateOrProvince, stateOrProvince)
            .build()

        let intermediateSubject = NameBuilder()
            .add(.commonName, intermediateCN)
            .add(.organization, organization)
            .addIfPresent(.organizationalUnit, organizationalUnit)
            .addIfPresent(.country, country)
            .addIfPresent(.locality, locality)
            .addIfPresent(.stateOrProvince, stateOrProvince)
            .build()

        let endEntitySubject = NameBuilder()
            .add(.commonName, commonName)
            .add(.organization, organization)
            .addIfPresent(.organizationalUnit, organizationalUnit)
            .addIfPresent(.country, country)
            .addIfPresent(.locality, locality)
            .addIfPresent(.stateOrProvince, stateOrProvince)
            .build()

        let validFrom = Date().addingTimeInterval(-300)
        let rootNotAfter =
            Calendar.current.date(byAdding: .day, value: validDays * 10, to: validFrom) ?? validFrom
        let interNotAfter =
            Calendar.current.date(byAdding: .day, value: validDays * 5, to: validFrom) ?? validFrom
        let eeNotAfter =
            Calendar.current.date(byAdding: .day, value: validDays, to: validFrom) ?? validFrom

        // Root CA (self-signed)
        // Export Root public key (ANSI X9.63)
        let rootPubData = rootPrivateKey.publicKey.x963Representation
        let rootTBS = try TBSCertificateBuilder.build(
            serialNumber: randomSerialNumber(length: 16),
            issuer: rootSubject,
            subject: rootSubject,
            notBefore: validFrom,
            notAfter: rootNotAfter,
            publicKeyBytesX963: rootPubData,
            isCA: true,
            pathLenConstraint: 1,
            includeTimeStampingEKU: false,
            authorityKeyIdentifier: nil
        )
        let rootSignatureDER: Data
        do {
            rootSignatureDER = try rootPrivateKey.signature(for: rootTBS).derRepresentation
        } catch {
            throw CerificateServiceError.signatureFailed("Root: \(error)")
        }
        let rootCertDER = ASN1.sequence([
            rootTBS,
            AlgorithmIdentifier.ecdsaWithSHA256.der,
            ASN1.bitString(rootSignatureDER),
        ])
        let rootPEM = pemWrap(type: "CERTIFICATE", der: rootCertDER)
        // Compute SKI for Root to use as AKI for Intermediate
        let rootSKI: Data = {
            var digest = [UInt8](repeating: 0, count: Int(CC_SHA1_DIGEST_LENGTH))
            rootPubData.withUnsafeBytes { raw in
                _ = CC_SHA1(raw.baseAddress, CC_LONG(rootPubData.count), &digest)
            }
            return Data(digest)
        }()

        // Intermediate CA (issued by Root)
        // Export Intermediate public key (ANSI X9.63)
        let intermediatePubData = intermediatePrivateKey.publicKey.x963Representation
        let intermediateTBS = try TBSCertificateBuilder.build(
            serialNumber: randomSerialNumber(length: 16),
            issuer: rootSubject,
            subject: intermediateSubject,
            notBefore: validFrom,
            notAfter: interNotAfter,
            publicKeyBytesX963: intermediatePubData,
            isCA: true,
            pathLenConstraint: 0,
            includeTimeStampingEKU: false,
            authorityKeyIdentifier: rootSKI
        )
        let intermediateSignatureDER: Data
        do {
            intermediateSignatureDER = try rootPrivateKey.signature(for: intermediateTBS)
                .derRepresentation
        } catch {
            throw CerificateServiceError.signatureFailed("Intermediate: \(error)")
        }
        let intermediateCertDER = ASN1.sequence([
            intermediateTBS,
            AlgorithmIdentifier.ecdsaWithSHA256.der,
            ASN1.bitString(intermediateSignatureDER),
        ])
        let intermediatePEM = pemWrap(type: "CERTIFICATE", der: intermediateCertDER)
        // Compute SKI for Intermediate to use as AKI for End-Entity
        let intermediateSKI: Data = {
            var digest = [UInt8](repeating: 0, count: Int(CC_SHA1_DIGEST_LENGTH))
            intermediatePubData.withUnsafeBytes { raw in
                _ = CC_SHA1(raw.baseAddress, CC_LONG(intermediatePubData.count), &digest)
            }
            return Data(digest)
        }()

        // End-entity (issued by Intermediate, public key from Secure Enclave)
        let endEntityTBS = try TBSCertificateBuilder.build(
            serialNumber: randomSerialNumber(length: 16),
            issuer: intermediateSubject,
            subject: endEntitySubject,
            notBefore: validFrom,
            notAfter: eeNotAfter,
            publicKeyBytesX963: eePubData,
            isCA: false,
            pathLenConstraint: nil,
            includeTimeStampingEKU: true,
            authorityKeyIdentifier: intermediateSKI
        )
        let endEntitySignatureDER: Data
        do {
            endEntitySignatureDER = try intermediatePrivateKey.signature(for: endEntityTBS)
                .derRepresentation
        } catch {
            throw CerificateServiceError.signatureFailed("End-entity: \(error)")
        }
        let endEntityCertDER = ASN1.sequence([
            endEntityTBS,
            AlgorithmIdentifier.ecdsaWithSHA256.der,
            ASN1.bitString(endEntitySignatureDER),
        ])
        let endEntityPEM = pemWrap(type: "CERTIFICATE", der: endEntityCertDER)

        // Return concatenated chain: end-entity, intermediate, root
        return endEntityPEM + "\n" + intermediatePEM + "\n" + rootPEM
    }

    // MARK: - Objective-C Bridging

    /// Objective-C friendly wrapper that returns NSError** on failure.
    @objc public static func createSelfSignedCertificatePEMForKeyTag(
        _ keyTag: String,
        commonName: String,
        organization: String? = nil,
        organizationalUnit: String? = nil,
        country: String? = nil,
        locality: String? = nil,
        stateOrProvince: String? = nil,
        validDays: Int = 365,
        error: NSErrorPointer
    ) -> String? {
        do {
            return try createSelfSignedCertificatePEM(
                keyTag: keyTag,
                commonName: commonName,
                organization: organization,
                organizationalUnit: organizationalUnit,
                country: country,
                locality: locality,
                stateOrProvince: stateOrProvince,
                validDays: validDays
            )
        } catch let e as NSError {
            error?.pointee = e
            return nil
        } catch let err {
            error?.pointee = NSError(
                domain: "CerificateService", code: -1,
                userInfo: [
                    NSLocalizedDescriptionKey: "\(err)"
                ])
            return nil
        }
    }

    @objc public static func createCertificateChainPEMForKeyTag(
        _ keyTag: String,
        commonName: String,
        organization: String,
        organizationalUnit: String? = nil,
        country: String? = nil,
        locality: String? = nil,
        stateOrProvince: String? = nil,
        validDays: Int = 365,
        error: NSErrorPointer
    ) -> String? {
        do {
            return try createCertificateChainPEM(
                keyTag: keyTag,
                commonName: commonName,
                organization: organization,
                organizationalUnit: organizationalUnit,
                country: country,
                locality: locality,
                stateOrProvince: stateOrProvince,
                validDays: validDays
            )
        } catch let e as NSError {
            error?.pointee = e
            return nil
        } catch let err {
            error?.pointee = NSError(
                domain: "CerificateService", code: -1,
                userInfo: [
                    NSLocalizedDescriptionKey: "\(err)"
                ])
            return nil
        }
    }

    // MARK: - Keychain (Secure Enclave)

    private static func loadSecureEnclavePrivateKey(tag: String) throws -> SecKey {
        let query: [String: Any] = [
            kSecClass as String: kSecClassKey,
            kSecAttrApplicationTag as String: tag,
            kSecAttrKeyType as String: kSecAttrKeyTypeECSECPrimeRandom,
            kSecAttrTokenID as String: kSecAttrTokenIDSecureEnclave,
            kSecReturnRef as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess, let priv = (item as! SecKey?) else {
            throw CerificateServiceError.keyNotFound(tag)
        }
        return priv
    }

    // MARK: - Serial number

    private static func randomSerialNumber(length: Int) -> Data {
        var bytes = [UInt8](repeating: 0, count: max(1, length))
        _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        // Ensure positive INTEGER: if MSB set, prepend 0x00
        if bytes.first ?? 0 >= 0x80 {
            return Data([0x00] + bytes)
        }
        // Avoid all-zero serial
        if bytes.allSatisfy({ $0 == 0 }) { bytes[bytes.count - 1] = 1 }
        return Data(bytes)
    }

    // MARK: - PEM

    private static func pemWrap(type: String, der: Data) -> String {
        let b64 = der.base64EncodedString(options: [.lineLength64Characters, .endLineWithLineFeed])
        return "-----BEGIN \(type)-----\n\(b64)\n-----END \(type)-----"
    }
}

// MARK: - TBSCertificate builder (v1)

private enum TBSCertificateBuilder {
    // OIDs
    private static let oidECDSAWithSHA256 = "1.2.840.10045.4.3.2"
    private static let oidIdEcPublicKey = "1.2.840.10045.2.1"
    private static let oidPrime256v1 = "1.2.840.10045.3.1.7"
    private static let oidBasicConstraints = "2.5.29.19"
    private static let oidKeyUsage = "2.5.29.15"
    private static let oidExtendedKeyUsage = "2.5.29.37"
    private static let oidTimeStamping = "1.3.6.1.5.5.7.3.8"
    private static let oidSubjectKeyIdentifier = "2.5.29.14"
    private static let oidAuthorityKeyIdentifier = "2.5.29.35"

    static func build(
        serialNumber: Data,
        issuer: Data,
        subject: Data,
        notBefore: Date,
        notAfter: Date,
        publicKeyBytesX963: Data,
        isCA: Bool,
        pathLenConstraint: Int? = nil,
        includeTimeStampingEKU: Bool = true,
        authorityKeyIdentifier: Data? = nil
    ) throws -> Data {
        // signature AlgorithmIdentifier (ecdsa-with-SHA256, params absent)
        let signatureAlgId = ASN1.sequence([
            ASN1.objectIdentifier(from: oidECDSAWithSHA256)
            // parameters absent per RFC 5758 / X9.62 for ecdsa-with-SHA2
        ])

        // Validity ::= SEQUENCE { notBefore Time, notAfter Time }
        let validity = ASN1.sequence([
            ASN1.utcTime(notBefore),
            ASN1.utcTime(notAfter),
        ])

        // SubjectPublicKeyInfo ::= SEQUENCE { algorithm AlgorithmIdentifier, subjectPublicKey BIT STRING }
        // algorithm: id-ecPublicKey with parameters prime256v1
        let spkiAlgorithm = ASN1.sequence([
            ASN1.objectIdentifier(from: oidIdEcPublicKey),
            ASN1.objectIdentifier(from: oidPrime256v1),
        ])
        // BIT STRING contents: 0 unused bits + raw ANSI X9.63 bytes
        let subjectPublicKey = ASN1.bitString(publicKeyBytesX963)
        let spki = ASN1.sequence([spkiAlgorithm, subjectPublicKey])

        // TBSCertificate (v3) fields
        let version = ASN1.explicit(tag: 0, ASN1.integer(2))

        // Compute SKI: SHA-1 of the raw ANSI X9.63 public key bytes (exclude BIT STRING header)
        var sha1Digest = [UInt8](repeating: 0, count: Int(CC_SHA1_DIGEST_LENGTH))
        publicKeyBytesX963.withUnsafeBytes { raw in
            _ = CC_SHA1(raw.baseAddress, CC_LONG(publicKeyBytesX963.count), &sha1Digest)
        }
        let skiBytes = Data(sha1Digest)

        // SubjectKeyIdentifier
        let skiValue = ASN1.octetString(skiBytes)
        let skiExtension = ASN1.sequence([
            ASN1.objectIdentifier(from: oidSubjectKeyIdentifier),
            // non-critical by default
            ASN1.octetString(skiValue),
        ])

        // BasicConstraints
        let bcContent: Data = {
            if isCA {
                var parts: [Data] = [ASN1.boolean(true)]
                if let pathLen = pathLenConstraint {
                    parts.append(ASN1.integer(UInt64(pathLen)))
                }
                return ASN1.sequence(parts)
            } else {
                return ASN1.sequence([ASN1.boolean(false)])
            }
        }()
        let bcExtension = ASN1.sequence([
            ASN1.objectIdentifier(from: oidBasicConstraints),
            ASN1.boolean(true),  // critical
            ASN1.octetString(bcContent),
        ])

        // KeyUsage
        let kuExtension: Data = {
            if isCA {
                // keyCertSign (5) + cRLSign (6)
                let bits = Data([0x60])
                let kuBitString = ASN1.bitString(bits)  // unusedBits = 0
                return ASN1.sequence([
                    ASN1.objectIdentifier(from: oidKeyUsage),
                    ASN1.boolean(true),  // critical
                    ASN1.octetString(kuBitString),
                ])
            } else {
                // digitalSignature (0) + contentCommitment (1)
                let bits = Data([0xC0])
                let kuBitString = ASN1.bitString(bits, unusedBits: 6)
                return ASN1.sequence([
                    ASN1.objectIdentifier(from: oidKeyUsage),
                    ASN1.boolean(true),  // critical
                    ASN1.octetString(kuBitString),
                ])
            }
        }()

        // ExtendedKeyUsage (optional; included when requested)
        let ekuExtension: Data? = {
            if includeTimeStampingEKU {
                let ekuValue = ASN1.sequence([
                    ASN1.objectIdentifier(from: oidTimeStamping)
                ])
                return ASN1.sequence([
                    ASN1.objectIdentifier(from: oidExtendedKeyUsage),
                    // non-critical by default
                    ASN1.octetString(ekuValue),
                ])
            }
            return nil
        }()

        // AuthorityKeyIdentifier (use provided authorityKeyIdentifier or default to SKI for self-signed)
        let akiKeyId = authorityKeyIdentifier ?? skiBytes
        let akiInner = ASN1.sequence([
            // AuthorityKeyIdentifier ::= SEQUENCE { keyIdentifier [0] KeyIdentifier OPTIONAL, ... }
            ASN1.implicit(tag: 0, akiKeyId)
        ])
        let akiExtension = ASN1.sequence([
            ASN1.objectIdentifier(from: oidAuthorityKeyIdentifier),
            // non-critical by default
            ASN1.octetString(akiInner),
        ])

        var extParts: [Data] = [bcExtension, kuExtension, skiExtension, akiExtension]
        if let eku = ekuExtension {
            // Place EKU before SKI for readability; ordering is not critical
            extParts.insert(eku, at: 2)
        }

        let extensions = ASN1.explicit(
            tag: 3,
            ASN1.sequence(extParts))
        let tbs = ASN1.sequence([
            version,
            ASN1.integer(serialNumber),
            signatureAlgId,
            issuer,
            validity,
            subject,
            spki,
            extensions,
        ])

        return tbs
    }
}

// MARK: - AlgorithmIdentifier helpers

private enum AlgorithmIdentifier {
    // ecdsa-with-SHA256: 1.2.840.10045.4.3.2 (parameters absent)
    case ecdsaWithSHA256

    var der: Data {
        switch self {
        case .ecdsaWithSHA256:
            return ASN1.sequence([
                ASN1.objectIdentifier(from: "1.2.840.10045.4.3.2")
            ])
        }
    }
}

// MARK: - Name builder

private final class NameBuilder {
    enum Attr {
        case commonName
        case organization
        case organizationalUnit
        case country
        case locality
        case stateOrProvince

        var oid: String {
            switch self {
            case .commonName: return "2.5.4.3"
            case .organization: return "2.5.4.10"
            case .organizationalUnit: return "2.5.4.11"
            case .country: return "2.5.4.6"
            case .locality: return "2.5.4.7"
            case .stateOrProvince: return "2.5.4.8"
            }
        }

        /// For DN values, we use UTF8String for most attributes.
        /// For country, PrintableString is conventional; we use PrintableString if ASCII and length <= 2, else UTF8String.
        func encodeValue(_ value: String) -> Data {
            switch self {
            case .country:
                if value.count <= 2,
                    value.range(of: #"^[A-Za-z]{1,2}$"#, options: .regularExpression) != nil
                {
                    return ASN1.printableString(value)
                }
                fallthrough
            default:
                return ASN1.utf8String(value)
            }
        }
    }

    private var atvs: [(Attr, String)] = []

    @discardableResult
    func add(_ attr: Attr, _ value: String) -> NameBuilder {
        atvs.append((attr, value))
        return self
    }

    @discardableResult
    func addIfPresent(_ attr: Attr, _ value: String?) -> NameBuilder {
        if let v = value, !v.isEmpty { atvs.append((attr, v)) }
        return self
    }

    /// Builds a Name ::= SEQUENCE OF RDNs, where each RDN is a SET containing one AttributeTypeAndValue.
    func build() -> Data {
        let rdns: [Data] = atvs.map { (attr, value) in
            let atv = ASN1.sequence([
                ASN1.objectIdentifier(from: attr.oid),
                attr.encodeValue(value),
            ])
            return ASN1.set([atv])
        }
        return ASN1.sequence(rdns)
    }
}

// MARK: - Minimal ASN.1 DER encoder (subset)

private enum ASN1 {
    // Primitive/constructed tags we need
    private static let tagInteger: UInt8 = 0x02
    private static let tagBoolean: UInt8 = 0x01
    private static let tagBitString: UInt8 = 0x03
    private static let tagOctetString: UInt8 = 0x04
    private static let tagNull: UInt8 = 0x05
    private static let tagObjectId: UInt8 = 0x06
    private static let tagUTF8String: UInt8 = 0x0C
    private static let tagSequence: UInt8 = 0x30  // constructed
    private static let tagSet: UInt8 = 0x31  // constructed
    private static let tagPrintableString: UInt8 = 0x13
    private static let tagUTCTime: UInt8 = 0x17
    private static let tagGeneralizedTime: UInt8 = 0x18

    static func sequence(_ parts: [Data]) -> Data {
        let content = Data(parts.joined())
        return tlv(tagSequence, content)
    }

    static func set(_ parts: [Data]) -> Data {
        let content = Data(parts.joined())
        return tlv(tagSet, content)
    }

    static func integer(_ value: Data) -> Data {
        var v = value
        if v.isEmpty { v = Data([0x00]) }
        // Ensure positive integer (prepend 0x00 if MSB is set)
        if let first = v.first, first & 0x80 != 0 {
            v.insert(0x00, at: 0)
        }
        return tlv(tagInteger, v)
    }

    static func integer(_ value: UInt64) -> Data {
        var bytes = withUnsafeBytes(of: value.bigEndian, Array.init)
        // Trim leading zeros
        while bytes.first == 0 && bytes.count > 1 {
            bytes.removeFirst()
        }
        return integer(Data(bytes))
    }

    static func bitString(_ bits: Data) -> Data {
        // Prepend "unused bits" count = 0
        var content = Data([0x00])
        content.append(bits)
        return tlv(tagBitString, content)
    }

    static func bitString(_ bits: Data, unusedBits: UInt8) -> Data {
        // Use a custom number of unused bits in the last octet (0..7)
        var content = Data([unusedBits])
        content.append(bits)
        return tlv(tagBitString, content)
    }

    static func octetString(_ content: Data) -> Data {
        tlv(tagOctetString, content)
    }

    static func null() -> Data {
        tlv(tagNull, Data())
    }

    static func utf8String(_ s: String) -> Data {
        tlv(tagUTF8String, Data(s.utf8))
    }

    static func printableString(_ s: String) -> Data {
        tlv(tagPrintableString, Data(s.utf8))
    }

    static func boolean(_ v: Bool) -> Data {
        tlv(tagBoolean, Data([v ? 0xFF : 0x00]))
    }

    // Context-specific EXPLICIT tag wrapper, e.g., [0] and [3]
    static func explicit(tag: UInt8, _ inner: Data) -> Data {
        let rawTag: UInt8 = 0xA0 | (tag & 0x1F)  // context-specific, constructed
        return tlvWithRawTag(rawTag, inner)
    }
    // Context-specific IMPLICIT tag (primitive), e.g., AuthorityKeyIdentifier keyIdentifier [0]
    static func implicit(tag: UInt8, _ primitiveContent: Data) -> Data {
        let rawTag: UInt8 = 0x80 | (tag & 0x1F)  // context-specific, primitive
        return tlvWithRawTag(rawTag, primitiveContent)
    }

    static func objectIdentifier(from dotted: String) -> Data {
        let parts = dotted.split(separator: ".").compactMap { UInt64($0) }
        precondition(parts.count >= 2, "OID must have at least two arcs")
        var bytes: [UInt8] = []
        // First two arcs combined: 40 * first + second
        let first = parts[0]
        let second = parts[1]
        bytes.append(UInt8(40 * first + second))

        for v in parts.dropFirst(2) {
            bytes.append(contentsOf: base128(v))
        }
        return tlv(tagObjectId, Data(bytes))
    }

    static func utcTime(_ date: Date) -> Data {
        // For years 1950..2049 use UTCTime, else GeneralizedTime
        let cal = Calendar(identifier: .gregorian)
        let comps = cal.dateComponents(in: TimeZone(secondsFromGMT: 0)!, from: date)
        let year = comps.year ?? 2000
        if (1950...2049).contains(year) {
            // "YYMMDDHHMMSSZ"
            let yy = String(format: "%02d", year % 100)
            let mm = String(format: "%02d", comps.month ?? 1)
            let dd = String(format: "%02d", comps.day ?? 1)
            let hh = String(format: "%02d", comps.hour ?? 0)
            let mi = String(format: "%02d", comps.minute ?? 0)
            let ss = String(format: "%02d", comps.second ?? 0)
            let s = "\(yy)\(mm)\(dd)\(hh)\(mi)\(ss)Z"
            return tlv(tagUTCTime, Data(s.utf8))
        } else {
            // "YYYYMMDDHHMMSSZ"
            let yyyy = String(format: "%04d", year)
            let mm = String(format: "%02d", comps.month ?? 1)
            let dd = String(format: "%02d", comps.day ?? 1)
            let hh = String(format: "%02d", comps.hour ?? 0)
            let mi = String(format: "%02d", comps.minute ?? 0)
            let ss = String(format: "%02d", comps.second ?? 0)
            let s = "\(yyyy)\(mm)\(dd)\(hh)\(mi)\(ss)Z"
            return tlv(tagGeneralizedTime, Data(s.utf8))
        }
    }

    // MARK: - Internals

    private static func tlvWithRawTag(_ tag: UInt8, _ content: Data) -> Data {
        var out = Data([tag])
        out.append(encodeLength(content.count))
        out.append(content)
        return out
    }

    private static func tlv(_ tag: UInt8, _ content: Data) -> Data {
        return tlvWithRawTag(tag, content)
    }

    private static func encodeLength(_ length: Int) -> Data {
        precondition(length >= 0)
        if length < 0x80 {
            return Data([UInt8(length)])
        }
        var b = withUnsafeBytes(of: UInt64(length).bigEndian, Array.init)
        while b.first == 0 { b.removeFirst() }
        let count = UInt8(b.count)
        return Data([0x80 | count]) + Data(b)
    }

    private static func base128(_ value: UInt64) -> [UInt8] {
        // Base-128, big-endian, MSB set on all but the last byte
        if value == 0 { return [0x00] }
        var stack: [UInt8] = []
        var v = value
        while v > 0 {
            stack.append(UInt8(v & 0x7F))
            v >>= 7
        }
        var out: [UInt8] = []
        for i in stack.indices.reversed() {
            var byte = stack[i]
            if i != 0 { byte |= 0x80 }
            out.append(byte)
        }
        return out
    }
}
