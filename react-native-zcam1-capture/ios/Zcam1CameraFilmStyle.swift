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
}
