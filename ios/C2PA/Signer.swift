//
//  Signer.swift
//

import C2PAC
import Foundation
import Security

public final class Signer {
    // raw pointer owned
    let ptr: UnsafeMutablePointer<C2paSigner>
    private var retainedContext: Unmanaged<AnyObject>?

    // internal designated init
    private init(ptr: UnsafeMutablePointer<C2paSigner>) {
        self.ptr = ptr
    }

    // --------------------------------------------------------------------
    // 1) PEM-based convenience
    // --------------------------------------------------------------------
    public convenience init(
        certsPEM: String,
        privateKeyPEM: String,
        algorithm: SigningAlgorithm,
        tsaURL: String? = nil
    ) throws {
        var raw: UnsafeMutablePointer<C2paSigner>!
        try withSignerInfo(
            alg: algorithm.description,
            cert: certsPEM,
            key: privateKeyPEM,
            tsa: tsaURL
        ) { algPtr, certPtr, keyPtr, tsaPtr in
            var info = C2paSignerInfo(
                alg: algPtr,
                sign_cert: certPtr,
                private_key: keyPtr,
                ta_url: tsaPtr)
            raw = try guardNotNull(c2pa_signer_from_info(&info))
        }
        self.init(ptr: raw)
    }

    public convenience init(info: SignerInfo) throws {
        try self.init(
            certsPEM: info.certificatePEM,
            privateKeyPEM: info.privateKeyPEM,
            algorithm: info.algorithm,
            tsaURL: info.tsaURL)
    }

    // --------------------------------------------------------------------
    // 2) Swift-native closure  (Data in → Data out)
    // --------------------------------------------------------------------
    public convenience init(
        algorithm: SigningAlgorithm,
        certificateChainPEM: String,
        tsaURL: String? = nil,
        sign: @escaping (Data) throws -> Data
    ) throws {
        // keep closure alive
        final class Box {
            let fn: (Data) throws -> Data
            init(_ fn: @escaping (Data) throws -> Data) { self.fn = fn }
        }
        let box = Box(sign)
        let ref = Unmanaged.passRetained(box as AnyObject)  // Retain Box as AnyObject

        let tramp: SignerCallback = { ctx, bytes, len, dst, dstCap in
            // ctx is the opaque pointer to our Box instance
            guard let ctx, let bytes, let dst else { return -1 }
            let b = Unmanaged<Box>.fromOpaque(ctx).takeUnretainedValue()
            let msg = Data(bytes: bytes, count: Int(len))  // len is uintptr_t (UInt)

            do {
                let sig = try b.fn(msg)
                // dstCap is uintptr_t (UInt)
                guard UInt(sig.count) <= dstCap else { return -1 }  // Compare UInts
                sig.copyBytes(to: dst, count: sig.count)
                return sig.count
            } catch {
                return -1
            }
        }

        var raw: UnsafeMutablePointer<C2paSigner>!
        try certificateChainPEM.withCString { certPtr in
            try withOptionalCString(tsaURL) { tsaPtr in
                raw = try guardNotNull(
                    c2pa_signer_create(
                        ref.toOpaque(),  // Pass opaque pointer to Box instance
                        tramp,
                        algorithm.cValue,
                        certPtr,
                        tsaPtr
                    )
                )
            }
        }

        self.init(ptr: raw)
        retainedContext = ref  // Store the Unmanaged<AnyObject>
    }

    deinit {
        c2pa_signer_free(ptr)
        retainedContext?.release()
    }

    public func reserveSize() throws -> Int {
        try Int(guardNonNegative(c2pa_signer_reserve_size(ptr)))
    }
}

extension Signer {
    public static func exportPublicKeyPEM(fromKeychainTag keyTag: String) throws -> String {
        let query: [String: Any] = [
            kSecClass as String: kSecClassKey,
            kSecAttrApplicationTag as String: keyTag,
            kSecAttrKeyType as String: kSecAttrKeyTypeECSECPrimeRandom,
            kSecReturnRef as String: true,
        ]

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)

        guard status == errSecSuccess,
            let privateKey = item as! SecKey?
        else {
            throw C2PAError.api("Failed to find key '\(keyTag)' in keychain: \(status)")
        }

        guard let publicKey = SecKeyCopyPublicKey(privateKey) else {
            throw C2PAError.api("Failed to extract public key")
        }

        var error: Unmanaged<CFError>?
        guard let publicKeyData = SecKeyCopyExternalRepresentation(publicKey, &error) as Data?
        else {
            if let error = error?.takeRetainedValue() {
                throw C2PAError.api("Failed to export public key: \(error)")
            }
            throw C2PAError.api("Failed to export public key")
        }

        let base64 = publicKeyData.base64EncodedString(options: [
            .lineLength64Characters, .endLineWithLineFeed,
        ])
        return "-----BEGIN PUBLIC KEY-----\n\(base64)\n-----END PUBLIC KEY-----"
    }
}
