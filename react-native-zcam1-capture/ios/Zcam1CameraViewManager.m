#import <React/RCTViewManager.h>
#import <React/RCTConvert.h>
#import <UIKit/UIKit.h>
#import <AVFoundation/AVFoundation.h>

#if __has_include("Zcam1Sdk-Swift.h")
#import "Zcam1Sdk-Swift.h"
#endif

@interface Zcam1CameraViewManager : RCTViewManager
@end

@implementation Zcam1CameraViewManager

// Expose this view to JS as "Zcam1CameraView", matching the
// name used in `requireNativeComponent("Zcam1CameraView")`.
RCT_EXPORT_MODULE(Zcam1CameraView);

- (UIView *)view
{
#if __has_include("Zcam1Sdk-Swift.h")
  if (@available(iOS 16.0, *)) {
    // Zcam1CameraView is the Swift UIView subclass defined in Zcam1Camera.swift
    return [Zcam1CameraView new];
  }
#endif

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
// @property (nonatomic, copy) NSString *filmStyle;    // "normal" | "mellow" | "bw" | "nostalgic" or custom name
// @property (nonatomic, copy) NSDictionary *filmStyleOverrides; // custom recipes for built-in presets
// @property (nonatomic, copy) NSDictionary *customFilmStyles;   // additional custom film styles by name
// @property (nonatomic) BOOL depthEnabled;            // enable depth data at session level (default: NO)
RCT_EXPORT_VIEW_PROPERTY(isActive, BOOL);
RCT_EXPORT_VIEW_PROPERTY(position, NSString);
RCT_EXPORT_VIEW_PROPERTY(captureFormat, NSString);
RCT_EXPORT_VIEW_PROPERTY(zoom, CGFloat);
RCT_EXPORT_VIEW_PROPERTY(torch, BOOL);
RCT_EXPORT_VIEW_PROPERTY(exposure, float);
RCT_EXPORT_VIEW_PROPERTY(depthEnabled, BOOL);

// Use custom property setter to ensure the Swift setter is called properly.
RCT_CUSTOM_VIEW_PROPERTY(filmStyle, NSString, Zcam1CameraView)
{
  NSString *filmStyleValue = json ? [RCTConvert NSString:json] : @"normal";
  NSLog(@"[Zcam1CameraViewManager] Setting filmStyle to: %@", filmStyleValue);
  view.filmStyle = filmStyleValue;
}

// Custom film style recipe overrides for built-in presets.
RCT_CUSTOM_VIEW_PROPERTY(filmStyleOverrides, NSDictionary, Zcam1CameraView)
{
  NSDictionary *overrides = json ? [RCTConvert NSDictionary:json] : nil;
  NSLog(@"[Zcam1CameraViewManager] Setting filmStyleOverrides: %@", overrides ? @"present" : @"nil");
  view.filmStyleOverrides = overrides;
}

// Additional custom film styles defined by name.
RCT_CUSTOM_VIEW_PROPERTY(customFilmStyles, NSDictionary, Zcam1CameraView)
{
  NSDictionary *custom = json ? [RCTConvert NSDictionary:json] : nil;
  NSLog(@"[Zcam1CameraViewManager] Setting customFilmStyles: %@", custom ? @"present" : @"nil");
  view.customFilmStyles = custom;
}

@end
