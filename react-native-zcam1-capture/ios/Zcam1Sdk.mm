#import "Zcam1Sdk.h"
#import <Security/Security.h>
#import <AVFoundation/AVFoundation.h>
#if __has_include("Zcam1Sdk-Swift.h")
#import "Zcam1Sdk-Swift.h"
#endif
#import <React/RCTBridgeModule.h>

// Static storage for pending promise callbacks - stored outside the instance to ensure they survive.
static NSMutableDictionary<NSString *, RCTPromiseResolveBlock> *sPendingResolvers = nil;
static NSMutableDictionary<NSString *, RCTPromiseRejectBlock> *sPendingRejecters = nil;
static dispatch_once_t sOnceToken;

static void ensureStaticStorageInitialized(void) {
    dispatch_once(&sOnceToken, ^{
        sPendingResolvers = [NSMutableDictionary new];
        sPendingRejecters = [NSMutableDictionary new];
    });
}

@implementation Zcam1Sdk

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
    return std::make_shared<facebook::react::NativeZcam1SdkSpecJSI>(params);
}

+ (NSString *)moduleName
{
  return @"Zcam1Sdk";
}


- (void)takeNativePhoto:(NSString *)format
               position:(NSString *)position
                  flash:(NSString *)flash
       includeDepthData:(BOOL)includeDepthData
                resolve:(RCTPromiseResolveBlock)resolve
                 reject:(RCTPromiseRejectBlock)reject
{
#if __has_include("Zcam1Sdk-Swift.h")
  if (@available(iOS 16.0, *)) {
    Zcam1CameraService *service = [Zcam1CameraService shared];

    // If empty strings are passed, let Swift fall back to its defaults.
    NSString *positionString = (position.length > 0) ? position : nil;
    NSString *formatString   = (format.length > 0)   ? format   : nil;

    // Set flash mode before capture.
    if (flash.length > 0) {
      [service setFlashMode:flash];
    }

    // Store callbacks in static storage with a unique key.
    // This ensures they survive regardless of TurboModule instance lifecycle.
    ensureStaticStorageInitialized();
    NSString *callbackKey = [[NSUUID UUID] UUIDString];
    @synchronized (sPendingResolvers) {
      sPendingResolvers[callbackKey] = [resolve copy];
      sPendingRejecters[callbackKey] = [reject copy];
    }

    [service takePhotoWithPositionString:positionString
                            formatString:formatString
                       includeDepthData:includeDepthData
                              completion:^(NSDictionary *result, NSError *error) {
      // Retrieve and remove callbacks from static storage.
      RCTPromiseResolveBlock storedResolve = nil;
      RCTPromiseRejectBlock storedReject = nil;
      @synchronized (sPendingResolvers) {
        storedResolve = sPendingResolvers[callbackKey];
        storedReject = sPendingRejecters[callbackKey];
        [sPendingResolvers removeObjectForKey:callbackKey];
        [sPendingRejecters removeObjectForKey:callbackKey];
      }

      if (error != nil) {
        NSString *code = @"CAMERA_CAPTURE_ERROR";
        NSString *message = error.localizedDescription ?: @"Failed to capture photo";
        if (storedReject) storedReject(code, message, error);
      } else if (result != nil) {
        if (storedResolve) storedResolve(result);
      } else {
        if (storedReject) storedReject(@"CAMERA_CAPTURE_ERROR", @"Capture returned no data", nil);
      }
    }];
    return;
  }

  // iOS version too old for the Swift camera implementation.
  reject(@"CAMERA_UNAVAILABLE", @"Native camera requires iOS 16+ and Swift component", nil);
#else
  // Swift-generated header is not available (no Swift camera implementation linked).
  reject(@"CAMERA_UNAVAILABLE", @"Native camera requires iOS Swift component", nil);
#endif
}

- (void)setZoom:(double)factor
{
#if __has_include("Zcam1Sdk-Swift.h")
  if (@available(iOS 16.0, *)) {
    [[Zcam1CameraService shared] setZoom:factor animated:NO];
  }
#endif
}

- (void)setZoomAnimated:(double)factor
{
#if __has_include("Zcam1Sdk-Swift.h")
  if (@available(iOS 16.0, *)) {
    // Use immediate:YES to skip session queue dispatch for lowest latency during pinch gestures.
    [[Zcam1CameraService shared] setZoom:factor animated:NO immediate:YES];
  }
#endif
}

- (void)getMinZoom:(RCTPromiseResolveBlock)resolve
            reject:(RCTPromiseRejectBlock)reject
{
#if __has_include("Zcam1Sdk-Swift.h")
  if (@available(iOS 16.0, *)) {
    CGFloat minZoom = [[Zcam1CameraService shared] getMinZoom];
    resolve(@(minZoom));
    return;
  }
#endif
  resolve(@(1.0));
}

- (void)getMaxZoom:(RCTPromiseResolveBlock)resolve
            reject:(RCTPromiseRejectBlock)reject
{
#if __has_include("Zcam1Sdk-Swift.h")
  if (@available(iOS 16.0, *)) {
    CGFloat maxZoom = [[Zcam1CameraService shared] getMaxZoom];
    resolve(@(maxZoom));
    return;
  }
#endif
  resolve(@(1.0));
}

- (void)getSwitchOverZoomFactors:(RCTPromiseResolveBlock)resolve
                          reject:(RCTPromiseRejectBlock)reject
{
#if __has_include("Zcam1Sdk-Swift.h")
  if (@available(iOS 16.0, *)) {
    NSArray<NSNumber *> *factors = [[Zcam1CameraService shared] getSwitchOverZoomFactors];
    resolve(factors);
    return;
  }
#endif
  resolve(@[]);
}

- (void)hasUltraWideCamera:(RCTPromiseResolveBlock)resolve
                    reject:(RCTPromiseRejectBlock)reject
{
#if __has_include("Zcam1Sdk-Swift.h")
  if (@available(iOS 16.0, *)) {
    BOOL hasUltraWide = [[Zcam1CameraService shared] hasUltraWideCamera];
    resolve(@(hasUltraWide));
    return;
  }
#endif
  resolve(@(NO));
}

- (void)focusAtPoint:(double)x
                   y:(double)y
{
#if __has_include("Zcam1Sdk-Swift.h")
  if (@available(iOS 16.0, *)) {
    CGPoint point = CGPointMake(x, y);
    [[Zcam1CameraService shared] focusAtPoint:point];
  }
#endif
}

- (void)getDeviceDiagnostics:(RCTPromiseResolveBlock)resolve
                      reject:(RCTPromiseRejectBlock)reject
{
#if __has_include("Zcam1Sdk-Swift.h")
  if (@available(iOS 16.0, *)) {
    NSDictionary *diagnostics = [[Zcam1CameraService shared] getDeviceDiagnostics];
    resolve(diagnostics);
    return;
  }
#endif
  resolve(@{@"error": @"Diagnostics not available"});
}

- (void)startNativeVideoRecording:(NSString *)position
                          resolve:(RCTPromiseResolveBlock)resolve
                           reject:(RCTPromiseRejectBlock)reject
{
#if __has_include("Zcam1Sdk-Swift.h")
  if (@available(iOS 16.0, *)) {
    Zcam1CameraService *service = [Zcam1CameraService shared];

    // If empty strings are passed, let Swift fall back to its defaults.
    NSString *positionString = (position.length > 0) ? position : nil;

    // Store callbacks in static storage with a unique key.
    ensureStaticStorageInitialized();
    NSString *callbackKey = [[NSUUID UUID] UUIDString];
    @synchronized (sPendingResolvers) {
      sPendingResolvers[callbackKey] = [resolve copy];
      sPendingRejecters[callbackKey] = [reject copy];
    }

    [service startVideoRecordingWithPositionString:positionString
                                       completion:^(NSDictionary *result, NSError *error) {
      RCTPromiseResolveBlock storedResolve = nil;
      RCTPromiseRejectBlock storedReject = nil;
      @synchronized (sPendingResolvers) {
        storedResolve = sPendingResolvers[callbackKey];
        storedReject = sPendingRejecters[callbackKey];
        [sPendingResolvers removeObjectForKey:callbackKey];
        [sPendingRejecters removeObjectForKey:callbackKey];
      }

      if (error != nil) {
        NSString *code = @"VIDEO_RECORDING_START_ERROR";
        NSString *message = error.localizedDescription ?: @"Failed to start video recording";
        if (storedReject) storedReject(code, message, error);
      } else if (result != nil) {
        if (storedResolve) storedResolve(result);
      } else {
        if (storedReject) storedReject(@"VIDEO_RECORDING_START_ERROR", @"Start recording returned no data", nil);
      }
    }];
    return;
  }

  // iOS version too old for the Swift camera implementation.
  reject(@"CAMERA_UNAVAILABLE", @"Native camera requires iOS 16+ and Swift component", nil);
#else
  // Swift-generated header is not available (no Swift camera implementation linked).
  reject(@"CAMERA_UNAVAILABLE", @"Native camera requires iOS Swift component", nil);
#endif
}

- (void)stopNativeVideoRecording:(RCTPromiseResolveBlock)resolve
                          reject:(RCTPromiseRejectBlock)reject
{
#if __has_include("Zcam1Sdk-Swift.h")
  if (@available(iOS 16.0, *)) {
    Zcam1CameraService *service = [Zcam1CameraService shared];

    // Store callbacks in static storage with a unique key.
    ensureStaticStorageInitialized();
    NSString *callbackKey = [[NSUUID UUID] UUIDString];
    @synchronized (sPendingResolvers) {
      sPendingResolvers[callbackKey] = [resolve copy];
      sPendingRejecters[callbackKey] = [reject copy];
    }

    [service stopVideoRecordingWithCompletion:^(NSDictionary *result, NSError *error) {
      RCTPromiseResolveBlock storedResolve = nil;
      RCTPromiseRejectBlock storedReject = nil;
      @synchronized (sPendingResolvers) {
        storedResolve = sPendingResolvers[callbackKey];
        storedReject = sPendingRejecters[callbackKey];
        [sPendingResolvers removeObjectForKey:callbackKey];
        [sPendingRejecters removeObjectForKey:callbackKey];
      }

      if (error != nil) {
        NSString *code = @"VIDEO_RECORDING_STOP_ERROR";
        NSString *message = error.localizedDescription ?: @"Failed to stop video recording";
        if (storedReject) storedReject(code, message, error);
      } else if (result != nil) {
        if (storedResolve) storedResolve(result);
      } else {
        if (storedReject) storedReject(@"VIDEO_RECORDING_STOP_ERROR", @"Stop recording returned no data", nil);
      }
    }];
    return;
  }

  // iOS version too old for the Swift camera implementation.
  reject(@"CAMERA_UNAVAILABLE", @"Native camera requires iOS 16+ and Swift component", nil);
#else
  // Swift-generated header is not available (no Swift camera implementation linked).
  reject(@"CAMERA_UNAVAILABLE", @"Native camera requires iOS Swift component", nil);
#endif
}

- (void)getDepthSensorInfo:(RCTPromiseResolveBlock)resolve
                    reject:(RCTPromiseRejectBlock)reject
{
#if __has_include("Zcam1Sdk-Swift.h")
  if (@available(iOS 16.0, *)) {
    // Check if current device supports depth data capture
    AVCaptureDevice *device = [AVCaptureDevice defaultDeviceWithDeviceType:AVCaptureDeviceTypeBuiltInDualCamera
                                                                     mediaType:AVMediaTypeVideo
                                                                      position:AVCaptureDevicePositionBack];

    // Also try triple camera and dual wide camera for broader support
    if (!device) {
      device = [AVCaptureDevice defaultDeviceWithDeviceType:AVCaptureDeviceTypeBuiltInTripleCamera
                                                   mediaType:AVMediaTypeVideo
                                                    position:AVCaptureDevicePositionBack];
    }

    if (!device) {
      device = [AVCaptureDevice defaultDeviceWithDeviceType:AVCaptureDeviceTypeBuiltInDualWideCamera
                                                   mediaType:AVMediaTypeVideo
                                                    position:AVCaptureDevicePositionBack];
    }

    BOOL supportsDepth = device != nil;

    NSMutableArray<NSString *> *formats = [NSMutableArray array];
    if (supportsDepth) {
      [formats addObject:@"depthFloat32"];
      [formats addObject:@"depthFloat16"];
      [formats addObject:@"disparityFloat32"];
      [formats addObject:@"disparityFloat16"];
    }

    NSDictionary *result = @{
      @"available": @(supportsDepth),
      @"formats": formats,
    };

    resolve(result);
    return;
  }

  // iOS version too old
  resolve(nil);
#else
  // Swift-generated header is not available
  resolve(nil);
#endif
}

@end
