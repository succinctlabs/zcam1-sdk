//
//  Zcam1Camera.swift
//  react-native-zcam1-sdk
//
//  Native camera view + service using AVFoundation for preview and capture.
//

import AVFoundation
import CoreMotion
import Foundation
import Harbeth
import ImageIO
import MobileCoreServices
import UIKit

// MARK: - Motion Manager (Singleton for orientation detection)

/// Singleton motion manager that provides non-blocking 4-way orientation detection.
/// Uses accelerometer data with a 0.75g threshold (same approach as Signal-iOS)
/// to determine portrait, portraitUpsideDown, landscapeLeft, and landscapeRight.
/// Works even when the user has iOS orientation lock enabled.
@available(iOS 16.0, *)
final class Zcam1MotionManager {
    static let shared = Zcam1MotionManager()

    private let motionManager = CMMotionManager()
    private let queue = OperationQueue()
    private var cachedOrientation: AVCaptureVideoOrientation = .portrait
    private let lock = NSLock()

    /// Listeners notified on orientation change (called on main thread), keyed by token.
    private var listeners: [Int: (AVCaptureVideoOrientation) -> Void] = [:]
    private var nextToken: Int = 0

    private init() {
        queue.name = "com.zcam1.motion"
        queue.maxConcurrentOperationCount = 1
    }

    /// Start accelerometer updates. Call when camera becomes active.
    func startUpdates() {
        guard motionManager.isAccelerometerAvailable else { return }
        guard !motionManager.isAccelerometerActive else { return }

        // 5 Hz is sufficient for orientation detection (same as Signal).
        motionManager.accelerometerUpdateInterval = 0.2
        motionManager.startAccelerometerUpdates(to: queue) { [weak self] data, _ in
            guard let self = self, let data = data else { return }

            // Use 0.75g threshold with deadzone to prevent jitter at 45 degrees.
            // When neither axis exceeds the threshold, keep the current orientation.
            let x = data.acceleration.x
            let y = data.acceleration.y

            let newOrientation: AVCaptureVideoOrientation?
            if x >= 0.75 {
                newOrientation = .landscapeLeft
            } else if x <= -0.75 {
                newOrientation = .landscapeRight
            } else if y <= -0.75 {
                newOrientation = .portrait
            } else if y >= 0.75 {
                newOrientation = .portraitUpsideDown
            } else {
                // Ambiguous angle (e.g. 45 degrees) — keep current orientation.
                newOrientation = nil
            }

            guard let newOrientation = newOrientation else { return }

            self.lock.lock()
            let changed = newOrientation != self.cachedOrientation
            if changed {
                self.cachedOrientation = newOrientation
            }
            let currentListeners = Array(self.listeners.values)
            self.lock.unlock()

            // Notify listeners on main thread when orientation changes.
            if changed {
                DispatchQueue.main.async {
                    for listener in currentListeners {
                        listener(newOrientation)
                    }
                }
            }
        }
    }

    /// Stop accelerometer updates. Call when camera becomes inactive.
    func stopUpdates() {
        motionManager.stopAccelerometerUpdates()
    }

    /// Get the current orientation as AVCaptureVideoOrientation (non-blocking, cached).
    func currentOrientation() -> AVCaptureVideoOrientation {
        lock.lock()
        let orientation = cachedOrientation
        lock.unlock()
        return orientation
    }

    /// Add a listener for orientation changes. Returns a token to remove it later.
    func addListener(_ listener: @escaping (AVCaptureVideoOrientation) -> Void) -> Int {
        lock.lock()
        let token = nextToken
        nextToken += 1
        listeners[token] = listener
        lock.unlock()
        return token
    }

    /// Remove a specific listener by its token.
    func removeListener(_ token: Int) {
        lock.lock()
        listeners.removeValue(forKey: token)
        lock.unlock()
    }
}

// MARK: - Capture Format

@objc public enum Zcam1CaptureFormat: Int {
    case jpeg = 0
    case dng = 1

    init(from string: String?) {
        switch string?.lowercased() {
        case "dng", "raw":
            self = .dng
        default:
            self = .jpeg
        }
    }

    var fileExtension: String {
        switch self {
        case .jpeg:
            return "jpg"
        case .dng:
            return "dng"
        }
    }

    var formatString: String {
        switch self {
        case .jpeg:
            return "jpeg"
        case .dng:
            return "dng"
        }
    }
}

// MARK: - Aspect Ratio

@objc public enum Zcam1AspectRatio: Int {
    case ratio4_3 = 0
    case ratio16_9 = 1
    case ratio1_1 = 2

    init(from string: String?) {
        switch string {
        case "16:9": self = .ratio16_9
        case "1:1": self = .ratio1_1
        default: self = .ratio4_3
        }
    }

    /// Returns the aspect ratio as width/height (portrait orientation)
    var value: CGFloat {
        switch self {
        case .ratio4_3: return 3.0 / 4.0   // Portrait: taller than wide
        case .ratio16_9: return 9.0 / 16.0 // Portrait: taller than wide
        case .ratio1_1: return 1.0
        }
    }

    var formatString: String {
        switch self {
        case .ratio4_3: return "4:3"
        case .ratio16_9: return "16:9"
        case .ratio1_1: return "1:1"
        }
    }
}

// MARK: - Orientation

@objc public enum Zcam1Orientation: Int {
    case auto = 0
    case portrait = 1
    case landscape = 2

    init(from string: String?) {
        switch string?.lowercased() {
        case "portrait": self = .portrait
        case "landscape": self = .landscape
        default: self = .auto
        }
    }

    /// Resolve to a concrete AVCaptureVideoOrientation using accelerometer data.
    /// Works even when the user has iOS orientation lock enabled.
    @available(iOS 16.0, *)
    func resolveToVideoOrientation() -> AVCaptureVideoOrientation {
        switch self {
        case .portrait:
            return .portrait
        case .landscape:
            // Auto-detect left/right from accelerometer.
            let detected = Zcam1MotionManager.shared.currentOrientation()
            if detected == .landscapeLeft || detected == .landscapeRight {
                return detected
            }
            // Default to landscapeRight if not currently in landscape.
            return .landscapeRight
        case .auto:
            return Zcam1MotionManager.shared.currentOrientation()
        }
    }
}

// MARK: - Orientation Helpers

/// Convert AVCaptureVideoOrientation to a JS-friendly string.
@available(iOS 16.0, *)
func orientationToString(_ orientation: AVCaptureVideoOrientation) -> String {
    switch orientation {
    case .portrait: return "portrait"
    case .portraitUpsideDown: return "portraitUpsideDown"
    case .landscapeLeft: return "landscapeLeft"
    case .landscapeRight: return "landscapeRight"
    @unknown default: return "portrait"
    }
}

/// Convert AVCaptureVideoOrientation to a rotation angle for the video writer transform.
/// Front camera requires different rotations due to mirroring and opposite sensor orientation.
@available(iOS 16.0, *)
func videoWriterRotationAngle(
    for orientation: AVCaptureVideoOrientation,
    position: AVCaptureDevice.Position = .back
) -> CGFloat {
    if position == .front {
        // Front camera: sensor is landscape-left + video is mirrored.
        switch orientation {
        case .portrait: return -.pi / 2             // 90° CCW (opposite of back)
        case .portraitUpsideDown: return .pi / 2    // 90° CW (opposite of back)
        case .landscapeRight: return .pi            // 180° (opposite of back)
        case .landscapeLeft: return 0               // No rotation (opposite of back)
        @unknown default: return -.pi / 2
        }
    } else {
        // Back camera: sensor is landscape-right.
        switch orientation {
        case .portrait: return .pi / 2              // 90° CW
        case .portraitUpsideDown: return -.pi / 2   // 90° CCW
        case .landscapeRight: return 0              // No rotation (sensor native)
        case .landscapeLeft: return .pi             // 180°
        @unknown default: return .pi / 2
        }
    }
}

// MARK: - Camera Delegate

/// Internal helper that acts as the AVCapturePhotoCaptureDelegate.
/// This keeps AVFoundation protocol types out of the @objc-visible service API.
@available(iOS 16.0, *)
private final class PhotoCaptureDelegate: NSObject, AVCapturePhotoCaptureDelegate {
    private let format: Zcam1CaptureFormat
    private let aspectRatio: Zcam1AspectRatio
    private let orientation: Zcam1Orientation
    private let includeDepthData: Bool
    private let skipPostProcessing: Bool
    // Store completion as a mutable optional so we can nil it after calling (prevents double-call).
    private var completion: ((NSDictionary?, NSError?) -> Void)?
    private weak var owner: Zcam1CameraService?
    // Keep a strong self-reference until completion is called to prevent premature deallocation.
    private var retainedSelf: PhotoCaptureDelegate?

    init(
        format: Zcam1CaptureFormat,
        aspectRatio: Zcam1AspectRatio,
        orientation: Zcam1Orientation,
        includeDepthData: Bool,
        skipPostProcessing: Bool = false,
        owner: Zcam1CameraService,
        completion: @escaping (NSDictionary?, NSError?) -> Void
    ) {
        self.format = format
        self.aspectRatio = aspectRatio
        self.orientation = orientation
        self.includeDepthData = includeDepthData
        self.skipPostProcessing = skipPostProcessing
        self.owner = owner
        self.completion = completion
        super.init()
        // Retain self until completion is called.
        self.retainedSelf = self
    }

    /// Safely call completion exactly once, then release all references.
    private func callCompletion(result: NSDictionary?, error: NSError?) {
        // Ensure we only call completion once.
        guard let completion = self.completion else {
            print("[PhotoCaptureDelegate] WARNING: completion already called, skipping")
            return
        }
        // Nil out completion before calling to prevent re-entry.
        self.completion = nil

        print(
            "[PhotoCaptureDelegate] calling completion, result=\(result != nil), error=\(error != nil)"
        )
        completion(result, error)

        // Clean up owner reference.
        self.owner?.didFinishCapture(delegate: self)
        // Release self-reference.
        self.retainedSelf = nil
    }

    func photoOutput(
        _ output: AVCapturePhotoOutput,
        didFinishProcessingPhoto photo: AVCapturePhoto,
        error: Error?
    ) {
        print("[PhotoCaptureDelegate] didFinishProcessingPhoto called")
        if let error = error as NSError? {
            print("[PhotoCaptureDelegate] ERROR: \(error)")
            DispatchQueue.main.async { [self] in
                self.callCompletion(result: nil, error: error)
            }
            return
        }

        print("[PhotoCaptureDelegate] getting fileDataRepresentation...")
        guard let photoData = photo.fileDataRepresentation(), !photoData.isEmpty else {
            print("[PhotoCaptureDelegate] ERROR: Empty photo data")
            let err = NSError(
                domain: "Zcam1CameraService",
                code: -20,
                userInfo: [NSLocalizedDescriptionKey: "Empty photo data"]
            )
            DispatchQueue.main.async { [self] in
                self.callCompletion(result: nil, error: err)
            }
            return
        }
        print("[PhotoCaptureDelegate] photo data size: \(photoData.count) bytes")

        // Log actual captured dimensions for debugging resolution issues.
        if let cgImageSource = CGImageSourceCreateWithData(photoData as CFData, nil),
           let properties = CGImageSourceCopyPropertiesAtIndex(cgImageSource, 0, nil) as? [String: Any] {
            let width = properties[kCGImagePropertyPixelWidth as String] ?? "?"
            let height = properties[kCGImagePropertyPixelHeight as String] ?? "?"
            print("[PhotoCaptureDelegate] captured photo dimensions: \(width)x\(height)")
        }

        // Copy values we need immediately.
        print("[PhotoCaptureDelegate] extracting metadata...")
        let metadataSnapshot: [String: Any] = photo.metadata
        print(
            "[PhotoCaptureDelegate] extracting depthData (includeDepthData=\(includeDepthData))...")
        let depthDataSnapshot: AVDepthData? = includeDepthData ? photo.depthData : nil
        print("[PhotoCaptureDelegate] depthData present: \(depthDataSnapshot != nil)")

        // Process synchronously on the current queue to avoid closure capture issues.
        // The AVCapturePhotoOutput callback queue can handle this work.
        print("[PhotoCaptureDelegate] processing photo...")
        var data = photoData

        // Apply crop + film style in a single pass (avoids double JPEG compression, preserves EXIF).
        // Skip post-processing if requested (returns raw sensor output).
        if skipPostProcessing {
            print("[PhotoCaptureDelegate] skipPostProcessing=true, returning raw JPEG data")
        } else {
            print("[PhotoCaptureDelegate] applying crop and film style...")
            if let owner = self.owner,
               let processedData = owner.processImage(
                   data,
                   metadata: metadataSnapshot,
                   aspectRatio: self.aspectRatio
               ) {
                data = processedData
            }
        }
        print("[PhotoCaptureDelegate] processing complete, data size: \(data.count)")

        // Re-extract metadata from processed data to get accurate dimensions.
        var finalMetadata: [String: Any] = metadataSnapshot
        if let cgImageSource = CGImageSourceCreateWithData(data as CFData, nil),
           let properties = CGImageSourceCopyPropertiesAtIndex(cgImageSource, 0, nil) as? [String: Any] {
            finalMetadata = properties
            print("[PhotoCaptureDelegate] re-extracted metadata, dimensions: \(properties[kCGImagePropertyPixelWidth as String] ?? "?")x\(properties[kCGImagePropertyPixelHeight as String] ?? "?")")
        }

        let filename = "zcam1-\(UUID().uuidString).\(self.format.fileExtension)"
        let tmpURL = FileManager.default.temporaryDirectory.appendingPathComponent(filename)
        print("[PhotoCaptureDelegate] writing to: \(tmpURL.path)")

        do {
            try data.write(to: tmpURL, options: [.atomic])
            print("[PhotoCaptureDelegate] file written successfully")

            var metadata: [String: Any] = finalMetadata
            print("[PhotoCaptureDelegate] processing metadata...")

            // Extract TIFF dictionary (device info, resolution).
            if let tiffDict = metadata[kCGImagePropertyTIFFDictionary as String]
                as? [String: Any]
            {
                metadata["{TIFF}"] = tiffDict
            }

            // Extract EXIF dictionary (ISO, exposure, focal length, aperture).
            if let exifDict = metadata[kCGImagePropertyExifDictionary as String]
                as? [String: Any]
            {
                metadata["{Exif}"] = exifDict
            }
            print("[PhotoCaptureDelegate] metadata processed")

            // Extract depth data only when requested (and when available).
            var depthData: [String: Any]? = nil
            if self.includeDepthData, let depthDataSnapshot = depthDataSnapshot {
                print("[PhotoCaptureDelegate] processing depth data...")
                depthData = Zcam1DepthDataProcessor.processDepthData(depthDataSnapshot)
                print("[PhotoCaptureDelegate] depth data processed")
            }

            var result: [String: Any] = [
                "filePath": tmpURL.path,
                "format": self.format.formatString,
                "metadata": metadata,
            ]

            // Include depth data in result if requested and available.
            if self.includeDepthData, let depthData = depthData {
                result["depthData"] = depthData
            }

            print("[PhotoCaptureDelegate] calling completion on main thread...")
            DispatchQueue.main.async { [self] in
                self.callCompletion(result: result as NSDictionary, error: nil)
            }
        } catch {
            print("[PhotoCaptureDelegate] ERROR writing file: \(error)")
            DispatchQueue.main.async { [self] in
                self.callCompletion(result: nil, error: error as NSError)
            }
        }
    }
}

// MARK: - Asset Writer Recording State

/// Holds state for AVAssetWriter-based video recording.
/// Using AVAssetWriter instead of AVCaptureMovieFileOutput eliminates preview flash
/// when starting/stopping recording, since we manually write frames without session reconfiguration.
///
/// Thread safety: All writer operations (startSession, append, markAsFinished, finishWriting)
/// are serialized through the writerQueue to prevent race conditions.
@available(iOS 16.0, *)
private final class AssetWriterRecordingState {
    let assetWriter: AVAssetWriter
    let videoInput: AVAssetWriterInput
    let audioInput: AVAssetWriterInput?
    let pixelBufferAdaptor: AVAssetWriterInputPixelBufferAdaptor
    let outputURL: URL

    /// Serial queue for all writer operations to prevent race conditions.
    let writerQueue = DispatchQueue(label: "com.zcam1.assetwriter", qos: .userInitiated)

    /// Whether recording is active. Only modified on writerQueue.
    var isRecording: Bool = false

    /// Whether startSession has been called. Only modified on writerQueue.
    var hasStartedSession: Bool = false

    /// Timestamp of first frame. Only modified on writerQueue.
    var startTime: CMTime = .invalid

    /// Frame/sample counters for debugging. Only modified on writerQueue.
    var videoFrameCount: Int = 0
    var audioSampleCount: Int = 0

    init(
        assetWriter: AVAssetWriter,
        videoInput: AVAssetWriterInput,
        audioInput: AVAssetWriterInput?,
        pixelBufferAdaptor: AVAssetWriterInputPixelBufferAdaptor,
        outputURL: URL
    ) {
        self.assetWriter = assetWriter
        self.videoInput = videoInput
        self.audioInput = audioInput
        self.pixelBufferAdaptor = pixelBufferAdaptor
        self.outputURL = outputURL
    }
}

// MARK: - Camera Service

/// Shared service that owns the AVCaptureSession and performs still captures.
///
/// It is designed to be driven from the JS side via the TurboModule method
/// `takeNativePhoto`, and from a native preview view (see `Zcam1CameraView`).
@available(iOS 16.0, *)
@objcMembers
public final class Zcam1CameraService: NSObject, AVCaptureAudioDataOutputSampleBufferDelegate {

    // Singleton instance (easy to access from ObjC / Swift bridge)
    public static let shared = Zcam1CameraService()

    // Underlying capture session and IO
    public private(set) var captureSession: AVCaptureSession?
    private var videoInput: AVCaptureDeviceInput?
    private var audioInput: AVCaptureDeviceInput?

    private let photoOutput = AVCapturePhotoOutput()

    // Audio data output for recording. Only attached when mic is authorized.
    private let audioDataOutput = AVCaptureAudioDataOutput()
    private let audioDataQueue = DispatchQueue(label: "com.zcam1.audiodataoutput", qos: .userInteractive)

    // Depth delivery can incur a noticeable one-time setup cost (first capture).
    // We prewarm it once per session configuration to avoid first-shot lag.
    private var didPrewarmDepth: Bool = false

    // Whether depth data delivery is enabled at the session/output level.
    // When true, zoom may be restricted on dual-camera devices.
    private var depthEnabledAtSessionLevel: Bool = false

    // Serial queue for all session operations
    private let sessionQueue = DispatchQueue(label: "com.anonymous.zcam1poc.camera.session")

    // Keep strong references to in-flight delegates so they live until completion
    private var inFlightDelegates: [PhotoCaptureDelegate] = []

    // AVAssetWriter-based video recording state.
    // Using AVAssetWriter eliminates preview flash since we manually write frames
    // without any AVCaptureSession reconfiguration.
    // Thread safety: recordingStateLock guards the reference; writerQueue guards internal mutations.
    private var recordingState: AssetWriterRecordingState?
    private let recordingStateLock = NSLock()

    /// Returns true if video recording is currently active.
    /// Thread-safe: uses recordingStateLock to protect access.
    public var isVideoRecording: Bool {
        recordingStateLock.lock()
        let recording = recordingState?.isRecording ?? false
        recordingStateLock.unlock()
        return recording
    }

    // Auto-stop support: a cancellable work item that fires when maxDurationSeconds is reached.
    // When it fires, it calls stopVideoRecording and caches the result so that a subsequent
    // JS-side stopVideoRecording call can retrieve it without an error.
    private var autoStopWorkItem: DispatchWorkItem?
    private var autoStopResult: NSDictionary?

    // Camera control state
    private var currentZoom: CGFloat = 1.0
    private var flashMode: AVCaptureDevice.FlashMode = .off
    private var currentExposureBias: Float = 0.0
    private var currentPosition: AVCaptureDevice.Position = .back

    // Film style state
    private var currentFilmStyle: Zcam1CameraFilmStyle = .normal
    private var customFilmStyleChain: [C7FilterProtocol]?

    private override init() {
        super.init()
    }

    /// Best-effort prewarm for depth capture to avoid first-shot lag.
    /// This primes the system's depth pipeline (and related ISP work) ahead of the first user capture.
    /// Only runs if depth is enabled at the session level.
    private func prewarmDepthPipelineIfNeeded() {
        // Skip prewarm if depth is not enabled at the session level.
        guard depthEnabledAtSessionLevel else { return }

        // Only prewarm once the session is running; otherwise the work may still be deferred
        // and the first real capture can pay the cost.
        guard let session = captureSession, session.isRunning else { return }

        guard !didPrewarmDepth else { return }
        didPrewarmDepth = true

        guard photoOutput.isDepthDataDeliverySupported else { return }

        // Depth is already enabled at the output level in configureSessionIfNeeded().
        // Just prepare the settings to prime the ISP.

        let settings: AVCapturePhotoSettings
        if photoOutput.availablePhotoCodecTypes.contains(.jpeg) {
            settings = AVCapturePhotoSettings(format: [
                AVVideoCodecKey: AVVideoCodecType.jpeg
            ])
        } else {
            settings = AVCapturePhotoSettings()
        }

        settings.isDepthDataDeliveryEnabled = true
        if photoOutput.isCameraCalibrationDataDeliverySupported {
            settings.isCameraCalibrationDataDeliveryEnabled = true
        }

        if #available(iOS 13.0, *) {
            settings.photoQualityPrioritization = .speed
        }

        photoOutput.setPreparedPhotoSettingsArray([settings]) { prepared, error in
            if let error = error {
                print("[Zcam1CameraService] Depth prewarm failed: \(error)")
                return
            }
            print("[Zcam1CameraService] Depth prewarm prepared=\(prepared)")
        }
    }

    // MARK: - Film Style

    /// Set the active camera film style for preview and capture.
    /// Clears any custom film style chain.
    public func setFilmStyle(_ filmStyle: Zcam1CameraFilmStyle) {
        self.currentFilmStyle = filmStyle
        self.customFilmStyleChain = nil
    }

    /// Set a custom film style chain for preview and capture.
    /// Overrides the built-in preset film style.
    public func setCustomFilmStyles(_ filmStyles: [C7FilterProtocol]) {
        self.customFilmStyleChain = filmStyles.isEmpty ? nil : filmStyles
    }

    /// Get the current film style.
    public func getFilmStyle() -> Zcam1CameraFilmStyle {
        return currentFilmStyle
    }

    /// Check if custom film styles are active.
    public func hasCustomFilmStyles() -> Bool {
        return customFilmStyleChain != nil
    }

    /// Get the current camera position.
    public func getCurrentPosition() -> AVCaptureDevice.Position {
        return currentPosition
    }

    /// Process image data with crop and film style. iOS handles orientation via EXIF metadata.
    /// - Parameters:
    ///   - data: The original JPEG image data
    ///   - metadata: The original photo metadata (EXIF, TIFF, GPS, etc.)
    ///   - aspectRatio: The target aspect ratio
    ///   - compressionQuality: JPEG compression quality (0.0-1.0, default 0.95)
    /// - Returns: Processed JPEG data with metadata, or the original data if no processing needed
    func processImage(
        _ data: Data,
        metadata: [String: Any],
        aspectRatio: Zcam1AspectRatio,
        compressionQuality: CGFloat = 0.95
    ) -> Data? {
        let needsFilmStyle = customFilmStyleChain != nil

        guard let image = UIImage(data: data),
              let cgImage = image.cgImage else { return data }

        // Calculate if cropping is needed.
        // The sensor buffer is always landscape (width > height) regardless of capture orientation.
        // EXIF orientation handles the final display rotation (portrait vs landscape).
        // So we always crop in landscape pixel space using the inverted portrait ratio.
        let pixelWidth = CGFloat(cgImage.width)
        let pixelHeight = CGFloat(cgImage.height)
        let sourceRatio = pixelWidth / pixelHeight
        let targetRatio = 1.0 / aspectRatio.value
        let needsCrop = abs(sourceRatio - targetRatio) > 0.01

        // If no processing needed, return original
        guard needsCrop || needsFilmStyle else { return data }

        var processedCGImage: CGImage = cgImage

        // Apply crop if needed (simple center crop)
        if needsCrop {
            if let croppedImage = cropCGImage(cgImage, targetRatio: targetRatio) {
                processedCGImage = croppedImage
            }
        }

        // Apply film style if needed, preserving original EXIF orientation.
        // Harbeth's make(filter:) calls flattened() which bakes UIImage orientation into the
        // pixel data and returns .up. This corrupts the EXIF orientation metadata (e.g., a
        // portrait photo would get EXIF 1 "Up" instead of EXIF 6 "Right"). To prevent this,
        // we pass the CGImage with .up orientation so flattened() is a no-op, then restore
        // the original orientation afterward. Film style effects are purely color-space
        // operations and do not depend on pixel orientation.
        let originalOrientation = image.imageOrientation
        var finalImage = UIImage(cgImage: processedCGImage, scale: image.scale, orientation: originalOrientation)
        if let customFilmStyles = customFilmStyleChain {
            let upImage = UIImage(cgImage: processedCGImage, scale: image.scale, orientation: .up)
            let filtered = Zcam1CameraFilmStyle.apply(filmStyles: customFilmStyles, to: upImage)
            if let filteredCG = filtered.cgImage {
                finalImage = UIImage(cgImage: filteredCG, scale: image.scale, orientation: originalOrientation)
            }
        }

        return encodeJPEGWithMetadata(finalImage, metadata: metadata, compressionQuality: compressionQuality)
    }

    /// Crop a CGImage to the specified aspect ratio using center crop.
    /// - Parameters:
    ///   - cgImage: The source image to crop
    ///   - targetRatio: The target width/height ratio (already adjusted for EXIF orientation)
    private func cropCGImage(_ cgImage: CGImage, targetRatio: CGFloat) -> CGImage? {
        let pixelW = CGFloat(cgImage.width)
        let pixelH = CGFloat(cgImage.height)
        let currentRatio = pixelW / pixelH

        var cropRect: CGRect
        if currentRatio > targetRatio {
            let newWidth = pixelH * targetRatio
            let xOffset = (pixelW - newWidth) / 2
            cropRect = CGRect(x: xOffset, y: 0, width: newWidth, height: pixelH)
        } else {
            let newHeight = pixelW / targetRatio
            let yOffset = (pixelH - newHeight) / 2
            cropRect = CGRect(x: 0, y: yOffset, width: pixelW, height: newHeight)
        }

        return cgImage.cropping(to: cropRect)
    }

    /// Encode a UIImage to JPEG data with metadata preservation using ImageIO.
    private func encodeJPEGWithMetadata(
        _ image: UIImage,
        metadata: [String: Any],
        compressionQuality: CGFloat
    ) -> Data? {
        guard let cgImage = image.cgImage else { return nil }

        let data = NSMutableData()
        guard let destination = CGImageDestinationCreateWithData(
            data as CFMutableData,
            kUTTypeJPEG,
            1,
            nil
        ) else { return nil }

        // Prepare metadata with updated dimensions and orientation.
        var updatedMetadata = metadata

        // Update EXIF dimensions to match the processed image.
        if var exifDict = updatedMetadata[kCGImagePropertyExifDictionary as String] as? [String: Any] {
            exifDict[kCGImagePropertyExifPixelXDimension as String] = cgImage.width
            exifDict[kCGImagePropertyExifPixelYDimension as String] = cgImage.height
            updatedMetadata[kCGImagePropertyExifDictionary as String] = exifDict
        }

        // Set the image orientation in metadata.
        updatedMetadata[kCGImagePropertyOrientation as String] = cgImageOrientationFromUIImageOrientation(image.imageOrientation)

        // Set compression quality.
        updatedMetadata[kCGImageDestinationLossyCompressionQuality as String] = compressionQuality

        CGImageDestinationAddImage(destination, cgImage, updatedMetadata as CFDictionary)

        guard CGImageDestinationFinalize(destination) else { return nil }

        return data as Data
    }

    /// Convert UIImage.Orientation to CGImagePropertyOrientation value.
    private func cgImageOrientationFromUIImageOrientation(_ orientation: UIImage.Orientation) -> Int {
        switch orientation {
        case .up: return 1
        case .upMirrored: return 2
        case .down: return 3
        case .downMirrored: return 4
        case .leftMirrored: return 5
        case .right: return 6
        case .rightMirrored: return 7
        case .left: return 8
        @unknown default: return 1
        }
    }

    // MARK: - Video Data Output for Film Style Preview

    /// Configure and add a video data output to the session for film style preview.
    /// Must be called to get video frames for applying film styles in real-time.
    /// - Parameters:
    ///   - delegate: The sample buffer delegate to receive video frames.
    ///   - callbackQueue: The queue for delegate callbacks.
    ///   - completion: Called on main thread with the output if successful, nil if failed.
    public func configureVideoDataOutput(
        delegate: AVCaptureVideoDataOutputSampleBufferDelegate,
        callbackQueue: DispatchQueue,
        completion: @escaping (AVCaptureVideoDataOutput?) -> Void
    ) {
        sessionQueue.async { [weak self] in
            guard let self = self, let session = self.captureSession else {
                print("[Zcam1CameraService] configureVideoDataOutput: no session")
                DispatchQueue.main.async { completion(nil) }
                return
            }

            print(
                "[Zcam1CameraService] configureVideoDataOutput: session.isRunning=\(session.isRunning), preset=\(session.sessionPreset.rawValue)"
            )

            // Check if we already have a video data output.
            for output in session.outputs {
                if let existingOutput = output as? AVCaptureVideoDataOutput {
                    print(
                        "[Zcam1CameraService] configureVideoDataOutput: already have video data output, updating delegate and connection"
                    )
                    existingOutput.setSampleBufferDelegate(delegate, queue: callbackQueue)

                    // Reconfigure the connection for the current camera position.
                    if let connection = existingOutput.connection(with: .video) {
                        session.beginConfiguration()
                        // Mirror front camera for natural selfie view.
                        if connection.isVideoMirroringSupported {
                            connection.isVideoMirrored = (self.currentPosition == .front)
                        }
                        session.commitConfiguration()
                        print(
                            "[Zcam1CameraService] configureVideoDataOutput: reconfigured connection for position=\(self.currentPosition == .front ? "front" : "back"), mirrored=\(connection.isVideoMirrored)"
                        )
                    }

                    DispatchQueue.main.async { completion(existingOutput) }
                    return
                }
            }

            let output = AVCaptureVideoDataOutput()
            output.alwaysDiscardsLateVideoFrames = true
            output.videoSettings = [
                kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA
            ]

            // Set delegate BEFORE adding to session to not miss any frames.
            output.setSampleBufferDelegate(delegate, queue: callbackQueue)
            print(
                "[Zcam1CameraService] configureVideoDataOutput: delegate set on queue \(callbackQueue.label)"
            )

            session.beginConfiguration()

            // Try to add the output.
            if session.canAddOutput(output) {
                session.addOutput(output)
                print(
                    "[Zcam1CameraService] configureVideoDataOutput: added output successfully, total outputs=\(session.outputs.count)"
                )

                // Configure the connection.
                if let connection = output.connection(with: .video) {
                    connection.isEnabled = true
                    // Mirror front camera for natural selfie view.
                    if connection.isVideoMirroringSupported {
                        connection.isVideoMirrored = (self.currentPosition == .front)
                    }
                    print(
                        "[Zcam1CameraService] configureVideoDataOutput: connection configured, isActive=\(connection.isActive), isEnabled=\(connection.isEnabled), mirrored=\(connection.isVideoMirrored)"
                    )
                } else {
                    print(
                        "[Zcam1CameraService] configureVideoDataOutput: WARNING - no video connection found!"
                    )
                }

                session.commitConfiguration()
                print(
                    "[Zcam1CameraService] configureVideoDataOutput: committed configuration, session.isRunning=\(session.isRunning)"
                )
                DispatchQueue.main.async { completion(output) }
            } else {
                print(
                    "[Zcam1CameraService] configureVideoDataOutput: canAddOutput returned false, preset=\(session.sessionPreset.rawValue)"
                )
                session.commitConfiguration()
                DispatchQueue.main.async { completion(nil) }
            }
        }
    }

    /// Remove a video data output from the session.
    public func removeVideoDataOutput(_ output: AVCaptureVideoDataOutput) {
        sessionQueue.async { [weak self] in
            guard let self = self, let session = self.captureSession else { return }
            session.beginConfiguration()
            session.removeOutput(output)
            session.commitConfiguration()
            print(
                "[Zcam1CameraService] removeVideoDataOutput: removed output, total outputs=\(session.outputs.count)"
            )
        }
    }

    // MARK: - Permissions

    public func ensureCameraAuthorization(completion: @escaping (Bool) -> Void) {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            completion(true)
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { granted in
                DispatchQueue.main.async {
                    completion(granted)
                }
            }
        default:
            completion(false)
        }
    }

    public func ensureMicrophoneAuthorization(completion: @escaping (Bool) -> Void) {
        switch AVCaptureDevice.authorizationStatus(for: .audio) {
        case .authorized:
            completion(true)
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .audio) { granted in
                DispatchQueue.main.async {
                    completion(granted)
                }
            }
        default:
            completion(false)
        }
    }

    // MARK: - Session Setup

    private func device(for position: AVCaptureDevice.Position) -> AVCaptureDevice? {
        #if targetEnvironment(simulator)
            // Simulator doesn't have camera hardware.
            // We'll handle this case specially in takePhoto() to return a test image.
            return nil
        #else
            // Prefer virtual devices that combine multiple cameras for seamless zoom.
            // Order matters - first available is used.
            let deviceTypes: [AVCaptureDevice.DeviceType] = [
                .builtInTripleCamera,  // Ultra-wide + Wide + Telephoto (back)
                .builtInDualWideCamera,  // Ultra-wide + Wide (back)
                .builtInDualCamera,  // Wide + Telephoto (back)
                .builtInTrueDepthCamera,  // TrueDepth with depth support (front)
                .builtInWideAngleCamera,  // Wide only (fallback)
            ]

            let discoverySession = AVCaptureDevice.DiscoverySession(
                deviceTypes: deviceTypes,
                mediaType: .video,
                position: position
            )

            // Return the first available device (most capable virtual device).
            if let device = discoverySession.devices.first {
                return device
            }

            // Fallback to any video device.
            return AVCaptureDevice.default(for: .video)
        #endif
    }

    /// Configure virtual device lens switching for smooth zoom transitions.
    /// This enables seamless switching between ultra-wide, wide, and telephoto lenses.
    private func configureVirtualDeviceSwitching(_ device: AVCaptureDevice) {
        // Only configure for virtual devices that support lens switching.
        let deviceType = device.deviceType
        let isVirtualDevice =
            deviceType == .builtInTripleCamera || deviceType == .builtInDualWideCamera
            || deviceType == .builtInDualCamera

        guard isVirtualDevice else {
            print(
                "[Zcam1CameraService] Device is not a virtual device, skipping switching configuration"
            )
            return
        }

        do {
            try device.lockForConfiguration()

            // Enable automatic lens switching for smooth zoom transitions.
            // .auto allows the device to automatically switch between constituent cameras
            // based on zoom factor, providing seamless transitions.
            device.setPrimaryConstituentDeviceSwitchingBehavior(
                .auto, restrictedSwitchingBehaviorConditions: [])

            print(
                "[Zcam1CameraService] Configured virtual device switching: \(deviceType.rawValue), behavior: auto"
            )

            device.unlockForConfiguration()
        } catch {
            print("[Zcam1CameraService] Failed to configure virtual device switching: \(error)")
        }
    }

    /// Configure the capture session if needed (or reconfigure if the position or depth setting changed).
    /// - Parameters:
    ///   - position: The camera position (front or back).
    ///   - depthEnabled: Whether to enable depth data delivery at the session level.
    ///     When true, depth data can be captured but zoom may be restricted on dual-camera devices.
    ///     When false (default), full zoom range is available.
    @nonobjc public func configureSessionIfNeeded(
        position: AVCaptureDevice.Position,
        depthEnabled: Bool = false,
        completion: @escaping (Error?) -> Void
    ) {
        sessionQueue.async {
            // Early return if session is already configured correctly for the requested position and depth setting.
            if let session = self.captureSession,
                let currentInput = self.videoInput,
                currentInput.device.position == position,
                session.outputs.contains(self.photoOutput),
                session.sessionPreset == .high,
                self.depthEnabledAtSessionLevel == depthEnabled
            {
                DispatchQueue.main.async {
                    completion(nil)
                }
                return
            }

            do {
                let session = self.captureSession ?? AVCaptureSession()
                session.beginConfiguration()
                self.didPrewarmDepth = false
                // Use .high preset to support both photo and video capture.
                // This avoids session reconfiguration when starting video recording,
                // which would cause dark initial frames while ISP adjusts.
                session.sessionPreset = .high

                // Remove existing input if position changed
                if let currentInput = self.videoInput,
                    currentInput.device.position != position
                {
                    session.removeInput(currentInput)
                    self.videoInput = nil
                }

                // Add input if missing
                if self.videoInput == nil {
                    guard let device = self.device(for: position) else {
                        throw NSError(
                            domain: "Zcam1CameraService",
                            code: -1,
                            userInfo: [NSLocalizedDescriptionKey: "No suitable camera device found"]
                        )
                    }

                    // Configure smooth lens switching for virtual devices (dual/triple camera).
                    // This enables seamless zoom transitions between ultra-wide, wide, and telephoto lenses.
                    self.configureVirtualDeviceSwitching(device)

                    let input = try AVCaptureDeviceInput(device: device)
                    if session.canAddInput(input) {
                        session.addInput(input)
                        self.videoInput = input
                        self.currentPosition = position
                    } else {
                        throw NSError(
                            domain: "Zcam1CameraService",
                            code: -2,
                            userInfo: [
                                NSLocalizedDescriptionKey: "Cannot add camera input to session"
                            ]
                        )
                    }
                }

                // Add photo output if needed.
                if !session.outputs.contains(self.photoOutput) {
                    if session.canAddOutput(self.photoOutput) {
                        session.addOutput(self.photoOutput)
                    } else {
                        throw NSError(
                            domain: "Zcam1CameraService",
                            code: -3,
                            userInfo: [
                                NSLocalizedDescriptionKey: "Cannot add photo output to session"
                            ]
                        )
                    }
                }

                // Audio input/output setup is deferred until recording starts.
                // This avoids triggering microphone permission prompts during camera preview.
                // See setupAudioForRecording() which is called when recording begins.

                // Configure photo output for maximum resolution.
                // This is critical because we use .high session preset for video preview,
                // but still want full-resolution photos (12MP instead of 2MP).
                if let device = self.videoInput?.device {
                    // Find the highest resolution format available for photos.
                    let maxDimensions = device.activeFormat.supportedMaxPhotoDimensions
                        .max { ($0.width * $0.height) < ($1.width * $1.height) }

                    if let maxDim = maxDimensions {
                        self.photoOutput.maxPhotoDimensions = maxDim
                        print("[Zcam1CameraService] Photo output configured for max dimensions: \(maxDim.width)x\(maxDim.height)")
                    }
                }

                // Depth delivery setup:
                // - Enable at the output level based on the depthEnabled parameter.
                // - When enabled, prewarm the pipeline via setPreparedPhotoSettingsArray.
                // - Note: Enabling depth restricts zoom on dual-camera devices.
                if self.photoOutput.isDepthDataDeliverySupported {
                    self.photoOutput.isDepthDataDeliveryEnabled = depthEnabled
                    self.depthEnabledAtSessionLevel = depthEnabled
                } else {
                    self.depthEnabledAtSessionLevel = false
                }

                // Camera calibration data delivery is configured per-capture on AVCapturePhotoSettings.
                // AVCapturePhotoOutput does not expose a calibration delivery toggle on all iOS versions.

                session.commitConfiguration()
                self.captureSession = session

                // Prewarm depth pipeline (best-effort).
                self.prewarmDepthPipelineIfNeeded()

                DispatchQueue.main.async {
                    completion(nil)
                }
            } catch {
                DispatchQueue.main.async {
                    completion(error)
                }
            }
        }
    }

    // MARK: - Session Control

    public func startRunning() {
        // Start motion manager for orientation detection (non-blocking).
        Zcam1MotionManager.shared.startUpdates()

        sessionQueue.async {
            guard let session = self.captureSession else { return }
            if !session.isRunning {
                session.startRunning()
            }

            // Trigger depth prewarm right after the session is (or becomes) running
            // to avoid first-shot lag on depth-enabled captures.
            self.prewarmDepthPipelineIfNeeded()

            // Prewarm audio if mic permission is already granted to avoid shutter on first recording.
            self.prewarmAudioIfAuthorized()
        }
    }

    public func stopRunning() {
        // Stop motion manager when camera is inactive.
        Zcam1MotionManager.shared.stopUpdates()

        sessionQueue.async {
            guard let session = self.captureSession, session.isRunning else { return }
            session.stopRunning()
        }
    }

    // MARK: - Camera Controls

    /// Set zoom factor using the device's actual range.
    /// For virtual devices with ultra-wide, 1.0 is ultra-wide (0.5x user-facing),
    /// 2.0 is wide-angle (1x user-facing), etc.
    /// - Parameter factor: Device zoom factor (use getMinZoom/getMaxZoom for valid range)
    public func setZoom(_ factor: CGFloat) {
        sessionQueue.async {
            guard let device = self.videoInput?.device else { return }
            do {
                try device.lockForConfiguration()
                let minZoom = device.minAvailableVideoZoomFactor
                let maxZoom = min(device.maxAvailableVideoZoomFactor, 20.0)
                let clampedZoom = min(max(factor, minZoom), maxZoom)
                device.videoZoomFactor = clampedZoom
                self.currentZoom = clampedZoom

                // Log active physical camera for debugging lens switching.
                if let activeCamera = device.activePrimaryConstituent {
                    print(
                        "[Zcam1] Zoom: \(clampedZoom), active lens: \(activeCamera.deviceType.rawValue)"
                    )
                }

                device.unlockForConfiguration()
            } catch {
                print("[Zcam1] Failed to set zoom: \(error)")
            }
        }
    }

    /// Get the minimum supported zoom factor.
    /// For virtual devices with ultra-wide, this is 1.0 (corresponds to 0.5x user-facing).
    public func getMinZoom() -> CGFloat {
        guard let device = videoInput?.device else { return 1.0 }
        return device.minAvailableVideoZoomFactor
    }

    /// Get the maximum supported zoom factor (capped at 15x for UX).
    public func getMaxZoom() -> CGFloat {
        guard let device = videoInput?.device else { return 1.0 }
        return min(device.maxAvailableVideoZoomFactor, 20.0)
    }

    /// Get the zoom factors where the device switches between physical lenses.
    /// Returns empty array for single-camera devices.
    /// For triple camera: typically [2.0, 6.0] meaning:
    /// - Below 2.0: ultra-wide lens (0.5x-1x user-facing)
    /// - At 2.0: switches FROM ultra-wide TO wide lens (1x user-facing)
    /// - At 6.0: switches FROM wide TO telephoto lens (3x user-facing)
    public func getSwitchOverZoomFactors() -> [NSNumber] {
        guard let device = videoInput?.device else { return [] }
        return device.virtualDeviceSwitchOverVideoZoomFactors.map { $0 }
    }

    /// Check if the current device has an ultra-wide camera.
    /// This is true for builtInTripleCamera and builtInDualWideCamera.
    /// This is false for builtInDualCamera (Wide + Telephoto) and builtInWideAngleCamera.
    public func hasUltraWideCamera() -> Bool {
        guard let device = videoInput?.device else { return false }
        let deviceType = device.deviceType
        // builtInTripleCamera = Ultra-wide + Wide + Telephoto
        // builtInDualWideCamera = Ultra-wide + Wide
        // builtInDualCamera = Wide + Telephoto (NO ultra-wide)
        // builtInWideAngleCamera = Wide only (NO ultra-wide)
        return deviceType == .builtInTripleCamera || deviceType == .builtInDualWideCamera
    }

    /// Get diagnostic info about the current camera device for debugging.
    /// Returns a dictionary with device type, supported zoom range, and switching behavior.
    public func getDeviceDiagnostics() -> [String: Any] {
        guard let device = videoInput?.device else {
            return ["error": "No device configured"]
        }

        let deviceType = device.deviceType.rawValue
        let minZoom = device.minAvailableVideoZoomFactor
        let maxZoom = device.maxAvailableVideoZoomFactor
        let switchOverFactors = device.virtualDeviceSwitchOverVideoZoomFactors.map {
            $0.doubleValue
        }
        let currentZoom = device.videoZoomFactor
        let switchingBehavior = device.activePrimaryConstituentDeviceSwitchingBehavior.rawValue

        return [
            "deviceType": deviceType,
            "minZoom": minZoom,
            "maxZoom": maxZoom,
            "currentZoom": currentZoom,
            "switchOverFactors": switchOverFactors,
            "switchingBehavior": switchingBehavior,
            "isVirtualDevice": !switchOverFactors.isEmpty,
        ]
    }

    // MARK: - Depth Detection Methods

    /// Check if the current camera device supports depth data capture.
    /// Returns true for dual/triple rear cameras and TrueDepth front camera.
    /// Returns false for single rear cameras (iPhone SE, 16e, Air).
    public func isDepthSupported() -> Bool {
        return photoOutput.isDepthDataDeliverySupported
    }

    /// Check if enabling depth would restrict zoom on this device.
    /// Returns true if zoom is limited to discrete levels (min == max in all ranges).
    /// This typically happens on dual-camera devices (iPhone 12-16 base).
    /// Returns false for triple-camera devices (Pro) and TrueDepth front cameras.
    public func hasDepthZoomLimitations() -> Bool {
        guard let device = videoInput?.device,
              photoOutput.isDepthDataDeliverySupported else { return false }

        let format = device.activeFormat  // activeFormat is NOT optional.

        // Use supportedVideoZoomRangesForDepthDataDelivery (iOS 17.2+).
        // Returns [ClosedRange<CGFloat>] - use .lowerBound/.upperBound.
        // If all ranges have min == max, zoom is restricted to discrete levels.
        if #available(iOS 17.2, *) {
            let ranges = format.supportedVideoZoomRangesForDepthDataDelivery
            if ranges.isEmpty { return false }

            // Check if ALL ranges are discrete (min == max).
            let allDiscrete = ranges.allSatisfy { $0.lowerBound == $0.upperBound }
            return allDiscrete
        }

        // Pre-iOS 17.2: assume limitations for dual camera devices.
        return device.deviceType == .builtInDualCamera ||
               device.deviceType == .builtInDualWideCamera
    }

    /// Get zoom ranges supported when depth data delivery is enabled.
    /// Returns array of [min, max] pairs. If min == max, it's a discrete level.
    /// Empty array means no depth support or no zoom restrictions.
    public func getDepthSupportedZoomRanges() -> [[Double]] {
        guard let device = videoInput?.device,
              photoOutput.isDepthDataDeliverySupported else { return [] }

        let format = device.activeFormat  // activeFormat is NOT optional.

        if #available(iOS 17.2, *) {
            // supportedVideoZoomRangesForDepthDataDelivery returns [ClosedRange<CGFloat>].
            return format.supportedVideoZoomRangesForDepthDataDelivery.map {
                [Double($0.lowerBound), Double($0.upperBound)]
            }
        }
        return []
    }

    /// Set torch mode (continuous flashlight during preview).
    /// - Parameter enabled: Whether torch should be on.
    public func setTorch(_ enabled: Bool) {
        sessionQueue.async {
            guard let device = self.videoInput?.device else { return }
            guard device.hasTorch && device.isTorchAvailable else { return }
            do {
                try device.lockForConfiguration()
                device.torchMode = enabled ? .on : .off
                device.unlockForConfiguration()
            } catch {
                print("[Zcam1] Failed to set torch: \(error)")
            }
        }
    }

    /// Set flash mode for the next capture.
    /// - Parameter mode: "off", "on", or "auto".
    public func setFlashMode(_ mode: String) {
        switch mode.lowercased() {
        case "on":
            flashMode = .on
        case "auto":
            flashMode = .auto
        default:
            flashMode = .off
        }
    }

    /// Focus at a specific point in the preview.
    /// - Parameter point: Normalized coordinates (0-1, 0-1) where (0,0) is top-left.
    public func focusAtPoint(_ point: CGPoint) {
        sessionQueue.async {
            guard let device = self.videoInput?.device else { return }
            guard device.isFocusPointOfInterestSupported else { return }
            do {
                try device.lockForConfiguration()
                device.focusPointOfInterest = point
                device.focusMode = .autoFocus

                // Also set exposure point if supported.
                if device.isExposurePointOfInterestSupported {
                    device.exposurePointOfInterest = point
                    device.exposureMode = .autoExpose
                }

                device.unlockForConfiguration()
            } catch {
                print("[Zcam1] Failed to focus: \(error)")
            }
        }
    }

    /// Set exposure compensation.
    /// - Parameter bias: Exposure bias in EV units (typically -2.0 to +2.0).
    public func setExposureCompensation(_ bias: Float) {
        sessionQueue.async {
            guard let device = self.videoInput?.device else { return }
            do {
                try device.lockForConfiguration()
                let minBias = device.minExposureTargetBias
                let maxBias = device.maxExposureTargetBias
                let clampedBias = min(max(bias, minBias), maxBias)
                device.setExposureTargetBias(clampedBias, completionHandler: nil)
                self.currentExposureBias = clampedBias
                device.unlockForConfiguration()
            } catch {
                print("[Zcam1] Failed to set exposure: \(error)")
            }
        }
    }

    /// Called by PhotoCaptureDelegate when a capture has fully completed so we can
    /// release the strong reference and avoid memory leaks.
    fileprivate func didFinishCapture(delegate: PhotoCaptureDelegate) {
        if let index = inFlightDelegates.firstIndex(where: { $0 === delegate }) {
            inFlightDelegates.remove(at: index)
        }
    }

    // MARK: - Simulator Test Image

    /// Creates a simple test image for simulator testing.
    /// Returns a UIImage with a colored background and test text.
    private func createTestImage() -> UIImage {
        let size = CGSize(width: 1920, height: 1080)
        let renderer = UIGraphicsImageRenderer(size: size)

        return renderer.image { context in
            // Random gradient background with consistent tint (same hue).
            let hue = CGFloat.random(in: 0.0...1.0)
            let saturation = CGFloat.random(in: 0.55...0.9)
            let brightness1 = CGFloat.random(in: 0.5...0.75)
            let brightness2 = min(brightness1 + CGFloat.random(in: 0.15...0.35), 1.0)

            let color1 = UIColor(
                hue: hue, saturation: saturation, brightness: brightness1, alpha: 1.0)
            let color2 = UIColor(
                hue: hue, saturation: saturation, brightness: brightness2, alpha: 1.0)
            let colors = [color1.cgColor, color2.cgColor]
            let gradient = CGGradient(
                colorsSpace: CGColorSpaceCreateDeviceRGB(),
                colors: colors as CFArray,
                locations: [0.0, 1.0])!
            context.cgContext.drawLinearGradient(
                gradient,
                start: .zero,
                end: CGPoint(x: size.width, y: size.height),
                options: [])

            // Add test text.
            let now = Date()
            let dateFormatter = DateFormatter()
            dateFormatter.dateFormat = "yyyy-MM-dd\nHH:mm:ss"
            let dateTimeString = dateFormatter.string(from: now)

            let dateAttributes: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 88, weight: .semibold),
                .foregroundColor: UIColor.white.withAlphaComponent(0.9),
            ]
            let dateTextSize = dateTimeString.size(withAttributes: dateAttributes)
            let dateTextRect = CGRect(
                x: (size.width - dateTextSize.width) / 2,
                y: (size.height - dateTextSize.height) / 2 + 90,
                width: dateTextSize.width,
                height: dateTextSize.height
            )
            dateTimeString.draw(in: dateTextRect, withAttributes: dateAttributes)
            let text = "SIMULATOR TEST IMAGE"
            let attributes: [NSAttributedString.Key: Any] = [
                .font: UIFont.boldSystemFont(ofSize: 72),
                .foregroundColor: UIColor.white,
            ]
            let textSize = text.size(withAttributes: attributes)
            let textRect = CGRect(
                x: (size.width - textSize.width) / 2,
                y: (size.height - textSize.height) / 2 - 90,
                width: textSize.width,
                height: textSize.height)
            text.draw(in: textRect, withAttributes: attributes)
        }
    }

    // MARK: - Public Capture API (Objective-C-friendly)

    /// High-level capture API used from ObjC / React Native bridge.
    ///
    /// - Parameters:
    ///   - positionString: "front" or "back" (defaults to back).
    ///   - formatString: "jpeg" or "dng" (defaults to jpeg).
    ///   - completion: Called with a dictionary `{ filePath, format, metadata, depthData? }` or an error.
    public func takePhoto(
        positionString: String?,
        formatString: String?,
        completion: @escaping (NSDictionary?, NSError?) -> Void
    ) {
        self.takePhoto(
            positionString: positionString,
            formatString: formatString,
            includeDepthData: true,
            aspectRatio: nil,
            orientation: nil,
            completion: completion
        )
    }

    public func takePhoto(
        positionString: String?,
        formatString: String?,
        includeDepthData: Bool,
        aspectRatio: String?,
        orientation: String?,
        skipPostProcessing: Bool = false,
        completion: @escaping (NSDictionary?, NSError?) -> Void
    ) {
        let aspectRatioEnum = Zcam1AspectRatio(from: aspectRatio)
        let orientationEnum = Zcam1Orientation(from: orientation)
        print("[Zcam1CameraService] takePhoto START - position=\(positionString ?? "nil"), format=\(formatString ?? "nil"), includeDepthData=\(includeDepthData), skipPostProcessing=\(skipPostProcessing)")
        #if targetEnvironment(simulator)
            // Simulator mode: create and return a test image.
            let format = Zcam1CaptureFormat(from: formatString)
            let testImage = createTestImage()

            guard let jpegData = testImage.jpegData(compressionQuality: 0.9) else {
                let err = NSError(
                    domain: "Zcam1CameraService",
                    code: -30,
                    userInfo: [NSLocalizedDescriptionKey: "Failed to create test image data"]
                )
                completion(nil, err)
                return
            }

            let filename = "zcam1-simulator-\(UUID().uuidString).\(format.fileExtension)"
            let tmpURL = FileManager.default.temporaryDirectory.appendingPathComponent(filename)

            do {
                try jpegData.write(to: tmpURL, options: [.atomic])

                // Create mock metadata similar to what a real camera would provide.
                let now = Date()
                let dateFormatter = DateFormatter()
                dateFormatter.dateFormat = "yyyy:MM:dd HH:mm:ss"
                let dateString = dateFormatter.string(from: now)

                let metadata: [String: Any] = [
                    "{Exif}": [
                        "ISOSpeedRatings": [],
                        "PixelXDimension": 1920,
                        "PixelYDimension": 1080,
                        "ExposureTime": 0,
                        "FNumber": 1,
                        "FocalLength": 5,
                    ],
                    "{TIFF}": [
                        "DateTime": dateString,
                        "Model": "iPhone Simulator",
                        "Software": "iOS Simulator",
                    ],
                    "Orientation": 6,
                ]

                let result: [String: Any] = [
                    "filePath": tmpURL.path,
                    "format": format.formatString,
                    "metadata": metadata,
                ]

                DispatchQueue.main.async {
                    completion(result as NSDictionary, nil)
                }
            } catch {
                DispatchQueue.main.async {
                    completion(nil, error as NSError)
                }
            }
            return
        #endif
        print("[Zcam1CameraService] takePhoto: checking camera authorization...")
        ensureCameraAuthorization { authorized in
            print("[Zcam1CameraService] takePhoto: authorized=\(authorized)")
            guard authorized else {
                let err = NSError(
                    domain: "Zcam1CameraService",
                    code: -10,
                    userInfo: [NSLocalizedDescriptionKey: "Camera access not authorized"]
                )
                completion(nil, err)
                return
            }

            let position: AVCaptureDevice.Position
            switch positionString?.lowercased() {
            case "front":
                position = .front
            default:
                position = .back
            }

            let format = Zcam1CaptureFormat(from: formatString)
            print(
                "[Zcam1CameraService] takePhoto: configuring session for position=\(position.rawValue), format=\(format), depthEnabled=\(self.depthEnabledAtSessionLevel)"
            )

            self.configureSessionIfNeeded(position: position, depthEnabled: self.depthEnabledAtSessionLevel) { error in
                print(
                    "[Zcam1CameraService] takePhoto: configureSessionIfNeeded completed, error=\(String(describing: error))"
                )
                if let error = error {
                    completion(nil, error as NSError)
                    return
                }

                self.sessionQueue.async {
                    print(
                        "[Zcam1CameraService] takePhoto: on sessionQueue, checking captureSession..."
                    )
                    guard let session = self.captureSession else {
                        let err = NSError(
                            domain: "Zcam1CameraService",
                            code: -11,
                            userInfo: [NSLocalizedDescriptionKey: "Capture session not configured"]
                        )
                        DispatchQueue.main.async {
                            completion(nil, err)
                        }
                        return
                    }

                    print("[Zcam1CameraService] takePhoto: session.isRunning=\(session.isRunning)")
                    if !session.isRunning {
                        print("[Zcam1CameraService] takePhoto: starting session...")
                        session.startRunning()
                        print(
                            "[Zcam1CameraService] takePhoto: calling prewarmDepthPipelineIfNeeded..."
                        )
                        self.prewarmDepthPipelineIfNeeded()
                        print("[Zcam1CameraService] takePhoto: prewarm completed")
                    }

                    // Prepare photo settings
                    print("[Zcam1CameraService] takePhoto: preparing photo settings...")
                    let settings: AVCapturePhotoSettings

                    switch format {
                    case .jpeg:
                        print("[Zcam1CameraService] takePhoto: format is JPEG")
                        if self.photoOutput.availablePhotoCodecTypes.contains(.jpeg) {
                            settings = AVCapturePhotoSettings(format: [
                                AVVideoCodecKey: AVVideoCodecType.jpeg
                            ])
                        } else {
                            settings = AVCapturePhotoSettings()
                        }

                    case .dng:
                        print("[Zcam1CameraService] takePhoto: format is DNG")
                        if let rawType = self.photoOutput.availableRawPhotoPixelFormatTypes.first {
                            settings = AVCapturePhotoSettings(rawPixelFormatType: rawType)
                            // RAW capture requested; DNG file type selection is handled by the system if supported.
                        } else {
                            // Fallback to JPEG if RAW not available
                            if self.photoOutput.availablePhotoCodecTypes.contains(.jpeg) {
                                settings = AVCapturePhotoSettings(format: [
                                    AVVideoCodecKey: AVVideoCodecType.jpeg
                                ])
                            } else {
                                settings = AVCapturePhotoSettings()
                            }
                        }

                    }
                    print("[Zcam1CameraService] takePhoto: settings created")

                    // Request maximum resolution photo capture.
                    // This is critical because we use .high session preset for video preview,
                    // but still want full-resolution photos (12MP instead of 2MP).
                    let maxDimensions = self.photoOutput.maxPhotoDimensions
                    if maxDimensions.width > 0 && maxDimensions.height > 0 {
                        settings.maxPhotoDimensions = maxDimensions
                        print("[Zcam1CameraService] takePhoto: requesting max dimensions \(maxDimensions.width)x\(maxDimensions.height)")
                    }

                    // Configure flash if available.
                    if let device = self.videoInput?.device, device.hasFlash {
                        if self.photoOutput.supportedFlashModes.contains(self.flashMode) {
                            settings.flashMode = self.flashMode
                        }
                    }
                    print("[Zcam1CameraService] takePhoto: flash configured")

                    // Favor responsiveness when depth delivery is enabled (reduces perceived capture lag),
                    // but clamp to what the current device/output supports.
                    if #available(iOS 13.0, *) {
                        let desired: AVCapturePhotoOutput.QualityPrioritization =
                            includeDepthData ? .speed : .quality
                        let maxSupported = self.photoOutput.maxPhotoQualityPrioritization

                        if desired == .quality && maxSupported != .quality {
                            settings.photoQualityPrioritization = maxSupported
                        } else {
                            settings.photoQualityPrioritization = desired
                        }
                    }
                    print("[Zcam1CameraService] takePhoto: quality prioritization configured")

                    // Depth: only set on photo settings if already enabled at output level.
                    print(
                        "[Zcam1CameraService] takePhoto: isDepthDataDeliveryEnabled=\(self.photoOutput.isDepthDataDeliveryEnabled)"
                    )
                    if self.photoOutput.isDepthDataDeliveryEnabled {
                        print(
                            "[Zcam1CameraService] takePhoto: setting settings.isDepthDataDeliveryEnabled=\(includeDepthData)"
                        )
                        settings.isDepthDataDeliveryEnabled = includeDepthData
                    } else {
                        settings.isDepthDataDeliveryEnabled = false
                    }

                    // Calibration: can be set directly if device supports it.
                    print(
                        "[Zcam1CameraService] takePhoto: isCameraCalibrationDataDeliverySupported=\(self.photoOutput.isCameraCalibrationDataDeliverySupported)"
                    )
                    if self.photoOutput.isCameraCalibrationDataDeliverySupported {
                        print(
                            "[Zcam1CameraService] takePhoto: setting settings.isCameraCalibrationDataDeliveryEnabled=\(includeDepthData)"
                        )
                        settings.isCameraCalibrationDataDeliveryEnabled = includeDepthData
                    } else {
                        settings.isCameraCalibrationDataDeliveryEnabled = false
                    }

                    // Set the capture connection orientation so EXIF metadata is correct.
                    // This is the key step that makes landscape photos display correctly.
                    let resolvedOrientation = orientationEnum.resolveToVideoOrientation()
                    if let connection = self.photoOutput.connection(with: .video),
                       connection.isVideoOrientationSupported {
                        connection.videoOrientation = resolvedOrientation
                        print("[Zcam1CameraService] takePhoto: set videoOrientation=\(orientationToString(resolvedOrientation))")
                    }

                    // Create delegate to handle capture and keep it alive until completion.
                    print("[Zcam1CameraService] takePhoto: creating PhotoCaptureDelegate...")
                    let delegate = PhotoCaptureDelegate(
                        format: format,
                        aspectRatio: aspectRatioEnum,
                        orientation: orientationEnum,
                        includeDepthData: includeDepthData,
                        skipPostProcessing: skipPostProcessing,
                        owner: self,
                        completion: completion
                    )
                    self.inFlightDelegates.append(delegate)
                    print("[Zcam1CameraService] takePhoto: calling capturePhoto...")
                    self.photoOutput.capturePhoto(with: settings, delegate: delegate)
                    print("[Zcam1CameraService] takePhoto: capturePhoto called successfully")
                }
            }
        }
    }

    // MARK: - Video Capture API (Objective-C-friendly)

    /// Starts video recording to a temporary `.mov` file using AVAssetWriter.
    /// This approach eliminates preview flash since no session reconfiguration is needed.
    /// Call `stopVideoRecording` to finish and receive the final file path.
    ///
    /// - Parameters:
    ///   - positionString: Camera position ("front" or "back").
    ///   - maxDurationSeconds: Maximum recording duration in seconds. When greater
    ///     than zero the native layer will automatically stop recording after this
    ///     many seconds and cache the result for the next `stopVideoRecording` call.
    ///   - completion: Called once the recorder has started (or on error).
    public func startVideoRecording(
        positionString: String?,
        maxDurationSeconds: Double = 0,
        completion: @escaping (NSDictionary?, NSError?) -> Void
    ) {
        #if targetEnvironment(simulator)
            let err = NSError(
                domain: "Zcam1CameraService",
                code: -40,
                userInfo: [
                    NSLocalizedDescriptionKey:
                        "Video recording is not supported on the iOS simulator"
                ]
            )
            completion(nil, err)
            return
        #endif

        ensureCameraAuthorization { authorized in
            guard authorized else {
                let err = NSError(
                    domain: "Zcam1CameraService",
                    code: -10,
                    userInfo: [NSLocalizedDescriptionKey: "Camera access not authorized"]
                )
                completion(nil, err)
                return
            }

            let startWithMicAuthorized: (Bool) -> Void = { micAuthorized in
                let position: AVCaptureDevice.Position
                switch positionString?.lowercased() {
                case "front":
                    position = .front
                default:
                    position = .back
                }

                self.configureSessionIfNeeded(position: position, depthEnabled: self.depthEnabledAtSessionLevel) { error in
                    if let error = error {
                        completion(nil, error as NSError)
                        return
                    }

                    self.sessionQueue.async {
                        guard let session = self.captureSession else {
                            let err = NSError(
                                domain: "Zcam1CameraService",
                                code: -11,
                                userInfo: [
                                    NSLocalizedDescriptionKey: "Capture session not configured"
                                ]
                            )
                            DispatchQueue.main.async {
                                completion(nil, err)
                            }
                            return
                        }

                        // Check if recording is already in progress (with lock protection)
                        self.recordingStateLock.lock()
                        let isRecordingActive = self.recordingState != nil
                        self.recordingStateLock.unlock()

                        if isRecordingActive {
                            let err = NSError(
                                domain: "Zcam1CameraService",
                                code: -42,
                                userInfo: [
                                    NSLocalizedDescriptionKey:
                                        "A video recording is already in progress"
                                ]
                            )
                            DispatchQueue.main.async {
                                completion(nil, err)
                            }
                            return
                        }

                        // Setup audio input/output if mic is authorized (deferred from session init)
                        var hasAudio = false
                        if micAuthorized {
                            hasAudio = self.setupAudioForRecording(session: session)
                        }

                        // Prepare output URL
                        let filename = "zcam1-\(UUID().uuidString).mov"
                        let tmpURL = FileManager.default.temporaryDirectory.appendingPathComponent(filename)

                        // Remove any existing file at the path (defensive)
                        if FileManager.default.fileExists(atPath: tmpURL.path) {
                            try? FileManager.default.removeItem(at: tmpURL)
                        }

                        do {
                            // Create AVAssetWriter
                            let assetWriter = try AVAssetWriter(outputURL: tmpURL, fileType: .mov)

                            // Get video dimensions from the active video device format.
                            // Camera delivers uncompressed BGRA pixel buffers from AVCaptureVideoDataOutput,
                            // so we must encode them to H.264/HEVC (passthrough nil settings only works with
                            // already-compressed samples).
                            var videoWidth: Int = 1920
                            var videoHeight: Int = 1080
                            if let videoDevice = self.videoInput?.device {
                                let dimensions = CMVideoFormatDescriptionGetDimensions(videoDevice.activeFormat.formatDescription)
                                videoWidth = Int(dimensions.width)
                                videoHeight = Int(dimensions.height)
                            }

                            // Use HEVC for modern devices (iOS 11+)
                            let videoSettings: [String: Any] = [
                                AVVideoCodecKey: AVVideoCodecType.hevc,
                                AVVideoWidthKey: videoWidth,
                                AVVideoHeightKey: videoHeight,
                            ]

                            let videoInput = AVAssetWriterInput(
                                mediaType: .video,
                                outputSettings: videoSettings
                            )
                            videoInput.expectsMediaDataInRealTime = true

                            // Set video orientation based on current physical device orientation.
                            // The transform is locked at recording start (same as Apple Camera and Signal).
                            let recordingOrientation = Zcam1MotionManager.shared.currentOrientation()
                            let rotationAngle = videoWriterRotationAngle(
                                for: recordingOrientation,
                                position: position
                            )
                            videoInput.transform = CGAffineTransform(rotationAngle: rotationAngle)
                            print("[Zcam1CameraService] video recording orientation: \(orientationToString(recordingOrientation)), position: \(position == .front ? "front" : "back"), angle: \(rotationAngle)")

                            guard assetWriter.canAdd(videoInput) else {
                                throw NSError(
                                    domain: "Zcam1CameraService",
                                    code: -45,
                                    userInfo: [NSLocalizedDescriptionKey: "Cannot add video input to asset writer"]
                                )
                            }
                            assetWriter.add(videoInput)

                            // Create pixel buffer adaptor for writing filtered frames.
                            // This allows us to write CVPixelBuffer directly instead of CMSampleBuffer,
                            // which is necessary when applying film style filters to video frames.
                            let pixelBufferAttributes: [String: Any] = [
                                kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
                                kCVPixelBufferWidthKey as String: videoWidth,
                                kCVPixelBufferHeightKey as String: videoHeight,
                            ]
                            let pixelBufferAdaptor = AVAssetWriterInputPixelBufferAdaptor(
                                assetWriterInput: videoInput,
                                sourcePixelBufferAttributes: pixelBufferAttributes
                            )

                            // Configure audio input with AAC encoding.
                            // AVCaptureAudioDataOutput provides uncompressed LPCM samples, so we must
                            // encode them (passthrough nil settings only works with already-compressed audio).
                            var audioInput: AVAssetWriterInput?
                            if hasAudio {
                                let audioSettings: [String: Any] = [
                                    AVFormatIDKey: kAudioFormatMPEG4AAC,
                                    AVNumberOfChannelsKey: 2,
                                    AVSampleRateKey: 44100.0,
                                    AVEncoderBitRateKey: 128000,
                                ]
                                let input = AVAssetWriterInput(
                                    mediaType: .audio,
                                    outputSettings: audioSettings
                                )
                                input.expectsMediaDataInRealTime = true

                                if assetWriter.canAdd(input) {
                                    assetWriter.add(input)
                                    audioInput = input
                                }
                            }

                            // Start writing
                            guard assetWriter.startWriting() else {
                                throw assetWriter.error ?? NSError(
                                    domain: "Zcam1CameraService",
                                    code: -46,
                                    userInfo: [NSLocalizedDescriptionKey: "Failed to start asset writer"]
                                )
                            }

                            // Create recording state
                            let state = AssetWriterRecordingState(
                                assetWriter: assetWriter,
                                videoInput: videoInput,
                                audioInput: audioInput,
                                pixelBufferAdaptor: pixelBufferAdaptor,
                                outputURL: tmpURL
                            )

                            // Mark recording as active on the writer queue
                            state.writerQueue.sync {
                                state.isRecording = true
                            }

                            // Set recordingState with lock protection
                            self.recordingStateLock.lock()
                            self.recordingState = state
                            self.recordingStateLock.unlock()

                            print("[Zcam1CameraService] AVAssetWriter recording started (no preview flash)")

                            // Schedule auto-stop if a duration cap was requested.
                            self.autoStopWorkItem?.cancel()
                            self.autoStopWorkItem = nil
                            self.autoStopResult = nil

                            if maxDurationSeconds > 0 {
                                let workItem = DispatchWorkItem { [weak self] in
                                    guard let self = self else { return }

                                    // Verify recording is still active before auto-stopping.
                                    self.recordingStateLock.lock()
                                    let isActive = self.recordingState != nil
                                    self.recordingStateLock.unlock()

                                    guard isActive else { return }

                                    print("[Zcam1CameraService] Auto-stopping recording (maxDurationSeconds=\(maxDurationSeconds))")
                                    self.stopVideoRecording { result, error in
                                        if let result = result {
                                            // Cache the result so the next JS stopVideoRecording call can retrieve it.
                                            self.autoStopResult = result
                                        }
                                    }
                                }
                                self.autoStopWorkItem = workItem
                                DispatchQueue.main.asyncAfter(
                                    deadline: .now() + maxDurationSeconds,
                                    execute: workItem
                                )
                            }

                            // Immediately return success - no waiting for iOS callbacks
                            let result: [String: Any] = [
                                "status": "recording",
                                "filePath": tmpURL.path,
                                "format": "mov",
                                "hasAudio": hasAudio,
                            ]
                            DispatchQueue.main.async {
                                completion(result as NSDictionary, nil)
                            }

                        } catch {
                            DispatchQueue.main.async {
                                completion(nil, error as NSError)
                            }
                        }
                    }
                }
            }

            let hasMicUsageDescription =
                Bundle.main.object(forInfoDictionaryKey: "NSMicrophoneUsageDescription") != nil

            // If the app didn't declare NSMicrophoneUsageDescription, do not request mic permission
            // (requesting would crash). Proceed with video-only recording.
            if !hasMicUsageDescription {
                startWithMicAuthorized(false)
                return
            }

            self.ensureMicrophoneAuthorization { micAuthorized in
                startWithMicAuthorized(micAuthorized)
            }
        }
    }

    /// Sets up audio input and output for recording. Called only when mic is authorized.
    /// Returns true if audio was successfully configured.
    /// Uses a single beginConfiguration/commitConfiguration block to minimize preview interruption.
    private func setupAudioForRecording(session: AVCaptureSession) -> Bool {
        let needsInput = self.audioInput == nil
        let needsOutput = !session.outputs.contains(self.audioDataOutput)

        // If nothing to add, we're already configured
        if !needsInput && !needsOutput {
            return true
        }

        // Prepare audio input outside the configuration block to minimize lock time
        var newAudioInput: AVCaptureDeviceInput?
        if needsInput {
            guard let audioDevice = AVCaptureDevice.default(for: .audio) else {
                return false
            }
            do {
                newAudioInput = try AVCaptureDeviceInput(device: audioDevice)
            } catch {
                print("[Zcam1CameraService] Failed to create audio input: \(error)")
                return false
            }
        }

        // Single configuration block for all changes
        session.beginConfiguration()

        if let audioInput = newAudioInput, session.canAddInput(audioInput) {
            session.addInput(audioInput)
            self.audioInput = audioInput
        }

        if needsOutput && session.canAddOutput(self.audioDataOutput) {
            session.addOutput(self.audioDataOutput)
            self.audioDataOutput.setSampleBufferDelegate(self, queue: self.audioDataQueue)
        }

        session.commitConfiguration()

        return self.audioInput != nil && session.outputs.contains(self.audioDataOutput)
    }

    /// Prewarms audio configuration if mic permission is already granted.
    /// Call this after camera session is configured to avoid shutter on first recording.
    /// Must be called from sessionQueue.
    private func prewarmAudioIfAuthorized() {
        // Only prewarm if mic permission is already granted (don't trigger prompt)
        guard AVCaptureDevice.authorizationStatus(for: .audio) == .authorized else {
            return
        }
        guard let session = self.captureSession else {
            return
        }

        if self.audioInput == nil || !session.outputs.contains(self.audioDataOutput) {
            print("[Zcam1CameraService] Prewarming audio configuration...")
            _ = self.setupAudioForRecording(session: session)
        }
    }

    /// Stops an in-progress video recording and returns `{ filePath, format, durationSeconds? }`.
    ///
    /// If the recording was already auto-stopped (via `maxDurationSeconds`), the cached result
    /// is returned immediately instead of an error.
    public func stopVideoRecording(completion: @escaping (NSDictionary?, NSError?) -> Void) {
        // Cancel any pending auto-stop timer since we are stopping explicitly.
        self.autoStopWorkItem?.cancel()
        self.autoStopWorkItem = nil

        sessionQueue.async {
            // Lock to safely read the recordingState reference.
            self.recordingStateLock.lock()
            let state = self.recordingState
            self.recordingStateLock.unlock()

            guard let state = state else {
                // Recording state is nil. Check if the native auto-stop already ran and
                // cached the result — if so, return it instead of an error.
                if let cachedResult = self.autoStopResult {
                    self.autoStopResult = nil
                    DispatchQueue.main.async {
                        completion(cachedResult, nil)
                    }
                    return
                }

                let err = NSError(
                    domain: "Zcam1CameraService",
                    code: -44,
                    userInfo: [NSLocalizedDescriptionKey: "No active video recording to stop"]
                )
                DispatchQueue.main.async {
                    completion(nil, err)
                }
                return
            }

            // All finalization must happen on the writer queue to prevent races with append
            state.writerQueue.async {
                // Check if still recording (might have been stopped already by auto-stop).
                guard state.isRecording else {
                    // The auto-stop may have already finished and cached the result.
                    if let cachedResult = self.autoStopResult {
                        self.autoStopResult = nil
                        DispatchQueue.main.async {
                            completion(cachedResult, nil)
                        }
                    } else {
                        DispatchQueue.main.async {
                            completion(nil, NSError(
                                domain: "Zcam1CameraService",
                                code: -44,
                                userInfo: [NSLocalizedDescriptionKey: "Recording already stopped"]
                            ))
                        }
                    }
                    return
                }

                // Mark as not recording to stop accepting new samples
                state.isRecording = false

                print("[Zcam1CameraService] Stopping AVAssetWriter recording...")

                // Handle edge case: no frames were captured
                if !state.hasStartedSession {
                    // Start a session at zero so we can finalize properly
                    state.assetWriter.startSession(atSourceTime: .zero)
                    state.hasStartedSession = true
                }

                // Mark inputs as finished
                state.videoInput.markAsFinished()
                state.audioInput?.markAsFinished()

                // Finalize the asset writer
                state.assetWriter.finishWriting {
                    // Clear recording state with lock protection
                    self.recordingStateLock.lock()
                    self.recordingState = nil
                    self.recordingStateLock.unlock()

                    if let error = state.assetWriter.error {
                        print("[Zcam1CameraService] AVAssetWriter error: \(error)")
                        DispatchQueue.main.async {
                            completion(nil, error as NSError)
                        }
                        return
                    }

                    print("[Zcam1CameraService] AVAssetWriter recording finished, frames: \(state.videoFrameCount), audio: \(state.audioSampleCount)")

                    // Build result with metadata derived from the actual recorded file
                    self.buildVideoMetadata(from: state.outputURL, hasAudio: state.audioInput != nil) { result in
                        DispatchQueue.main.async {
                            completion(result as NSDictionary, nil)
                        }
                    }
                }
            }
        }
    }

    /// Extracts metadata from a recorded video file.
    private func buildVideoMetadata(from url: URL, hasAudio: Bool, completion: @escaping ([String: Any]) -> Void) {
        var result: [String: Any] = [
            "filePath": url.path,
            "format": "mov",
            "hasAudio": hasAudio,
            "deviceMake": "Apple",
            "deviceModel": UIDevice.current.model,
            "softwareVersion": "\(UIDevice.current.systemName) \(UIDevice.current.systemVersion)",
        ]

        // File size
        do {
            let attrs = try FileManager.default.attributesOfItem(atPath: url.path)
            if let size = attrs[.size] as? Int {
                result["fileSizeBytes"] = NSNumber(value: size)
            }
        } catch {
            // Best-effort
        }

        let asset = AVURLAsset(url: url)

        // Duration
        let seconds = CMTimeGetSeconds(asset.duration)
        if seconds.isFinite && !seconds.isNaN && seconds >= 0 {
            result["durationSeconds"] = seconds
        }

        // Helper to convert FourCC to string
        func fourCCString(_ code: FourCharCode) -> String {
            let be = code.bigEndian
            let bytes: [UInt8] = [
                UInt8((be >> 24) & 0xff),
                UInt8((be >> 16) & 0xff),
                UInt8((be >> 8) & 0xff),
                UInt8(be & 0xff),
            ]
            if let s = String(bytes: bytes, encoding: .macOSRoman) {
                return s.trimmingCharacters(in: .controlCharacters)
            }
            return "\(code)"
        }

        // Video track metadata
        if let videoTrack = asset.tracks(withMediaType: .video).first {
            // Dimensions corrected for transform
            let transformed = videoTrack.naturalSize.applying(videoTrack.preferredTransform)
            let width = abs(transformed.width)
            let height = abs(transformed.height)
            if width.isFinite && !width.isNaN && height.isFinite && !height.isNaN {
                result["width"] = Int(width.rounded())
                result["height"] = Int(height.rounded())
            }

            // Frame rate
            let frameRate = videoTrack.nominalFrameRate
            if frameRate.isFinite && !frameRate.isNaN && frameRate > 0 {
                result["frameRate"] = Int(frameRate.rounded())
            }

            // Rotation from transform
            let t = videoTrack.preferredTransform
            let epsilon: CGFloat = 0.001
            func approx(_ x: CGFloat, _ y: CGFloat) -> Bool { abs(x - y) < epsilon }
            if approx(t.a, 0), approx(t.b, 1), approx(t.c, -1), approx(t.d, 0) {
                result["rotationDegrees"] = 90
            } else if approx(t.a, 0), approx(t.b, -1), approx(t.c, 1), approx(t.d, 0) {
                result["rotationDegrees"] = 270
            } else if approx(t.a, -1), approx(t.b, 0), approx(t.c, 0), approx(t.d, -1) {
                result["rotationDegrees"] = 180
            } else {
                result["rotationDegrees"] = 0
            }

            // Video codec
            if let formatDescAny = videoTrack.formatDescriptions.first {
                let formatDesc = formatDescAny as! CMFormatDescription
                result["videoCodec"] = fourCCString(CMFormatDescriptionGetMediaSubType(formatDesc))
            }
        }

        // Audio track metadata
        if let audioTrack = asset.tracks(withMediaType: .audio).first {
            if let formatDescAny = audioTrack.formatDescriptions.first {
                let formatDesc = formatDescAny as! CMAudioFormatDescription
                result["audioCodec"] = fourCCString(CMFormatDescriptionGetMediaSubType(formatDesc))
                    .trimmingCharacters(in: .whitespacesAndNewlines)

                if let asbdPtr = CMAudioFormatDescriptionGetStreamBasicDescription(formatDesc) {
                    let asbd = asbdPtr.pointee
                    if asbd.mSampleRate > 0 {
                        result["audioSampleRate"] = asbd.mSampleRate
                    }
                    if asbd.mChannelsPerFrame > 0 {
                        result["audioChannels"] = Int(asbd.mChannelsPerFrame)
                    }
                }
            }
        }

        completion(result)
    }

    // MARK: - Sample Buffer Writing for Recording

    /// Called by the view when it receives a video sample buffer.
    /// If recording is active, writes the sample to the asset writer.
    /// Applies film style filters if a custom film style chain is active.
    /// Thread-safe: recordingStateLock guards reference access; writerQueue serializes writes.
    public func writeVideoSampleBuffer(_ sampleBuffer: CMSampleBuffer) {
        // Lock to safely read the recordingState reference.
        recordingStateLock.lock()
        let state = recordingState
        recordingStateLock.unlock()
        guard let state = state else { return }

        // Capture film style chain outside the async block to avoid race conditions.
        let filmStyles = customFilmStyleChain

        // All writer operations must be serialized on the writer queue.
        state.writerQueue.async {
            guard state.isRecording else { return }

            let timestamp = CMSampleBufferGetPresentationTimeStamp(sampleBuffer)

            // Start the session on first video frame.
            if !state.hasStartedSession {
                state.assetWriter.startSession(atSourceTime: timestamp)
                state.hasStartedSession = true
                state.startTime = timestamp
                print("[Zcam1CameraService] Asset writer session started at \(timestamp.seconds)")
            }

            // Write video frame if input is ready.
            guard state.videoInput.isReadyForMoreMediaData else { return }

            // Check if we have a film style to apply.
            if let filmStyles = filmStyles, !filmStyles.isEmpty {
                // Apply film style filter to the pixel buffer.
                guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else {
                    print("[Zcam1CameraService] Failed to get pixel buffer from sample buffer")
                    return
                }

                // Use .up orientation for video recording - the asset writer's transform handles rotation.
                // Film style filters only modify colors, not geometry.
                let orientation: UIImage.Orientation = .up

                // Apply film style filter.
                if let filteredBuffer = Zcam1CameraFilmStyle.apply(
                    filmStyles: filmStyles,
                    to: pixelBuffer,
                    orientation: orientation
                ) {
                    // Write filtered pixel buffer via adaptor.
                    if !state.pixelBufferAdaptor.append(filteredBuffer, withPresentationTime: timestamp) {
                        if let error = state.assetWriter.error {
                            print("[Zcam1CameraService] Filtered video append failed: \(error)")
                        }
                    } else {
                        state.videoFrameCount += 1
                    }
                } else {
                    // Fallback: write original buffer if filtering fails.
                    if !state.pixelBufferAdaptor.append(pixelBuffer, withPresentationTime: timestamp) {
                        if let error = state.assetWriter.error {
                            print("[Zcam1CameraService] Video append failed: \(error)")
                        }
                    } else {
                        state.videoFrameCount += 1
                    }
                }
            } else {
                // No film style - write original sample buffer directly.
                if !state.videoInput.append(sampleBuffer) {
                    if let error = state.assetWriter.error {
                        print("[Zcam1CameraService] Video append failed: \(error)")
                    }
                } else {
                    state.videoFrameCount += 1
                }
            }
        }
    }

    // MARK: - AVCaptureAudioDataOutputSampleBufferDelegate

    public func captureOutput(
        _ output: AVCaptureOutput,
        didOutput sampleBuffer: CMSampleBuffer,
        from connection: AVCaptureConnection
    ) {
        // Only handle audio data output
        guard output === audioDataOutput else { return }

        // Lock to safely read the recordingState reference
        recordingStateLock.lock()
        let state = recordingState
        recordingStateLock.unlock()
        guard let state = state else { return }

        // All writer operations must be serialized on the writer queue
        state.writerQueue.async {
            guard state.isRecording, state.hasStartedSession else { return }

            // Write audio sample if input is ready
            if let audioInput = state.audioInput, audioInput.isReadyForMoreMediaData {
                if !audioInput.append(sampleBuffer) {
                    if let error = state.assetWriter.error {
                        print("[Zcam1CameraService] Audio append failed: \(error)")
                    }
                } else {
                    state.audioSampleCount += 1
                }
            }
        }
    }

    /// Check if the device supports depth data capture and return available formats.
    public func getDepthSensorInfo(completion: @escaping (NSDictionary?, NSError?) -> Void) {
        // Check if current device supports depth data capture
        // Devices with dual/triple cameras typically support depth
        let deviceTypes: [AVCaptureDevice.DeviceType] = [
            .builtInTripleCamera,
            .builtInDualWideCamera,
            .builtInDualCamera,
        ]

        let discoverySession = AVCaptureDevice.DiscoverySession(
            deviceTypes: deviceTypes,
            mediaType: .video,
            position: .back
        )

        let supportsDepth = !discoverySession.devices.isEmpty

        var formats: [String] = []
        if supportsDepth {
            // List all potentially available depth formats
            formats = [
                "depthFloat32",
                "depthFloat16",
                "disparityFloat32",
                "disparityFloat16",
            ]
        }

        let result: [String: Any] = [
            "available": supportsDepth,
            "formats": formats,
        ]

        DispatchQueue.main.async {
            completion(result as NSDictionary, nil)
        }
    }

}
// Capture delegate implementation moved into the internal PhotoCaptureDelegate helper.

// MARK: - Camera Preview View

/// UIView subclass that displays the live camera preview.
///
/// NEW ARCHITECTURE: Always uses AVCaptureVideoDataOutput for preview rendering.
/// This eliminates the complexity of toggling between preview layer and film style image view.
/// All frames go through the same pipeline - film style is applied when needed.
///
/// This view is intended to be wrapped by a React Native view manager
/// and controlled via props such as `isActive` and `position`.
@available(iOS 16.0, *)
@objc(Zcam1CameraView)
@objcMembers
public final class Zcam1CameraView: UIView, AVCaptureVideoDataOutputSampleBufferDelegate {

    // Exposed properties (KVC/KVO friendly for RN)
    public var isActive: Bool = true {
        didSet {
            updateRunningState()
        }
    }

    /// "front" or "back"
    public var position: String = "back" {
        didSet {
            guard oldValue != position else { return }
            // Set flag first to stop accepting frames, then clear the preview.
            isReconfiguring = true
            previewImageView.image = nil
            reconfigureSession()
        }
    }

    /// "jpeg" or "dng" (controls what JS will request on capture)
    public var captureFormat: String = "jpeg"

    /// Zoom factor (1.0 = no zoom, 2.0 = 2x, etc.)
    /// Prop-driven zoom changes are instant (used by slider and button taps).
    /// For smooth pinch-to-zoom, use setZoomAnimated via the TurboModule instead.
    public var zoom: CGFloat = 1.0 {
        didSet {
            Zcam1CameraService.shared.setZoom(zoom)
        }
    }

    /// Whether torch (flashlight) is enabled during preview.
    public var torch: Bool = false {
        didSet {
            Zcam1CameraService.shared.setTorch(torch)
        }
    }

    /// Exposure compensation in EV units.
    public var exposure: Float = 0.0 {
        didSet {
            Zcam1CameraService.shared.setExposureCompensation(exposure)
        }
    }

    /// Film style preset name ("normal", "mellow", "bw", "nostalgic") or custom film style name.
    public var filmStyle: String = "normal" {
        didSet {
            guard oldValue != filmStyle else { return }
            print("[Zcam1CameraView] Film style changed: \(oldValue) -> \(filmStyle)")
            applyCurrentFilmStyle()
        }
    }

    /// Custom film style recipe overrides for built-in presets.
    /// Keys are preset names, values are arrays of film style effect dictionaries.
    @objc public var filmStyleOverrides: NSDictionary? {
        didSet {
            print("[Zcam1CameraView] filmStyleOverrides updated")
            applyCurrentFilmStyle()
        }
    }

    /// Additional custom film styles defined by name.
    /// Keys are custom film style names, values are arrays of film style effect dictionaries.
    @objc public var customFilmStyles: NSDictionary? {
        didSet {
            print("[Zcam1CameraView] customFilmStyles updated")
            applyCurrentFilmStyle()
        }
    }

    /// Enable depth data capture at session level.
    /// When true, depth data can be captured but zoom may be restricted on dual-camera devices.
    /// When false (default), full zoom range is available.
    public var depthEnabled: Bool = false {
        didSet {
            guard oldValue != depthEnabled else { return }
            print("[Zcam1CameraView] depthEnabled changed: \(oldValue) -> \(depthEnabled)")
            // Reconfigure session to apply the new depth setting.
            isReconfiguring = true
            reconfigureSession()
        }
    }

    /// Callback fired when device physical orientation changes.
    /// Sends a dictionary with "orientation" key ("portrait", "landscapeLeft", "landscapeRight", "portraitUpsideDown").
    public var onOrientationChange: (([String: Any]) -> Void)?

    /// Token for this view's motion manager listener, used for cleanup in deinit.
    private var orientationListenerToken: Int?

    // Preview rendering - single UIImageView for all frames (filtered or not)
    private let previewImageView: UIImageView = {
        let iv = UIImageView()
        iv.contentMode = .scaleAspectFill
        iv.clipsToBounds = true
        return iv
    }()

    // Video processing
    private var videoDataOutput: AVCaptureVideoDataOutput?
    private let videoDataQueue = DispatchQueue(label: "com.zcam1.videodata", qos: .userInteractive)
    private var currentFilmStyleEnum: Zcam1CameraFilmStyle = .normal
    private var currentCustomFilmStyles: [C7FilterProtocol]?
    private let ciContext = CIContext(options: [.useSoftwareRenderer: false])
    private var frameCount: Int = 0

    // Flag to skip frames during camera reconfiguration to avoid showing incorrectly mirrored frames.
    private var isReconfiguring: Bool = false

    public override init(frame: CGRect) {
        super.init(frame: frame)
        commonInit()
    }

    public required init?(coder: NSCoder) {
        super.init(coder: coder)
        commonInit()
    }

    private func commonInit() {
        backgroundColor = .black

        // Add preview image view as the only preview mechanism.
        previewImageView.frame = bounds
        previewImageView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        addSubview(previewImageView)

        // Register for orientation change events from the motion manager.
        orientationListenerToken = Zcam1MotionManager.shared.addListener { [weak self] orientation in
            guard let self = self, let callback = self.onOrientationChange else { return }
            callback(["orientation": orientationToString(orientation)])
        }

        // Configure session and start receiving frames.
        reconfigureSession()
    }

    deinit {
        // Remove only this view's listener from the motion manager.
        if let token = orientationListenerToken {
            Zcam1MotionManager.shared.removeListener(token)
        }
    }

    public override func layoutSubviews() {
        super.layoutSubviews()
        previewImageView.frame = bounds
    }

    // MARK: - Film Style Resolution

    /// Resolves and applies the current film style, checking overrides and custom film styles first.
    private func applyCurrentFilmStyle() {
        // Check filmStyleOverrides first.
        if let overrides = filmStyleOverrides as? [String: [[String: Any]]],
           let recipe = overrides[filmStyle] {
            print("[Zcam1CameraView] Using film style override for '\(filmStyle)'")
            let filmStyles = Zcam1CameraFilmStyle.createFilmStyles(from: recipe)
            currentCustomFilmStyles = filmStyles
            currentFilmStyleEnum = .normal
            Zcam1CameraService.shared.setCustomFilmStyles(filmStyles)
            return
        }

        // Check customFilmStyles next.
        if let custom = customFilmStyles as? [String: [[String: Any]]],
           let recipe = custom[filmStyle] {
            print("[Zcam1CameraView] Using custom film style '\(filmStyle)'")
            let filmStyles = Zcam1CameraFilmStyle.createFilmStyles(from: recipe)
            currentCustomFilmStyles = filmStyles
            currentFilmStyleEnum = .normal
            Zcam1CameraService.shared.setCustomFilmStyles(filmStyles)
            return
        }

        // Fall back to no film style (JS SDK provides all built-in recipes via filmStyleOverrides).
        currentCustomFilmStyles = nil
        currentFilmStyleEnum = .normal
        Zcam1CameraService.shared.setFilmStyle(.normal)
    }

    // MARK: - AVCaptureVideoDataOutputSampleBufferDelegate

    public func captureOutput(
        _ output: AVCaptureOutput,
        didOutput sampleBuffer: CMSampleBuffer,
        from connection: AVCaptureConnection
    ) {
        // Skip frames during reconfiguration to avoid showing incorrectly mirrored frames.
        if isReconfiguring {
            return
        }

        // Forward sample buffer to service for recording (if active).
        // This enables AVAssetWriter-based recording without any preview flash.
        Zcam1CameraService.shared.writeVideoSampleBuffer(sampleBuffer)

        frameCount += 1
        if frameCount == 1 {
            print("[Zcam1CameraView] FIRST FRAME! filmStyle=\(currentFilmStyleEnum)")
        } else if frameCount % 60 == 0 {
            print("[Zcam1CameraView] frame \(frameCount), filmStyle=\(currentFilmStyleEnum)")
        }

        guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else {
            return
        }

        // Convert pixel buffer to UIImage.
        let ciImage = CIImage(cvPixelBuffer: pixelBuffer)
        guard let cgImage = ciContext.createCGImage(ciImage, from: ciImage.extent) else {
            return
        }

        // Create UIImage with fixed portrait orientation for display.
        // The app UI is portrait-locked, so the preview frame is always taller than wide.
        // Camera sensor buffers always arrive in landscape (native sensor orientation),
        // so we always rotate 90° CW (.right) to fit the portrait frame.
        // Orientation-aware rotation only applies to photo capture and video recording,
        // NOT to the live preview.
        let isFront = position.lowercased() == "front"
        let imageOrientation: UIImage.Orientation = isFront ? .rightMirrored : .right

        var displayImage = UIImage(cgImage: cgImage, scale: 1.0, orientation: imageOrientation)

        // Apply film style if needed.
        if let customFilmStyles = currentCustomFilmStyles {
            displayImage = Zcam1CameraFilmStyle.apply(filmStyles: customFilmStyles, to: displayImage)
        }

        // Update UI on main thread, but double-check we're not reconfiguring.
        DispatchQueue.main.async { [weak self] in
            guard let self = self, !self.isReconfiguring else { return }
            self.previewImageView.image = displayImage
        }
    }

    public func captureOutput(
        _ output: AVCaptureOutput,
        didDrop sampleBuffer: CMSampleBuffer,
        from connection: AVCaptureConnection
    ) {
        // Log dropped frames for debugging.
        print("[Zcam1CameraView] DROPPED frame")
    }

    // MARK: - Session Configuration

    private func reconfigureSession() {
        let svc = Zcam1CameraService.shared
        let positionEnum: AVCaptureDevice.Position =
            position.lowercased() == "front" ? .front : .back

        svc.configureSessionIfNeeded(position: positionEnum, depthEnabled: depthEnabled) { [weak self] error in
            guard let self = self, error == nil else { return }

            // Apply camera settings.
            self.applyCurrentSettings()

            // Setup video data output for frame capture.
            self.setupVideoDataOutput()

            // Start the session.
            self.updateRunningState()
        }
    }

    private func setupVideoDataOutput() {
        Zcam1CameraService.shared.configureVideoDataOutput(
            delegate: self,
            callbackQueue: videoDataQueue
        ) { [weak self] output in
            guard let self = self else { return }
            if let output = output {
                self.videoDataOutput = output
                // Clear the reconfiguring flag now that the connection is properly configured.
                self.isReconfiguring = false
                print("[Zcam1CameraView] Video data output ready, reconfiguring=false")
            } else {
                // Clear flag even on error to avoid permanently blocking frames.
                self.isReconfiguring = false
                print("[Zcam1CameraView] ERROR: Failed to setup video data output")
            }
        }
    }

    private func applyCurrentSettings() {
        let svc = Zcam1CameraService.shared
        svc.setZoom(zoom)
        svc.setTorch(torch)
        svc.setExposureCompensation(exposure)
    }

    private func updateRunningState() {
        let svc = Zcam1CameraService.shared
        if isActive {
            svc.startRunning()
        } else {
            svc.stopRunning()
        }
    }
}
