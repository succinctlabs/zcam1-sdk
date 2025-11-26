//
//  SigningAlgorithm.swift
//

import C2PAC
import Foundation

public enum SigningAlgorithm {
    case es256, es384, es512, ps256, ps384, ps512, ed25519

    var cValue: C2paSigningAlg {
        switch self {
        case .es256: return Es256
        case .es384: return Es384
        case .es512: return Es512
        case .ps256: return Ps256
        case .ps384: return Ps384
        case .ps512: return Ps512
        case .ed25519: return Ed25519
        }
    }

    public var description: String {
        switch self {
        case .es256: return "es256"
        case .es384: return "es384"
        case .es512: return "es512"
        case .ps256: return "ps256"
        case .ps384: return "ps384"
        case .ps512: return "ps512"
        case .ed25519: return "ed25519"
        }
    }
}

public struct SignerInfo {
    public let algorithm: SigningAlgorithm
    public let certificatePEM: String
    public let privateKeyPEM: String
    public let tsaURL: String?

    public init(
        algorithm: SigningAlgorithm,
        certificatePEM: String,
        privateKeyPEM: String,
        tsaURL: String? = nil
    ) {
        self.algorithm = algorithm
        self.certificatePEM = certificatePEM
        self.privateKeyPEM = privateKeyPEM
        self.tsaURL = tsaURL
    }
}
