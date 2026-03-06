require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))
folly_compiler_flags = '-DFOLLY_NO_CONFIG -DFOLLY_MOBILE=1 -DFOLLY_USE_LIBCPP=1 -Wno-comma -Wno-shorten-64-to-32'

Pod::Spec.new do |s|
  s.name         = "Zcam1Sdk"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => min_ios_version_supported }
  s.source       = { :git => "https://github.com/succinctlabs/zcam1-sdk.git", :tag => "#{s.version}" }

  # Proving is opt-in.
  #
  # Enable proving in one of these ways:
  #
  # 1) Environment variable (works for Expo + non-Expo):
  #    - ZCAM1_ENABLE_PROVING=1 pod install
  #    - or set ENV["ZCAM1_ENABLE_PROVING"] = "1" early in your Podfile
  #
  # 2) Podfile.properties.json (recommended for Expo plugins that want to avoid editing Podfile):
  #    - ios/Podfile.properties.json:
  #        { "zcam1EnableProving": true }
  #      or:
  #        { "zcam1": { "enableProving": true } }
  #      or:
  #        { "zcam1.enableProving": true }
  #
  zcam1_truthy = ->(v) { v == true || v.to_s == "1" || v.to_s.downcase == "true" }
  enable_proving_from_env = zcam1_truthy.call(ENV["ZCAM1_ENABLE_PROVING"])

  enable_proving_from_props = begin
    props_path = File.join(Pod::Config.instance.installation_root.to_s, "Podfile.properties.json")
    if File.exist?(props_path)
      props = JSON.parse(File.read(props_path))
      zcam1_truthy.call(props["ZCAM1_ENABLE_PROVING"]) ||
        zcam1_truthy.call(props["enableProving"])
    else
      false
    end
  rescue
    false
  end

  enable_proving = enable_proving_from_env || enable_proving_from_props

  source_files = [
    "ios/*.{h,m,mm,swift}",
    "cpp/*.{hpp,cpp,c,h}",
    "cpp/generated/*.{hpp,cpp,c,h}",
  ]
  public_header_files = ["ios/*.h"]

  vendored_frameworks = ["Zcam1Framework.xcframework"]

  if enable_proving
    source_files += [
      "ios/proving/*.{h,m,mm,swift}",
      "cpp/proving/*.{hpp,cpp,c,h}",
      "cpp/proving/generated/*.{hpp,cpp,c,h}",
    ]
    public_header_files += ["ios/proving/*.h"]

    vendored_frameworks += ["Zcam1ProvingFramework.xcframework"]
  end

  version = package["version"]
  base_url = "https://github.com/succinctlabs/zcam1-sdk/releases/download/v#{version}"

  # Proving framework download command, only included when proving is enabled.
  # Injected as a shell snippet into prepare_command via Ruby interpolation.
  download_proving_cmd = enable_proving ? <<~SHELL
    if [ ! -d "Zcam1ProvingFramework.xcframework" ]; then
      echo "Downloading Zcam1ProvingFramework.xcframework v#{version}..."
      curl -L "#{base_url}/Zcam1ProvingFramework.xcframework.zip" -o Zcam1ProvingFramework.xcframework.zip
      unzip -q Zcam1ProvingFramework.xcframework.zip
      rm Zcam1ProvingFramework.xcframework.zip
    elif [ -f "$MARKER" ] && [ "$(cat $MARKER)" != "#{version}" ]; then
      echo "Updating Zcam1ProvingFramework.xcframework to v#{version}..."
      rm -rf Zcam1ProvingFramework.xcframework
      curl -L "#{base_url}/Zcam1ProvingFramework.xcframework.zip" -o Zcam1ProvingFramework.xcframework.zip
      unzip -q Zcam1ProvingFramework.xcframework.zip
      rm Zcam1ProvingFramework.xcframework.zip
    fi
  SHELL
  : ""

  # Download xcframeworks from GitHub release artifacts before pod installation.
  # The version marker file ensures stale frameworks are replaced on version upgrades.
  # When frameworks are already present and up-to-date (Yalc, private npm), download is skipped.
  s.prepare_command = <<~SHELL
    MARKER=".xcframework-version"
    # If the folder is absent, download from GitHub release artifacts.
    # If the folder is present but the marker is absent, it came from Yalc or a private npm
    # registry (which includes the frameworks directly) — skip the download.
    # If the marker is present and the version differs, re-download (public npm upgrade).
    if [ ! -d "Zcam1Framework.xcframework" ]; then
      echo "Downloading Zcam1Framework.xcframework v#{version}..."
      curl -L "#{base_url}/Zcam1Framework.xcframework.zip" -o Zcam1Framework.xcframework.zip
      unzip -q Zcam1Framework.xcframework.zip
      rm Zcam1Framework.xcframework.zip
      echo "#{version}" > "$MARKER"
    elif [ -f "$MARKER" ] && [ "$(cat $MARKER)" != "#{version}" ]; then
      echo "Updating Zcam1Framework.xcframework to v#{version}..."
      rm -rf Zcam1Framework.xcframework
      curl -L "#{base_url}/Zcam1Framework.xcframework.zip" -o Zcam1Framework.xcframework.zip
      unzip -q Zcam1Framework.xcframework.zip
      rm Zcam1Framework.xcframework.zip
      echo "#{version}" > "$MARKER"
    fi
    #{download_proving_cmd}
  SHELL

  s.source_files = source_files
  # Only expose ObjC headers publicly (Swift can import these).
  s.public_header_files = public_header_files

  # Keep everything that contains C/C++ out of Swift's importer.
  s.private_header_files = "cpp/**/*.h", "cpp/**/*.hpp"

  s.frameworks = ["QuickLook"]
  s.vendored_frameworks = vendored_frameworks
  s.dependency    "uniffi-bindgen-react-native", "0.29.3-1"

  # Harbeth: GPU-accelerated image/video/camera filter library.
  s.dependency "Harbeth", "~> 1.1"

  # Use install_modules_dependencies helper to install the dependencies if React Native version >=0.71.0.
  # See https://github.com/facebook/react-native/blob/febf6b7f33fdb4904669f99d795eba4c0f95d7bf/scripts/cocoapods/new_architecture.rb#L79.
  if respond_to?(:install_modules_dependencies, true)
    install_modules_dependencies(s)
  else
    s.dependency "React-Core"

    # Don't install the dependencies when we run `pod install` in the old architecture.
    if ENV['RCT_NEW_ARCH_ENABLED'] == '1' then
      s.compiler_flags = folly_compiler_flags + " -DRCT_NEW_ARCH_ENABLED=1"
      s.pod_target_xcconfig    = {
          "HEADER_SEARCH_PATHS" => "\"$(PODS_ROOT)/boost\"",
          "OTHER_CPLUSPLUSFLAGS" => "-DFOLLY_NO_CONFIG -DFOLLY_MOBILE=1 -DFOLLY_USE_LIBCPP=1",
          "CLANG_CXX_LANGUAGE_STANDARD" => "c++17"
      }
      s.dependency "React-Codegen"
      s.dependency "RCT-Folly"
      s.dependency "RCTRequired"
      s.dependency "RCTTypeSafety"
      s.dependency "ReactCommon/turbomodule/core"
    end
  end
end
