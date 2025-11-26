#import "Zcam1C2pa.h"
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

@interface Zcam1C2pa ()
- (BOOL)c2pa_ensureSecureEnclaveKey:(NSString *)keyTag
                              error:(NSError * _Nullable * _Nullable)error;
- (nullable NSString *)c2pa_exportPublicKeyPEM:(NSString *)keyTag
                                         error:(NSError * _Nullable * _Nullable)error;
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

// Ensure a Secure Enclave P-256 private key exists for the given keyTag.
// Returns YES on success (key existed or was created), NO on error.
- (BOOL)c2pa_ensureSecureEnclaveKey:(NSString *)keyTag
                              error:(NSError * _Nullable * _Nullable)error
{
  NSDictionary *query = @{
    (__bridge id)kSecClass: (__bridge id)kSecClassKey,
    (__bridge id)kSecAttrApplicationTag: keyTag,
    (__bridge id)kSecAttrKeyType: (__bridge id)kSecAttrKeyTypeECSECPrimeRandom,
    (__bridge id)kSecAttrTokenID: (__bridge id)kSecAttrTokenIDSecureEnclave,
    (__bridge id)kSecReturnRef: @YES,
    (__bridge id)kSecMatchLimit: (__bridge id)kSecMatchLimitOne,
  };
  CFTypeRef item = NULL;
  OSStatus status = SecItemCopyMatching((__bridge CFDictionaryRef)query, &item);
  if (status == errSecSuccess) {
    if (item) CFRelease(item);
    return YES;
  }
  if (status != errSecItemNotFound) {
    if (error) {
      *error = [NSError errorWithDomain:NSOSStatusErrorDomain
                                   code:status
                               userInfo:@{NSLocalizedDescriptionKey: @"Failed to access Secure Enclave key"}];
    }
    return NO;
  }

  CFErrorRef cfErr = NULL;
  SecAccessControlRef access = SecAccessControlCreateWithFlags(
      kCFAllocatorDefault,
      kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
      kSecAccessControlPrivateKeyUsage,
      &cfErr);
  if (!access) {
    if (error) *error = CFBridgingRelease(cfErr);
    return NO;
  }

  NSDictionary *attrs = @{
    (__bridge id)kSecAttrKeyType: (__bridge id)kSecAttrKeyTypeECSECPrimeRandom,
    (__bridge id)kSecAttrKeySizeInBits: @256,
    (__bridge id)kSecAttrTokenID: (__bridge id)kSecAttrTokenIDSecureEnclave,
    (__bridge id)kSecPrivateKeyAttrs: @{
      (__bridge id)kSecAttrIsPermanent: @YES,
      (__bridge id)kSecAttrApplicationTag: keyTag,
      (__bridge id)kSecAttrAccessControl: (__bridge id)access
    }
  };

  SecKeyRef privateKey = SecKeyCreateRandomKey((__bridge CFDictionaryRef)attrs, &cfErr);
  CFRelease(access);
  if (!privateKey) {
    if (error) *error = CFBridgingRelease(cfErr);
    return NO;
  }
  CFRelease(privateKey);
  return YES;
}

// Export the public key (SubjectPublicKeyInfo) as PEM for the key identified by keyTag.
- (nullable NSString *)c2pa_exportPublicKeyPEM:(NSString *)keyTag
                                         error:(NSError * _Nullable * _Nullable)error
{
  NSDictionary *query = @{
    (__bridge id)kSecClass: (__bridge id)kSecClassKey,
    (__bridge id)kSecAttrApplicationTag: keyTag,
    (__bridge id)kSecAttrKeyType: (__bridge id)kSecAttrKeyTypeECSECPrimeRandom,
    (__bridge id)kSecReturnRef: @YES,
    (__bridge id)kSecMatchLimit: (__bridge id)kSecMatchLimitOne,
  };

  CFTypeRef item = NULL;
  OSStatus status = SecItemCopyMatching((__bridge CFDictionaryRef)query, &item);
  if (status != errSecSuccess) {
    if (error) {
      *error = [NSError errorWithDomain:NSOSStatusErrorDomain
                                   code:status
                               userInfo:@{NSLocalizedDescriptionKey: [NSString stringWithFormat:@"Failed to find key '%@' in keychain", keyTag]}];
    }
    return nil;
  }

  SecKeyRef privateKey = (SecKeyRef)item;
  SecKeyRef publicKey = SecKeyCopyPublicKey(privateKey);
  if (!publicKey) {
    if (error) {
      *error = [NSError errorWithDomain:@"C2PA"
                                   code:-1
                               userInfo:@{NSLocalizedDescriptionKey: @"Failed to extract public key"}];
    }
    CFRelease(privateKey);
    return nil;
  }

  CFErrorRef cfErr = NULL;
  CFDataRef publicKeyData = SecKeyCopyExternalRepresentation(publicKey, &cfErr);
  if (!publicKeyData) {
    if (error) {
      NSError *nserr = CFBridgingRelease(cfErr);
      *error = nserr ?: [NSError errorWithDomain:@"C2PA"
                                            code:-1
                                        userInfo:@{NSLocalizedDescriptionKey: @"Failed to export public key"}];
    }
    CFRelease(publicKey);
    CFRelease(privateKey);
    return nil;
  }

  NSString *base64 = [(__bridge NSData *)publicKeyData
                      base64EncodedStringWithOptions:(NSDataBase64Encoding64CharacterLineLength)];
  NSString *pem = [NSString stringWithFormat:@"-----BEGIN PUBLIC KEY-----\n%@\n-----END PUBLIC KEY-----", base64];

  CFRelease(publicKeyData);
  CFRelease(publicKey);
  CFRelease(privateKey);

  return pem;
}

- (void)ensureSecureEnclaveKey:(NSString *)keyTag
                       resolve:(RCTPromiseResolveBlock)resolve
                        reject:(RCTPromiseRejectBlock)reject
{
  NSError *error = nil;
  BOOL ok = [self c2pa_ensureSecureEnclaveKey:keyTag error:&error];
  if (ok) {
    resolve(@(YES));
  } else {
    NSString *code = @"C2PA_SE_KEY";
    NSString *message = error.localizedDescription ?: @"Failed to ensure Secure Enclave key";
    reject(code, message, error);
  }
}

- (void)exportPublicKeyPEM:(NSString *)keyTag
                   resolve:(RCTPromiseResolveBlock)resolve
                    reject:(RCTPromiseRejectBlock)reject
{
  NSError *error = nil;
  NSString *pem = [self c2pa_exportPublicKeyPEM:keyTag error:&error];
  if (pem != nil && pem.length > 0) {
    resolve(pem);
  } else {
    NSString *code = @"C2PA_EXPORT_PUBKEY";
    NSString *message = error.localizedDescription ?: @"Failed to export public key PEM";
    reject(code, message, error);
  }
}

- (void)createSelfSignedCertificatePEM:(NSString *)keyTag
                           commonName:(NSString *)commonName
                          organization:(NSString *)organization
                   organizationalUnit:(NSString *)organizationalUnit
                              country:(NSString *)country
                             locality:(NSString *)locality
                      stateOrProvince:(NSString *)stateOrProvince
                            validDays:(NSNumber *)validDays
                              resolve:(RCTPromiseResolveBlock)resolve
                               reject:(RCTPromiseRejectBlock)reject
{
#if __has_include("Zcam1C2pa-Swift.h")
  NSError *error = nil;
  NSInteger days = validDays != nil ? [validDays integerValue] : 365;
  NSString *pem = [CerificateService createSelfSignedCertificatePEMForKeyTag:keyTag
                                                                 commonName:commonName
                                                                organization:(organization.length > 0 ? organization : nil)
                                                         organizationalUnit:(organizationalUnit.length > 0 ? organizationalUnit : nil)
                                                                    country:(country.length > 0 ? country : nil)
                                                                   locality:(locality.length > 0 ? locality : nil)
                                                            stateOrProvince:(stateOrProvince.length > 0 ? stateOrProvince : nil)
                                                                  validDays:days
                                                                      error:&error];
  if (pem != nil && pem.length > 0) {
    resolve(pem);
    return;
  }
  NSString *code = @"C2PA_CERT_CREATE";
  NSString *message = error.localizedDescription ?: @"Failed to create self-signed certificate PEM";
  reject(code, message, error);
#else
  reject(@"C2PA_UNAVAILABLE", @"Certificate creation requires iOS Swift component", nil);
#endif
}

- (void)createCertificateChainPEM:(NSString *)keyTag
                       commonName:(NSString *)commonName
                      organization:(NSString *)organization
               organizationalUnit:(NSString *)organizationalUnit
                          country:(NSString *)country
                         locality:(NSString *)locality
                  stateOrProvince:(NSString *)stateOrProvince
                        validDays:(NSNumber *)validDays
                          resolve:(RCTPromiseResolveBlock)resolve
                           reject:(RCTPromiseRejectBlock)reject
{
#if __has_include("Zcam1C2pa-Swift.h")
  NSError *error = nil;
  NSInteger days = validDays != nil ? [validDays integerValue] : 365;
  NSString *pem = [CerificateService createCertificateChainPEMForKeyTag:keyTag
                                                             commonName:commonName
                                                            organization:organization
                                                     organizationalUnit:(organizationalUnit.length > 0 ? organizationalUnit : nil)
                                                                country:(country.length > 0 ? country : nil)
                                                               locality:(locality.length > 0 ? locality : nil)
                                                        stateOrProvince:(stateOrProvince.length > 0 ? stateOrProvince : nil)
                                                              validDays:days
                                                                  error:&error];
  if (pem != nil && pem.length > 0) {
    resolve(pem);
    return;
  }
  NSString *code = @"C2PA_CERT_CHAIN_CREATE";
  NSString *message = error.localizedDescription ?: @"Failed to create certificate chain PEM";
  reject(code, message, error);
#else
  reject(@"C2PA_UNAVAILABLE", @"Certificate chain creation requires iOS Swift component", nil);
#endif
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

- (void)takeNativePhoto:(NSString *)format
                         position:(NSString *)position
                          resolve:(RCTPromiseResolveBlock)resolve
                           reject:(RCTPromiseRejectBlock)reject
{
#if __has_include("Zcam1C2pa-Swift.h")
  if (@available(iOS 16.0, *)) {
    Zcam1CameraService *service = [Zcam1CameraService shared];

    // If empty strings are passed, let Swift fall back to its defaults
    NSString *positionString = (position.length > 0) ? position : nil; // "front" or "back"
    NSString *formatString   = (format.length > 0)   ? format   : nil; // "jpeg" or "dng"

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

@end
