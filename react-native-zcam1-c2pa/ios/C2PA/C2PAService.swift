import Foundation
import Security

@available(iOS 16.0, *)
public enum C2PAServiceError: Error, LocalizedError {
    case unsupportedFormat(String)
    case keyAccess(String)
    case invalidParameter(String)

    public var errorDescription: String? {
        switch self {
        case .unsupportedFormat(let ext):
            return "Unsupported media format for extension: \(ext)"
        case .keyAccess(let message):
            return "Secure Enclave key error: \(message)"
        case .invalidParameter(let message):
            return "Invalid parameter: \(message)"
        }
    }
}

@available(iOS 16.0, *)
@objc public final class C2PAService: NSObject {

    // MARK: - Secure Enclave Key Management

    /// Ensures a Secure Enclave key exists for the given keyTag.
    /// If missing, it creates a new P-256 key in the Secure Enclave with the provided access control flags.
    /// - Returns: The SecKey reference of the existing or newly created key.
    @discardableResult
    public static func ensureSecureEnclaveKey(
        keyTag: String,
        accessControl: SecAccessControlCreateFlags = [.privateKeyUsage]
    ) throws -> SecKey {
        if let existing = try findSecureEnclavePrivateKey(tag: keyTag) {
            return existing
        }
        // Create via C2PA extension
        let config = SecureEnclaveSignerConfig(keyTag: keyTag, accessControl: accessControl)
        return try Signer.createSecureEnclaveKey(config: config)
    }

    // MARK: - Signing

    /// Signs an image file with a provided C2PA manifest JSON using the Secure Enclave-backed signer.
    ///
    /// - Parameters:
    ///   - sourceURL: The original media URL (e.g., a JPEG file).
    ///   - destinationURL: The output file URL where the signed asset will be written.
    ///   - manifestJSON: The C2PA manifest JSON string to apply.
    ///   - keyTag: The Secure Enclave key tag used for signing.
    ///   - certificateChainPEM: The certificate chain in PEM format (end-entity first), suitable for C2PA signing.
    ///   - tsaURL: Optional timestamp authority URL.
    ///   - embed: Whether to embed the manifest in the destination asset (default true). If false, creates a remote manifest.
    /// - Returns: The produced C2PA manifest bytes (as returned by the builder), which can be stored separately if needed.
    public static func signImage(
        at sourceURL: URL,
        to destinationURL: URL,
        manifestJSON: String,
        keyTag: String,
        certificateChainPEM: String,
        tsaURL: String? = nil,
        embed: Bool = true
    ) throws -> Data {
        // Validate parameters
        guard !manifestJSON.isEmpty else {
            throw C2PAServiceError.invalidParameter("manifestJSON must not be empty")
        }
        guard !certificateChainPEM.isEmpty else {
            throw C2PAServiceError.invalidParameter("certificateChainPEM must not be empty")
        }

        // Ensure key exists
        _ = try ensureSecureEnclaveKey(keyTag: keyTag)

        // Create signer bound to the Secure Enclave key
        let signer = try Signer(
            algorithm: .es256,
            certificateChainPEM: certificateChainPEM,
            tsaURL: tsaURL,
            secureEnclaveConfig: SecureEnclaveSignerConfig(keyTag: keyTag)
        )

        // Build manifest and sign
        let builder = try Builder(manifestJSON: manifestJSON)
        if !embed {
            builder.setNoEmbed()
        }

        let format = try inferFormat(from: sourceURL)

        // Use file-backed streams for source and destination
        let src = try Stream(fileURL: sourceURL, truncate: false, createIfNeeded: false)
        let dst = try Stream(fileURL: destinationURL, truncate: true, createIfNeeded: true)

        return try builder.sign(
            format: format,
            source: src,
            destination: dst,
            signer: signer
        )
    }

    public static func signImageWithDataHashed(
        at sourceURL: URL,
        to destinationURL: URL,
        manifestJSON: String,
        keyTag: String,
        dataHash: String,
        certificateChainPEM: String,
        tsaURL: String? = nil,
        embed: Bool = true
    ) throws -> Data {
        // Validate parameters
        guard !manifestJSON.isEmpty else {
            throw C2PAServiceError.invalidParameter("manifestJSON must not be empty")
        }
        guard !certificateChainPEM.isEmpty else {
            throw C2PAServiceError.invalidParameter("certificateChainPEM must not be empty")
        }

        // Ensure key exists
        _ = try ensureSecureEnclaveKey(keyTag: keyTag)

        // Create signer bound to the Secure Enclave key
        let signer = try Signer(
            algorithm: .es256,
            certificateChainPEM: certificateChainPEM,
            tsaURL: tsaURL,
            secureEnclaveConfig: SecureEnclaveSignerConfig(keyTag: keyTag)
        )

        // Build manifest and sign
        let builder = try Builder(manifestJSON: manifestJSON)
        if !embed {
            builder.setNoEmbed()
        }

        let format = try inferFormat(from: sourceURL)

        // Use file-backed streams for source and destination
        let src = try Stream(fileURL: sourceURL, truncate: false, createIfNeeded: false)
        let dst = try Stream(fileURL: destinationURL, truncate: true, createIfNeeded: true)

        return try builder.signWithDataHashed(
            format: format,
            dataHash: dataHash,
            source: src,
            destination: dst,
            signer: signer
        )
    }

    // MARK: - Utilities

    /// Attempts to find an existing Secure Enclave private key by tag.
    private static func findSecureEnclavePrivateKey(tag: String) throws -> SecKey? {
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
        switch status {
        case errSecSuccess:
            return (item as! SecKey)
        case errSecItemNotFound:
            return nil
        default:
            throw C2PAServiceError.keyAccess("SecItemCopyMatching failed with status \(status)")
        }
    }

    /// Infers the C2PA "format" string from a file URL (e.g., "image/jpeg" for .jpg).
    private static func inferFormat(from url: URL) throws -> String {
        let ext = url.pathExtension.lowercased()
        switch ext {
        case "jpg", "jpeg": return "image/jpeg"
        case "png": return "image/png"
        case "heic": return "image/heic"
        case "heif": return "image/heif"
        case "tif", "tiff": return "image/tiff"
        case "webp": return "image/webp"
        case "dng": return "image/x-adobe-dng"
        default:
            throw C2PAServiceError.unsupportedFormat(ext)
        }
    }

    // MARK: - Objective-C bridging
    // These @objc helpers provide NSError** bridging for Objective-C callers.
    @objc public static func signImageAt(
        _ sourceURL: URL,
        to destinationURL: URL,
        manifestJSON: String,
        keyTag: String,
        certificateChainPEM: String,
        tsaURL: String? = nil,
        embed: Bool,
        error: NSErrorPointer
    ) -> Data? {
        do {
            return try signImage(
                at: sourceURL,
                to: destinationURL,
                manifestJSON: manifestJSON,
                keyTag: keyTag,
                certificateChainPEM: certificateChainPEM,
                tsaURL: tsaURL,
                embed: embed
            )
        } catch let caughtError {
            if let e = error {
                e.pointee = caughtError as NSError
            }
            return nil
        }
    }

    @objc public static func signImageWithDataHashedAt(
        _ sourceURL: URL,
        to destinationURL: URL,
        manifestJSON: String,
        keyTag: String,
        dataHash: String,
        certificateChainPEM: String,
        tsaURL: String? = nil,
        embed: Bool,
        error: NSErrorPointer
    ) -> Data? {
        do {
            return try signImageWithDataHashed(
                at: sourceURL,
                to: destinationURL,
                manifestJSON: manifestJSON,
                keyTag: keyTag,
                dataHash: dataHash,
                certificateChainPEM: certificateChainPEM,
                tsaURL: tsaURL,
                embed: embed
            )
        } catch let caughtError {
            if let e = error {
                e.pointee = caughtError as NSError
            }
            return nil
        }
    }
}
