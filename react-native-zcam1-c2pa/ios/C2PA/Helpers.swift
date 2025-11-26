//
//  Helpers.swift
//

import C2PAC
import Foundation

public enum C2PAError: Error, CustomStringConvertible {
    case api(String)  // message from Rust layer
    case nilPointer  // unexpected NULL
    case utf8  // invalid UTF-8 returned
    case negative(Int64, String)  // negative status from C

    public var description: String {
        switch self {
        case .api(let m): return "C2PA-API error: \(m)"
        case .nilPointer: return "Unexpected NULL pointer"
        case .utf8: return "Invalid UTF-8 from C2PA"
        case .negative(let v, let o): return "C2PA negative status \(v) for \(o)"
        }
    }
}

extension C2PAError: LocalizedError {
    public var errorDescription: String? { self.description }
}

// MARK: - Common helpers

@inline(__always)
func guardNotNull<T>(_ ptr: UnsafeMutablePointer<T>?) throws -> UnsafeMutablePointer<T> {
    guard let p = ptr else { throw C2PAError.api(lastC2PAError()) }
    return p
}

@inline(__always)
func guardNotNull<T>(_ ptr: UnsafePointer<T>?) throws -> UnsafePointer<T> {
    guard let p = ptr else { throw C2PAError.api(lastC2PAError()) }
    return p
}

@inline(__always)
func guardNonNegative(_ value: Int64) throws -> Int64 {
    if value < 0 { throw C2PAError.negative(value, lastC2PAError()) }
    return value
}

// MARK: - CString helpers

@inline(__always)
func withOptionalCString<R>(
    _ str: String?,
    _ body: (UnsafePointer<CChar>?) throws -> R
) rethrows -> R {
    if let s = str {
        return try s.withCString { cStr in
            try body(cStr)
        }
    } else {
        return try body(nil)
    }
}

@inline(__always)
func withSignerInfo<R>(
    alg: String,
    cert: String,
    key: String,
    tsa: String?,
    _ body: (
        _ algPtr: UnsafePointer<CChar>,
        _ certPtr: UnsafePointer<CChar>,
        _ keyPtr: UnsafePointer<CChar>,
        _ tsaPtr: UnsafePointer<CChar>?
    ) throws -> R
) rethrows -> R {
    try alg.withCString { algPtr in
        try cert.withCString { certPtr in
            try key.withCString { keyPtr in
                try withOptionalCString(tsa) { tsaPtr in
                    try body(algPtr, certPtr, keyPtr, tsaPtr)
                }
            }
        }
    }
}

// MARK: - String conversion from C pointers

// Use when C API returns a newly-allocated (owned) char* that must be freed.
@inline(__always)
func stringFromC(_ ptr: UnsafeMutablePointer<CChar>?) throws -> String {
    guard let p = ptr else { throw C2PAError.nilPointer }
    defer { c2pa_string_free(p) }
    return String(cString: p)
}

// Use when C API returns a borrowed const char* that must NOT be freed here.
@inline(__always)
func stringFromC(_ ptr: UnsafePointer<CChar>?) throws -> String {
    guard let p = ptr else { throw C2PAError.nilPointer }
    return String(cString: p)
}

// MARK: - Error helpers

@inline(__always)
func lastC2PAError() -> String {
    // Returns a borrowed pointer managed by the C layer.
    guard let p = c2pa_error() else { return "Unknown C2PA error" }
    defer { c2pa_string_free(p) }
    return String(cString: p)
}

// MARK: - Stream context bridge

@inline(__always)
func asStreamCtx(_ p: UnsafeMutableRawPointer) -> UnsafeMutablePointer<StreamContext> {
    UnsafeMutablePointer<StreamContext>(OpaquePointer(p))
}
