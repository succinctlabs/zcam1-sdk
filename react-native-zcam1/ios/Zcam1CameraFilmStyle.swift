//
//  Zcam1CameraFilmStyle.swift
//  react-native-zcam1-sdk
//
//  Camera film style presets using Harbeth for real-time preview and capture.
//

import Harbeth
import UIKit

/// Camera film style presets.
public enum Zcam1CameraFilmStyle: String, CaseIterable {
    case normal
    case mellow
    case bw
    case nostalgic

    /// Initialize from a string (case-insensitive).
    init(from string: String?) {
        switch string?.lowercased() {
        case "mellow":
            self = .mellow
        case "bw":
            self = .bw
        case "nostalgic":
            self = .nostalgic
        default:
            self = .normal
        }
    }

    // MARK: - Custom Film Style Recipe Parser

    /// Parse a film style recipe from JavaScript into Harbeth effects.
    /// Each effect dictionary should have a "type" key and either a "value" or "config" key.
    static func createFilmStyles(from recipe: [[String: Any]]) -> [C7FilterProtocol] {
        var filmStyles: [C7FilterProtocol] = []

        for effect in recipe {
            guard let type = effect["type"] as? String else { continue }

            switch type {
            case "whiteBalance":
                if let config = effect["config"] as? [String: Any],
                   let temp = config["temperature"] as? Float {
                    let tint = config["tint"] as? Float ?? 0
                    filmStyles.append(C7WhiteBalance(temperature: temp, tint: tint))
                }
            case "saturation":
                if let value = effect["value"] as? Float {
                    filmStyles.append(C7Saturation(saturation: value))
                }
            case "contrast":
                if let value = effect["value"] as? Float {
                    filmStyles.append(C7Contrast(contrast: value))
                }
            case "brightness":
                if let value = effect["value"] as? Float {
                    filmStyles.append(C7Brightness(brightness: value))
                }
            case "hue":
                if let value = effect["value"] as? Float {
                    filmStyles.append(C7Hue(hue: value))
                }
            case "vibrance":
                if let value = effect["value"] as? Float {
                    filmStyles.append(C7Vibrance(vibrance: value))
                }
            case "highlightShadow":
                if let config = effect["config"] as? [String: Any],
                   let highlights = config["highlights"] as? Float,
                   let shadows = config["shadows"] as? Float {
                    filmStyles.append(C7HighlightShadow(highlights: highlights, shadows: shadows))
                }
            case "monochrome":
                if let config = effect["config"] as? [String: Any],
                   let intensity = config["intensity"] as? Float {
                    var color = C7Color.zero
                    if let colorConfig = config["color"] as? [String: Any],
                       let r = colorConfig["r"] as? CGFloat,
                       let g = colorConfig["g"] as? CGFloat,
                       let b = colorConfig["b"] as? CGFloat {
                        color = C7Color(red: r, green: g, blue: b, alpha: 1.0)
                    }
                    filmStyles.append(C7Monochrome(intensity: intensity, color: color))
                }
            default:
                print("[Zcam1CameraFilmStyle] Unknown effect type: \(type)")
            }
        }

        return filmStyles
    }

    /// Apply an array of film style effects to a UIImage.
    static func apply(filmStyles: [C7FilterProtocol], to image: UIImage) -> UIImage {
        guard !filmStyles.isEmpty else {
            return image
        }

        var result = image
        for effect in filmStyles {
            do {
                result = try result.make(filter: effect)
            } catch {
                print("[Zcam1CameraFilmStyle] Failed to apply film style effect: \(error)")
            }
        }
        return result
    }

    // MARK: - Pixel Buffer Filtering for Video Recording

    /// Shared CIContext for efficient pixel buffer rendering.
    private static let ciContext: CIContext = {
        // Use Metal for GPU-accelerated rendering.
        if let device = MTLCreateSystemDefaultDevice() {
            return CIContext(mtlDevice: device, options: [.cacheIntermediates: false])
        }
        return CIContext(options: [.useSoftwareRenderer: false])
    }()

    /// Apply an array of film style effects to a CVPixelBuffer.
    /// Returns a new filtered pixel buffer, or nil if filtering fails.
    /// Used for applying film styles to video frames during recording.
    static func apply(
        filmStyles: [C7FilterProtocol],
        to pixelBuffer: CVPixelBuffer,
        orientation: UIImage.Orientation
    ) -> CVPixelBuffer? {
        guard !filmStyles.isEmpty else {
            return nil
        }

        // Convert pixel buffer to CIImage.
        let ciImage = CIImage(cvPixelBuffer: pixelBuffer)

        // Create CGImage from CIImage.
        guard let cgImage = ciContext.createCGImage(ciImage, from: ciImage.extent) else {
            print("[Zcam1CameraFilmStyle] Failed to create CGImage from pixel buffer")
            return nil
        }

        // Create UIImage with correct orientation and apply filters.
        var image = UIImage(cgImage: cgImage, scale: 1.0, orientation: orientation)
        for effect in filmStyles {
            do {
                image = try image.make(filter: effect)
            } catch {
                print("[Zcam1CameraFilmStyle] Failed to apply film style effect: \(error)")
            }
        }

        // Convert filtered UIImage back to pixel buffer.
        guard let filteredCGImage = image.cgImage else {
            print("[Zcam1CameraFilmStyle] Failed to get CGImage from filtered UIImage")
            return nil
        }

        // Create a new pixel buffer with the same dimensions as the original.
        let width = CVPixelBufferGetWidth(pixelBuffer)
        let height = CVPixelBufferGetHeight(pixelBuffer)

        var newPixelBuffer: CVPixelBuffer?
        let attributes: [String: Any] = [
            kCVPixelBufferCGImageCompatibilityKey as String: true,
            kCVPixelBufferCGBitmapContextCompatibilityKey as String: true,
            kCVPixelBufferIOSurfacePropertiesKey as String: [:],
        ]

        let status = CVPixelBufferCreate(
            kCFAllocatorDefault,
            width,
            height,
            kCVPixelFormatType_32BGRA,
            attributes as CFDictionary,
            &newPixelBuffer
        )

        guard status == kCVReturnSuccess, let outputBuffer = newPixelBuffer else {
            print("[Zcam1CameraFilmStyle] Failed to create output pixel buffer: \(status)")
            return nil
        }

        // Render the filtered CIImage to the new pixel buffer.
        let filteredCIImage = CIImage(cgImage: filteredCGImage)
        ciContext.render(filteredCIImage, to: outputBuffer)

        return outputBuffer
    }

    // MARK: - CIFilter-based Pipeline (GPU-only, for preview rendering)

    /// Create CIFilter equivalents from a JavaScript film style recipe.
    /// Used for GPU-only preview rendering without CPU readback.
    /// Results are visually approximate to Harbeth — exact film styles are applied via Harbeth during capture.
    static func createCIFilters(from recipe: [[String: Any]]) -> [CIFilter] {
        var filters: [CIFilter] = []

        // Collect color controls into a single CIColorControls filter for efficiency.
        var saturation: Float?
        var contrast: Float?
        var brightness: Float?

        for effect in recipe {
            guard let type = effect["type"] as? String else { continue }

            switch type {
            case "whiteBalance":
                if let config = effect["config"] as? [String: Any],
                   let temp = config["temperature"] as? Float {
                    let tint = config["tint"] as? Float ?? 0
                    if let filter = CIFilter(name: "CITemperatureAndTint") {
                        filter.setValue(CIVector(x: 6500, y: 0), forKey: "inputNeutral")
                        filter.setValue(
                            CIVector(x: CGFloat(6500 + temp * 100), y: CGFloat(tint * 100)),
                            forKey: "inputTargetNeutral"
                        )
                        filters.append(filter)
                    }
                }
            case "saturation":
                saturation = effect["value"] as? Float
            case "contrast":
                contrast = effect["value"] as? Float
            case "brightness":
                brightness = effect["value"] as? Float
            case "hue":
                if let value = effect["value"] as? Float {
                    if let filter = CIFilter(name: "CIHueAdjust") {
                        // Harbeth uses degrees, CIFilter uses radians.
                        filter.setValue(NSNumber(value: value * .pi / 180.0), forKey: "inputAngle")
                        filters.append(filter)
                    }
                }
            case "vibrance":
                if let value = effect["value"] as? Float {
                    if let filter = CIFilter(name: "CIVibrance") {
                        filter.setValue(NSNumber(value: value), forKey: "inputAmount")
                        filters.append(filter)
                    }
                }
            case "highlightShadow":
                if let config = effect["config"] as? [String: Any],
                   let highlights = config["highlights"] as? Float,
                   let shadows = config["shadows"] as? Float {
                    if let filter = CIFilter(name: "CIHighlightShadowAdjust") {
                        filter.setValue(NSNumber(value: highlights), forKey: "inputHighlightAmount")
                        filter.setValue(NSNumber(value: shadows), forKey: "inputShadowAmount")
                        filters.append(filter)
                    }
                }
            case "monochrome":
                if let config = effect["config"] as? [String: Any],
                   let intensity = config["intensity"] as? Float {
                    if let filter = CIFilter(name: "CIColorMonochrome") {
                        filter.setValue(NSNumber(value: intensity), forKey: "inputIntensity")
                        if let colorConfig = config["color"] as? [String: Any],
                           let r = colorConfig["r"] as? CGFloat,
                           let g = colorConfig["g"] as? CGFloat,
                           let b = colorConfig["b"] as? CGFloat {
                            filter.setValue(CIColor(red: r, green: g, blue: b), forKey: "inputColor")
                        }
                        filters.append(filter)
                    }
                }
            default:
                break
            }
        }

        // Combine saturation, contrast, and brightness into one CIColorControls filter.
        if saturation != nil || contrast != nil || brightness != nil {
            if let filter = CIFilter(name: "CIColorControls") {
                if let s = saturation { filter.setValue(NSNumber(value: s), forKey: "inputSaturation") }
                if let c = contrast { filter.setValue(NSNumber(value: c), forKey: "inputContrast") }
                if let b = brightness { filter.setValue(NSNumber(value: b), forKey: "inputBrightness") }
                // Insert at start so color controls are applied before other effects.
                filters.insert(filter, at: 0)
            }
        }

        return filters
    }

    /// Apply an array of CIFilters to a CIImage. All processing stays on GPU (lazy evaluation).
    static func applyCIFilters(_ filters: [CIFilter], to image: CIImage) -> CIImage {
        var result = image
        for filter in filters {
            filter.setValue(result, forKey: kCIInputImageKey)
            if let output = filter.outputImage {
                result = output
            }
        }
        return result
    }
}
