//
//  Zcam1CameraFilter.swift
//  react-native-zcam1-sdk
//
//  Camera filter presets using Harbeth filters for real-time preview and capture.
//

import Harbeth
import UIKit

/// Camera filter presets.
public enum Zcam1CameraFilter: String, CaseIterable {
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

    /// Returns an array of Harbeth filters to apply for this preset.
    func createFilters() -> [C7FilterProtocol] {
        switch self {
        case .normal:
            return []
        case .mellow:
            // Negative Film Gold style - warm, saturated, lifted shadows.
            return [
                C7WhiteBalance(temperature: 6900, tint: 40),
                C7Saturation(saturation: 1.4),
                C7Contrast(contrast: 0.8),
                C7HighlightShadow(highlights: 0.0, shadows: 0.4),
                C7Brightness(brightness: -0.1),
            ]
        case .bw:
            // Contrasty B&W with warm tint.
            return [
                C7Monochrome(intensity: 1.0, color: C7Color(red: 0.6, green: 0.55, blue: 0.5, alpha: 1.0)),
                C7Contrast(contrast: 1.2),
                C7Brightness(brightness: -0.1),
            ]
        case .nostalgic:
            // Kodak Magenta Chrome - warm amber, faded, lifted shadows, bright.
            // Based on Ricoh GR III recipe: CTE + A:12, Sat+1, Contrast-3, Highlight-4, Shadow+4, HighKey+3
            return [
                C7WhiteBalance(temperature: 7000, tint: 0),
                C7Saturation(saturation: 1.1),
                C7Contrast(contrast: 0.7),
                C7HighlightShadow(highlights: -0.4, shadows: 0.5),
                C7Brightness(brightness: 0.15),
            ]
        }
    }

    // MARK: - Custom Filter Recipe Parser

    /// Parse a filter recipe from JavaScript into Harbeth filters.
    /// Each effect dictionary should have a "type" key and either a "value" or "config" key.
    static func createFilters(from recipe: [[String: Any]]) -> [C7FilterProtocol] {
        var filters: [C7FilterProtocol] = []

        for effect in recipe {
            guard let type = effect["type"] as? String else { continue }

            switch type {
            case "whiteBalance":
                if let config = effect["config"] as? [String: Any],
                   let temp = config["temperature"] as? Float {
                    let tint = config["tint"] as? Float ?? 0
                    filters.append(C7WhiteBalance(temperature: temp, tint: tint))
                }
            case "saturation":
                if let value = effect["value"] as? Float {
                    filters.append(C7Saturation(saturation: value))
                }
            case "contrast":
                if let value = effect["value"] as? Float {
                    filters.append(C7Contrast(contrast: value))
                }
            case "brightness":
                if let value = effect["value"] as? Float {
                    filters.append(C7Brightness(brightness: value))
                }
            case "hue":
                if let value = effect["value"] as? Float {
                    filters.append(C7Hue(hue: value))
                }
            case "vibrance":
                if let value = effect["value"] as? Float {
                    filters.append(C7Vibrance(vibrance: value))
                }
            case "highlightShadow":
                if let config = effect["config"] as? [String: Any],
                   let highlights = config["highlights"] as? Float,
                   let shadows = config["shadows"] as? Float {
                    filters.append(C7HighlightShadow(highlights: highlights, shadows: shadows))
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
                    filters.append(C7Monochrome(intensity: intensity, color: color))
                }
            default:
                print("[Zcam1CameraFilter] Unknown filter type: \(type)")
            }
        }

        return filters
    }

    /// Apply an array of custom filters to a UIImage.
    static func apply(filters: [C7FilterProtocol], to image: UIImage) -> UIImage {
        guard !filters.isEmpty else {
            return image
        }

        var result = image
        for filter in filters {
            do {
                result = try result.make(filter: filter)
            } catch {
                print("[Zcam1CameraFilter] Failed to apply custom filter: \(error)")
            }
        }
        return result
    }

    /// Apply this filter preset to a UIImage and return the filtered result.
    func apply(to image: UIImage) -> UIImage {
        guard self != .normal else {
            return image
        }

        let filters = createFilters()
        guard !filters.isEmpty else {
            print("[Zcam1CameraFilter] No filters to apply for \(self)")
            return image
        }

        var result = image
        for filter in filters {
            do {
                result = try result.make(filter: filter)
            } catch {
                print("[Zcam1CameraFilter] Failed to apply filter: \(error)")
            }
        }
        return result
    }

    /// Apply this filter preset to image data and return filtered JPEG data.
    func apply(toData data: Data, compressionQuality: CGFloat = 0.9) -> Data? {
        guard self != .normal else {
            return data
        }

        guard let inputImage = UIImage(data: data) else {
            return data
        }

        let filteredImage = apply(to: inputImage)
        return filteredImage.jpegData(compressionQuality: compressionQuality)
    }
}
