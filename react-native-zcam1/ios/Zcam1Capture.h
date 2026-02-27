
#ifdef RCT_NEW_ARCH_ENABLED
#import <Zcam1SdkSpec/Zcam1SdkSpec.h>

@interface Zcam1Capture : NSObject <NativeZcam1CaptureSpec>

#else
#import <React/RCTBridgeModule.h>

@interface Zcam1Capture : NSObject <RCTBridgeModule>
#endif

@end
