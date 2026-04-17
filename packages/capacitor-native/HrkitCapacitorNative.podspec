Pod::Spec.new do |s|
  s.name = 'HrkitCapacitorNative'
  s.version = '0.1.0'
  s.summary = 'Native Capacitor plugin for @hrkit (CoreBluetooth)'
  s.license = 'MIT'
  s.homepage = 'https://github.com/josedab/hrkit'
  s.author = '@hrkit contributors'
  s.source = { :git => 'https://github.com/josedab/hrkit.git', :tag => s.version.to_s }
  s.source_files = 'ios/Plugin/**/*.{swift,h,m}'
  s.ios.deployment_target = '14.0'
  s.dependency 'Capacitor'
  s.swift_version = '5.5'
end
