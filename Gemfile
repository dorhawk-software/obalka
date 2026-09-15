source 'https://rubygems.org'

# You may use http://rbenv.org/ or https://rvm.io/ to install and use this version.
# 3.1 because activesupport 7.2 requires it; the macOS system Ruby (2.6) is no longer enough.
ruby ">= 3.1.0"

# Exclude problematic versions of cocoapods and activesupport that causes build failures.
gem 'cocoapods', '>= 1.13', '!= 1.15.0', '!= 1.15.1'
# Floors, not the React Native template's lines. The template allows activesupport from 6.1.7.5 and
# caps concurrent-ruby below 1.3.4; every version that admits is affected by a published advisory
# (activesupport < 7.2.3.1: GHSA-2j26-frm8-cmj9, GHSA-89vf-4333-qx8v, GHSA-cg4j-q9v8-6v38;
# concurrent-ruby < 1.3.7: GHSA-h8w8-99g7-qmvj, GHSA-wv3x-4vxv-whpp, GHSA-6wx8-w4f5-wwcr).
# The same three activesupport advisories cover 8.0 before 8.0.4.1 and 8.1 before 8.1.2.1, which this
# floor admits. That is safe only while no CocoaPods can resolve activesupport 8: cocoapods-core
# requires < 8 in every release up to 1.17.0. If a release lifts that cap, raise the floor with it.
# The cap existed because concurrent-ruby 1.3.5 stopped loading `logger`, which broke activesupport
# before 7.1. 7.2 requires `logger` itself, so the cap has nothing left to protect. An RN upgrade
# that copies the template Gemfile back in brings the vulnerable ranges back with it;
# __tests__/security/dependencyAdvisories.test.ts fails when it does.
gem 'activesupport', '>= 7.2.3.1'
gem 'xcodeproj', '< 1.26.0'
gem 'concurrent-ruby', '>= 1.3.7'

# Ruby 3.4.0 has removed some libraries from the standard library.
gem 'bigdecimal'
gem 'logger'
gem 'benchmark'
gem 'mutex_m'
gem 'nkf'
