//
//  Zcam1DepthData.swift
//  react-native-zcam1-sdk
//
//  Depth data extraction and processing using AVDepthData.
//

import AVFoundation
import Foundation
import ImageIO
import UIKit

// MARK: - Depth Data Processor

/// Handles extraction, conversion, and serialization of depth data from AVDepthData.
public class Zcam1DepthDataProcessor {

    /// Extract depth data from an AVCapturePhoto if available.
    /// Returns a dictionary containing depth information or nil if not available.
    public static func extractDepthData(from photo: AVCapturePhoto) -> [String: Any]? {
        guard let depthData = photo.depthData else {
            return nil
        }

        return processDepthData(depthData)
    }

    /// Process AVDepthData and return a dictionary with depth information.
    public static func processDepthData(_ depthData: AVDepthData) -> [String: Any] {
        let depthDataMap = depthData.depthDataMap

        // Get depth data dimensions
        let width = CVPixelBufferGetWidth(depthDataMap)
        let height = CVPixelBufferGetHeight(depthDataMap)

        // Get pixel format type
        let pixelFormatType = CVPixelBufferGetPixelFormatType(depthDataMap)
        let pixelFormatString = pixelFormatTypeToString(pixelFormatType)

        // Extract depth statistics
        let statistics = extractDepthStatistics(from: depthDataMap)

        // Get accuracy if available (iOS 14.1+)
        var accuracyString = "relative"
        if #available(iOS 14.1, *) {
            switch depthData.depthDataAccuracy {
            case .relative:
                accuracyString = "relative"
            case .absolute:
                accuracyString = "absolute"
            @unknown default:
                accuracyString = "unknown"
            }
        }

        var result: [String: Any] = [
            "width": width,
            "height": height,
            "pixelFormat": pixelFormatString,
            "statistics": statistics,
            "accuracy": accuracyString,
        ]

        return result
    }

    /// Extract statistics (min, max, mean, stddev) from depth data.
    private static func extractDepthStatistics(from depthDataMap: CVPixelBuffer) -> [String: Any] {
        let width = CVPixelBufferGetWidth(depthDataMap)
        let height = CVPixelBufferGetHeight(depthDataMap)
        let pixelFormatType = CVPixelBufferGetPixelFormatType(depthDataMap)

        CVPixelBufferLockBaseAddress(depthDataMap, .readOnly)
        defer { CVPixelBufferUnlockBaseAddress(depthDataMap, .readOnly) }

        guard let baseAddress = CVPixelBufferGetBaseAddress(depthDataMap) else {
            return [:]
        }

        let bytesPerRow = CVPixelBufferGetBytesPerRow(depthDataMap)
        var depthValues: [Float] = []
        depthValues.reserveCapacity(width * height)

        // Extract depth values based on pixel format
        switch pixelFormatType {
        case kCVPixelFormatType_DepthFloat32, kCVPixelFormatType_DisparityFloat32:
            let floatBuffer = baseAddress.assumingMemoryBound(to: Float32.self)
            for y in 0..<height {
                for x in 0..<width {
                    let offset = y * (bytesPerRow / MemoryLayout<Float32>.stride) + x
                    let value = floatBuffer[offset]
                    if !value.isNaN && !value.isInfinite {
                        depthValues.append(value)
                    }
                }
            }

        case kCVPixelFormatType_DepthFloat16, kCVPixelFormatType_DisparityFloat16:
            let float16Buffer = baseAddress.assumingMemoryBound(to: Float16.self)
            for y in 0..<height {
                for x in 0..<width {
                    let offset = y * (bytesPerRow / MemoryLayout<Float16>.stride) + x
                    let value = float16Buffer[offset]
                    if !value.isNaN && !value.isInfinite {
                        depthValues.append(Float(value))
                    }
                }
            }

        default:
            break
        }

        // Calculate statistics
        guard !depthValues.isEmpty else {
            return [
                "min": NSNull(),
                "max": NSNull(),
                "mean": NSNull(),
                "stdDev": NSNull(),
                "validPixelCount": 0,
            ]
        }

        let min = depthValues.min() ?? 0
        let max = depthValues.max() ?? 0
        let mean = depthValues.reduce(0, +) / Float(depthValues.count)

        // Calculate standard deviation
        let variance =
            depthValues.reduce(0) { sum, value in
                sum + pow(value - mean, 2)
            } / Float(depthValues.count)
        let stdDev = sqrt(variance)

        return [
            "min": min,
            "max": max,
            "mean": mean,
            "stdDev": stdDev,
            "validPixelCount": depthValues.count,
        ]
    }

    /// Extract camera calibration data.
    private static func extractCalibrationData(_ calibration: AVCameraCalibrationData) -> [String:
        Any]
    {
        var result: [String: Any] = [:]

        // Intrinsic matrix (3x3) - camera intrinsic parameters
        // Intrinsic matrix (3x3)
        let intrinsicMatrix = calibration.intrinsicMatrix
        result["intrinsicMatrix"] = [
            [intrinsicMatrix[0, 0], intrinsicMatrix[0, 1], intrinsicMatrix[0, 2]],
            [intrinsicMatrix[1, 0], intrinsicMatrix[1, 1], intrinsicMatrix[1, 2]],
            [intrinsicMatrix[2, 0], intrinsicMatrix[2, 1], intrinsicMatrix[2, 2]],
        ]

        // Extrinsic matrix (4x3)
        let extrinsicMatrix = calibration.extrinsicMatrix
        result["extrinsicMatrix"] = [
            [extrinsicMatrix[0, 0], extrinsicMatrix[0, 1], extrinsicMatrix[0, 2]],
            [extrinsicMatrix[1, 0], extrinsicMatrix[1, 1], extrinsicMatrix[1, 2]],
            [extrinsicMatrix[2, 0], extrinsicMatrix[2, 1], extrinsicMatrix[2, 2]],
            [extrinsicMatrix[3, 0], extrinsicMatrix[3, 1], extrinsicMatrix[3, 2]],
        ]

        // Lens distortion center
        let lensDistortionCenter = calibration.lensDistortionCenter
        result["lensDistortionCenter"] = [
            "x": lensDistortionCenter.x,
            "y": lensDistortionCenter.y,
        ]

        return result
    }

    /// Convert pixel format type to a human-readable string.
    private static func pixelFormatTypeToString(_ pixelFormatType: OSType) -> String {
        switch pixelFormatType {
        case kCVPixelFormatType_DepthFloat32:
            return "depthFloat32"
        case kCVPixelFormatType_DepthFloat16:
            return "depthFloat16"
        case kCVPixelFormatType_DisparityFloat32:
            return "disparityFloat32"
        case kCVPixelFormatType_DisparityFloat16:
            return "disparityFloat16"
        default:
            return "unknown"
        }
    }

    /// Encode depth data as a grayscale image for visualization.
    ///
    /// The output is encoded to match Google's GDepth `RangeInverse` convention:
    /// values are higher (brighter) for nearer pixels and lower (darker) for farther pixels.
    public static func encodeDepthDataAsImage(
        depthData: AVDepthData
    ) -> UIImage? {
        let depthDataMap = depthData.depthDataMap
        let width = CVPixelBufferGetWidth(depthDataMap)
        let height = CVPixelBufferGetHeight(depthDataMap)

        CVPixelBufferLockBaseAddress(depthDataMap, .readOnly)
        defer { CVPixelBufferUnlockBaseAddress(depthDataMap, .readOnly) }

        guard let baseAddress = CVPixelBufferGetBaseAddress(depthDataMap) else {
            return nil
        }

        let pixelFormatType = CVPixelBufferGetPixelFormatType(depthDataMap)
        let bytesPerRow = CVPixelBufferGetBytesPerRow(depthDataMap)

        // Extract depth values and find their range
        var depthValues: [Float] = []
        depthValues.reserveCapacity(width * height)
        var minDepth: Float = .infinity
        var maxDepth: Float = -.infinity

        switch pixelFormatType {
        case kCVPixelFormatType_DepthFloat32, kCVPixelFormatType_DisparityFloat32:
            let floatBuffer = baseAddress.assumingMemoryBound(to: Float32.self)
            for y in 0..<height {
                for x in 0..<width {
                    let offset = y * (bytesPerRow / MemoryLayout<Float32>.stride) + x
                    let value = floatBuffer[offset]
                    if !value.isNaN && !value.isInfinite {
                        depthValues.append(value)
                        // Ignore non-positive values when establishing near/far planes,
                        // since RangeInverse uses 1/depth.
                        if value > 0 {
                            minDepth = min(minDepth, value)
                            maxDepth = max(maxDepth, value)
                        }
                    }
                }
            }

        case kCVPixelFormatType_DepthFloat16, kCVPixelFormatType_DisparityFloat16:
            let float16Buffer = baseAddress.assumingMemoryBound(to: Float16.self)
            for y in 0..<height {
                for x in 0..<width {
                    let offset = y * (bytesPerRow / MemoryLayout<Float16>.stride) + x
                    let value = Float(float16Buffer[offset])
                    if !value.isNaN && !value.isInfinite {
                        depthValues.append(value)
                        // Ignore non-positive values when establishing near/far planes,
                        // since RangeInverse uses 1/depth.
                        if value > 0 {
                            minDepth = min(minDepth, value)
                            maxDepth = max(maxDepth, value)
                        }
                    }
                }
            }

        default:
            return nil
        }

        // Create grayscale image from normalized depth data
        guard !depthValues.isEmpty else { return nil }

        // If we never saw any positive finite values, near/far planes are not usable.
        if !minDepth.isFinite || !maxDepth.isFinite || minDepth <= 0 || maxDepth <= 0 {
            minDepth = 0
            maxDepth = 0
        }

        let depthRange = maxDepth - minDepth
        var pixelData = [UInt8]()
        pixelData.reserveCapacity(width * height)

        switch pixelFormatType {
        case kCVPixelFormatType_DepthFloat32, kCVPixelFormatType_DisparityFloat32:
            let floatBuffer = baseAddress.assumingMemoryBound(to: Float32.self)
            for y in 0..<height {
                for x in 0..<width {
                    let offset = y * (bytesPerRow / MemoryLayout<Float32>.stride) + x
                    let value = floatBuffer[offset]
                    if value.isNaN || value.isInfinite || value <= 0 {
                        pixelData.append(0)
                        continue
                    }

                    // RangeInverse: normalize in inverse-depth space (1/z), so nearer pixels are brighter.
                    let normalized: Float
                    if depthRange > 0, minDepth > 0, maxDepth > 0 {
                        let inv = 1.0 / value
                        let invNear = 1.0 / minDepth
                        let invFar = 1.0 / maxDepth
                        let invRange = invNear - invFar

                        if inv.isFinite, invNear.isFinite, invFar.isFinite, invRange != 0 {
                            normalized = (inv - invFar) / invRange
                        } else {
                            normalized = 0
                        }
                    } else {
                        normalized = 0
                    }

                    if !normalized.isFinite {
                        pixelData.append(0)
                    } else {
                        let clamped = max(0, min(1, normalized))
                        pixelData.append(UInt8(max(0, min(255, clamped * 255))))
                    }
                }
            }

        case kCVPixelFormatType_DepthFloat16, kCVPixelFormatType_DisparityFloat16:
            let float16Buffer = baseAddress.assumingMemoryBound(to: Float16.self)
            for y in 0..<height {
                for x in 0..<width {
                    let offset = y * (bytesPerRow / MemoryLayout<Float16>.stride) + x
                    let value = Float(float16Buffer[offset])
                    if value.isNaN || value.isInfinite || value <= 0 {
                        pixelData.append(0)
                        continue
                    }

                    // RangeInverse: normalize in inverse-depth space (1/z), so nearer pixels are brighter.
                    let normalized: Float
                    if depthRange > 0, minDepth > 0, maxDepth > 0 {
                        let inv = 1.0 / value
                        let invNear = 1.0 / minDepth
                        let invFar = 1.0 / maxDepth
                        let invRange = invNear - invFar

                        if inv.isFinite, invNear.isFinite, invFar.isFinite, invRange != 0 {
                            normalized = (inv - invFar) / invRange
                        } else {
                            normalized = 0
                        }
                    } else {
                        normalized = 0
                    }

                    if !normalized.isFinite {
                        pixelData.append(0)
                    } else {
                        let clamped = max(0, min(1, normalized))
                        pixelData.append(UInt8(max(0, min(255, clamped * 255))))
                    }
                }
            }

        default:
            return nil
        }

        // Create CGImage from pixel data
        guard
            let provider = CGDataProvider(
                data: NSData(bytes: pixelData, length: pixelData.count))
        else {
            return nil
        }

        let colorSpace = CGColorSpaceCreateDeviceGray()
        guard
            let cgImage = CGImage(
                width: width,
                height: height,
                bitsPerComponent: 8,
                bitsPerPixel: 8,
                bytesPerRow: width,
                space: colorSpace,
                bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.none.rawValue),
                provider: provider,
                decode: nil,
                shouldInterpolate: false,
                intent: .defaultIntent
            )
        else {
            return nil
        }

        return UIImage(cgImage: cgImage)
    }

}
