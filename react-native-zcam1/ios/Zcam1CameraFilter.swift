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
    case vivid
    case warm
    case cool

    /// Initialize from a string (case-insensitive).
    init(from string: String?) {
        switch string?.lowercased() {
        case "vivid":
            self = .vivid
        case "warm":
            self = .warm
        case "cool":
            self = .cool
        default:
            self = .normal
        }
    }

    /// Returns an array of Harbeth filters to apply for this preset.
    func createFilters() -> [C7FilterProtocol] {
        switch self {
        case .normal:
            return []
        case .vivid:
            // Enhanced saturation and vibrance without color shift.
            return [
                C7Saturation(saturation: 1.5),
                C7Contrast(contrast: 1.15),
                C7Vibrance(vibrance: 0.3),
            ]
        case .warm:
            // Warmer tones - higher temperature adds orange/yellow warmth.
            return [
                C7WhiteBalance(temperature: 8000),
                C7Saturation(saturation: 1.1),
            ]
        case .cool:
            // Cooler tones - lower temperature adds blue coolness.
            return [
                C7WhiteBalance(temperature: 3500),
                C7Saturation(saturation: 1.05),
            ]
        }
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
