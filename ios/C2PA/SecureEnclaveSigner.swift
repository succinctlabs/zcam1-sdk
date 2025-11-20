//
//  SecureEnclaveSigner.swift
//

import C2PAC
import Foundation
import Security

public struct SecureEnclaveSignerConfig {
    public let keyTag: String
    public let accessControl: SecAccessControlCreateFlags

    public init(
        keyTag: String,
        accessControl: SecAccessControlCreateFlags = [.privateKeyUsage]
    ) {
        self.keyTag = keyTag
        self.accessControl = accessControl
    }
}

extension Signer {
    public convenience init(
        algorithm: SigningAlgorithm,
        certificateChainPEM: String,
        tsaURL: String? = nil,
        secureEnclaveConfig: SecureEnclaveSignerConfig
    ) throws {
        guard algorithm == .es256 else {
            throw C2PAError.api("Secure Enclave only supports ES256 (P-256)")
        }

        try self.init(
            algorithm: algorithm,
            certificateChainPEM: certificateChainPEM,
            tsaURL: tsaURL
        ) { data in
            let query: [String: Any] = [
                kSecClass as String: kSecClassKey,
                kSecAttrApplicationTag as String: secureEnclaveConfig.keyTag,
                kSecAttrKeyType as String: kSecAttrKeyTypeECSECPrimeRandom,
                kSecAttrTokenID as String: kSecAttrTokenIDSecureEnclave,
                kSecReturnRef as String: true,
            ]

            var item: CFTypeRef?
            let status = SecItemCopyMatching(query as CFDictionary, &item)

            let privateKey: SecKey
            if status == errSecItemNotFound {
                privateKey = try Signer.createSecureEnclaveKey(config: secureEnclaveConfig)
            } else if status == errSecSuccess,
                let key = item as! SecKey?
            {
                privateKey = key
            } else {
                throw C2PAError.api("Failed to access Secure Enclave key: \(status)")
            }

            let algorithm = SecKeyAlgorithm.ecdsaSignatureMessageX962SHA256

            guard SecKeyIsAlgorithmSupported(privateKey, .sign, algorithm) else {
                throw C2PAError.api("Secure Enclave key doesn't support required algorithm")
            }

            var error: Unmanaged<CFError>?
            guard
                let signature = SecKeyCreateSignature(
                    privateKey,
                    algorithm,
                    data as CFData,
                    &error)
            else {
                if let error = error?.takeRetainedValue() {
                    throw C2PAError.api("Secure Enclave signing failed: \(error)")
                }
                throw C2PAError.api("Secure Enclave signing failed")
            }

            return signature as Data
        }
    }

    public static func createSecureEnclaveKey(config: SecureEnclaveSignerConfig) throws -> SecKey {
        guard
            let access = SecAccessControlCreateWithFlags(
                kCFAllocatorDefault,
                kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
                config.accessControl,
                nil
            )
        else {
            throw C2PAError.api("Failed to create access control")
        }

        let attributes: [String: Any] = [
            kSecAttrKeyType as String: kSecAttrKeyTypeECSECPrimeRandom,
            kSecAttrKeySizeInBits as String: 256,
            kSecAttrTokenID as String: kSecAttrTokenIDSecureEnclave,
            kSecPrivateKeyAttrs as String: [
                kSecAttrIsPermanent as String: true,
                kSecAttrApplicationTag as String: config.keyTag,
                kSecAttrAccessControl as String: access,
            ],
        ]

        var error: Unmanaged<CFError>?
        guard let privateKey = SecKeyCreateRandomKey(attributes as CFDictionary, &error) else {
            if let error = error?.takeRetainedValue() {
                throw C2PAError.api("Failed to create Secure Enclave key: \(error)")
            }
            throw C2PAError.api("Failed to create Secure Enclave key")
        }

        return privateKey
    }

    public static func deleteSecureEnclaveKey(keyTag: String) -> Bool {
        let query: [String: Any] = [
            kSecClass as String: kSecClassKey,
            kSecAttrApplicationTag as String: keyTag,
            kSecAttrKeyType as String: kSecAttrKeyTypeECSECPrimeRandom,
            kSecAttrTokenID as String: kSecAttrTokenIDSecureEnclave,
        ]

        let status = SecItemDelete(query as CFDictionary)
        return status == errSecSuccess || status == errSecItemNotFound
    }
}
