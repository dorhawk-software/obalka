# The phone-to-phone transfer's iOS half (025 T022): the native module, and the Go archive it calls.
#
# A LOCAL pod, listed in ios/Podfile, rather than files in the Xcode project: CocoaPods already knows
# how to pick the device slice out of a vendored .xcframework, put its headers on the module's search
# path and link it into the app, and a podspec is a dozen readable lines where the same by hand is a
# set of pbxproj entries nobody reviews.
#
# `Obalkatransfer.xcframework` is built by scripts/build-transfer-xcframework.sh (macOS, Go) and is
# gitignored, like the Android .aar. Without it this pod compiles to nothing, so the app builds and
# runs with no transfer - `NativeModules.ObalkaTransfer` is simply absent and the screens hide the
# feature (FR-013), the way Android loads its archive reflectively. The presence check runs at
# `pod install`, so after building the framework run `pod install` again. CI, the sideload build and
# a release build it first and fail if it is missing.

require 'json'

framework = 'Obalkatransfer.xcframework'
linked = File.exist?(File.join(__dir__, framework, 'Info.plist'))
package = JSON.parse(File.read(File.join(__dir__, '..', '..', 'package.json')))

Pod::Spec.new do |s|
  s.name         = 'ObalkaTransferModule'
  s.version      = package['version']
  s.summary      = 'Phone-to-phone transfer (croc, through gomobile) for Obalka.'
  s.homepage     = 'https://github.com/dorhawk-software/obalka'
  s.license      = 'MIT'
  s.author       = 'The Obalka contributors'
  s.platforms    = { :ios => '15.5' }
  s.source       = { :path => '.' }
  s.source_files = '*.{h,m}'
  s.requires_arc = true

  if linked
    s.vendored_frameworks = framework
    # What the Go runtime inside the static archive calls into and nothing links for it: the resolver
    # (`net`, libresolv), and the system trust store (`crypto/x509`, Security + CoreFoundation).
    # A c-archive does not carry its #cgo LDFLAGS, so the app has to.
    s.frameworks = 'Foundation', 'Security', 'CoreFoundation'
    s.libraries = 'resolv'
    s.pod_target_xcconfig = { 'GCC_PREPROCESSOR_DEFINITIONS' => '$(inherited) OBALKA_TRANSFER_LINKED=1' }
    Pod::UI.puts "[025] ObalkaTransferModule: linking #{framework}"
  else
    Pod::UI.warn "[025] ObalkaTransferModule: #{framework} is missing - this build has NO " \
                 'phone-to-phone transfer. Build it with scripts/build-transfer-xcframework.sh ' \
                 '(macOS), then run pod install again.'
  end

  # React Native's own helper, as the app's other native modules use: with React Native's prebuilt core
  # (the default in 0.86) the React headers reach a pod through the dependency and header overlay it
  # adds. Called AFTER pod_target_xcconfig is set above, because it merges into that setting and a later
  # assignment would replace what it added.
  if respond_to?(:install_modules_dependencies, true)
    install_modules_dependencies(s)
  else
    s.dependency 'React-Core'
  end
end
