#import <React/RCTViewManager.h>
#import <React/RCTConvert.h>
#import <UIKit/UIKit.h>
#import <AVFoundation/AVFoundation.h>

#import "ReactNativeZcam1-Swift.h"

@interface Zcam1CameraViewManager : RCTViewManager
@end

@implementation Zcam1CameraViewManager

// Expose this view to JS as "Zcam1CameraView", matching the
// name used in `requireNativeComponent("Zcam1CameraView")`.
RCT_EXPORT_MODULE(Zcam1CameraView);

- (UIView *)view
{
  if (@available(iOS 16.0, *)) {
    // Zcam1CameraView is the Swift UIView subclass defined in Zcam1Camera.swift
    return [Zcam1CameraView new];
  }

  // Fallback dummy view if the Swift implementation is not available
  UIView *fallback = [UIView new];
  fallback.backgroundColor = [UIColor blackColor];
  return fallback;
}

+ (BOOL)requiresMainQueueSetup
{
  // Camera / UIKit objects must be created on the main thread
  return YES;
}

// Props bridged to Swift Zcam1CameraView:
//
// @property (nonatomic) BOOL isActive;
// @property (nonatomic, copy) NSString *position;      // "front" | "back"
// @property (nonatomic, copy) NSString *captureFormat; // "jpeg" | "dng"
// @property (nonatomic) CGFloat zoom;                  // 1.0 = no zoom
// @property (nonatomic) BOOL torch;                    // torch on/off
// @property (nonatomic) float exposure;               // exposure bias in EV
// @property (nonatomic, copy) NSString *filter;       // "normal" | "vivid" | "mono" | "noir" | "warm" | "cool"
RCT_EXPORT_VIEW_PROPERTY(isActive, BOOL);
RCT_EXPORT_VIEW_PROPERTY(position, NSString);
RCT_EXPORT_VIEW_PROPERTY(captureFormat, NSString);
RCT_EXPORT_VIEW_PROPERTY(zoom, CGFloat);
RCT_EXPORT_VIEW_PROPERTY(torch, BOOL);
RCT_EXPORT_VIEW_PROPERTY(exposure, float);

// Use custom property setter to ensure the Swift setter is called properly.
RCT_CUSTOM_VIEW_PROPERTY(filter, NSString, Zcam1CameraView)
{
  NSString *filterValue = json ? [RCTConvert NSString:json] : @"normal";
  NSLog(@"[Zcam1CameraViewManager] Setting filter to: %@", filterValue);
  view.filter = filterValue;
}

@end
