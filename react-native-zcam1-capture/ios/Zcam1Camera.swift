//
//  Zcam1Camera.swift
//  react-native-zcam1-sdk
//
//  Native camera view + service using AVFoundation for preview and capture.
//

import AVFoundation
import Foundation
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

        guard let data = photo.fileDataRepresentation(), !data.isEmpty else {
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
    private let photoOutput = AVCapturePhotoOutput()

    // Serial queue for all session operations
    private let sessionQueue = DispatchQueue(label: "com.anonymous.zcam1poc.camera.session")

    // Keep strong references to in-flight delegates so they live until completion
    private var inFlightDelegates: [PhotoCaptureDelegate] = []

    // Camera control state
    private var currentZoom: CGFloat = 1.0
    private var flashMode: AVCaptureDevice.FlashMode = .off
    private var currentExposureBias: Float = 0.0

    private override init() {
        super.init()
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
                session.sessionPreset = .photo

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
                let maxZoom = min(device.maxAvailableVideoZoomFactor, 15.0)
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
        return min(device.maxAvailableVideoZoomFactor, 15.0)
    }

    /// Get the zoom factors where the device switches between physical lenses.
    /// Returns empty array for single-camera devices.
    /// For triple camera: typically [2.0, 6.0] meaning switch to wide at 2x, telephoto at 6x.
    public func getSwitchOverZoomFactors() -> [CGFloat] {
        guard let device = videoInput?.device else { return [] }
        return device.virtualDeviceSwitchOverVideoZoomFactors.map { CGFloat($0.doubleValue) }
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

}
// Capture delegate implementation moved into the internal PhotoCaptureDelegate helper.

// MARK: - Camera Preview View

/// UIView subclass that displays the live camera preview using AVCaptureVideoPreviewLayer.
///
/// This view is intended to be wrapped by a React Native view manager
/// and controlled via props such as `isActive` and `position`.
@available(iOS 16.0, *)
@objc(Zcam1CameraView)
@objcMembers
public final class Zcam1CameraView: UIView {

    // Exposed properties (KVC/KVO friendly for RN)
    public var isActive: Bool = true {
        didSet {
            updateRunningState()
        }
    }

    /// "front" or "back"
    public var position: String = "back" {
        didSet {
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

    // Convenience access to the preview layer
    private var previewLayer: AVCaptureVideoPreviewLayer {
        return layer as! AVCaptureVideoPreviewLayer
    }

    public override init(frame: CGRect) {
        super.init(frame: frame)
        commonInit()
    }

    public required init?(coder: NSCoder) {
        super.init(coder: coder)
        commonInit()
    }

    public override class var layerClass: AnyClass {
        return AVCaptureVideoPreviewLayer.self
    }

    private func commonInit() {
        backgroundColor = .black
        previewLayer.videoGravity = .resizeAspectFill

        // Attach the shared session if already configured
        if let session = Zcam1CameraService.shared.captureSession {
            previewLayer.session = session
        }

        reconfigureSession()
    }

    public override func layoutSubviews() {
        super.layoutSubviews()
        previewLayer.frame = bounds
    }

    // MARK: - Session Wiring

    private func reconfigureSession() {
        let svc = Zcam1CameraService.shared
        let positionEnum: AVCaptureDevice.Position

        switch position.lowercased() {
        case "front":
            positionEnum = .front
        default:
            positionEnum = .back
        }

        svc.configureSessionIfNeeded(position: positionEnum) { [weak self] error in
            guard let self = self else { return }
            if error == nil, let session = svc.captureSession {
                self.previewLayer.session = session
                self.updateRunningState()
                // Re-apply camera settings after session is configured.
                self.applyCurrentSettings()
            }
        }
    }

    /// Apply current zoom, torch, and exposure settings to the camera.
    /// Called after session configuration to ensure settings are applied.
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
