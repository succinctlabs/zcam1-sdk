#import "Zcam1C2pa.h"
#import <Security/Security.h>
#import <AVFoundation/AVFoundation.h>
#if __has_include("Zcam1C2pa-Swift.h")
#import "Zcam1C2pa-Swift.h"
#endif
#import <Security/Security.h>
#import <React/RCTBridgeModule.h>
#if __has_include("Zcam1C2pa-Swift.h")
#import "Zcam1C2pa-Swift.h"
#endif

@interface Zcam1C2pa ()
@end

@implementation Zcam1C2pa
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
    return std::make_shared<facebook::react::NativeZcam1C2paSpecJSI>(params);
}

+ (NSString *)moduleName
{
  return @"Zcam1C2pa";
}

// MARK: - Minimal C2PA bridge helpers

- (void)readFile:(NSString *)path
          resolve:(RCTPromiseResolveBlock)resolve
           reject:(RCTPromiseRejectBlock)reject
{
#if __has_include("Zcam1C2pa-Swift.h")
  if (@available(iOS 16.0, *)) {
    NSURL *src = ([path hasPrefix:@"file://"] ? [NSURL URLWithString:path] : [NSURL fileURLWithPath:path]);
    NSError *error = nil;

    NSString *json = [C2PAService readFile:src
                                     error:&error];
    if (json != nil) {
      resolve(json);
      return;
    }
    NSString *code = @"C2PA_SIGN_IMAGE";
    NSString *message = error.localizedDescription ?: @"Failed to sign image";
    reject(code, message, error);
    return;
  }
#endif
  reject(@"C2PA_UNAVAILABLE", @"C2PA signing requires iOS 16+ and Swift component", nil);
}

- (void)signImage:(NSString *)sourcePath
  destinationPath:(NSString *)destinationPath
     manifestJSON:(NSString *)manifestJSON
           keyTag:(NSString *)keyTag
certificateChainPEM:(NSString *)certificateChainPEM
           tsaURL:(NSString *)tsaURL
            embed:(NSNumber *)embed
          resolve:(RCTPromiseResolveBlock)resolve
           reject:(RCTPromiseRejectBlock)reject
{
#if __has_include("Zcam1C2pa-Swift.h")
  if (@available(iOS 16.0, *)) {
    NSURL *src = ([sourcePath hasPrefix:@"file://"] ? [NSURL URLWithString:sourcePath] : [NSURL fileURLWithPath:sourcePath]);
    NSURL *dst = ([destinationPath hasPrefix:@"file://"] ? [NSURL URLWithString:destinationPath] : [NSURL fileURLWithPath:destinationPath]);
    NSError *error = nil;
    NSString *tsa = (tsaURL.length > 0 ? tsaURL : nil);
    BOOL embedBool = (embed != nil) ? [embed boolValue] : YES;
    NSData *manifest = [C2PAService signImageAt:src
                                             to:dst
                                  manifestJSON:manifestJSON
                                        keyTag:keyTag
                          certificateChainPEM:certificateChainPEM
                                        tsaURL:tsa
                                         embed:embedBool
                                         error:&error];
    if (manifest != nil) {
      resolve([manifest base64EncodedStringWithOptions:0]);
      return;
    }
    NSString *code = @"C2PA_SIGN_IMAGE";
    NSString *message = error.localizedDescription ?: @"Failed to sign image";
    reject(code, message, error);
    return;
  }
#endif
  reject(@"C2PA_UNAVAILABLE", @"C2PA signing requires iOS 16+ and Swift component", nil);
}

- (void)signImageWithDataHashed:(NSString *)sourcePath
  destinationPath:(NSString *)destinationPath
     manifestJSON:(NSString *)manifestJSON
           keyTag:(NSString *)keyTag
         dataHash:(NSString *)dataHash
certificateChainPEM:(NSString *)certificateChainPEM
           tsaURL:(NSString *)tsaURL
            embed:(NSNumber *)embed
          resolve:(RCTPromiseResolveBlock)resolve
           reject:(RCTPromiseRejectBlock)reject
{
#if __has_include("Zcam1C2pa-Swift.h")
  if (@available(iOS 16.0, *)) {
    NSURL *src = ([sourcePath hasPrefix:@"file://"] ? [NSURL URLWithString:sourcePath] : [NSURL fileURLWithPath:sourcePath]);
    NSURL *dst = ([destinationPath hasPrefix:@"file://"] ? [NSURL URLWithString:destinationPath] : [NSURL fileURLWithPath:destinationPath]);
    NSError *error = nil;
    NSString *tsa = (tsaURL.length > 0 ? tsaURL : nil);
    BOOL embedBool = (embed != nil) ? [embed boolValue] : YES;

    NSData *manifest = [C2PAService signImageWithDataHashedAt:src
                                             to:dst
                                  manifestJSON:manifestJSON
                                        keyTag:keyTag
                                      dataHash:dataHash
                          certificateChainPEM:certificateChainPEM
                                        tsaURL:tsa
                                         embed:embedBool
                                         error:&error];
    if (manifest != nil) {
      resolve([manifest base64EncodedStringWithOptions:0]);
      return;
    }
    NSString *code = @"C2PA_SIGN_IMAGE";
    NSString *message = error.localizedDescription ?: @"Failed to sign image";
    reject(code, message, error);
    return;
  }
#endif
  reject(@"C2PA_UNAVAILABLE", @"C2PA signing requires iOS 16+ and Swift component", nil);
}

@end
