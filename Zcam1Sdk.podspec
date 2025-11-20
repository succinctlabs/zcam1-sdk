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
  s.vendored_frameworks = "ios/C2PA/C2PAC.xcframework"

  install_modules_dependencies(s)

  # Download and extract C2PAC.xcframework before installation
  s.prepare_command = <<-CMD
    FRAMEWORK_URL="https://github.com/contentauth/c2pa-ios/releases/download/v0.0.7/C2PAC.xcframework.zip"
    DEST_DIR="ios/C2PA"
    FRAMEWORK_PATH="$DEST_DIR/C2PAC.xcframework"

    if [ -d "$FRAMEWORK_PATH" ]; then
      echo "✅ C2PAC.xcframework already exists, skipping download"
      exit 0
    fi

    echo "📦 Downloading C2PAC.xcframework..."
    mkdir -p "$DEST_DIR"

    if curl -L -o "$DEST_DIR/C2PAC.xcframework.zip" "$FRAMEWORK_URL"; then
      echo "📦 Download complete, extracting..."
      unzip -q "$DEST_DIR/C2PAC.xcframework.zip" -d "$DEST_DIR"
      rm "$DEST_DIR/C2PAC.xcframework.zip"
      echo "✅ C2PAC.xcframework extracted successfully"
    else
      echo "❌ Error downloading C2PAC.xcframework"
      exit 1
    fi
  CMD
end
