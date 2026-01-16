//
//  Zcam1Camera.swift
//  react-native-zcam1-sdk
//
//  Native camera view + service using AVFoundation for preview and capture.
//

import AVFoundation
import Foundation
import Harbeth
import UIKit

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

// MARK: - Camera Delegate

/// Internal helper that acts as the AVCapturePhotoCaptureDelegate.
/// This keeps AVFoundation protocol types out of the @objc-visible service API.
@available(iOS 16.0, *)
private final class PhotoCaptureDelegate: NSObject, AVCapturePhotoCaptureDelegate {
    private let format: Zcam1CaptureFormat
    private let completion: (NSDictionary?, NSError?) -> Void
    private unowned let owner: Zcam1CameraService

    init(
        format: Zcam1CaptureFormat,
        owner: Zcam1CameraService,
        completion: @escaping (NSDictionary?, NSError?) -> Void
    ) {
        self.format = format
        self.owner = owner
        self.completion = completion
    }

    func photoOutput(
        _ output: AVCapturePhotoOutput,
        didFinishProcessingPhoto photo: AVCapturePhoto,
        error: Error?
    ) {
        if let error = error as NSError? {
            DispatchQueue.main.async {
                self.completion(nil, error)
                self.owner.didFinishCapture(delegate: self)
            }
            return
        }

        guard var data = photo.fileDataRepresentation(), !data.isEmpty else {
            let err = NSError(
                domain: "Zcam1CameraService",
                code: -20,
                userInfo: [NSLocalizedDescriptionKey: "Empty photo data"]
            )
            DispatchQueue.main.async {
                self.completion(nil, err)
                self.owner.didFinishCapture(delegate: self)
            }
            return
        }

        // Apply filter if set (before C2PA signing).
        if let filteredData = owner.applyFilterToImageData(data) {
            data = filteredData
        }

        let filename = "zcam1-\(UUID().uuidString).\(format.fileExtension)"
        let tmpURL = FileManager.default.temporaryDirectory.appendingPathComponent(filename)

        do {
            try data.write(to: tmpURL, options: [.atomic])

            var metadata: [String: Any] = photo.metadata
            if let tiffDict = metadata[kCGImagePropertyTIFFDictionary as String] as? [String: Any] {
                metadata["{TIFF}"] = tiffDict
            }

            let result: [String: Any] = [
                "filePath": tmpURL.path,
                "format": format.formatString,
                "metadata": metadata,
            ]

            DispatchQueue.main.async {
                self.completion(result as NSDictionary, nil)
                self.owner.didFinishCapture(delegate: self)
            }
        } catch {
            DispatchQueue.main.async {
                self.completion(nil, error as NSError)
                self.owner.didFinishCapture(delegate: self)
            }
        }
    }
}

/// Internal helper that acts as the AVCaptureFileOutputRecordingDelegate.
/// This keeps AVFoundation protocol types out of the @objc-visible service API.
@available(iOS 16.0, *)
private final class MovieCaptureDelegate: NSObject, AVCaptureFileOutputRecordingDelegate {
    private unowned let owner: Zcam1CameraService

    init(owner: Zcam1CameraService) {
        self.owner = owner
        super.init()
    }

    func fileOutput(
        _ output: AVCaptureFileOutput,
        didStartRecordingTo fileURL: URL,
        from connections: [AVCaptureConnection]
    ) {
        owner.enqueueVideoRecordingDidStart(outputFileURL: fileURL)
    }

    func fileOutput(
        _ output: AVCaptureFileOutput,
        didFinishRecordingTo outputFileURL: URL,
        from connections: [AVCaptureConnection],
        error: Error?
    ) {
        owner.enqueueVideoRecordingDidFinish(outputFileURL: outputFileURL, error: error)
        owner.enqueueDidFinishVideoCapture(delegate: self)
    }
}

// MARK: - Camera Service

/// Shared service that owns the AVCaptureSession and performs still captures.
///
/// It is designed to be driven from the JS side via the TurboModule method
/// `takeNativePhoto`, and from a native preview view (see `Zcam1CameraView`).
@available(iOS 16.0, *)
@objcMembers
public final class Zcam1CameraService: NSObject {

    // Singleton instance (easy to access from ObjC / Swift bridge)
    public static let shared = Zcam1CameraService()

    // Underlying capture session and IO
    public private(set) var captureSession: AVCaptureSession?
    private var videoInput: AVCaptureDeviceInput?
    private var audioInput: AVCaptureDeviceInput?

    private let photoOutput = AVCapturePhotoOutput()
    private let movieOutput = AVCaptureMovieFileOutput()

    // Serial queue for all session operations
    private let sessionQueue = DispatchQueue(label: "com.anonymous.zcam1poc.camera.session")

    // Keep strong references to in-flight delegates so they live until completion
    private var inFlightDelegates: [PhotoCaptureDelegate] = []
    private var inFlightMovieDelegates: [MovieCaptureDelegate] = []

    // Video recording state (single in-flight recording)
    private var activeMovieOutputURL: URL?
    private var activeVideoHasAudio: Bool = false
    private var pendingVideoStartCompletion: ((NSDictionary?, NSError?) -> Void)?
    private var pendingVideoStopCompletion: ((NSDictionary?, NSError?) -> Void)?

    // Camera control state
    private var currentZoom: CGFloat = 1.0
    private var flashMode: AVCaptureDevice.FlashMode = .off
    private var currentExposureBias: Float = 0.0

    // Filter state
    private var currentFilter: Zcam1CameraFilter = .normal

    private override init() {
        super.init()
    }

    // MARK: - Filter

    /// Set the active camera filter for preview and capture.
    public func setFilter(_ filter: Zcam1CameraFilter) {
        self.currentFilter = filter
    }

    /// Get the current filter.
    public func getFilter() -> Zcam1CameraFilter {
        return currentFilter
    }

    /// Apply the current filter to image data and return filtered JPEG data.
    public func applyFilterToImageData(_ data: Data) -> Data? {
        return currentFilter.apply(toData: data, compressionQuality: 0.9)
    }

    // MARK: - Video Data Output for Filtered Preview

    /// Configure and add a video data output to the session for filtered preview.
    /// Must be called to get video frames for applying filters in real-time.
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

            print("[Zcam1CameraService] configureVideoDataOutput: session.isRunning=\(session.isRunning), preset=\(session.sessionPreset.rawValue)")

            // Check if we already have a video data output.
            for output in session.outputs {
                if let existingOutput = output as? AVCaptureVideoDataOutput {
                    print("[Zcam1CameraService] configureVideoDataOutput: already have video data output, updating delegate")
                    existingOutput.setSampleBufferDelegate(delegate, queue: callbackQueue)
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
            print("[Zcam1CameraService] configureVideoDataOutput: delegate set on queue \(callbackQueue.label)")

            session.beginConfiguration()

            // Try to add the output.
            if session.canAddOutput(output) {
                session.addOutput(output)
                print("[Zcam1CameraService] configureVideoDataOutput: added output successfully, total outputs=\(session.outputs.count)")

                // Configure the connection.
                if let connection = output.connection(with: .video) {
                    connection.isEnabled = true
                    if connection.isVideoOrientationSupported {
                        connection.videoOrientation = .portrait
                    }
                    print("[Zcam1CameraService] configureVideoDataOutput: connection configured, isActive=\(connection.isActive), isEnabled=\(connection.isEnabled)")
                } else {
                    print("[Zcam1CameraService] configureVideoDataOutput: WARNING - no video connection found!")
                }

                session.commitConfiguration()
                print("[Zcam1CameraService] configureVideoDataOutput: committed configuration, session.isRunning=\(session.isRunning)")
                DispatchQueue.main.async { completion(output) }
            } else {
                print("[Zcam1CameraService] configureVideoDataOutput: canAddOutput returned false, preset=\(session.sessionPreset.rawValue)")
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
            print("[Zcam1CameraService] removeVideoDataOutput: removed output, total outputs=\(session.outputs.count)")
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
                .builtInTripleCamera,      // Ultra-wide + Wide + Telephoto
                .builtInDualWideCamera,    // Ultra-wide + Wide
                .builtInDualCamera,        // Wide + Telephoto
                .builtInWideAngleCamera,   // Wide only (fallback)
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

    /// Configure the capture session if needed (or reconfigure if the position changed).
    @nonobjc public func configureSessionIfNeeded(
        position: AVCaptureDevice.Position,
        completion: @escaping (Error?) -> Void
    ) {
        sessionQueue.async {
            do {
                let session = self.captureSession ?? AVCaptureSession()
                session.beginConfiguration()
                // Use .high preset which supports both photo capture and video data output.
                // The .photo preset may not deliver continuous frames needed for real-time filtering.
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
                    let input = try AVCaptureDeviceInput(device: device)
                    if session.canAddInput(input) {
                        session.addInput(input)
                        self.videoInput = input
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

                // Add photo output if needed
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

                session.commitConfiguration()
                self.captureSession = session

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
        sessionQueue.async {
            guard let session = self.captureSession, !session.isRunning else { return }
            session.startRunning()
        }
    }

    public func stopRunning() {
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

    // Delegate callbacks can arrive on arbitrary threads. Route all state mutations through `sessionQueue`.
    fileprivate func enqueueVideoRecordingDidStart(outputFileURL: URL) {
        sessionQueue.async {
            self.videoRecordingDidStart(outputFileURL: outputFileURL)
        }
    }

    fileprivate func enqueueVideoRecordingDidFinish(outputFileURL: URL, error: Error?) {
        sessionQueue.async {
            self.videoRecordingDidFinish(outputFileURL: outputFileURL, error: error)
        }
    }

    fileprivate func enqueueDidFinishVideoCapture(delegate: MovieCaptureDelegate) {
        sessionQueue.async {
            self.didFinishVideoCapture(delegate: delegate)
        }
    }

    fileprivate func didFinishVideoCapture(delegate: MovieCaptureDelegate) {
        if let index = inFlightMovieDelegates.firstIndex(where: { $0 === delegate }) {
            inFlightMovieDelegates.remove(at: index)
        }
    }

    // NOTE: Must be called on `sessionQueue`.
    fileprivate func videoRecordingDidStart(outputFileURL: URL) {
        let result: [String: Any] = [
            "status": "recording",
            "filePath": outputFileURL.path,
            "format": "mov",
            "hasAudio": self.activeVideoHasAudio,
        ]
        let startCompletion = pendingVideoStartCompletion
        pendingVideoStartCompletion = nil
        DispatchQueue.main.async {
            startCompletion?(result as NSDictionary, nil)
        }
    }

    // NOTE: Must be called on `sessionQueue`.
    fileprivate func videoRecordingDidFinish(outputFileURL: URL, error: Error?) {
        // Restore session for still capture.
        if let session = self.captureSession {
            session.beginConfiguration()

            if session.outputs.contains(self.movieOutput) {
                session.removeOutput(self.movieOutput)
            }

            if let audioInput = self.audioInput {
                session.removeInput(audioInput)
                self.audioInput = nil
            }

            if session.canSetSessionPreset(.high) {
                session.sessionPreset = .high
            }

            session.commitConfiguration()
        }

        if let error = error as NSError? {
            // Prefer resolving stop completion if present; otherwise resolve start completion (e.g. start failed).
            let stopCompletion = pendingVideoStopCompletion
            let startCompletion = pendingVideoStartCompletion
            pendingVideoStopCompletion = nil
            pendingVideoStartCompletion = nil
            activeMovieOutputURL = nil
            activeVideoHasAudio = false

            DispatchQueue.main.async {
                if let stopCompletion = stopCompletion {
                    stopCompletion(nil, error)
                } else {
                    startCompletion?(nil, error)
                }
            }
            return
        }

        var result: [String: Any] = [
            "filePath": outputFileURL.path,
            "format": "mov",
            "hasAudio": self.activeVideoHasAudio,
        ]

        let asset = AVURLAsset(url: outputFileURL)
        let seconds = CMTimeGetSeconds(asset.duration)
        if seconds.isFinite && !seconds.isNaN && seconds >= 0 {
            result["durationSeconds"] = seconds
        }

        let stopCompletion = pendingVideoStopCompletion
        pendingVideoStopCompletion = nil
        activeMovieOutputURL = nil
        activeVideoHasAudio = false

        DispatchQueue.main.async {
            stopCompletion?(result as NSDictionary, nil)
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
    ///   - completion: Called with a dictionary `{ filePath, format, metadata }` or an error.
    public func takePhoto(
        positionString: String?,
        formatString: String?,
        completion: @escaping (NSDictionary?, NSError?) -> Void
    ) {
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
                    "{TIFF}": [
                        "DateTime": dateString,
                        "Model": "iPhone Simulator",
                        "Software": "iOS Simulator",
                    ]
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

            let position: AVCaptureDevice.Position
            switch positionString?.lowercased() {
            case "front":
                position = .front
            default:
                position = .back
            }

            let format = Zcam1CaptureFormat(from: formatString)

            self.configureSessionIfNeeded(position: position) { error in
                if let error = error {
                    completion(nil, error as NSError)
                    return
                }

                self.sessionQueue.async {
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

                    if !session.isRunning {
                        session.startRunning()
                    }

                    // Prepare photo settings
                    let settings: AVCapturePhotoSettings

                    switch format {
                    case .jpeg:
                        if self.photoOutput.availablePhotoCodecTypes.contains(.jpeg) {
                            settings = AVCapturePhotoSettings(format: [
                                AVVideoCodecKey: AVVideoCodecType.jpeg
                            ])
                        } else {
                            settings = AVCapturePhotoSettings()
                        }

                    case .dng:
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

                    // Configure flash if available.
                    if let device = self.videoInput?.device, device.hasFlash {
                        if self.photoOutput.supportedFlashModes.contains(self.flashMode) {
                            settings.flashMode = self.flashMode
                        }
                    }

                    // Create delegate to handle capture and keep it alive until completion
                    let delegate = PhotoCaptureDelegate(
                        format: format,
                        owner: self,
                        completion: completion
                    )
                    self.inFlightDelegates.append(delegate)
                    self.photoOutput.capturePhoto(with: settings, delegate: delegate)
                }
            }
        }
    }

    // MARK: - Video Capture API (Objective-C-friendly)

    /// Starts video recording to a temporary `.mov` file.
    /// Call `stopVideoRecording` to finish and receive the final file path.
    public func startVideoRecording(
        positionString: String?,
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

                self.configureSessionIfNeeded(position: position) { error in
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

                        guard !self.movieOutput.isRecording else {
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

                        // Switch session into a video-capable configuration.
                        do {
                            session.beginConfiguration()

                            if session.canSetSessionPreset(.high) {
                                session.sessionPreset = .high
                            }

                            if !session.outputs.contains(self.movieOutput) {
                                if session.canAddOutput(self.movieOutput) {
                                    session.addOutput(self.movieOutput)
                                    // Single, finalized file (no fragments).
                                    self.movieOutput.movieFragmentInterval = .invalid

                                    // Basic recording configuration (orientation + stabilization).
                                    if let connection = self.movieOutput.connection(with: .video) {
                                        if connection.isVideoOrientationSupported {
                                            connection.videoOrientation = .portrait
                                        }
                                        if connection.isVideoStabilizationSupported {
                                            connection.preferredVideoStabilizationMode = .auto
                                        }
                                    }
                                } else {
                                    throw NSError(
                                        domain: "Zcam1CameraService",
                                        code: -43,
                                        userInfo: [
                                            NSLocalizedDescriptionKey:
                                                "Cannot add movie output to session"
                                        ]
                                    )
                                }
                            }

                            // Track whether we actually have an audio input attached (not just permission).
                            self.activeVideoHasAudio = false

                            if micAuthorized {
                                if let existingAudioInput = self.audioInput,
                                    session.inputs.contains(where: { $0 === existingAudioInput })
                                {
                                    self.activeVideoHasAudio = true
                                } else if self.audioInput == nil,
                                    let audioDevice = AVCaptureDevice.default(for: .audio)
                                {
                                    let audioInput = try AVCaptureDeviceInput(device: audioDevice)
                                    if session.canAddInput(audioInput) {
                                        session.addInput(audioInput)
                                        self.audioInput = audioInput
                                        self.activeVideoHasAudio = true
                                    } else {
                                        self.audioInput = nil
                                        self.activeVideoHasAudio = false
                                    }
                                }
                            } else if let audioInput = self.audioInput {
                                session.removeInput(audioInput)
                                self.audioInput = nil
                                self.activeVideoHasAudio = false
                            }

                            session.commitConfiguration()
                        } catch {
                            session.commitConfiguration()
                            DispatchQueue.main.async {
                                completion(nil, error as NSError)
                            }
                            return
                        }

                        if !session.isRunning {
                            session.startRunning()
                        }

                        // Prepare output URL.
                        let filename = "zcam1-\(UUID().uuidString).mov"
                        let tmpURL = FileManager.default.temporaryDirectory.appendingPathComponent(
                            filename)

                        // Remove any existing file at the path (defensive).
                        if FileManager.default.fileExists(atPath: tmpURL.path) {
                            try? FileManager.default.removeItem(at: tmpURL)
                        }

                        self.activeMovieOutputURL = tmpURL
                        self.pendingVideoStartCompletion = completion
                        self.pendingVideoStopCompletion = nil

                        let delegate = MovieCaptureDelegate(owner: self)
                        self.inFlightMovieDelegates.append(delegate)
                        self.movieOutput.startRecording(to: tmpURL, recordingDelegate: delegate)
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

    /// Stops an in-progress video recording and returns `{ filePath, format, durationSeconds? }`.
    public func stopVideoRecording(completion: @escaping (NSDictionary?, NSError?) -> Void) {
        sessionQueue.async {
            guard self.movieOutput.isRecording else {
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

            self.pendingVideoStopCompletion = completion
            self.movieOutput.stopRecording()
        }
    }

}
// Capture delegate implementation moved into the internal PhotoCaptureDelegate helper.

// MARK: - Camera Preview View

/// UIView subclass that displays the live camera preview.
///
/// NEW ARCHITECTURE: Always uses AVCaptureVideoDataOutput for preview rendering.
/// This eliminates the complexity of toggling between preview layer and filtered image view.
/// All frames go through the same pipeline - filter is applied when needed.
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
            reconfigureSession()
        }
    }

    /// "jpeg" or "dng" (controls what JS will request on capture)
    public var captureFormat: String = "jpeg"

    /// Zoom factor (1.0 = no zoom, 2.0 = 2x, etc.)
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

    /// Filter preset name ("normal", "vivid", "mono", "noir", "warm", "cool").
    public var filter: String = "normal" {
        didSet {
            guard oldValue != filter else { return }
            print("[Zcam1CameraView] Filter changed: \(oldValue) -> \(filter)")
            currentFilterEnum = Zcam1CameraFilter(from: filter)
            Zcam1CameraService.shared.setFilter(currentFilterEnum)
        }
    }

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
    private var currentFilterEnum: Zcam1CameraFilter = .normal
    private let ciContext = CIContext(options: [.useSoftwareRenderer: false])
    private var frameCount: Int = 0

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

        // Configure session and start receiving frames.
        reconfigureSession()
    }

    public override func layoutSubviews() {
        super.layoutSubviews()
        previewImageView.frame = bounds
    }

    // MARK: - AVCaptureVideoDataOutputSampleBufferDelegate

    public func captureOutput(
        _ output: AVCaptureOutput,
        didOutput sampleBuffer: CMSampleBuffer,
        from connection: AVCaptureConnection
    ) {
        frameCount += 1
        if frameCount == 1 {
            print("[Zcam1CameraView] FIRST FRAME! filter=\(currentFilterEnum)")
        } else if frameCount % 60 == 0 {
            print("[Zcam1CameraView] frame \(frameCount), filter=\(currentFilterEnum)")
        }

        guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else {
            return
        }

        // Convert pixel buffer to UIImage.
        let ciImage = CIImage(cvPixelBuffer: pixelBuffer)
        guard let cgImage = ciContext.createCGImage(ciImage, from: ciImage.extent) else {
            return
        }

        // Create UIImage with correct orientation for display.
        var displayImage = UIImage(cgImage: cgImage, scale: 1.0, orientation: .up)

        // Apply filter if not normal.
        if currentFilterEnum != .normal {
            displayImage = currentFilterEnum.apply(to: displayImage)
        }

        // Update UI on main thread.
        DispatchQueue.main.async { [weak self] in
            self?.previewImageView.image = displayImage
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
        let positionEnum: AVCaptureDevice.Position = position.lowercased() == "front" ? .front : .back

        svc.configureSessionIfNeeded(position: positionEnum) { [weak self] error in
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
                print("[Zcam1CameraView] Video data output ready")
            } else {
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
