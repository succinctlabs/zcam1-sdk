require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "Zcam1Sdk"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => "16.0" }
  s.source       = { :git => ".git", :tag => "#{s.version}" }
  s.swift_versions = ["5.9"]

  s.source_files = "ios/**/*.{h,m,mm,cpp,swift}"
  s.private_header_files = "ios/**/*.h"

  s.frameworks = ["QuickLook"]

  # Swift module configuration
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES'
  }

  # Harbeth: GPU-accelerated image/video/camera filter library.
  s.dependency "Harbeth", "~> 1.1"

  install_modules_dependencies(s)

  # Add dependency on ReactCodegen for codegen headers
  s.dependency "ReactCodegen"

  # Add user header search paths for codegen
  s.user_target_xcconfig = {
    'HEADER_SEARCH_PATHS' => '$(inherited) "$(PODS_TARGET_SRCROOT)/../../../apps/zcam/ios/build/generated/ios"'
  }

end
