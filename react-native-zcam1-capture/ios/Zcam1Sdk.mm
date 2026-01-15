#import "Zcam1Sdk.h"
#import <Security/Security.h>
#import <AVFoundation/AVFoundation.h>
#if __has_include("Zcam1Sdk-Swift.h")
#import "Zcam1Sdk-Swift.h"
#endif
#import <Security/Security.h>
#import <React/RCTBridgeModule.h>
#if __has_include("Zcam1Sdk-Swift.h")
#import "Zcam1Sdk-Swift.h"
#endif

@interface Zcam1Sdk ()
@end

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
                resolve:(RCTPromiseResolveBlock)resolve
                 reject:(RCTPromiseRejectBlock)reject
{
#if __has_include("Zcam1Sdk-Swift.h")
  if (@available(iOS 16.0, *)) {
    Zcam1CameraService *service = [Zcam1CameraService shared];

    // If empty strings are passed, let Swift fall back to its defaults
    NSString *positionString = (position.length > 0) ? position : nil; // "front" or "back"
    NSString *formatString   = (format.length > 0)   ? format   : nil; // "jpeg" or "dng"

    // Set flash mode before capture.
    if (flash.length > 0) {
      [service setFlashMode:flash];
    }

    [service takePhotoWithPositionString:positionString
                            formatString:formatString
                              completion:^(NSDictionary *result, NSError *error) {
      if (error != nil) {
        NSString *code = @"CAMERA_CAPTURE_ERROR";
        NSString *message = error.localizedDescription ?: @"Failed to capture photo";
        reject(code, message, error);
      } else if (result != nil) {
        resolve(result);
      } else {
        reject(@"CAMERA_CAPTURE_ERROR", @"Capture returned no data", nil);
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
    [[Zcam1CameraService shared] setZoom:factor];
  }
#endif
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

- (void)startNativeVideoRecording:(NSString *)position
                          resolve:(RCTPromiseResolveBlock)resolve
                           reject:(RCTPromiseRejectBlock)reject
{
#if __has_include("Zcam1Sdk-Swift.h")
  if (@available(iOS 16.0, *)) {
    Zcam1CameraService *service = [Zcam1CameraService shared];

    // If empty strings are passed, let Swift fall back to its defaults
    NSString *positionString = (position.length > 0) ? position : nil; // "front" or "back"

    [service startVideoRecordingWithPositionString:positionString
                                       completion:^(NSDictionary *result, NSError *error) {
      if (error != nil) {
        NSString *code = @"VIDEO_RECORDING_START_ERROR";
        NSString *message = error.localizedDescription ?: @"Failed to start video recording";
        reject(code, message, error);
      } else if (result != nil) {
        resolve(result);
      } else {
        reject(@"VIDEO_RECORDING_START_ERROR", @"Start recording returned no data", nil);
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

    [service stopVideoRecordingWithCompletion:^(NSDictionary *result, NSError *error) {
      if (error != nil) {
        NSString *code = @"VIDEO_RECORDING_STOP_ERROR";
        NSString *message = error.localizedDescription ?: @"Failed to stop video recording";
        reject(code, message, error);
      } else if (result != nil) {
        resolve(result);
      } else {
        reject(@"VIDEO_RECORDING_STOP_ERROR", @"Stop recording returned no data", nil);
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

@end
