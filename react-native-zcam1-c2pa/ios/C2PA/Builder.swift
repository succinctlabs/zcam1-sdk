//
//  Builder.swift
//

import C2PAC
import Foundation

public final class Builder {
    private let ptr: UnsafeMutablePointer<C2paBuilder>

    public init(manifestJSON: String) throws {
        ptr = try guardNotNull(c2pa_builder_from_json(manifestJSON))
    }

    public init(archiveStream: Stream) throws {
        ptr = try guardNotNull(c2pa_builder_from_archive(archiveStream.rawPtr))
    }

    deinit { c2pa_builder_free(ptr) }

    public func setNoEmbed() { c2pa_builder_set_no_embed(ptr) }

    public func setRemoteURL(_ url: String) throws {
        _ = try guardNonNegative(
            Int64(c2pa_builder_set_remote_url(ptr, url))
        )
    }

    public func addResource(uri: String, stream: Stream) throws {
        _ = try guardNonNegative(
            Int64(c2pa_builder_add_resource(ptr, uri, stream.rawPtr))
        )
    }

    public func addIngredient(json: String, format: String, from stream: Stream) throws {
        _ = try guardNonNegative(
            Int64(c2pa_builder_add_ingredient_from_stream(ptr, json, format, stream.rawPtr))
        )
    }

    public func writeArchive(to dest: Stream) throws {
        _ = try guardNonNegative(
            Int64(c2pa_builder_to_archive(ptr, dest.rawPtr))
        )
    }

    @discardableResult
    public func sign(
        format: String,
        source: Stream,
        destination: Stream,
        signer: Signer
    ) throws -> Data {
        var manifestPtr: UnsafePointer<UInt8>?
        let size = try guardNonNegative(
            c2pa_builder_sign(
                ptr,
                format,
                source.rawPtr,
                destination.rawPtr,
                signer.ptr,
                &manifestPtr)
        )
        guard let mp = manifestPtr else { return Data() }
        let data = Data(bytes: mp, count: Int(size))
        c2pa_manifest_bytes_free(mp)
        return data
    }

    @discardableResult
    public func signWithDataHashed(
        format: String,
        dataHash: String,
        source: Stream,
        destination: Stream,
        signer: Signer
    ) throws -> Data {
        switch format {
        case "image/jpeg":
            return try signWithDataHashedJpeg(
                dataHash: dataHash,
                source: source,
                destination: destination,
                signer: signer
            )
        case "image/x-adobe-dng":
            return try signWithDataHashedDng(
                dataHash: dataHash,
                source: source,
                destination: destination,
                signer: signer
            )
        default:
            throw C2PAError.api("Unsupported format for signWithDataHashed: \(format)")
        }
    }

    @discardableResult
    public func signWithDataHashedJpeg(
        dataHash: String,
        source: Stream,
        destination: Stream,
        signer: Signer
    ) throws -> Data {
        let format = "image/jpeg"

        // 1) Create a placeholder manifest sized for this signer
        var placeholderPtr: UnsafePointer<UInt8>?
        let placeholderSize = try guardNonNegative(
            c2pa_builder_data_hashed_placeholder(
                ptr,
                UInt(try signer.reserveSize()),
                format,
                &placeholderPtr
            )
        )
        guard let ph = placeholderPtr else { return Data() }
        defer { c2pa_manifest_bytes_free(ph) }

        // 2) Copy source -> destination, inserting placeholder at manifest_pos = 2
        //    (like the Rust example: SOI marker is 2 bytes for JPEG)
        let src = source.rawPtr.pointee
        let dst = destination.rawPtr.pointee

        // Seek to start on both
        _ = src.seeker?(src.context, 0, Start)
        _ = dst.seeker?(dst.context, 0, Start)

        // Read first two bytes from source
        var firstTwo = [UInt8](repeating: 0, count: 2)
        let nFirst = firstTwo.withUnsafeMutableBufferPointer { buf -> Int in
            let r = src.reader?(src.context, buf.baseAddress, 2) ?? -1
            return Int(r)
        }
        if nFirst < 0 { throw C2PAError.api(lastC2PAError()) }

        // Write first two bytes to destination
        _ = firstTwo.withUnsafeBufferPointer { buf in
            dst.writer?(dst.context, buf.baseAddress, nFirst)
        }

        // Write the placeholder manifest
        _ = dst.writer?(dst.context, ph, Int(placeholderSize))

        // Stream the remainder of the source into destination
        let chunkSize = 64 * 1024
        let tmp = UnsafeMutablePointer<UInt8>.allocate(capacity: chunkSize)
        defer { tmp.deallocate() }
        while true {
            let r = src.reader?(src.context, tmp, chunkSize) ?? -1
            if r < 0 { throw C2PAError.api(lastC2PAError()) }
            if r == 0 { break }
            let w = dst.writer?(dst.context, tmp, r) ?? -1
            if w < 0 { throw C2PAError.api(lastC2PAError()) }
        }
        _ = dst.flusher?(dst.context)

        guard let decodedData = Data(base64Encoded: dataHash) else {
            throw C2PAError.utf8
        }

        // 3) Build DataHash JSON including exclusions for the inserted placeholder
        let payload: [String: Any] = [
            "alg": "sha256",
            "hash": Array(decodedData),
            "pad": [],
            "exclusions": [
                ["start": 2 as UInt64, "length": UInt64(placeholderSize)]
            ],
        ]
        let jsonData = try JSONSerialization.data(withJSONObject: payload, options: [])
        guard let jsonString = String(data: jsonData, encoding: .utf8) else {
            throw C2PAError.utf8
        }

        // 4) Ask SDK to produce final embeddable manifest bytes using provided data hash
        var manifestPtr: UnsafePointer<UInt8>?
        let size = try guardNonNegative(
            c2pa_builder_sign_data_hashed_embeddable(
                ptr,
                signer.ptr,
                jsonString,
                format,
                nil,  // use pre-calculated data hash (no stream needed)
                &manifestPtr
            )
        )

        // 5) Overwrite placeholder with the final manifest at position 2
        guard let mp = manifestPtr else { return Data() }
        _ = dst.seeker?(dst.context, 2, Start)
        _ = dst.writer?(dst.context, mp, Int(size))
        _ = dst.flusher?(dst.context)

        // Return manifest bytes to caller
        let data = Data(bytes: mp, count: Int(size))
        c2pa_manifest_bytes_free(mp)
        return data
    }

    @discardableResult
    public func signWithDataHashedDng(
        dataHash: String,
        source: Stream,
        destination: Stream,
        signer: Signer
    ) throws -> Data {
        let format = "image/x-adobe-dng"

        // 1) Create a placeholder manifest sized for this signer
        var placeholderPtr: UnsafePointer<UInt8>?
        let placeholderSize = try guardNonNegative(
            c2pa_builder_data_hashed_placeholder(
                ptr,
                UInt(try signer.reserveSize()),
                format,
                &placeholderPtr
            )
        )
        guard let ph = placeholderPtr else { return Data() }
        defer { c2pa_manifest_bytes_free(ph) }

        let placeholderLen = Int(placeholderSize)
        let placeholderData = Data(bytes: ph, count: placeholderLen)

        // 2) Read entire source DNG into memory
        let src = source.rawPtr.pointee
        _ = src.seeker?(src.context, 0, Start)

        var dng = Data()
        let chunkSize = 64 * 1024
        let tmp = UnsafeMutablePointer<UInt8>.allocate(capacity: chunkSize)
        defer { tmp.deallocate() }

        while true {
            let r = src.reader?(src.context, tmp, chunkSize) ?? -1
            if r < 0 { throw C2PAError.api(lastC2PAError()) }
            if r == 0 { break }
            dng.append(tmp, count: r)
        }

        // 3) Parse TIFF/DNG header and locate last IFD
        guard dng.count >= 8 else {
            throw C2PAError.api("DNG file too small to contain valid TIFF header")
        }

        // Determine byte order: "II" (0x4949) or "MM" (0x4D4D)
        let byte0 = dng[dng.startIndex]
        let byte1 = dng[dng.startIndex + 1]
        let isLittleEndian: Bool
        if byte0 == 0x49 && byte1 == 0x49 {
            isLittleEndian = true
        } else if byte0 == 0x4D && byte1 == 0x4D {
            isLittleEndian = false
        } else {
            throw C2PAError.api("Unsupported TIFF byte order in DNG")
        }

        func readUInt16(_ data: Data, _ offset: Int) throws -> UInt16 {
            guard offset + 2 <= data.count else {
                throw C2PAError.api("Unexpected EOF while reading UInt16")
            }
            let slice = data[offset..<offset + 2]
            return slice.withUnsafeBytes { raw -> UInt16 in
                let v = raw.load(as: UInt16.self)
                return isLittleEndian ? UInt16(littleEndian: v) : UInt16(bigEndian: v)
            }
        }

        func readUInt32(_ data: Data, _ offset: Int) throws -> UInt32 {
            guard offset + 4 <= data.count else {
                throw C2PAError.api("Unexpected EOF while reading UInt32")
            }
            let slice = data[offset..<offset + 4]
            return slice.withUnsafeBytes { raw -> UInt32 in
                let v = raw.load(as: UInt32.self)
                return isLittleEndian ? UInt32(littleEndian: v) : UInt32(bigEndian: v)
            }
        }

        func writeUInt32(_ data: inout Data, _ offset: Int, _ value: UInt32) throws {
            guard offset + 4 <= data.count else {
                throw C2PAError.api("Unexpected EOF while writing UInt32")
            }
            var v = isLittleEndian ? value.littleEndian : value.bigEndian
            withUnsafeBytes(of: &v) { raw in
                data.replaceSubrange(offset..<offset + 4, with: raw)
            }
        }

        func appendUInt16(_ data: inout Data, _ value: UInt16) {
            var v = isLittleEndian ? value.littleEndian : value.bigEndian
            withUnsafeBytes(of: &v) { raw in
                data.append(raw.bindMemory(to: UInt8.self))
            }
        }

        func appendUInt32(_ data: inout Data, _ value: UInt32) {
            var v = isLittleEndian ? value.littleEndian : value.bigEndian
            withUnsafeBytes(of: &v) { raw in
                data.append(raw.bindMemory(to: UInt8.self))
            }
        }

        // Validate TIFF/DNG magic (42 or 85)
        let magic = try readUInt16(dng, 2)
        guard magic == 42 || magic == 85 else {
            throw C2PAError.api("Unsupported TIFF/DNG magic value: \(magic)")
        }

        let firstIFDOffset = try readUInt32(dng, 4)
        var currentIFDOffset = Int(firstIFDOffset)
        var lastIFDNextOffsetPos: Int?

        // Walk IFD chain to find the last IFD (where next-IFD offset is 0)
        while currentIFDOffset != 0 {
            guard currentIFDOffset + 2 <= dng.count else {
                throw C2PAError.api("Invalid IFD offset in DNG")
            }

            let entryCount = Int(try readUInt16(dng, currentIFDOffset))
            let entriesStart = currentIFDOffset + 2
            let entriesSize = entryCount * 12
            let nextOffsetPos = entriesStart + entriesSize

            guard nextOffsetPos + 4 <= dng.count else {
                throw C2PAError.api("Invalid IFD structure in DNG")
            }

            let nextOffset = try readUInt32(dng, nextOffsetPos)
            lastIFDNextOffsetPos = nextOffsetPos

            if nextOffset == 0 {
                break
            }
            currentIFDOffset = Int(nextOffset)
        }

        guard let lastNextPos = lastIFDNextOffsetPos else {
            throw C2PAError.api("Failed to locate IFD in DNG")
        }

        // 4) Append a new IFD containing tag 52545 (0xCD41), type 7, whose value is the placeholder manifest.
        var out = dng

        func align(_ value: Int, to alignment: Int) -> Int {
            let remainder = value % alignment
            return remainder == 0 ? value : (value + (alignment - remainder))
        }

        // Align new IFD on a 2-byte boundary (standard for TIFF)
        let alignment = 2
        let alignedIfdOffset = align(out.count, to: alignment)
        if alignedIfdOffset > out.count {
            out.append(
                contentsOf: [UInt8](repeating: 0, count: alignedIfdOffset - out.count)
            )
        }
        let newIfdOffset = alignedIfdOffset

        guard newIfdOffset <= Int(UInt32.max) else {
            throw C2PAError.api("DNG file too large to add new IFD")
        }

        // Patch previous last IFD's "next IFD offset" to point to our new IFD
        try writeUInt32(&out, lastNextPos, UInt32(newIfdOffset))

        // Compute where the placeholder bytes will live:
        //   IFD header (2 bytes for count)
        //   + 12 bytes for our single entry
        //   + 4 bytes for the "next IFD" pointer
        let manifestOffset = newIfdOffset + 2 + 12 + 4
        guard manifestOffset <= Int(UInt32.max) else {
            throw C2PAError.api("Manifest offset out of range")
        }

        // Write new IFD (1 entry: tag 52545 / 0xCD41)
        appendUInt16(&out, 1)  // entry count

        // Tag = 52545 (0xCD41)
        appendUInt16(&out, 52545)

        // Type = 7 (UNDEFINED)
        appendUInt16(&out, 7)

        // Count = number of bytes in placeholder
        appendUInt32(&out, UInt32(placeholderLen))

        // Value offset = where the placeholder bytes will be stored
        appendUInt32(&out, UInt32(manifestOffset))

        // Next IFD offset = 0 (terminates chain)
        appendUInt32(&out, 0)

        // At this point, out.count should equal manifestOffset. Ensure it does.
        if out.count < manifestOffset {
            out.append(
                contentsOf: [UInt8](repeating: 0, count: manifestOffset - out.count)
            )
        }

        // Append placeholder manifest bytes as the tag value
        out.append(placeholderData)

        // 5) Write the modified DNG (with placeholder manifest tag) to destination
        let dst = destination.rawPtr.pointee
        _ = dst.seeker?(dst.context, 0, Start)
        out.withUnsafeBytes { buf in
            _ = dst.writer?(dst.context, buf.baseAddress, out.count)
        }
        _ = dst.flusher?(dst.context)

        // 6) Build DataHash JSON including exclusion for the placeholder tag data
        guard let decodedData = Data(base64Encoded: dataHash) else {
            throw C2PAError.utf8
        }

        let payload: [String: Any] = [
            "alg": "sha256",
            "hash": Array(decodedData),
            "pad": [],
            "exclusions": [
                [
                    "start": UInt64(manifestOffset),
                    "length": UInt64(placeholderLen),
                ]
            ],
        ]

        let jsonData = try JSONSerialization.data(withJSONObject: payload, options: [])
        guard let jsonString = String(data: jsonData, encoding: .utf8) else {
            throw C2PAError.utf8
        }

        // 7) Ask SDK to produce final embeddable manifest bytes using provided data hash
        var manifestPtr: UnsafePointer<UInt8>?
        let size = try guardNonNegative(
            c2pa_builder_sign_data_hashed_embeddable(
                ptr,
                signer.ptr,
                jsonString,
                format,
                nil,  // use pre-calculated data hash (no stream needed)
                &manifestPtr
            )
        )

        guard let mp = manifestPtr else { return Data() }

        // 8) Overwrite placeholder tag value with the final manifest bytes
        _ = dst.seeker?(dst.context, Int(manifestOffset), Start)
        _ = dst.writer?(dst.context, mp, Int(size))
        _ = dst.flusher?(dst.context)

        // Return manifest bytes to caller
        let result = Data(bytes: mp, count: Int(size))
        c2pa_manifest_bytes_free(mp)
        return result
    }

}
