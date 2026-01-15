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
    case mono
    case noir
    case warm
    case cool

    /// Initialize from a string (case-insensitive).
    init(from string: String?) {
        switch string?.lowercased() {
        case "vivid":
            self = .vivid
        case "mono":
            self = .mono
        case "noir":
            self = .noir
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
            // Enhanced saturation and contrast boost (increased for visibility).
            return [
                C7Saturation(saturation: 1.8),
                C7Contrast(contrast: 1.3),
            ]
        case .mono:
            // Classic black & white.
            return [C7Monochrome()]
        case .noir:
            // High-contrast black & white.
            return [
                C7Monochrome(),
                C7Contrast(contrast: 1.6),
            ]
        case .warm:
            // Warmer color temperature (more extreme for visibility).
            return [C7WhiteBalance(temperature: 4000)]
        case .cool:
            // Cooler color temperature (more extreme for visibility).
            return [C7WhiteBalance(temperature: 9000)]
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
