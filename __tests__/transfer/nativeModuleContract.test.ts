// The two native transfer modules are one contract (025 T022).
//
// Neither the Kotlin nor the Objective-C module can run in jest, and nothing else would notice them
// drifting apart until a phone did: a method renamed on one side, an event name spelled differently,
// a rejection code the TypeScript side does not know. So this reads the three sources as text and
// holds them to each other, and holds the iOS wiring - Podfile, podspec, build script, Info.plist,
// .gitignore - to the names the module and the scripts use.

import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '../..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

const KOTLIN = read('android/app/src/main/java/com/obalkadatovaschranka/transfer/TransferModule.kt');
const OBJC = read('ios/ObalkaTransferModule/ObalkaTransferModule.m');
const TS = read('src/services/transfer/nativeTransport.ts');
const PODSPEC = read('ios/ObalkaTransferModule/ObalkaTransferModule.podspec');
const PODFILE = read('ios/Podfile');
const XCFRAMEWORK_SCRIPT = read('scripts/build-transfer-xcframework.sh');

const sorted = (xs: Iterable<string>) => [...new Set(xs)].sort();

/** `@ReactMethod fun name(` */
const kotlinMethods = sorted(
  [...KOTLIN.matchAll(/@ReactMethod\s+fun\s+(\w+)\s*\(/g)].map(m => m[1]),
);
/** `RCT_EXPORT_METHOD(name` - the JavaScript name is the selector's first part. */
const objcMethods = sorted(
  [...OBJC.matchAll(/RCT_EXPORT_METHOD\(\s*(\w+)/g)].map(m => m[1]),
);
/** The methods of `interface NativeTransferModule`. */
const tsMethods = sorted(
  [
    ...(/interface NativeTransferModule \{([\s\S]*?)\n\}/.exec(TS)?.[1] ?? '').matchAll(
      /^\s*(\w+)\??\(/gm,
    ),
  ].map(m => m[1]),
);

describe('the native transfer modules', () => {
  it('export the same methods on both platforms, the ones the transport calls', () => {
    expect(tsMethods).toEqual(['available', 'cancel', 'keepScreenOn', 'receive', 'send']);
    expect(kotlinMethods).toEqual(tsMethods);
    expect(objcMethods).toEqual(tsMethods);
  });

  it('take the run id first, then the directory, the phrase and the local-only flag', () => {
    for (const which of ['send', 'receive']) {
      expect(KOTLIN).toMatch(
        new RegExp(`fun ${which}\\(runId: String, dir: String, secret: String, onlyLocal: Boolean,`),
      );
      expect(OBJC).toMatch(
        new RegExp(
          `RCT_EXPORT_METHOD\\(${which}\\s*:\\s*\\(NSString \\*\\)runId dir\\s*:\\s*\\(NSString \\*\\)dir secret\\s*:\\s*\\(NSString \\*\\)secret onlyLocal\\s*:\\s*\\(BOOL\\)onlyLocal`,
        ),
      );
    }
  });

  it('share the module name and the progress event', () => {
    const name = /NativeModules\.(\w+) as NativeTransferModule/.exec(TS)?.[1];
    const event = /const EVENT = '([^']+)'/.exec(TS)?.[1];
    expect(name).toBe('ObalkaTransfer');
    expect(KOTLIN).toContain(`const val NAME = "${name}"`);
    expect(OBJC).toContain(`RCT_EXPORT_MODULE(${name})`);
    expect(KOTLIN).toContain(`private const val EVENT = "${event}"`);
    expect(OBJC).toContain(`OBTEvent = @"${event}"`);
    for (const key of ['runId', 'stage', 'sent', 'total', 'relayed']) {
      expect(KOTLIN).toContain(`"${key}"`);
      expect(OBJC).toContain(`@"${key}"`);
    }
  });

  it('reject with the codes the transport tells apart', () => {
    // `failed` is everything else, so the transport reads it as the default rather than by name.
    for (const code of ['cancelled', 'phrase']) {
      expect(TS).toContain(`code === '${code}'`);
    }
    for (const code of ['cancelled', 'phrase', 'failed']) {
      expect(KOTLIN).toContain(`"${code}"`);
      expect(OBJC).toContain(`@"${code}"`);
    }
  });
});

describe('the iOS wiring', () => {
  it('builds the framework where the podspec looks for it, under the name the module imports', () => {
    const framework = /framework = '([^']+)'/.exec(PODSPEC)?.[1];
    expect(framework).toBe('Obalkatransfer.xcframework');
    expect(XCFRAMEWORK_SCRIPT).toContain('NAME=Obalkatransfer');
    expect(XCFRAMEWORK_SCRIPT).toContain('OUT="$ROOT/ios/ObalkaTransferModule/$NAME.xcframework"');
    expect(OBJC).toContain('#import <Obalkatransfer/Obalkatransfer.h>');
    expect(read('.gitignore')).toContain('ios/ObalkaTransferModule/Obalkatransfer.xcframework/');
  });

  it('compiles the module exactly when the podspec links the framework', () => {
    expect(PODSPEC).toMatch(/if linked[\s\S]*OBALKA_TRANSFER_LINKED=1[\s\S]*else/);
    expect(OBJC).toMatch(/^#if OBALKA_TRANSFER_LINKED$/m);
    expect(PODSPEC).toContain("s.source_files = '*.{h,m}'");
  });

  it('is a pod of the app target', () => {
    expect(PODFILE).toMatch(
      /target 'ObalkaDatovaSchranka' do[\s\S]*pod 'ObalkaTransferModule', :path => '\.\/ObalkaTransferModule'/,
    );
  });

  it('says why the app reaches the local network (the direct route between two phones)', () => {
    expect(read('ios/ObalkaDatovaSchranka/Info.plist')).toMatch(
      /<key>NSLocalNetworkUsageDescription<\/key>\s*<string>[^<]{20,}<\/string>/,
    );
  });
});
