#import "Zcam1Prove.h"

@implementation Zcam1Prove
- (NSNumber *)multiply:(double)a b:(double)b {
    NSNumber *result = @(a * b);

    return result;
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
    return std::make_shared<facebook::react::NativeZcam1ProveSpecJSI>(params);
}

+ (NSString *)moduleName
{
  return @"Zcam1Prove";
}

@end
